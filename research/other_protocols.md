# Other Protocols Analysis

**Date**: 2025-11-11
**Purpose**: Study URQL, React Query, and JSON:API to understand different approaches to cache management and data updates

---

## URQL (Universal React Query Library)

### Overview

URQL is a lightweight, flexible GraphQL client with two cache modes:
1. **Document Cache** (default) - Simple, no normalization
2. **Graphcache** (normalized) - Similar to Apollo/Relay

### Document Cache (Default)

**How it works**:
- Caches entire query results by query key
- No normalization - queries are independent
- Simple and fast

**Example**:
```typescript
const client = createClient({
  url: '/graphql',
  exchanges: [cacheExchange, fetchExchange]
});
```

**Pros**:
- ✅ Simple mental model
- ✅ Fast (no normalization overhead)
- ✅ Works well for simple apps

**Cons**:
- ❌ Data duplication (same entity in multiple queries)
- ❌ No automatic updates across queries
- ❌ High memory usage for large apps

**Mutation updates**:
```typescript
// Must invalidate entire queries
useMutation(CREATE_TODO, {
  onSuccess: () => {
    // Invalidate all queries containing todos
    client.invalidateQuery({ query: GET_TODOS });
    client.invalidateQuery({ query: SEARCH_TODOS });
  }
});
```

**Problem**: Must manually list every affected query.

### Graphcache (Normalized Cache)

**How it works**:
- Normalizes entities like Apollo (`__typename:id`)
- Automatic updates for simple mutations
- Manual updaters for complex cases

**Configuration**:
```typescript
import { cacheExchange as graphcacheExchange } from '@urql/exchange-graphcache';

const client = createClient({
  exchanges: [
    graphcacheExchange({
      keys: {
        User: data => data.id,
        Todo: data => data.id
      }
    }),
    fetchExchange
  ]
});
```

**Automatic updates**:
```graphql
mutation UpdateUser {
  updateUser(id: "123", input: { name: "New Name" }) {
    id
    name
    email
  }
}
```

If `User:123` exists, Graphcache merges automatically. ✅

**Manual updates for lists**:
```typescript
const client = createClient({
  exchanges: [
    graphcacheExchange({
      updates: {
        Mutation: {
          createTodo: (result, args, cache, info) => {
            // Manual update logic
            cache.updateQuery({ query: GET_TODOS }, data => {
              if (!data) return data;
              return {
                ...data,
                todos: [...data.todos, result.createTodo]
              };
            });
          }
        }
      }
    }),
    fetchExchange
  ]
});
```

**Pain points**:

1. **Similar boilerplate to Apollo**: Must write updaters for every mutation affecting lists
2. **Configuration complexity**: All updaters defined upfront in config (not colocated with mutations)
3. **Cache update API**: Different from Apollo (`cache.updateQuery` vs `cache.writeQuery`)

### Key Insight for GraphQL Cascade

URQL's **document cache** model is interesting: it embraces query-level invalidation rather than entity-level normalization.

**GraphQL Cascade could support both patterns**:
- **Normalized caches** (Apollo, Relay): Apply entity updates directly
- **Document caches** (URQL, React Query): Use invalidation hints to determine which queries to refetch

This is why Cascade includes **both** `updated` entities **and** `invalidations` hints.

---

## React Query (TanStack Query)

### Overview

React Query is **not** a GraphQL-specific library - it's a general-purpose data fetching/caching library. However, it's commonly used with GraphQL.

**Key difference**: React Query does **not** normalize by default. It caches queries by query key.

### Cache Model

```typescript
const { data } = useQuery({
  queryKey: ['todos', { filter: 'active' }],
  queryFn: () => fetchTodos({ filter: 'active' })
});
```

**Cache key**: `['todos', { filter: 'active' }]`
**Cache structure**: Entire query result stored under this key

### Mutation Updates

#### Pattern 1: Invalidation (Most Common)

```typescript
const mutation = useMutation({
  mutationFn: createTodo,
  onSuccess: () => {
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  }
});
```

**What happens**:
1. Mutation executes
2. All queries matching `['todos']` are marked stale
3. Active queries refetch automatically
4. Inactive queries refetch when accessed

**Pros**:
- ✅ Simple API
- ✅ Always correct (fresh from server)
- ✅ No manual data transformation

**Cons**:
- ❌ Network overhead (extra requests)
- ❌ Slower (wait for refetch)

#### Pattern 2: Optimistic Updates

```typescript
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['todos'] });

    // Snapshot previous value
    const previousTodos = queryClient.getQueryData(['todos']);

    // Optimistically update
    queryClient.setQueryData(['todos'], old => {
      return old.map(todo =>
        todo.id === newTodo.id ? newTodo : todo
      );
    });

    // Return rollback function
    return { previousTodos };
  },
  onError: (err, newTodo, context) => {
    // Rollback on error
    queryClient.setQueryData(['todos'], context.previousTodos);
  },
  onSettled: () => {
    // Refetch after error or success
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  }
});
```

