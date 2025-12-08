# Architecture Overview

This document explains how GraphQL Cascade integrates with React Query in this Todo application.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend App                         │
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐ │
│  │ React        │────▶│ React Query  │────▶│ Cascade     │ │
│  │ Components   │     │ Hooks        │     │ Client      │ │
│  └──────────────┘     └──────────────┘     └─────────────┘ │
│         ▲                     ▲                     │        │
│         │                     │                     │        │
│         └─────────────────────┴─────────────────────┘        │
│                    Automatic Re-renders                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ GraphQL Request
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      GraphQL Server                          │
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐ │
│  │ Resolver     │────▶│ Cascade      │────▶│ Response    │ │
│  │ Logic        │     │ Tracker      │     │ Builder     │ │
│  └──────────────┘     └──────────────┘     └─────────────┘ │
│                                                              │
│  Response includes cascade metadata in extensions            │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Query Flow (Read Operations)

```
User Action (Load Page)
    │
    ▼
Component mounts
    │
    ▼
useTodos() hook
    │
    ▼
useQuery(['todos'])
    │
    ▼
GraphQL Request to Server
    │
    ▼
Server Returns Data
    │
    ▼
React Query Caches Data
    │
    ▼
Component Renders with Data
```

### 2. Mutation Flow (Write Operations)

```
User Action (Create Todo)
    │
    ▼
useCreateTodo() hook
    │
    ▼
useMutation()
    │
    ▼
GraphQL Request with Mutation
    │
    ▼
Server Processes Mutation
    │
    ▼
Server Tracks Cascade Effects
    │
    ▼
Server Returns Data + Cascade Metadata
    │
    ▼
graphqlRequest() extracts cascade data
    │
    ▼
Cascade Client Processes Metadata
    │
    ├─▶ Update cached entities
    ├─▶ Remove deleted entities
    └─▶ Invalidate affected queries
    │
    ▼
React Query Refetches Invalidated Queries
    │
    ▼
All Components Re-render Automatically
```

## Component Hierarchy

```
App
├─ QueryClientProvider
│  └─ React Query Context
│
├─ Header
│
├─ CascadeBanner (info)
│
├─ AddTodo
│  ├─ Form
│  └─ useCreateTodo() hook
│
├─ TodoList
│  ├─ useTodos() hook
│  └─ TodoItem (for each todo)
│     ├─ useUpdateTodo() hook
│     ├─ useDeleteTodo() hook
│     └─ useToggleTodo() hook
│
└─ ReactQueryDevtools
```

## State Management

### Traditional React Query (Without Cascade)

```typescript
// State lives in React Query cache
queryClient.cache = {
  ['todos']: [...todos],
  ['todo', '1']: {...todo},
  ['todoStats']: {...stats},
}

// Every mutation must manually update ALL affected queries
onSuccess: () => {
  queryClient.setQueryData(['todos'], ...);
  queryClient.setQueryData(['todo', id], ...);
  queryClient.invalidateQueries(['todoStats']);
  // Easy to forget queries!
}
```

### With Cascade

```typescript
// State still lives in React Query cache
queryClient.cache = {
  ['todos']: [...todos],
  ['todo', '1']: {...todo},
  ['todoStats']: {...stats},
}

// Server tells client what to update
extensions.cascade = {
  updated: [/* entities to update */],
  deleted: [/* entities to remove */],
  invalidations: [/* queries to refetch */],
}

// Cascade client automatically applies all updates
// No manual cache management needed!
```

## Key Integration Points

### 1. GraphQL Executor (`src/api/client.ts`)

```typescript
async function graphqlExecutor(query, variables) {
  const response = await fetch(GRAPHQL_ENDPOINT, {...});
  const result = await response.json();

  // Extract cascade data from extensions
  if (result.extensions?.cascade) {
    cascadeClient.applyCascade(result.extensions.cascade);
  }

  return result.data;
}
```

**Role:** Bridge between GraphQL responses and Cascade processing

### 2. Cascade Client

```typescript
export const cascadeClient = new ReactQueryCascadeClient(
  queryClient,
  graphqlExecutor
);
```

**Role:**
- Wraps React Query's QueryClient
- Processes cascade metadata
- Updates cache automatically

### 3. React Query Hooks

```typescript
// Query Hook
export function useTodos() {
  return useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      return await graphqlRequest(LIST_TODOS_QUERY);
    },
  });
}

// Mutation Hook
export function useCreateTodo() {
  return useMutation({
    mutationFn: async (input) => {
      return await graphqlRequest(CREATE_TODO_MUTATION, { input });
    },
    // No onSuccess needed - Cascade handles it!
  });
}
```

**Role:**
- Standard React Query hooks
- Simplified - no cache management code
- Cascade integration is transparent

## Cache Update Strategies

### Entity Updates (CREATE/UPDATE)

When an entity is created or updated:

1. **Server sends:**
   ```json
   {
     "updated": [{
       "__typename": "Todo",
       "id": "123",
       "operation": "UPDATE",
       "entity": {...newData}
     }]
   }
   ```

2. **Cascade client:**
   - Finds all queries containing this entity
   - Updates the entity data in-place
   - React Query triggers re-renders

### Entity Deletion (DELETE)

When an entity is deleted:

1. **Server sends:**
   ```json
   {
     "deleted": [{
       "__typename": "Todo",
       "id": "123",
       "deletedAt": "2024-01-01T00:00:00Z"
     }]
   }
   ```

