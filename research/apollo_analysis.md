# Apollo Client Analysis

**Date**: 2025-11-11
**Purpose**: Understand Apollo Client's approach to cache management and mutation updates

---

## Overview

Apollo Client is the most popular GraphQL client library, known for:
- Simple API and gentle learning curve
- Flexible caching with `InMemoryCache`
- React integration with hooks
- Broad ecosystem support

Unlike Relay's opinionated approach, Apollo is designed to be flexible and work with any GraphQL schema.

## Cache Architecture

### Normalization with `__typename` + `id`

Apollo uses a simpler normalization strategy than Relay:

```typescript
new InMemoryCache({
  typePolicies: {
    // Default: Use __typename:id as cache key
    User: {
      keyFields: ['id']  // Cache key: "User:123"
    },
    Company: {
      keyFields: ['id']  // Cache key: "Company:456"
    }
  }
})
```

**How it works**:
1. Every query result with `__typename` and `id` gets normalized
2. Cache key format: `"TypeName:idValue"` (e.g., `"User:123"`)
3. Objects with the same cache key are merged automatically

**Pros**:
- ✅ Simple to understand (no ID encoding)
- ✅ Works with natural database IDs
- ✅ Flexible (custom `keyFields` per type)
- ✅ No schema changes required (unlike Relay's Node interface)

**Cons**:
- ❌ Namespace collisions possible if IDs overlap across types
- ❌ No generic `node(id)` query pattern
- ❌ Custom `keyFields` can be complex for nested identifiers

### Automatic Merging

Like Relay, Apollo automatically merges mutation responses:

```graphql
mutation UpdateUser {
  updateUser(id: "123", input: { name: "New Name" }) {
    id          # Cache key: User:123
    name        # Automatically merged
    email
  }
}
```

If `User:123` exists in cache, Apollo merges the fields. **No manual code required.**

**Limitation**: Only works for the **returned entities**. Related entities, lists, and cascading effects require manual updates.

## Mutation Update Patterns

### 1. The `update` Function (Manual Cache Updates)

Apollo mutations accept an `update` function for manual cache manipulation:

```typescript
const [updateUser] = useMutation(UPDATE_USER, {
  update(cache, { data }) {
    // Manual cache update logic here
  }
});
```

### 2. Common Patterns and Their Complexity

#### Pattern A: `cache.readQuery` + `cache.writeQuery`

The most common pattern for updating lists:

```typescript
const [createTodo] = useMutation(CREATE_TODO, {
  update(cache, { data: { createTodo } }) {
    // 1. Read existing query
    const existingTodos = cache.readQuery({
      query: GET_TODOS
    });

    // 2. Create new array with new item
    const newTodos = [...existingTodos.todos, createTodo];

    // 3. Write back to cache
    cache.writeQuery({
      query: GET_TODOS,
      data: { todos: newTodos }
    });
  }
});
```

**Problems**:

1. **Query not in cache error**:
   ```typescript
   // Crashes if query hasn't been run yet!
   const existingTodos = cache.readQuery({ query: GET_TODOS });
   ```

   **Solution**: Wrap in try/catch (boilerplate):
   ```typescript
   try {
     const existingTodos = cache.readQuery({ query: GET_TODOS });
     // ...
   } catch (e) {
     // Query not in cache, ignore
   }
   ```

2. **Immutability requirements**:
   ```typescript
   // ❌ WRONG - mutates cached data
   existingTodos.todos.push(createTodo);

   // ✅ CORRECT - create new array
   const newTodos = [...existingTodos.todos, createTodo];
   ```
   Apollo throws errors if you mutate the return value of `readQuery`.

3. **Variable matching complexity**:
   ```typescript
   // Must match variables exactly
   cache.readQuery({
     query: GET_TODOS,
     variables: { filter: 'active', limit: 10 }  // Must match original query!
   });
   ```

   If your app has multiple queries with different variables, you need to update **all of them**:
   ```typescript
   // Update all relevant queries
   const filtersToUpdate = ['active', 'completed', 'all'];
   filtersToUpdate.forEach(filter => {
     try {
       const existing = cache.readQuery({
         query: GET_TODOS,
         variables: { filter, limit: 10 }
       });
       cache.writeQuery({
         query: GET_TODOS,
         variables: { filter, limit: 10 },
         data: { todos: [...existing.todos, createTodo] }
       });
     } catch (e) {
       // Query not in cache
     }
   });
   ```

4. **Multiple queries to update**:
   - User list query
   - User search query
   - Admin user query
   - ... each needs individual update logic

#### Pattern B: `cache.modify` (Newer, More Direct)

Apollo 3.0+ introduced `cache.modify` for targeted updates:

```typescript
const [updateTodo] = useMutation(UPDATE_TODO, {
  update(cache, { data: { updateTodo } }) {
    cache.modify({
      id: cache.identify({ __typename: 'Todo', id: updateTodo.id }),
      fields: {
        completed(existing) {
          return updateTodo.completed;
        },
        text(existing) {
          return updateTodo.text;
        }
      }
    });
  }
});
```

**Problems**:

1. **Doesn't work for lists**: `cache.modify` is for updating fields on specific objects, not for adding/removing from lists

2. **Returns false silently**: If the cache ID is wrong, `cache.modify` returns `false` with no error:
   ```typescript
   const success = cache.modify({ ... });
   if (!success) {
     // Object not found, but why?
   }
   ```

3. **Still requires manual field enumeration**: You must list every field to update

#### Pattern C: `cache.evict` (Nuclear Option)

When updates are too complex, developers just evict stale data:

```typescript
const [deleteTodo] = useMutation(DELETE_TODO, {
  update(cache, { data: { deleteTodo } }) {
    // Remove from cache
    cache.evict({
      id: cache.identify({ __typename: 'Todo', id: deleteTodo.id })
    });

    // Garbage collect orphaned references
    cache.gc();
  }
});
```

**Problems**:

1. **Doesn't update lists**: Evicted object is removed, but list queries still reference it
2. **Requires garbage collection**: Must call `cache.gc()` to clean up
3. **Forces refetch**: Next access to that query will trigger network request

### 3. The `refetchQueries` Alternative

Many developers give up on manual updates and just refetch:

```typescript
const [createTodo] = useMutation(CREATE_TODO, {
  refetchQueries: [
    { query: GET_TODOS },
    { query: GET_TODOS, variables: { filter: 'active' } },
    { query: SEARCH_TODOS, variables: { q: '' } }
  ]
});
```

**Pros**:
- ✅ Simple to implement
- ✅ Always correct (fresh from server)

**Cons**:
- ❌ Network overhead (extra requests)
- ❌ Slower user experience
- ❌ Server load

## Real-World Pain Points

### 1. **Massive Boilerplate**

Every mutation that modifies a list requires 15-30 lines of update logic:

```typescript
// For EVERY mutation affecting a list:
update(cache, { data }) {
  // 1. Try to read existing query
  try {
    const existing = cache.readQuery({ query, variables });

    // 2. Transform data (depends on mutation type)
    const updated = transformData(existing, data);

    // 3. Write back
    cache.writeQuery({ query, variables, data: updated });
  } catch (e) {
    // Handle query not in cache
  }

  // 4. Repeat for other queries
  try {
    const existing2 = cache.readQuery({ query: QUERY2, variables: vars2 });
    // ... more boilerplate
  } catch (e) {}
}
```

Multiply by 20-50 mutations in a typical app = **hundreds of lines of repetitive code**.

### 2. **Hard to Get Right**

Common mistakes from Stack Overflow:
- Forgetting try/catch → app crashes
- Mutating instead of creating new arrays → cache corruption
- Missing variables → wrong query updated
- Forgetting to update all affected queries → UI inconsistencies

### 3. **Testing Burden**

Every `update` function needs tests:
- Does it handle query not in cache?
- Does it update all relevant queries?
- Does it handle different variable combinations?
- Does it correctly transform nested data?

### 4. **Maintenance Burden**

When schema changes:
- Update mutation
- Update all `update` functions that reference it
- Update all queries that might be affected
- Hope you didn't miss any

### 5. **No Invalidation Hints**

Unlike Cascade's server-side invalidation hints, Apollo has no way to know:
- "This mutation affects the user list query"
- "Invalidate all search queries"
- "Refetch related entity queries"

Developers must manually enumerate every affected query.

## What Apollo Does Well

Despite these challenges, Apollo has strengths:

1. ✅ **Simple mental model**: `__typename:id` is easy to understand
2. ✅ **Flexible**: Works with any GraphQL schema (no Node interface required)
3. ✅ **React integration**: `useMutation` hook is elegant
4. ✅ **Type policies**: Powerful customization per type
5. ✅ **cache.modify**: Better than read/write pattern (though limited)
6. ✅ **Ecosystem**: Massive community, plugins, tools

## Comparison: What GraphQL Cascade Improves

| Aspect | Apollo Client | GraphQL Cascade |
|--------|---------------|-----------------|
| **Simple field updates** | ✅ Automatic | ✅ Automatic |
| **Adding to lists** | ❌ Manual `update` function | ✅ Automatic via cascade |
| **Removing from lists** | ❌ Manual `update` function | ✅ Automatic via cascade |
| **Related entity updates** | ❌ Manual or ignored | ✅ Automatic via cascade |
| **Query invalidation** | ❌ Manual `refetchQueries` | ✅ Declarative invalidation hints |
| **Boilerplate per mutation** | ❌ 15-30 lines | ✅ 0 lines (server handles it) |
| **Error handling** | ⚠️ Requires try/catch | ✅ Server guarantees consistency |
| **Multiple queries** | ❌ Update each manually | ✅ Server determines affected queries |
| **Developer experience** | ⚠️ Moderate learning curve | ✅ Zero-config for most cases |

## Key Insight for GraphQL Cascade

**Apollo's limitation**: The client doesn't know:
- Which queries are affected by a mutation
- Which related entities changed
- Whether to invalidate or update

**GraphQL Cascade's solution**: The server knows all of this because it performed the mutation. By returning:
- All updated entities (cascade.updated)
- All deleted entities (cascade.deleted)
- Invalidation hints (cascade.invalidations)

...the client can mechanically apply updates without any mutation-specific logic.

## Migration Path from Apollo

For Apollo users migrating to GraphQL Cascade:

1. **Keep**:
   - `InMemoryCache` with typename+id normalization
   - `useMutation` hook
   - Type policies

2. **Remove**:
   - `update` functions
   - `refetchQueries` (in most cases)
   - Manual `cache.readQuery` / `cache.writeQuery` logic

3. **Add**:
   - Cascade response handling (generic, reusable)
   - `applyCascade` utility function

**Before (Apollo)**:
```typescript
const [createTodo] = useMutation(CREATE_TODO, {
  update(cache, { data: { createTodo } }) {
    try {
      const existing = cache.readQuery({ query: GET_TODOS });
      cache.writeQuery({
        query: GET_TODOS,
        data: { todos: [...existing.todos, createTodo] }
      });
    } catch (e) {
      // Handle error
    }

    // Repeat for other queries...
  }
});
```

**After (GraphQL Cascade)**:
```typescript
const [createTodo] = useCascadeMutation(CREATE_TODO);
// That's it - cascade applied automatically
```

## Example: Real-World Complexity

From Stack Overflow and GitHub issues, a typical Apollo mutation update:

```typescript
const [addToCart] = useMutation(ADD_TO_CART, {
  update(cache, { data: { addToCart } }) {
    // Update cart query
    try {
      const { cart } = cache.readQuery({ query: GET_CART });
      cache.writeQuery({
        query: GET_CART,
        data: { cart: { ...cart, items: [...cart.items, addToCart.item] } }
      });
    } catch (e) {}

    // Update product (reduce inventory)
    try {
      const product = cache.readFragment({
        id: cache.identify({ __typename: 'Product', id: addToCart.item.productId }),
        fragment: PRODUCT_FRAGMENT
      });
      cache.writeFragment({
        id: cache.identify({ __typename: 'Product', id: addToCart.item.productId }),
        fragment: PRODUCT_FRAGMENT,
        data: { ...product, inventory: product.inventory - addToCart.item.quantity }
      });
    } catch (e) {}

    // Update user's cart count
    cache.modify({
      id: cache.identify({ __typename: 'User', id: currentUserId }),
      fields: {
        cartItemCount(existing) {
          return existing + 1;
        }
      }
    });

    // Invalidate related queries
    cache.evict({ fieldName: 'recommendedProducts' });
  }
});
```

**40+ lines of manual logic** for a single mutation. With GraphQL Cascade: **0 lines** (server returns all affected entities).

## References

- [Apollo Client Cache Configuration](https://www.apollographql.com/docs/react/caching/cache-configuration)
- [Apollo Mutations Documentation](https://www.apollographql.com/docs/react/data/mutations)
- [Apollo Advanced Caching Topics](https://www.apollographql.com/docs/react/caching/advanced-topics)
- Stack Overflow: 500+ questions about "apollo client update cache mutation"

---

## Conclusion

Apollo Client is an excellent GraphQL client with a simple, flexible API. However, its manual cache update approach creates significant developer burden:

- **15-30 lines of boilerplate per mutation**
- **Error-prone** (easy to forget try/catch, mutate data, miss queries)
- **Maintenance burden** (update logic must change when schema changes)
- **No server guidance** (client guesses which queries to update)

**GraphQL Cascade** solves this by moving complexity to the server, where it belongs. The server tracks changes and returns comprehensive update information, enabling **zero-boilerplate cache updates** while maintaining all of Apollo's strengths.
