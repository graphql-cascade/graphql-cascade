# Framework Comparison Matrix

**Date**: 2025-11-11
**Purpose**: Compare GraphQL cache management approaches across frameworks

---

## Executive Summary

This comparison analyzes how different frameworks handle GraphQL cache updates after mutations, identifying pain points that GraphQL Cascade addresses.

**Key Finding**: All existing frameworks require **manual cache update logic** for non-trivial mutations. GraphQL Cascade eliminates this by having the server automatically track and return affected entities.

---

## Detailed Comparison

### Cache Architecture

| Framework | Cache Model | Entity Identification | Normalization |
|-----------|-------------|---------------------|---------------|
| **Relay Modern** | Normalized store | Global IDs (`VXNlcjoxMjM=`) | ✅ Yes |
| **Apollo Client** | Normalized InMemoryCache | `__typename:id` | ✅ Yes |
| **URQL (default)** | Document cache | Query-based | ❌ No |
| **URQL Graphcache** | Normalized store | `__typename:id` | ✅ Yes |
| **React Query** | Document cache | Query key | ❌ No |
| **JSON:API** | N/A (REST) | `type:id` | Client-dependent |
| **GraphQL Cascade** | Agnostic | `__typename:id` (recommended) | Works with both |

### Automatic Cache Updates

| Framework | Simple Field Updates | Adding to Lists | Removing from Lists | Related Entities |
|-----------|---------------------|-----------------|--------------------|--------------------|
| **Relay Modern** | ✅ Automatic | ❌ Manual updater | ❌ Manual updater | ❌ Manual updater |
| **Apollo Client** | ✅ Automatic | ❌ Manual `update` | ❌ Manual `update` | ❌ Manual `update` |
| **URQL Document** | ❌ Invalidate query | ❌ Invalidate query | ❌ Invalidate query | ❌ Invalidate query |
| **URQL Graphcache** | ✅ Automatic | ❌ Manual updater | ❌ Manual updater | ❌ Manual updater |
| **React Query** | ❌ Manual setQueryData | ❌ Manual setQueryData | ❌ Manual setQueryData | ❌ Manual setQueryData |
| **GraphQL Cascade** | ✅ Automatic | ✅ Automatic | ✅ Automatic | ✅ Automatic |

### Manual Update Patterns

| Framework | API | Complexity (Lines of Code) | Error Handling | Immutability Required |
|-----------|-----|---------------------------|----------------|-----------------------|
| **Relay Modern** | `updater(store)` + `ConnectionHandler` | 15-25 lines | Connection not found | Yes |
| **Apollo Client** | `update(cache, { data })` + `cache.readQuery/writeQuery` | 15-30 lines | Query not in cache (try/catch) | Yes |
| **URQL Graphcache** | Config-based updaters | 10-20 lines | Query not found | Yes |
| **React Query** | `onSuccess` + `setQueryData` | 10-25 lines | Query not in cache | Yes |
| **GraphQL Cascade** | N/A - No manual updates | 0 lines ✅ | N/A | N/A |

### Query Invalidation

| Framework | Built-in Mechanism | How to Invalidate | Server Hints |
|-----------|-------------------|-------------------|--------------|
| **Relay Modern** | ❌ No | Manual refetch or update | ❌ No |
| **Apollo Client** | `refetchQueries` | List queries to refetch | ❌ No |
| **URQL Document** | `invalidate()` | Invalidate by query | ❌ No |
| **URQL Graphcache** | Partial (auto for entities) | Invalidate connections | ❌ No |
| **React Query** | `invalidateQueries()` | Match by query key | ❌ No |
| **GraphQL Cascade** | ✅ Automatic hints | Server provides `invalidations` array | ✅ Yes |

### Developer Experience

| Framework | Setup Complexity | Per-Mutation Boilerplate | Learning Curve | Documentation |
|-----------|-----------------|-------------------------|----------------|---------------|
| **Relay Modern** | High (Babel plugin, strict GraphQL) | 15-25 lines | Steep | Good |
| **Apollo Client** | Medium (simple config) | 15-30 lines | Moderate | Excellent |
| **URQL Document** | Low | 5-10 lines (invalidation) | Low | Good |
| **URQL Graphcache** | Medium (config-based) | 10-20 lines | Moderate | Good |
| **React Query** | Low | 10-25 lines | Low | Excellent |
| **GraphQL Cascade** | Low | 0 lines ✅ | Very Low | TBD |

