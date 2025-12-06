# @graphql-cascade/relay

Relay Modern integration for GraphQL Cascade. Automatically applies cascade updates to Relay's normalized store, eliminating manual store manipulation in mutation updaters.

## Installation

```bash
npm install @graphql-cascade/client-relay relay-runtime react-relay
```

### Peer Dependencies

- `relay-runtime`: ^14.0.0 or later
- `react-relay`: ^14.0.0 or later (for React hooks)
- `graphql`: ^16.0.0 or later

## Features

- **Automatic Store Updates** - Cascade responses automatically update Relay's normalized store
- **Connection Handling** - Automatic updates for @connection fields
- **Optimistic Updates** - Full support for optimistic mutations with rollback
- **Type Safety** - Full TypeScript support with Relay Compiler types
- **Fragment Consistency** - Maintains data consistency across fragments
- **Zero Configuration** - Drop-in replacement for standard Relay environments

## Quick Start

### Basic Setup

```typescript
import { createCascadeRelayEnvironment } from '@graphql-cascade/client-relay';
import { Network, Store, RecordSource } from 'relay-runtime';

// Your fetch function
async function fetchQuery(operation, variables) {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: operation.text,
      variables
    })
  });
  return response.json();
}

// Create cascade-enabled environment
const network = Network.create(fetchQuery);
const store = new Store(new RecordSource());
const environment = createCascadeRelayEnvironment(network, store);

// Use like a regular Relay environment
// Cascade responses are automatically processed
```

### React Integration

```tsx
import { RelayEnvironmentProvider } from 'react-relay';
import { createCascadeRelayEnvironment } from '@graphql-cascade/client-relay';

function App() {
  return (
    <RelayEnvironmentProvider environment={environment}>
      <YourApp />
    </RelayEnvironmentProvider>
  );
}
```

### Using Mutations

```typescript
import { useMutation, graphql } from 'react-relay';

const CreateTodoMutation = graphql`
  mutation CreateTodoMutation($input: CreateTodoInput!) {
    createTodo(input: $input) {
      success
      data {
        id
        title
        completed
      }
      cascade {
        updated {
          __typename
          id
          operation
          entity
        }
        deleted {
          __typename
          id
        }
        invalidations {
          queryName
          scope
        }
      }
    }
  }
`;

function CreateTodoButton() {
  const [commit, isInFlight] = useMutation(CreateTodoMutation);

  const handleCreate = () => {
    commit({
      variables: { input: { title: 'New Todo' } },
      // No updater needed! Cascade handles it automatically
      onCompleted: (response) => {
        console.log('Todo created:', response.createTodo.data);
      }
    });
  };

  return (
    <button onClick={handleCreate} disabled={isInFlight}>
      {isInFlight ? 'Creating...' : 'Create Todo'}
    </button>
  );
}
```

## Environment Configuration

### createCascadeRelayEnvironment

Creates a Relay Environment that automatically processes cascade responses.

```typescript
import { createCascadeRelayEnvironment } from '@graphql-cascade/client-relay';

const environment = createCascadeRelayEnvironment(network, store, {
  // Enable debug logging
  debug: process.env.NODE_ENV === 'development',

  // Callback when cascade is processed
  onCascade: (cascade) => {
    console.log('Cascade processed:', cascade);
  },

  // Callback on errors
  onError: (error) => {
    console.error('Cascade error:', error);
  },

  // Filter which cascades to process
  shouldProcessCascade: (cascade) => {
    return cascade.updated.length < 1000;
  }
});
```

### Configuration Options

```typescript
interface CascadeRelayConfig {
  /** Enable debug logging */
  debug?: boolean;

  /** Callback when cascade data is processed */
  onCascade?: (cascade: CascadeData) => void;

  /** Callback when an error occurs */
  onError?: (error: Error) => void;

  /** Filter function to decide if cascade should be processed */
  shouldProcessCascade?: (cascade: CascadeData) => boolean;

  /** Custom store updater for specific types */
  typeUpdaters?: Record<string, TypeUpdater>;
}
```

## Updater Functions

### Automatic Cascade Updates

