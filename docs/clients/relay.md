# Relay Integration

Complete guide to using GraphQL Cascade with Relay Modern. Learn how Cascade integrates with Relay's normalized store architecture for automatic cache management.

## Overview

GraphQL Cascade works seamlessly with Relay Modern's store architecture by automatically applying mutation side effects to the normalized cache. When your GraphQL server returns cascade metadata alongside mutation responses, the Relay client automatically:

- **Creates** new entities in the store
- **Updates** existing entities with fresh data
- **Deletes** entities that no longer exist
- **Invalidates** cached queries that may be affected

This eliminates the need for manual cache updates while maintaining Relay's performance benefits and type safety.

## Installation

```bash
npm install @graphql-cascade/client-relay relay-runtime react-relay
```

For TypeScript projects, also install the types:

```bash
npm install --save-dev @types/relay-runtime
```

## Quick Start

Get started with Cascade in 5 minutes:

```typescript
import { Network, RecordSource, Store } from 'relay-runtime';
import { createCascadeRelayEnvironment } from '@graphql-cascade/client-relay';

// Create standard Relay network
const network = Network.create(async (operation, variables) => {
  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: operation.text,
      variables
    })
  });
  return response.json();
});

// Create store
const store = new Store(new RecordSource());

// Create cascade-enabled environment
const environment = createCascadeRelayEnvironment(network, store);

// Use like a regular Relay environment
// Cascade responses are processed automatically!
```

## Environment Setup

### Creating Cascade Network

The `createCascadeRelayEnvironment` function wraps your standard Relay environment with cascade processing:

```typescript
import { createCascadeRelayEnvironment } from '@graphql-cascade/client-relay';

const environment = createCascadeRelayEnvironment(network, store, {
  // Optional configuration
  debug: process.env.NODE_ENV === 'development',
  onCascade: (cascade) => console.log('Cascade processed:', cascade)
});
```

### Store Configuration

Cascade works with any Relay Store configuration:

```typescript
import { Store, RecordSource } from 'relay-runtime';

// Standard store
const store = new Store(new RecordSource());

// With garbage collection
const storeWithGC = new Store(new RecordSource(), {
  gcReleaseBufferSize: 10
});

// With custom record resolvers
const storeWithResolvers = new Store(new RecordSource(), {
  getDataID: (record, type) => {
    // Custom ID generation logic
    return record.id || `${type}:${record.slug}`;
  }
});

const environment = createCascadeRelayEnvironment(network, storeWithResolvers);
```

### Advanced Network Setup

For complex networking needs (authentication, retries, etc.):

```typescript
import { Network, Observable } from 'relay-runtime';

const network = Network.create((operation, variables) => {
  return Observable.create(sink => {
    const fetchQuery = async () => {
      try {
        const token = await getAuthToken();
        const response = await fetch('http://localhost:4000/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            query: operation.text,
            variables
          })
        });

        const data = await response.json();

        // Cascade processing happens automatically
        // in createCascadeRelayEnvironment
        sink.next(data);
        sink.complete();
      } catch (error) {
        sink.error(error);
      }
    };

    fetchQuery();
  });
});

const environment = createCascadeRelayEnvironment(network, store);
```

## Updater Functions

### Automatic Cascade Updates

Cascade handles most cache updates automatically. Simply include `__cascade` in your mutation responses:

```typescript
import { useMutation, graphql } from 'react-relay';

const UpdateTodoMutation = graphql`
  mutation UpdateTodoMutation($input: UpdateTodoInput!) {
    updateTodo(input: $input) {
      todo {
        id
        title
        completed
      }
      __cascade {
        updated { __typename id }
      }
    }
  }
`;

function UpdateTodoButton({ todoId }) {
  const [commit] = useMutation(UpdateTodoMutation);

  const handleToggle = () => {
    commit({
      variables: {
        input: { id: todoId, completed: true }
      }
      // No updater needed! Cascade handles the update automatically
    });
  };

  return <button onClick={handleToggle}>Complete Todo</button>;
}
```

### Manual Override with Updaters

Combine cascade with custom Relay updaters when needed:

