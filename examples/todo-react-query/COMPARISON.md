# React Query: With vs Without GraphQL Cascade

This document provides a detailed comparison of implementing the Todo app with and without GraphQL Cascade, highlighting the dramatic simplification Cascade provides.

## Table of Contents

- [Complete Code Comparison](#complete-code-comparison)
- [Metrics](#metrics)
- [Maintenance Scenarios](#maintenance-scenarios)
- [Common Pitfalls Avoided](#common-pitfalls-avoided)

## Complete Code Comparison

### Scenario 1: Creating a Todo

#### Without Cascade (Traditional React Query)

```typescript
// useTodoMutations.ts
export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTodoInput) => {
      const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation CreateTodo($input: CreateTodoInput!) {
              createTodo(input: $input) {
                success
                data {
                  id
                  title
                  completed
                  createdAt
                  updatedAt
                }
              }
            }
          `,
          variables: { input },
        }),
      });
      const result = await response.json();
      if (result.errors) throw new Error(result.errors[0].message);
      return result.data.createTodo.data;
    },
    onSuccess: (newTodo) => {
      // Manual cache management required!

      // Update the todos list
      queryClient.setQueryData(['todos'], (oldTodos: Todo[] = []) => {
        return [...oldTodos, newTodo];
      });

      // Update any filtered lists
      if (!newTodo.completed) {
        queryClient.setQueryData(['todos', { filter: 'active' }], (oldTodos: Todo[] = []) => {
          return [...oldTodos, newTodo];
        });
      }

      // Update the todo count
      queryClient.setQueryData(['todoCount'], (oldCount: number = 0) => {
        return oldCount + 1;
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['todoStats'] });
      queryClient.invalidateQueries({ queryKey: ['recentTodos'] });

      // Don't forget aggregate queries!
      queryClient.invalidateQueries({ queryKey: ['completionRate'] });
    },
    onError: (error) => {
      // Rollback optimistic updates if any
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
```

**Lines of code:** ~45 lines
**Complexity:** High - must track all affected queries

#### With Cascade (This Example)

```typescript
// useTodoMutations.ts
export function useCreateTodo() {
  return useMutation({
    mutationFn: async (input: CreateTodoInput) => {
      const data = await graphqlRequest<CreateTodoResponse>(
        CREATE_TODO_MUTATION,
        { input }
      );
      return data.createTodo.data;
    },
    // Cascade handles everything automatically!
  });
}
```

**Lines of code:** ~8 lines
**Complexity:** Low - straightforward mutation

**Reduction:** 82% fewer lines, 100% less cache management code

---

### Scenario 2: Updating a Todo

#### Without Cascade

```typescript
export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTodoInput }) => {
      const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: UPDATE_TODO_MUTATION,
          variables: { id, input },
        }),
      });
      const result = await response.json();
      if (result.errors) throw new Error(result.errors[0].message);
      return result.data.updateTodo.data;
    },
    onSuccess: (updatedTodo, { id }) => {
      // Update the single todo query
      queryClient.setQueryData(['todo', id], updatedTodo);

      // Update the todo in the list
      queryClient.setQueryData(['todos'], (oldTodos: Todo[] = []) => {
        return oldTodos.map(todo =>
          todo.id === id ? updatedTodo : todo
        );
      });

      // Update filtered lists
      queryClient.setQueryData(['todos', { filter: 'active' }], (oldTodos: Todo[] = []) => {
        if (updatedTodo.completed) {
          // Remove from active list if now completed
          return oldTodos.filter(todo => todo.id !== id);
        } else {
          // Update in place or add if not present
          return oldTodos.some(t => t.id === id)
            ? oldTodos.map(t => t.id === id ? updatedTodo : t)
            : [...oldTodos, updatedTodo];
        }
      });

      queryClient.setQueryData(['todos', { filter: 'completed' }], (oldTodos: Todo[] = []) => {
        if (!updatedTodo.completed) {
          // Remove from completed list if now active
          return oldTodos.filter(todo => todo.id !== id);
        } else {
          // Update in place or add if not present
          return oldTodos.some(t => t.id === id)
            ? oldTodos.map(t => t.id === id ? updatedTodo : t)
            : [...oldTodos, updatedTodo];
        }
      });

      // Invalidate aggregate queries
      queryClient.invalidateQueries({ queryKey: ['todoStats'] });
      queryClient.invalidateQueries({ queryKey: ['completionRate'] });
    },
  });
}
```

**Lines of code:** ~55 lines
**Complexity:** Very high - complex conditional logic

#### With Cascade

```typescript
export function useUpdateTodo() {
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTodoInput }) => {
      const data = await graphqlRequest<UpdateTodoResponse>(
        UPDATE_TODO_MUTATION,
        { id, input }
      );
      return data.updateTodo.data;
    },
  });
}
```

**Lines of code:** ~9 lines
**Complexity:** Low - simple mutation

**Reduction:** 84% fewer lines, eliminated complex conditional logic

---

### Scenario 3: Deleting a Todo

#### Without Cascade

```typescript
export function useDeleteTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: DELETE_TODO_MUTATION,
          variables: { id },
        }),
      });
      const result = await response.json();
      if (result.errors) throw new Error(result.errors[0].message);
      return result.data.deleteTodo.data;
    },
    onSuccess: (_, id) => {
      // Remove from all list queries
      queryClient.setQueryData(['todos'], (oldTodos: Todo[] = []) => {
        return oldTodos.filter(todo => todo.id !== id);
      });

      queryClient.setQueryData(['todos', { filter: 'active' }], (oldTodos: Todo[] = []) => {
        return oldTodos.filter(todo => todo.id !== id);
      });

      queryClient.setQueryData(['todos', { filter: 'completed' }], (oldTodos: Todo[] = []) => {
        return oldTodos.filter(todo => todo.id !== id);
      });

      // Remove the single todo query
      queryClient.removeQueries({ queryKey: ['todo', id] });

      // Update count
      queryClient.setQueryData(['todoCount'], (oldCount: number = 0) => {
        return Math.max(0, oldCount - 1);
      });

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['todoStats'] });
      queryClient.invalidateQueries({ queryKey: ['recentTodos'] });
      queryClient.invalidateQueries({ queryKey: ['completionRate'] });
    },
  });
}
```

**Lines of code:** ~40 lines
**Complexity:** Medium-high - must clean up all references

#### With Cascade

```typescript
export function useDeleteTodo() {
  return useMutation({
    mutationFn: async (id: string) => {
      const data = await graphqlRequest<DeleteTodoResponse>(
        DELETE_TODO_MUTATION,
        { id }
      );
      return data.deleteTodo.data;
    },
  });
}
```

**Lines of code:** ~8 lines
**Complexity:** Low - straightforward deletion

**Reduction:** 80% fewer lines, automatic cleanup

---

## Metrics

### Code Volume

| Operation | Without Cascade | With Cascade | Reduction |
|-----------|----------------|--------------|-----------|
| Create Todo | 45 lines | 8 lines | 82% |
| Update Todo | 55 lines | 9 lines | 84% |
| Delete Todo | 40 lines | 8 lines | 80% |
| **Total** | **140 lines** | **25 lines** | **82%** |

### Cognitive Complexity

| Aspect | Without Cascade | With Cascade |
|--------|----------------|--------------|
| Cache locations to track | 7+ per mutation | 0 |
| Conditional logic blocks | 3-5 per mutation | 0 |
| Error handling paths | 2-3 per mutation | 1 |
| Testing scenarios | 10+ per mutation | 2-3 |

### Maintenance Burden

| Task | Without Cascade | With Cascade |
|------|----------------|--------------|
| Add new query | Update all related mutations | No changes needed |
| Change data structure | Update all cache logic | No changes needed |
| Add derived field | Update calculations everywhere | No changes needed |
| Fix cache bug | Debug complex state management | Check server response |

---

## Maintenance Scenarios

### Scenario A: Adding a "Priority" Field

#### Without Cascade

**Changes required:**
1. Update all `setQueryData` calls to include `priority`
2. Add new filtered queries for `['todos', { filter: 'high-priority' }]`
3. Update all mutations to handle priority in cache updates
4. Update conditional logic for filtered lists
5. Add priority to aggregate queries

**Files affected:** 5-7 files
**Time estimate:** 2-3 hours
**Risk:** High - easy to miss a location

#### With Cascade

**Changes required:**
1. Server returns `priority` in GraphQL response
2. TypeScript types updated automatically

**Files affected:** 0 (types auto-generated)
**Time estimate:** 0 minutes (server-side only)
**Risk:** None - automatic

---

### Scenario B: Adding Related "Tags" Entity

#### Without Cascade

**Changes required:**
1. Create new cache update logic for tags
2. Handle bidirectional updates (todo → tags, tags → todo)
3. Update all todo mutations to invalidate related tags
4. Create new mutations for tag management
5. Handle cascade deletes (delete todo → update tags)
6. Test all interaction scenarios

**Files affected:** 8-12 files
**Time estimate:** 1-2 days
**Risk:** Very high - complex relationships

#### With Cascade

**Changes required:**
1. Server includes tags in cascade metadata
2. Add React Query hooks for tag queries

**Files affected:** 2 files (new hooks only)
**Time estimate:** 1-2 hours
**Risk:** Low - server handles relationships

---

## Common Pitfalls Avoided

### Pitfall 1: Forgetting to Update a Query

#### Without Cascade

```typescript
// Developer adds new feature: recent todos
export function useRecentTodos() {
  return useQuery({
    queryKey: ['recentTodos'],
    queryFn: fetchRecentTodos,
  });
}