By default, cascade updates are applied automatically:

```typescript
commit({
  variables: { input: { title: 'New Todo' } },
  // No updater needed! Cascade data automatically updates the store
  onCompleted: (response) => {
    console.log('Store updated automatically');
  }
});
```

### Combining with Manual Updaters

You can combine cascade with manual updaters for edge cases:

```typescript
commit({
  variables: { input: { title: 'New Todo' } },
  updater: (store, response) => {
    // Cascade is applied first
    // Then your custom logic runs

    // Example: Add to a connection manually
    const root = store.getRoot();
    const connection = ConnectionHandler.getConnection(
      root,
      'TodoList_todos'
    );

    if (connection) {
      const newEdge = ConnectionHandler.createEdge(
        store,
        connection,
        store.get(response.createTodo.data.id),
        'TodoEdge'
      );
      ConnectionHandler.insertEdgeAfter(connection, newEdge);
    }
  }
});
```

### Connection Updates

Cascade automatically handles connection updates when entities change:

```typescript
// Server returns cascade with connection info
cascade: {
  updated: [{
    __typename: 'Todo',
    id: '123',
    operation: 'CREATED',
    entity: { ... },
    connections: ['TodoList_todos'] // Optional: specify connections to update
  }]
}
```

## Optimistic Updates

### Basic Optimistic Response

```typescript
commit({
  variables: { id: '123', completed: true },
  optimisticResponse: {
    toggleTodo: {
      success: true,
      data: {
        id: '123',
        completed: true
      },
      cascade: {
        updated: [{
          __typename: 'Todo',
          id: '123',
          operation: 'UPDATED',
          entity: { completed: true }
        }],
        deleted: [],
        invalidations: []
      }
    }
  },
  onCompleted: (response) => {
    // Server response replaces optimistic data
  },
  onError: (error) => {
    // Optimistic updates automatically rolled back
  }
});
```

### Optimistic Updater Function

```typescript
commit({
  variables: { id: '123', completed: true },
  optimisticUpdater: (store) => {
    const todo = store.get('123');
    if (todo) {
      todo.setValue(true, 'completed');
    }
  },
  // Regular updater runs on success
  updater: (store, response) => {
    // Cascade applied automatically, then this runs
  }
});
```

## Fragments and Cascade

### Fragment Data Consistency

Cascade ensures data consistency across all fragments:

```typescript
const TodoItem = graphql`
  fragment TodoItem_todo on Todo {
    id
    title
    completed
    author {
      name
    }
  }
`;

// When cascade updates a Todo, all fragments using it are updated
```

### @refetchable Queries

Works seamlessly with refetchable fragments:

```typescript
const TodoListQuery = graphql`
  query TodoListQuery @refetchable(queryName: "TodoListRefetchQuery") {
    todos(first: 10) @connection(key: "TodoList_todos") {
      edges {
        node {
          id
          ...TodoItem_todo
        }
      }
    }
  }
`;
```

## API Reference

### createCascadeRelayEnvironment

```typescript
function createCascadeRelayEnvironment(
  network: Network,
  store: Store,
  config?: CascadeRelayConfig
): Environment;
```

### createCascadeUpdater

Creates a store updater function from cascade data:

```typescript
import { createCascadeUpdater } from '@graphql-cascade/client-relay';

const updater = createCascadeUpdater(cascadeData);

// Use in commit
store.commitUpdates(updater);

// Or in mutation
commit({
  variables,
  updater: (store) => {
    createCascadeUpdater(customCascade)(store);
    // Additional logic...
  }
});
```

### processCascadeResponse

Manually process a cascade response:

```typescript
import { processCascadeResponse } from '@graphql-cascade/client-relay';

processCascadeResponse(environment, cascadeData, {
  onEntityUpdated: (typename, id, data) => {
    console.log('Updated:', typename, id);
  },
  onEntityDeleted: (typename, id) => {
    console.log('Deleted:', typename, id);
  }
});
```

## TypeScript Support

Full type safety with Relay Compiler generated types:

```typescript
import type { CreateTodoMutation } from './__generated__/CreateTodoMutation.graphql';
import type { CreateTodoMutation$variables } from './__generated__/CreateTodoMutation.graphql';

const [commit] = useMutation<CreateTodoMutation>(CreateTodoMutation);

// Variables are type-checked
commit({
  variables: {
    input: { title: 'New Todo' } // Type-safe
  }
});
```

### Generic Types

```typescript
import type { CascadeData, CascadeUpdatedEntity } from '@graphql-cascade/client-relay';

function handleCascade(cascade: CascadeData) {
  cascade.updated.forEach((entity: CascadeUpdatedEntity) => {
    console.log(entity.__typename, entity.id, entity.operation);
  });
}
```

## Advanced Usage

### Preloaded Queries with Cascade

```typescript
import { usePreloadedQuery, graphql } from 'react-relay';

const TodoListQuery = graphql`
  query TodoListQuery {
    todos { id title completed }
  }
`;

function TodoList({ queryRef }) {
  const data = usePreloadedQuery(TodoListQuery, queryRef);

  // Data stays fresh through cascade updates
  return (
    <ul>
      {data.todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
```

### Suspense Integration

```typescript
import { Suspense } from 'react';
import { useLazyLoadQuery, graphql } from 'react-relay';

function TodoList() {
  const data = useLazyLoadQuery(TodoListQuery, {});

  return (
    <Suspense fallback={<Loading />}>
      {/* Cascade updates trigger re-renders automatically */}
      {data.todos.map(todo => <TodoItem key={todo.id} todo={todo} />)}
    </Suspense>
  );
}
```

### Custom Type Updaters

```typescript
const environment = createCascadeRelayEnvironment(network, store, {
  typeUpdaters: {
    Todo: (store, entity, operation) => {
      if (operation === 'CREATED') {
        // Custom handling for new todos
        const root = store.getRoot();
        // ... custom logic
      }
    },
    User: (store, entity, operation) => {
      // Custom handling for users
    }
  }
});
```

## Testing

### Mock Cascade Responses

```typescript
import { createMockEnvironment, MockPayloadGenerator } from 'relay-test-utils';

const environment = createMockEnvironment();

// Resolve mutation with cascade data
environment.mock.resolveMostRecentOperation((operation) =>
  MockPayloadGenerator.generate(operation, {
    Mutation() {
      return {
        createTodo: {
          success: true,
          data: { id: '1', title: 'Test', completed: false },
          cascade: {
            updated: [{ __typename: 'Todo', id: '1', operation: 'CREATED', entity: {} }],
            deleted: [],
            invalidations: []
          }
        }
      };
    }
  })
);
```

## Troubleshooting

### Store Not Updating

1. Verify cascade data is in the mutation response
2. Check that entities have `__typename` and `id`
3. Ensure the environment was created with `createCascadeRelayEnvironment`

### Debug Logging

```typescript
const environment = createCascadeRelayEnvironment(network, store, {
  debug: true,
  onCascade: (cascade) => {
    console.log('Processing cascade:', cascade);
    console.log('Updated:', cascade.updated.length, 'entities');
    console.log('Deleted:', cascade.deleted.length, 'entities');
  }
});
```

### Common Issues

- **Missing __typename** - All entities must include `__typename`
- **ID format mismatch** - Entity IDs must match what Relay expects
- **Connection not updating** - May need manual edge insertion for new items

## Migration Guide

### From Manual Updaters

**Before (Manual Store Manipulation):**
```typescript
commit({
  variables,
  updater: (store, response) => {
    const todo = store.get(response.createTodo.id);
    const root = store.getRoot();
    const todos = root.getLinkedRecords('todos');
    root.setLinkedRecords([...todos, todo], 'todos');
  }
});
```

**After (With Cascade):**
```typescript
commit({
  variables,
  // No updater needed! Cascade handles it
  onCompleted: (response) => {
    console.log('Created:', response.createTodo.data);
  }
});
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build
npm run build

# Type checking
npm run typecheck
```

## Contributing

See the main [Contributing Guide](../../CONTRIBUTING.md) for details on how to contribute.

## License

MIT