**Pain points**:

1. **Complex optimistic update logic**: Must handle rollback manually
2. **Query key matching**: Must know all affected query keys
3. **Data transformation**: Must manually apply updates to query data
4. **No normalization**: If same entity appears in multiple queries, must update each

#### Pattern 3: Direct Cache Updates

```typescript
const mutation = useMutation({
  mutationFn: createTodo,
  onSuccess: (newTodo) => {
    // Directly update cache
    queryClient.setQueryData(['todos'], old => {
      return [...old, newTodo];
    });

    // Update related queries too
    queryClient.setQueryData(['todos', { filter: 'active' }], old => {
      if (newTodo.status === 'active') {
        return [...old, newTodo];
      }
      return old;
    });

    // Update search queries
    queryClient.setQueriesData(
      { queryKey: ['search'] },
      old => {
        // Transform search results to include new todo
        return transformSearchResults(old, newTodo);
      }
    );
  }
});
```

**Pain points**:

1. **Must update all affected queries**: No automatic propagation
2. **Query key proliferation**: Tracking all keys that might contain entity
3. **Data structure assumptions**: Must know exact structure of each query's data
4. **Immutability**: Must create new objects (like Apollo)

### Automatic Invalidation Patterns

React Query doesn't provide built-in automatic invalidation, but developers can implement it using **global mutation callbacks**:

```typescript
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (data, variables, context, mutation) => {
      // Global callback for all mutations
      const mutationType = mutation.options.mutationType;

      switch (mutationType) {
        case 'createTodo':
          queryClient.invalidateQueries({ queryKey: ['todos'] });
          break;
        case 'updateUser':
          queryClient.invalidateQueries({ queryKey: ['users'] });
          queryClient.invalidateQueries({ queryKey: ['user', variables.id] });
          break;
        // ... more cases
      }
    }
  })
});
```

**Problem**: Developers must implement this mapping themselves. **GraphQL Cascade solves this by having the server provide invalidation hints.**

### Key Insight for GraphQL Cascade

React Query's **query invalidation pattern** is elegant for document caches. GraphQL Cascade's `invalidations` array maps perfectly to React Query's model:

```typescript
// Cascade response:
{
  cascade: {
    invalidations: [
      { queryName: 'listTodos', strategy: 'INVALIDATE', scope: 'PREFIX' },
      { queryName: 'getUser', arguments: { id: '123' }, strategy: 'REFETCH', scope: 'EXACT' }
    ]
  }
}

// React Query integration:
cascade.invalidations.forEach(inv => {
  if (inv.strategy === 'INVALIDATE') {
    queryClient.invalidateQueries({ queryKey: [inv.queryName, inv.arguments] });
  } else if (inv.strategy === 'REFETCH') {
    queryClient.refetchQueries({ queryKey: [inv.queryName, inv.arguments] });
  }
});
```

---

## JSON:API (REST Specification)

### Overview

JSON:API is a **REST** specification (not GraphQL), but it's highly relevant because it solves the **same problem**: returning related data efficiently.

**Key concepts**:
- Resource objects (entities)
- Relationships (links between resources)
- Included resources (side-loaded related data)

### Format Structure

```json
{
  "data": {
    "type": "articles",
    "id": "1",
    "attributes": {
      "title": "JSON:API paints my bikeshed!"
    },
    "relationships": {
      "author": {
        "data": { "type": "people", "id": "9" }
      },
      "comments": {
        "data": [
          { "type": "comments", "id": "5" },
          { "type": "comments", "id": "12" }
        ]
      }
    }
  },
  "included": [
    {
      "type": "people",
      "id": "9",
      "attributes": {
        "name": "Dan Gebhardt"
      }
    },
    {
      "type": "comments",
      "id": "5",
      "attributes": {
        "body": "First!"
      }
    },
    {
      "type": "comments",
      "id": "12",
      "attributes": {
        "body": "Great article!"
      }
    }
  ]
}
```

### Key Features

1. **Primary Resource** (`data`):
   - The main entity being requested
   - Includes `relationships` with resource identifiers (type + id)

2. **Side-Loaded Resources** (`included`):
   - Array of related resources
   - Identified by type + id
   - Complete resource objects with all attributes

3. **Include Parameter**:
   ```
   GET /articles/1?include=author,comments
   ```
   Tells server which relationships to side-load

### Comparison with GraphQL Cascade

JSON:API's `included` array is **exactly analogous** to GraphQL Cascade's `cascade.updated` array:

| JSON:API | GraphQL Cascade |
|----------|-----------------|
| `data` | Primary mutation result (`data`) |
| `included` | Side-loaded updates (`cascade.updated`) |
| `include` query param | Server-side cascade tracking (automatic) |
| Resource identifier (`type` + `id`) | Entity identifier (`__typename` + `id`) |