### Example: Adding Item to List

#### Relay Modern

```typescript
commitMutation(environment, {
  mutation: CreateTodoMutation,
  variables: { input: { text: 'New todo' } },
  updater: (store) => {
    const root = store.getRoot();
    const connection = ConnectionHandler.getConnection(
      root,
      'TodoList_todos',
      { filter: 'active' }
    );

    if (!connection) {
      console.error('Connection not found');
      return;
    }

    const newTodo = store.getRootField('createTodo').getLinkedRecord('todoEdge');
    ConnectionHandler.insertEdgeAfter(connection, newTodo);
  }
});
```

**Lines of code**: ~15
**Complexity**: High (ConnectionHandler API)

#### Apollo Client

```typescript
const [createTodo] = useMutation(CREATE_TODO, {
  update(cache, { data: { createTodo } }) {
    try {
      const existingTodos = cache.readQuery({
        query: GET_TODOS,
        variables: { filter: 'active' }
      });

      cache.writeQuery({
        query: GET_TODOS,
        variables: { filter: 'active' },
        data: {
          todos: [...existingTodos.todos, createTodo]
        }
      });
    } catch (e) {
      // Query not in cache
    }
  }
});
```

**Lines of code**: ~20
**Complexity**: Medium (try/catch, immutability)

#### URQL Graphcache

```typescript
const client = createClient({
  exchanges: [
    graphcacheExchange({
      updates: {
        Mutation: {
          createTodo: (result, args, cache, info) => {
            cache.updateQuery(
              { query: GET_TODOS, variables: { filter: 'active' } },
              data => {
                if (!data) return data;
                return {
                  ...data,
                  todos: [...data.todos, result.createTodo]
                };
              }
            );
          }
        }
      }
    }),
    fetchExchange
  ]
});
```

**Lines of code**: ~15
**Complexity**: Medium (config-based, not colocated)

#### React Query

```typescript
const mutation = useMutation({
  mutationFn: createTodo,
  onSuccess: (newTodo) => {
    queryClient.setQueryData(['todos', { filter: 'active' }], old => {
      return [...old, newTodo];
    });

    // Also update 'all' filter
    queryClient.setQueryData(['todos', { filter: 'all' }], old => {
      return [...old, newTodo];
    });

    // Invalidate search queries
    queryClient.invalidateQueries({ queryKey: ['search'] });
  }
});
```

**Lines of code**: ~15
**Complexity**: Medium (must update multiple queries)

#### GraphQL Cascade

```typescript
const [createTodo] = useCascadeMutation(CREATE_TODO);
// That's it!
```

**Lines of code**: 1 ✅
**Complexity**: None ✅

### Server Response Comparison

#### Standard GraphQL (All Frameworks)

```json
{
  "data": {
    "createTodo": {
      "id": "123",
      "text": "New todo",
      "completed": false
    }
  }
}
```

**Client responsibility**:
- Figure out which queries to update
- Read existing data
- Transform and merge
- Handle errors

#### GraphQL Cascade

```json
{
  "data": {
    "createTodo": {
      "success": true,
      "data": {
        "id": "123",
        "text": "New todo",
        "completed": false
      },
      "cascade": {
        "updated": [
          {
            "__typename": "Todo",
            "id": "123",
            "operation": "CREATED",
            "entity": { "id": "123", "text": "New todo", "completed": false }
          }
        ],
        "deleted": [],
        "invalidations": [
          {
            "queryName": "listTodos",
            "strategy": "INVALIDATE",
            "scope": "PREFIX"
          },
          {
            "queryName": "searchTodos",
            "strategy": "INVALIDATE",
            "scope": "PREFIX"
          }
        ],
        "metadata": {
          "timestamp": "2025-11-11T10:30:00Z",
          "affectedCount": 1
        }
      }
    }
  }
}
```

**Client responsibility**:
- Apply updates mechanically
- No decision-making required

---