// But forgets to update this in mutation:
export function useCreateTodo() {
  // ... missing invalidation for ['recentTodos']
}
```

**Result:** Stale data, user confusion, bugs in production

#### With Cascade

```typescript
// Server automatically includes in cascade metadata:
{
  "invalidations": [
    { "queryName": "listTodos", ... },
    { "queryName": "recentTodos", ... }  // Automatic!
  ]
}
```

**Result:** Always in sync, no manual tracking needed

---

### Pitfall 2: Race Conditions

#### Without Cascade

```typescript
// User clicks delete while update is in flight
const handleQuickActions = async () => {
  updateTodo.mutate({ id: '1', title: 'Updated' });  // In flight...
  deleteTodo.mutate('1');  // Delete arrives first!
  // Cache is now in inconsistent state
};
```

**Result:** Phantom todos, duplicate entries, corrupted state

#### With Cascade

Server handles ordering and sends consistent cascade data.
**Result:** Always consistent, server is source of truth

---

### Pitfall 3: Optimistic Updates Rollback

#### Without Cascade

```typescript
onMutate: (newTodo) => {
  // Optimistic update
  const previousTodos = queryClient.getQueryData(['todos']);
  queryClient.setQueryData(['todos'], (old) => [...old, newTodo]);
  return { previousTodos };
},
onError: (err, newTodo, context) => {
  // Rollback - but which queries were affected?
  queryClient.setQueryData(['todos'], context.previousTodos);
  // Did we forget ['recentTodos']? ['todoStats']?
};
```

**Result:** Partial rollback, inconsistent state

#### With Cascade

Cascade can handle optimistic updates with automatic rollback:
```typescript
// Server sends rollback cascade on error
// All affected queries rolled back automatically
```

**Result:** Complete, automatic rollback

---

## Summary

GraphQL Cascade with React Query provides:

1. **82% less code** - Dramatically simpler mutations
2. **Zero manual cache management** - Server drives updates
3. **Maintainability** - Changes on server automatically propagate
4. **Reliability** - No forgotten invalidations or stale data
5. **Scalability** - Complexity stays constant as app grows

Traditional React Query cache management is powerful but manual. GraphQL Cascade automates it entirely, letting you focus on building features instead of managing cache state.

---

**Try it yourself:** Compare the code in `src/hooks/useTodoMutations.ts` with the traditional approach above. Notice how much simpler, clearer, and more maintainable the Cascade version is!