**Key difference**: JSON:API requires the **client** to request side-loading via `?include=author,comments`. GraphQL Cascade **automatically determines** what to include based on the mutation's effects.

### Advantages of JSON:API Approach

1. ✅ **Standard format**: Widely adopted REST specification
2. ✅ **Explicit side-loading**: Client controls data loading
3. ✅ **Normalized cache-friendly**: type + id enables easy normalization

### Disadvantages

1. ❌ **REST-specific**: Doesn't leverage GraphQL's type system
2. ❌ **Client must specify includes**: Extra complexity
3. ❌ **No invalidation hints**: No guidance on what queries to refresh

### Key Insight for GraphQL Cascade

JSON:API proves that **returning related resources in a side-loaded array** is a successful pattern in production systems. GraphQL Cascade applies this same pattern to GraphQL mutations:

**JSON:API (REST)**:
```json
{
  "data": { "type": "articles", "id": "1", "attributes": {...} },
  "included": [
    { "type": "people", "id": "9", "attributes": {...} },
    { "type": "comments", "id": "5", "attributes": {...} }
  ]
}
```

**GraphQL Cascade (GraphQL)**:
```json
{
  "data": { "__typename": "Article", "id": "1", "title": "...", ... },
  "cascade": {
    "updated": [
      { "__typename": "Person", "id": "9", "entity": {...} },
      { "__typename": "Comment", "id": "5", "entity": {...} }
    ]
  }
}
```

The pattern is proven and familiar to many developers.

---

## Comparison Matrix

| Feature | URQL Document | URQL Graphcache | React Query | JSON:API | GraphQL Cascade |
|---------|--------------|-----------------|-------------|----------|-----------------|
| **Cache Model** | Document cache | Normalized | Document cache | N/A (REST) | Normalized + Invalidation |
| **Automatic Updates** | ❌ No | ✅ Simple cases | ❌ No | N/A | ✅ All cases |
| **Manual Updates** | Invalidate queries | Updaters | setQueryData | N/A | Not needed |
| **Side-Loading** | ❌ No | ❌ No | ❌ No | ✅ `included` array | ✅ `cascade.updated` |
| **Invalidation** | Manual | Manual | Manual | N/A | ✅ Automatic hints |
| **Boilerplate** | Medium | Medium | Medium | N/A | ✅ Zero |
| **Learning Curve** | Low | Medium | Low | Low | ✅ Very Low |

---

## Key Takeaways for GraphQL Cascade

### 1. **Support Multiple Cache Models**

GraphQL Cascade should work with:
- **Normalized caches** (Apollo, Relay, URQL Graphcache): Apply entity updates directly
- **Document caches** (URQL default, React Query): Use invalidation hints

This is why Cascade includes **both**:
```json
{
  "cascade": {
    "updated": [...],      // For normalized caches
    "invalidations": [...]  // For document caches
  }
}
```

### 2. **Invalidation is Critical**

React Query and URQL document cache prove that **query invalidation** is a valid, performant strategy. GraphQL Cascade's `invalidations` array enables this pattern without manual query enumeration.

### 3. **Side-Loading Pattern is Proven**

JSON:API demonstrates that returning related resources in a side-loaded array works at scale. GraphQL Cascade applies this pattern to mutations.

### 4. **Automatic is Better than Manual**

All these libraries require **manual work**:
- URQL: Write updaters or invalidate queries
- React Query: Implement invalidation logic
- JSON:API: Client specifies includes

GraphQL Cascade eliminates manual work by having the **server automatically determine** what changed and what to invalidate.

### 5. **Framework Agnostic**

GraphQL Cascade's response format should work with **any** client library:
- Apollo Client ✅
- Relay Modern ✅
- URQL (both modes) ✅
- React Query ✅
- Custom clients ✅

By providing both normalized entity updates and invalidation hints, Cascade accommodates all caching strategies.

---

## References

- [URQL Graphcache Documentation](https://commerce.nearform.com/open-source/urql/docs/graphcache/)
- [React Query Documentation](https://tanstack.com/query/latest/docs)
- [TkDodo's Blog: Automatic Query Invalidation](https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations)
- [JSON:API Specification](https://jsonapi.org/format/)

---

## Conclusion

Studying URQL, React Query, and JSON:API reveals that:

1. **Multiple cache strategies exist**: Normalized and document caches both have merit
2. **Invalidation is a first-class concern**: Not just an afterthought
3. **Side-loading patterns work**: JSON:API proves this at scale
4. **Manual updates are ubiquitous**: Every library requires them (pain point!)

**GraphQL Cascade** synthesizes the best ideas from all these approaches:
- Entity updates (from Apollo/Relay normalization)
- Query invalidation (from React Query pattern)
- Side-loading (from JSON:API)
- Automatic determination (new contribution)

The result: **Zero-boilerplate cache updates** that work with any client library.
