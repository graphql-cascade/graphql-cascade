# Performance Optimization

Best practices for high-performance GraphQL Cascade applications.

## Overview

GraphQL Cascade is designed for high performance, but following best practices ensures optimal results.

## Cascade Size Optimization

### 1. Limit Cascade Depth

Control how many levels of relationships are tracked:

```typescript
// Server configuration
const cascadeContext = createCascadeContext({
  maxDepth: 2 // Only track 2 levels of relationships
});

// Example:
// Level 0: Todo (directly modified)
// Level 1: TodoList (contains the todo)
// Level 2: User (owns the list)
// Level 3+: Not tracked
```

### 2. Use Selective Tracking

Only track entities that are frequently queried:

```typescript
// Only track entities in active use
context.cascade.trackUpdated('Todo', id, {
  propagate: shouldPropagate(id)
});

function shouldPropagate(id) {
  // Check if entity is in any active queries
  return cache.hasActiveQueries('Todo', id);
}
```

### 3. Batch Cascade Updates

Group multiple mutations into a single transaction:

```typescript
mutation BatchUpdateTodos($updates: [TodoUpdate!]!) {
  batchUpdateTodos(updates: $updates) {
    todos {
      id
      title
      completed
    }
    __cascade {
      # Single cascade for all updates
      updated { __typename id }
    }
  }
}
```

## Client-Side Optimization

### 1. Debounce Cascade Processing

For rapid-fire mutations, debounce cache updates:

```typescript
import { debounce } from 'lodash';

const cascadeLink = createCascadeLink({
  processCascade: debounce((cascade) => {
    applyCascade(cascade);
  }, 100)
});
```

### 2. Lazy Invalidation

Defer query refetches until the data is actually needed:

```typescript
const cascadeLink = createCascadeLink({
  invalidationStrategy: 'lazy' // Don't refetch immediately
});

// Query refetches automatically when component mounts
function TodoList() {
  const { data } = useQuery(GET_TODOS); // Refetches if invalidated
  // ...
}
```

### 3. Cache Persistence

Persist cascade metadata for offline support:

```typescript
const cache = new InMemoryCache({
  dataIdFromObject: (object) => `${object.__typename}:${object.id}`,
});

// Persist to localStorage
window.addEventListener('beforeunload', () => {
  localStorage.setItem('apollo-cache', JSON.stringify(cache.extract()));
});
```

## Server-Side Optimization

### 1. Efficient Entity Tracking

Use a lightweight tracking structure:

```typescript
class CascadeContext {
  private entities = new Map<string, Set<string>>();

  trackUpdated(typename: string, id: string) {
    if (!this.entities.has(typename)) {
      this.entities.set(typename, new Set());
    }
    this.entities.get(typename)!.add(id);
  }

  getCascade() {
    return {
      updated: Array.from(this.entities.entries()).flatMap(
        ([typename, ids]) =>
          Array.from(ids).map(id => ({ __typename: typename, id }))
      )
    };
  }
}
```

### 2. Database Query Optimization

Minimize database queries for cascade tracking:

```typescript
// Bad: N+1 queries
for (const todo of todos) {
  const list = await db.getTodoList(todo.listId);
  context.cascade.trackUpdated('TodoList', list.id);
}

// Good: Single query with joins
const lists = await db.query(`
  SELECT DISTINCT list_id
  FROM todos
  WHERE id IN (${todoIds.join(',')})
`);
lists.forEach(list => {
  context.cascade.trackUpdated('TodoList', list.id);
});
```

### 3. Cascade Compression

For large cascades, compress the response:

```typescript
import { gzip } from 'zlib';

// Server middleware
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (body.data?.__cascade && shouldCompress(body)) {
      body.data.__cascade = compressCascade(body.data.__cascade);
      res.setHeader('X-Cascade-Compressed', 'true');
    }
    return originalJson(body);
  };

  next();
});
```

## Monitoring and Metrics

### 1. Track Cascade Size

Monitor cascade payload sizes:

```typescript
const cascadeLink = createCascadeLink({
  onCascade: (cascade) => {
    const size = JSON.stringify(cascade).length;
    analytics.track('Cascade Processed', {
      entityCount: cascade.updated.length + cascade.created.length,
      payloadSize: size,
      invalidations: cascade.invalidated.length
    });
  }
});
```

### 2. Measure Cache Hit Rate

Track how often data is served from cache vs refetched:

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        todos: {
          read(existing, { args }) {
            const cacheHit = !!existing;
            analytics.track('Cache Read', {
              field: 'todos',
              hit: cacheHit
            });
            return existing;
          }
        }
      }
    }
  }
});
```

### 3. Profile Cascade Processing Time

Measure how long cascades take to process:

```typescript
const cascadeLink = createCascadeLink({
  onCascade: (cascade) => {
    const start = performance.now();
    applyCascade(cascade);
    const duration = performance.now() - start;

    if (duration > 16) { // Longer than one frame
      console.warn('Slow cascade processing:', duration, 'ms');
    }
  }
});
```

## Performance Benchmarks

### Target Metrics

- **Cascade overhead**: < 5% of total mutation time
- **Cache update time**: < 16ms (one frame at 60fps)
- **Cascade payload**: < 10KB for typical mutations
- **Memory overhead**: < 1MB for cascade tracking

### Measuring Performance

```typescript
// Benchmark cascade processing
import { performance } from 'perf_hooks';

const mutations = 1000;
const start = performance.now();

for (let i = 0; i < mutations; i++) {
  await createTodo({ variables: { title: `Todo ${i}` } });
}

const end = performance.now();
const avgTime = (end - start) / mutations;

console.log(`Average mutation time: ${avgTime.toFixed(2)}ms`);
console.log(`Throughput: ${(1000 / avgTime).toFixed(0)} mutations/sec`);
```

## Common Performance Issues

### Issue 1: Large Cascade Payloads

**Problem**: Cascades with hundreds of entities slow down response times.

**Solution**: Limit cascade depth or use pagination:

```typescript
const cascadeContext = createCascadeContext({
  maxDepth: 2,
  maxEntities: 100
});
```

### Issue 2: Excessive Refetching

**Problem**: Too many queries are marked for invalidation.

**Solution**: Be more selective about invalidation:

```typescript
// Don't invalidate queries that aren't affected
if (mutation.affectsSearchResults) {
  context.cascade.invalidate('Query', 'searchTodos');
}
```

### Issue 3: Slow Cache Updates

**Problem**: Cache updates block the UI thread.

**Solution**: Use async cache updates:

```typescript
const cascadeLink = createCascadeLink({
  asyncUpdates: true // Process cascades off the main thread
});
```

## Best Practices

1. **Start with defaults** - The default configuration is optimized for most use cases
2. **Monitor in production** - Track cascade sizes and processing times
3. **Profile before optimizing** - Identify actual bottlenecks before making changes
4. **Test with realistic data** - Ensure optimizations work with production-like datasets
5. **Benchmark regularly** - Track performance over time as the app grows

## Next Steps

- **[Client Integration](/clients/)** - Framework-specific optimization
- **[Server Implementation](/server/)** - Server-side performance tuning
- **[Specification](/specification/)** - Detailed performance requirements