2. **Cascade client:**
   - Finds all queries containing this entity
   - Removes the entity from arrays
   - Removes single-entity queries
   - React Query triggers re-renders

### Query Invalidation

When related data changes:

1. **Server sends:**
   ```json
   {
     "invalidations": [{
       "queryName": "listTodos",
       "strategy": "INVALIDATE",
       "scope": "EXACT"
     }]
   }
   ```

2. **Cascade client:**
   - Marks queries as stale
   - React Query refetches automatically
   - Components re-render with fresh data

## Performance Considerations

### What Cascade Optimizes

1. **Targeted Updates**
   - Only affected queries are invalidated
   - No blanket `invalidateQueries()` calls
   - Minimal unnecessary refetches

2. **Efficient Entity Updates**
   - Direct cache manipulation
   - No full query refetches for simple updates
   - Batched updates when possible

3. **Smart Invalidation**
   - Exact query matching
   - Prefix matching for related queries
   - Pattern matching for complex scenarios

### What to Watch For

1. **Large Lists**
   - Updating individual items is efficient
   - Adding many items at once may trigger multiple updates
   - Consider pagination for very large datasets

2. **Nested Entities**
   - Cascade handles nested updates automatically
   - Deep nesting may require more processing
   - Server should optimize cascade metadata

3. **Subscription Scenarios**
   - Real-time updates work great with Cascade
   - Each update includes cascade metadata
   - React Query handles frequent updates well

## Testing Strategy

### Unit Tests

Test individual hooks in isolation:

```typescript
test('useCreateTodo creates todo', async () => {
  const { result } = renderHook(() => useCreateTodo(), {
    wrapper: createQueryWrapper(),
  });

  await act(async () => {
    await result.current.mutateAsync({ title: 'Test' });
  });

  expect(result.current.isSuccess).toBe(true);
});
```

### Integration Tests

Test cascade behavior:

```typescript
test('creating todo updates list automatically', async () => {
  const { result: todosList } = renderHook(() => useTodos());
  const { result: createTodo } = renderHook(() => useCreateTodo());

  await act(async () => {
    await createTodo.current.mutateAsync({ title: 'Test' });
  });

  // List should update automatically via cascade
  expect(todosList.current.data).toContainEqual(
    expect.objectContaining({ title: 'Test' })
  );
});
```

### E2E Tests

Test full user flows:

```typescript
test('user can create, update, and delete todo', async () => {
  render(<App />);

  // Create
  await userEvent.type(screen.getByPlaceholderText('What needs...'), 'Test');
  await userEvent.click(screen.getByText('Add Todo'));

  // Verify appears in list (via cascade)
  expect(await screen.findByText('Test')).toBeInTheDocument();

  // Update
  await userEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByText('Test')).toHaveClass('completed');

  // Delete
  await userEvent.click(screen.getByText('Delete'));
  expect(screen.queryByText('Test')).not.toBeInTheDocument();
});
```

## Debugging Tips

### 1. React Query DevTools

Open DevTools (bottom-right) to see:
- Current cache state
- Query invalidations
- Refetch activity
- Mutation history

### 2. Console Logging

Add logging to `graphqlRequest`:

```typescript
export async function graphqlRequest<T>(query, variables) {
  const result = await fetch(...);

  if (result.extensions?.cascade) {
    console.log('Cascade data:', result.extensions.cascade);
    cascadeClient.applyCascade(result.extensions.cascade);
  }

  return result.data;
}
```

### 3. Network Tab

Inspect GraphQL responses:
- Check `extensions.cascade` is present
- Verify cascade metadata structure
- Confirm entity data is complete

### 4. Type Checking

Run TypeScript check:

```bash
npm run type-check
```

Ensures type safety across the entire application.

## Advanced Patterns

### Optimistic Updates

```typescript
export function useCreateTodoOptimistic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input) => {
      return await graphqlRequest(CREATE_TODO_MUTATION, { input });
    },
    onMutate: async (input) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      // Snapshot previous value
      const previousTodos = queryClient.getQueryData(['todos']);

      // Optimistically update
      const optimisticTodo = {
        id: 'temp-' + Date.now(),
        title: input.title,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData(['todos'], (old: Todo[] = []) => {
        return [...old, optimisticTodo];
      });

      return { previousTodos };
    },
    onError: (err, input, context) => {
      // Rollback on error
      queryClient.setQueryData(['todos'], context?.previousTodos);
    },
    onSettled: () => {
      // Cascade will handle the final update
      // No manual refetch needed!
    },
  });
}
```

### Infinite Queries

```typescript
export function useTodosInfinite() {
  return useInfiniteQuery({
    queryKey: ['todos', 'infinite'],
    queryFn: async ({ pageParam = 0 }) => {
      return await graphqlRequest(LIST_TODOS_PAGINATED, {
        offset: pageParam,
        limit: 20,
      });
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.hasMore ? pages.length * 20 : undefined;
    },
  });
}

// Cascade still works - updates apply to all pages!
```

## Summary

This architecture demonstrates how GraphQL Cascade seamlessly integrates with React Query to provide automatic cache management. The key benefits are:

1. **Simplicity** - No manual cache management code
2. **Reliability** - Server controls cache updates
3. **Maintainability** - Changes on server automatically propagate
4. **Performance** - Targeted, efficient updates
5. **Developer Experience** - Write less code, fewer bugs

The integration is transparent to React components - they simply use standard React Query hooks and everything "just works" thanks to Cascade.