```typescript
const [createTodo] = useMutation(CreateTodoMutation);

commit({
  variables: { input: { title: 'New todo' } },
  updater: (store) => {
    // Cascade updates are applied first automatically
    // Then add custom logic
    const todoCount = store.getRoot().getLinkedRecord('todoStats');
    if (todoCount) {
      const currentCount = todoCount.getValue('totalCount') || 0;
      todoCount.setValue(currentCount + 1, 'totalCount');
    }
  }
});
```

### Connection Updates

Cascade automatically handles connection updates for created/deleted entities:

```typescript
const CreateTodoMutation = graphql`
  mutation CreateTodoMutation($input: CreateTodoInput!) {
    createTodo(input: $input) {
      todo {
        id
        title
        completed
      }
      __cascade {
        created { __typename id }
        # Connection updates happen automatically
      }
    }
  }
`;

// The todo will automatically appear in any @connection fields
// that reference it, without manual connection updates
```

## Fragments and Cascade

### Fragment Data Consistency

Ensure your fragments include all fields that cascade might update:

```typescript
const TodoFragment = graphql`
  fragment TodoFragment on Todo {
    id
    title
    completed
    updatedAt  # Include fields that might change
  }
`;

// When cascade updates a Todo, all fragments will stay consistent
function TodoItem({ todo }) {
  return (
    <div>
      <h3>{todo.title}</h3>
      <p>Last updated: {todo.updatedAt}</p>
    </div>
  );
}
```

### @refetchable and Pagination

Cascade works seamlessly with Relay's pagination:

```typescript
const TodoListFragment = graphql`
  fragment TodoListFragment on Query
  @refetchable(queryName: "TodoListRefetchQuery") {
    todos(first: $count, after: $cursor)
    @connection(key: "TodoListFragment_todos") {
      edges {
        node {
          id
          title
          completed
        }
      }
    }
  }
`;

// When todos are created/deleted, the connection updates automatically
// No manual connection handling needed
```

### Fragment Composition

Cascade maintains consistency across composed fragments:

```typescript
const TodoBaseFragment = graphql`
  fragment TodoBaseFragment on Todo {
    id
    title
    completed
  }
`;

const TodoDetailsFragment = graphql`
  fragment TodoDetailsFragment on Todo {
    ...TodoBaseFragment
    description
    priority
  }
`;

// Updates to any field in either fragment will be consistent
```

## Optimistic Updates

### Optimistic Response Generation

Create optimistic responses that include cascade metadata:

```typescript
import { useMutation, graphql } from 'react-relay';

const ToggleTodoMutation = graphql`
  mutation ToggleTodoMutation($input: ToggleTodoInput!) {
    toggleTodo(input: $input) {
      todo {
        id
        completed
      }
      __cascade {
        updated { __typename id }
      }
    }
  }
`;

function TodoItem({ todo }) {
  const [commit] = useMutation(ToggleTodoMutation);

  const handleToggle = () => {
    commit({
      variables: { input: { id: todo.id } },
      optimisticResponse: {
        toggleTodo: {
          todo: {
            id: todo.id,
            completed: !todo.completed
          },
          __cascade: {
            updated: [{ __typename: 'Todo', id: todo.id }]
          }
        }
      },
      optimisticUpdater: (store) => {
        // Apply optimistic cascade update
        const todoRecord = store.get(todo.id);
        if (todoRecord) {
          todoRecord.setValue(!todo.completed, 'completed');
        }
      }
    });
  };

  return (
    <div>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={handleToggle}
      />
      {todo.title}
    </div>
  );
}
```

### Rollback on Error

Cascade handles rollback automatically when mutations fail:

```typescript
commit({
  variables: { input },
  optimisticResponse: optimisticResponse,
  optimisticUpdater: optimisticUpdater,
  // On error, cascade automatically reverts optimistic updates
  // No manual rollback logic needed
});
```

### Conflict Resolution

For complex optimistic updates, use Relay's conflict resolution:

```typescript
const [updateTodo] = useMutation(UpdateTodoMutation, {
  optimisticResponse: {
    updateTodo: {
      todo: {
        id: todoId,
        title: newTitle,
        version: currentVersion + 1
      },
      __cascade: {
        updated: [{ __typename: 'Todo', id: todoId }]
      }
    }
  },
  // Relay handles conflicts automatically
});
```

