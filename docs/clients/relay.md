# Relay Integration

Complete guide to using GraphQL Cascade with Relay Modern.

## Installation

```bash
npm install @graphql-cascade/client-relay relay-runtime react-relay
```

## Quick Setup

```typescript
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { createCascadeHandler } from '@graphql-cascade/client-relay';

// Create cascade-enabled network
const cascadeHandler = createCascadeHandler();

const network = Network.create(async (operation, variables) => {
  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: operation.text,
      variables
    })
  });

  const data = await response.json();

  // Process cascade if present
  cascadeHandler.processCascade(data);

  return data;
});

const environment = new Environment({
  network,
  store: new Store(new RecordSource())
});
```

## Usage with Relay Hooks

```typescript
import { useMutation, graphql } from 'react-relay';

const CreateTodoMutation = graphql`
  mutation RelayCreateTodoMutation($input: CreateTodoInput!) {
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

function CreateTodoButton() {
  const [commit, isInFlight] = useMutation(CreateTodoMutation);

  const handleCreate = () => {
    commit({
      variables: { input: { title: 'New todo' } },
      // Cascade handles cache updates automatically
    });
  };

  return (
    <button onClick={handleCreate} disabled={isInFlight}>
      Create Todo
    </button>
  );
}
```

## Cascade with Relay Updaters

You can combine Cascade with Relay's updater functions:

```typescript
commit({
  variables,
  updater: (store) => {
    // Cascade is processed first
    // Add custom Relay store updates if needed
  }
});
```

## Features

- Works with Relay's normalized store
- Compatible with @connection directive
- Supports optimistic updates
- Full Relay Compiler integration
- TypeScript support via generated types

## Configuration

```typescript
const cascadeHandler = createCascadeHandler({
  debug: true,
  onCascade: (cascade) => {
    console.log('Processing cascade:', cascade);
  }
});
```

## Next Steps

- **[URQL Integration](/clients/urql)** - Alternative client
- **[Server Setup](/server/)** - Configure your GraphQL server
- **[Specification](/specification/)** - Full protocol details