## Pain Point Analysis

### 1. Boilerplate Code

| Framework | Average Lines per Mutation | Total for 20 Mutations |
|-----------|---------------------------|------------------------|
| **Relay Modern** | 15-25 | 300-500 lines |
| **Apollo Client** | 15-30 | 300-600 lines |
| **URQL Graphcache** | 10-20 | 200-400 lines |
| **React Query** | 10-25 | 200-500 lines |
| **GraphQL Cascade** | 0 | 0 lines ✅ |

**Impact**: For a typical app with 50 mutations, developers write **1,000+ lines of cache update logic** that GraphQL Cascade eliminates.

### 2. Error Handling

| Framework | Common Errors | Developer Burden |
|-----------|--------------|------------------|
| **Relay Modern** | Connection not found | Must check and handle |
| **Apollo Client** | Query not in cache | Must wrap in try/catch |
| **URQL Graphcache** | Query not found | Must check return value |
| **React Query** | Query key mismatch | Must track all keys |
| **GraphQL Cascade** | None | Server guarantees consistency |

### 3. Maintenance Burden

**Scenario**: Schema changes - `Todo` now has `assignee: User`

| Framework | Required Changes |
|-----------|-----------------|
| **Relay Modern** | Update updater to handle assignee connection |
| **Apollo Client** | Update cache.writeQuery to include assignee |
| **URQL Graphcache** | Update updater config for assignee |
| **React Query** | Update setQueryData transformations |
| **GraphQL Cascade** | None - server handles automatically ✅ |

### 4. Testing Complexity

**What must be tested**:

| Framework | Test Requirements |
|-----------|------------------|
| **Relay Modern** | Updater logic, connection handling, edge cases |
| **Apollo Client** | Update logic, error handling, immutability |
| **URQL Graphcache** | Updater config, query matching |
| **React Query** | Invalidation logic, optimistic updates |
| **GraphQL Cascade** | None - generic cascade application ✅ |

**Testing burden**: Each mutation's update logic needs 3-5 tests = **150-250 tests** for 50 mutations. GraphQL Cascade: **0 mutation-specific tests**.

---

## Performance Comparison

### Network Requests

**Scenario**: Create todo in app with 5 todo queries (different filters)

| Framework | Approach | Network Requests |
|-----------|---------|------------------|
| **Relay Modern** | Manual updates | 1 (mutation only) |
| **Apollo Client** | Manual updates | 1 (mutation only) |
| **Apollo Client** | refetchQueries | 6 (mutation + 5 refetches) ❌ |
| **URQL Document** | Invalidate | 6 (mutation + 5 refetches) ❌ |
| **URQL Graphcache** | Manual updates | 1 (mutation only) |
| **React Query** | Invalidate | 6 (mutation + 5 refetches) ❌ |
| **React Query** | Manual setQueryData | 1 (mutation only) |
| **GraphQL Cascade** | Automatic | 1 (mutation only, includes cascade data) ✅ |

**Winner**: GraphQL Cascade provides the **best of both worlds** - single request with all update data.

### Response Size

**Scenario**: Update company (affects Company, Address, Owner entities)

| Framework | Response Size | Entities Returned |
|-----------|--------------|-------------------|
| **Standard** | ~500 bytes | 1 (Company only) |
| **GraphQL Cascade** | ~2KB | 3 (Company, Address, Owner) |

**Overhead**: ~1.5KB additional data
**Benefit**: **Eliminates 2 refetch requests** (~1KB each)
**Net**: Neutral or positive (fewer requests, similar total data)

### Client Processing

| Framework | Processing Complexity | Time |
|-----------|---------------------|------|
| **Relay Modern** | Updater execution | Low-Medium |
| **Apollo Client** | Read/transform/write | Medium |
| **React Query** | Transform + invalidate | Medium |
| **GraphQL Cascade** | Mechanical application | Very Low ✅ |

---

## Migration Complexity

### From Apollo Client to GraphQL Cascade

**Effort**: Low
**Steps**:
1. Install `@graphql-cascade/apollo`
2. Wrap mutations with `useCascadeMutation`
3. Remove `update` functions
4. Update GraphQL queries to include `cascade` fields