## Advanced Patterns

### Preloaded Queries

Cascade works with Relay's preloaded queries:

```typescript
import { loadQuery, usePreloadedQuery } from 'react-relay';

const preloadedQuery = loadQuery(
  environment,
  TodoListQuery,
  { first: 10 }
);

function TodoList() {
  const data = usePreloadedQuery(TodoListQuery, preloadedQuery);

  // Mutations with cascade will update the preloaded data automatically
  return (
    <div>
      {data.todos.edges.map(edge => (
        <TodoItem key={edge.node.id} todo={edge.node} />
      ))}
    </div>
  );
}
```

### Render-as-You-Fetch

Combine with Suspense for progressive loading:

```typescript
import { Suspense } from 'react';
import { useLazyLoadQuery } from 'react-relay';

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TodoApp />
    </Suspense>
  );
}

function TodoApp() {
  const data = useLazyLoadQuery(TodoListQuery, { first: 10 });

  // Cascade updates work seamlessly with Suspense boundaries
  return <TodoList todos={data.todos} />;
}
```

### Suspense Integration

Cascade maintains consistency across Suspense boundaries:

```typescript
function TodoContainer({ todoId }) {
  const data = useFragment(TodoFragment, todoId);

  return (
    <Suspense fallback={<TodoSkeleton />}>
      <TodoDetails todo={data} />
    </Suspense>
  );
}

// Updates from mutations flow through Suspense boundaries automatically
```

## TypeScript Support

### Relay Compiler Types

Full type safety with Relay's generated types:

```typescript
import { graphql, useMutation } from 'react-relay';

// Relay generates types automatically
const CreateTodoMutation = graphql`
  mutation CreateTodoMutation($input: CreateTodoInput!) {
    createTodo(input: $input) {
      todo {
        id
        title
        completed
      }
      __cascade {
        created { __typename id }
        updated { __typename id }
        deleted { __typename id }
        invalidated { __typename field }
      }
    }
  }
`;

type CreateTodoMutationVariables = {
  input: {
    title: string;
  };
};

function CreateTodoForm() {
  const [commit] = useMutation<CreateTodoMutation>(CreateTodoMutation);

  const handleSubmit = (title: string) => {
    commit({
      variables: { input: { title } },
      // Fully typed - no manual type annotations needed
    });
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(e.target.title.value);
    }}>
      <input name="title" type="text" />
      <button type="submit">Create</button>
    </form>
  );
}
```

### Type-Safe Cascade

Cascade responses are fully typed:

```typescript
// Relay generates cascade types automatically
function useTypedMutation() {
  const [commit] = useMutation(CreateTodoMutation);

  const handleCreate = () => {
    commit({
      variables: { input: { title: 'New Todo' } },
      onCompleted: (response) => {
        // response.createTodo.__cascade is fully typed
        console.log('Created entities:', response.createTodo.__cascade.created);
        console.log('Updated entities:', response.createTodo.__cascade.updated);
      }
    });
  };

  return handleCreate;
}
```

## Testing

### Mock Cascade Responses

Test components with cascade responses:

```typescript
import { RelayEnvironmentProvider } from 'react-relay';
import { createMockEnvironment } from 'relay-test-utils';

const mockEnvironment = createMockEnvironment();

const TestWrapper = ({ children }) => (
  <RelayEnvironmentProvider environment={mockEnvironment}>
    {children}
  </RelayEnvironmentProvider>
);

// Mock cascade responses
mockEnvironment.mock.resolveMostRecentOperation(operation => ({
  data: {
    createTodo: {
      todo: {
        __typename: 'Todo',
        id: '1',
        title: 'Test Todo',
        completed: false
      },
      __cascade: {
        created: [{ __typename: 'Todo', id: '1' }],
        updated: [],
        deleted: [],
        invalidated: []
      }
    }
  }
}));
```

### Testing Cascade Behavior

Verify cascade updates in tests:

```typescript
import { act, render } from '@testing-library/react';

test('creates todo with cascade', async () => {
  const { getByText } = render(
    <TestWrapper>
      <CreateTodoForm />
    </TestWrapper>
  );

  // Trigger mutation
  act(() => {
    // Simulate form submission
  });

  // Verify cascade updated the store
  await waitFor(() => {
    expect(mockEnvironment.getStore().getSource().get('1')).toBeDefined();
  });
});
```

## Migration Guide

### From Manual Relay Updaters

**Before Cascade:**

```typescript
const [createTodo] = useMutation(CreateTodoMutation, {
  updater: (store) => {
    // 20+ lines of manual cache management
    const root = store.getRoot();
    const todos = root.getLinkedRecords('todos') || [];

    const newTodo = store.create(todoId, 'Todo');
    newTodo.setValue(todoId, 'id');
    newTodo.setValue(title, 'title');
    newTodo.setValue(false, 'completed');

    root.setLinkedRecords([...todos, newTodo], 'todos');
  }
});
```

**After Cascade:**

```typescript
const [createTodo] = useMutation(CreateTodoMutation);
// That's it! Cache updates automatically
```

### Gradual Migration

Migrate incrementally by keeping existing updaters temporarily:

```typescript
const [updateTodo] = useMutation(UpdateTodoMutation, {
  updater: (store) => {
    // Keep existing updater during migration
    // Cascade will be applied first, then your custom logic
    const todo = store.get(todoId);
    if (todo) {
      // Your existing update logic
      todo.setValue(newTitle, 'title');
    }
  }
});

// Later, remove the updater entirely
const [updateTodo] = useMutation(UpdateTodoMutation);
```

### Apollo Migration

Coming from Apollo? The concepts are similar:

```typescript
// Apollo (before)
const [createTodo] = useMutation(CREATE_TODO, {
  update(cache, { data }) {
    // Manual cache updates
  }
});

// Relay + Cascade (after)
const [createTodo] = useMutation(CreateTodoMutation);
// Automatic cache updates!
```

## Troubleshooting

### Common Issues

**Cascade not updating the UI:**

- Ensure `__cascade` is included in your GraphQL mutation response
- Check that your fragments include all fields being updated
- Verify the environment is created with `createCascadeRelayEnvironment`

**Type errors with cascade:**

- Run `relay-compiler` to regenerate types after adding `__cascade`
- Ensure your GraphQL schema includes the cascade types

**Performance issues:**

- Large cascades (>1000 entities) may cause UI jank
- Use `shouldProcessCascade` to filter large updates
- Consider pagination for large datasets

### Debug Logging

Enable debug mode to see cascade processing:

```typescript
const environment = createCascadeRelayEnvironment(network, store, {
  debug: true, // Logs all cascade operations
  onCascade: (cascade) => {
    console.log('Processing cascade:', cascade);
  }
});
```

### FAQ

**Q: Does Cascade work with Relay's garbage collection?**

A: Yes! Cascade respects Relay's GC and will not create memory leaks.

**Q: Can I use Cascade with existing Relay updaters?**

A: Absolutely. Cascade applies first, then your updater runs.

**Q: What happens if cascade and updater conflict?**

A: Your updater logic takes precedence. Cascade provides the foundation updates.

**Q: Does Cascade work with subscriptions?**

A: Cascade is designed for mutations. For subscriptions, use Relay's standard patterns.

**Q: How do I handle complex cache relationships?**

A: Start with cascade for basic updates, then add custom updaters for complex relationships.

## Performance Tips

1. **Include cascade in fragments** to ensure all required fields are available
2. **Use pagination** to limit cascade sizes
3. **Monitor cascade size** in development
4. **Batch mutations** when possible to reduce network overhead

```typescript
// Monitor cascade performance
const environment = createCascadeRelayEnvironment(network, store, {
  onCascade: (cascade) => {
    const totalEntities = cascade.created.length +
                         cascade.updated.length +
                         cascade.deleted.length;
    if (totalEntities > 100) {
      console.warn(`Large cascade: ${totalEntities} entities`);
    }
  }
});
```

## Next Steps

- **[Apollo Client Integration](/clients/apollo)** - Alternative client
- **[Server Setup](/server/)** - Configure your GraphQL server
- **[Optimistic Updates](/guide/optimistic-updates)** - Instant UI feedback
- **[Specification](/specification/)** - Full protocol details
