# Optimistic Updates

Provide instant UI feedback while mutations are in flight.

## Overview

Optimistic updates let you update the UI immediately when a user performs an action, before waiting for the server response. GraphQL Cascade makes optimistic updates simple by predicting what the cascade will be.

## Basic Optimistic Updates

```typescript
const [createTodo] = useMutation(CREATE_TODO, {
  optimisticResponse: ({ title }) => ({
    createTodo: {
      __typename: 'TodoMutationResponse',
      todo: {
        __typename: 'Todo',
        id: 'temp-' + Date.now(),
        title,
        completed: false,
      },
      __cascade: {
        created: [{ __typename: 'Todo', id: 'temp-' + Date.now() }],
        updated: [],
        deleted: [],
        invalidated: []
      }
    }
  })
});
```

When the user creates a todo:
1. UI updates instantly with the optimistic data
2. Server processes the mutation
3. Real response replaces the optimistic data
4. UI reconciles (usually no visible change)

## Optimistic Cascade Prediction

The key to successful optimistic updates is predicting the cascade accurately:

### Create Operations
```typescript
{
  created: [{ __typename: 'Todo', id: 'temp-id' }],
  updated: [],
  deleted: [],
  invalidated: []
}
```

### Update Operations
```typescript
{
  created: [],
  updated: [{ __typename: 'Todo', id: '123' }],
  deleted: [],
  invalidated: []
}
```

### Delete Operations
```typescript
{
  created: [],
  updated: [],
  deleted: [{ __typename: 'Todo', id: '123' }],
  invalidated: []
}
```

## Complex Optimistic Updates

For mutations that affect multiple entities:

```typescript
const [assignTask] = useMutation(ASSIGN_TASK, {
  optimisticResponse: ({ taskId, userId }) => ({
    assignTask: {
      __typename: 'AssignTaskResponse',
      task: {
        __typename: 'Task',
        id: taskId,
        assignee: {
          __typename: 'User',
          id: userId,
        }
      },
      __cascade: {
        created: [],
        updated: [
          { __typename: 'Task', id: taskId },
          { __typename: 'User', id: userId }
        ],
        deleted: [],
        invalidated: [
          { __typename: 'Query', field: 'unassignedTasks' }
        ]
      }
    }
  })
});
```

## Rollback on Error

If the mutation fails, Cascade automatically rolls back the optimistic update:

```typescript
try {
  await createTodo({ variables: { title: 'New todo' } });
} catch (error) {
  // Optimistic update is automatically rolled back
  // UI returns to pre-mutation state
  console.error('Failed to create todo:', error);
}
```

## Best Practices

### 1. Keep Optimistic Data Minimal
Only include fields that are displayed in the UI:

```typescript
// Good: Only what's shown
optimisticResponse: {
  createTodo: {
    todo: {
      id: 'temp-id',
      title: 'New todo',
      completed: false,
    }
  }
}

// Avoid: Extra fields not used
optimisticResponse: {
  createTodo: {
    todo: {
      id: 'temp-id',
      title: 'New todo',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { /* ... */ }
    }
  }
}
```

### 2. Use Temporary IDs
Generate unique temporary IDs for created entities:

```typescript
id: 'temp-' + Date.now() + '-' + Math.random()
```

### 3. Predict Cascades Accurately
If your optimistic cascade doesn't match the real cascade, the UI may flicker:

```typescript
// If server also updates related entities, include them:
__cascade: {
  created: [{ __typename: 'Todo', id: 'temp-id' }],
  updated: [
    { __typename: 'TodoList', id: listId },
    { __typename: 'User', id: userId }
  ],
  deleted: [],
  invalidated: []
}
```

### 4. Handle Loading States
Show loading indicators for complex operations:

```typescript
const [createTodo, { loading }] = useMutation(CREATE_TODO);

return (
  <button onClick={handleCreate} disabled={loading}>
    {loading ? 'Creating...' : 'Create Todo'}
  </button>
);
```

## Framework-Specific Examples

### Apollo Client
```typescript
import { useMutation } from '@apollo/client';

const [createTodo] = useMutation(CREATE_TODO, {
  optimisticResponse: /* ... */
});
```

### React Query
```typescript
import { useMutation } from '@tanstack/react-query';

const mutation = useMutation({
  mutationFn: createTodo,
  optimisticUpdate: /* ... */
});
```

### Relay
```typescript
import { useMutation } from 'react-relay';

const [commit] = useMutation(CREATE_TODO);

commit({
  variables: { title: 'New todo' },
  optimisticResponse: /* ... */
});
```

## Testing Optimistic Updates

Test both success and failure scenarios:

```typescript
test('optimistic update shows immediately', async () => {
  const { getByText, getByPlaceholderText } = render(<TodoApp />);

  // User creates a todo
  const input = getByPlaceholderText('New todo...');
  fireEvent.change(input, { target: { value: 'Test todo' } });
  fireEvent.submit(input.closest('form'));

  // Should appear immediately (optimistic)
  expect(getByText('Test todo')).toBeInTheDocument();
});

test('optimistic update rolls back on error', async () => {
  // Mock server error
  server.use(
    graphql.mutation('CreateTodo', (req, res, ctx) => {
      return res(ctx.errors([{ message: 'Server error' }]));
    })
  );

  const { getByText, queryByText } = render(<TodoApp />);

  // Create todo
  // ... trigger mutation ...

  // Wait for error
  await waitFor(() => {
    expect(queryByText('Test todo')).not.toBeInTheDocument();
  });
});
```

## Next Steps

- **[Conflict Resolution](/guide/conflict-resolution)** - Handle concurrent updates
- **[Performance](/guide/performance)** - Optimize cascade processing
- **[Client Integration](/clients/)** - Framework-specific patterns