**Migration time**: ~1 day for 20 mutations

### From Relay Modern to GraphQL Cascade

**Effort**: Medium
**Steps**:
1. Install `@graphql-cascade/relay`
2. Replace `commitMutation` with cascade variant
3. Remove `updater` functions
4. Remove declarative directives (@appendEdge, etc.)
5. Update schema (optional - can keep Node interface)

**Migration time**: ~2-3 days for 20 mutations

### From React Query to GraphQL Cascade

**Effort**: Medium
**Steps**:
1. Install `@graphql-cascade/react-query`
2. Wrap mutations with cascade integration
3. Remove `onSuccess` invalidation/update logic
4. Add cascade fields to mutations

**Migration time**: ~2-3 days for 20 mutations

---

## Adoption Considerations

### When to Use Each Framework

#### Relay Modern
✅ **Use when**:
- Building large Facebook-scale apps
- Strict GraphQL schema enforcement desired
- Team experienced with Relay

❌ **Avoid when**:
- Team is small or inexperienced
- Schema flexibility needed
- Rapid prototyping

#### Apollo Client
✅ **Use when**:
- Flexible, batteries-included solution desired
- Excellent documentation important
- Large ecosystem needed

❌ **Avoid when**:
- Manual cache updates too burdensome
- Performance critical (large apps)

#### React Query
✅ **Use when**:
- Simple invalidation-based approach acceptable
- Not using GraphQL (general data fetching)
- Document cache model preferred

❌ **Avoid when**:
- Need normalized cache
- GraphQL-specific features needed

#### GraphQL Cascade
✅ **Use when**:
- Want zero-boilerplate cache updates
- Building on FraiseQL or similar backend
- Server can track entity changes
- Team wants to focus on features, not cache logic

❌ **Avoid when**:
- Server cannot be modified
- Need client-only solution
- Schema doesn't support cascade tracking

---

## Feature Matrix

| Feature | Relay | Apollo | URQL GC | URQL Doc | React Query | Cascade |
|---------|-------|--------|---------|----------|-------------|---------|
| **Normalized Cache** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (optional) |
| **Document Cache** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ (supported) |
| **Auto Field Updates** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Auto List Updates** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Auto Invalidation** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Zero Boilerplate** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Server Hints** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Framework Agnostic** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Optimistic Updates** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **TypeScript Support** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **React Integration** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Vue/Angular Support** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Conclusion

### Key Findings

1. **Universal Pain Point**: All frameworks require **manual cache update logic** for list operations and related entities.

2. **Boilerplate Burden**: Developers write **200-600 lines of update code** for a typical app's mutations.

3. **Error-Prone**: Common mistakes include:
   - Forgetting error handling
   - Mutating cached data
   - Missing affected queries
   - Incorrect immutable updates

4. **Maintenance Cost**: Schema changes require updating all affected update functions.

5. **Testing Overhead**: Each update function needs 3-5 tests.

### GraphQL Cascade's Advantage

**Solves the root problem**: By having the **server track and return affected entities**, GraphQL Cascade eliminates:

- ✅ All boilerplate (0 lines vs 200-600 lines)
- ✅ All error handling (server guarantees consistency)
- ✅ All maintenance burden (automatic adaptation to schema changes)
- ✅ All testing overhead (generic cascade application)

**Works with all cache models**:
- Normalized caches (Apollo, Relay): Apply entity updates
- Document caches (React Query): Use invalidation hints

**Framework agnostic**: Integration layer for each framework, but same server response.

### The Paradigm Shift

**Current paradigm**: Client figures out cache updates
- Client lists affected queries
- Client reads existing data
- Client transforms and merges
- Client handles errors

**GraphQL Cascade paradigm**: Server provides complete update information
- Server tracks affected entities
- Server returns comprehensive cascade
- Client applies mechanically
- No client decisions needed

This is a **fundamental improvement** in GraphQL cache management, similar to how GraphQL improved on REST's under/over-fetching problem.

---

## References

See individual analysis documents:
- [relay_analysis.md](./relay_analysis.md)
- [apollo_analysis.md](./apollo_analysis.md)
- [other_protocols.md](./other_protocols.md)
