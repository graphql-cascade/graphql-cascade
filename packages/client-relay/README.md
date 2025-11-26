# @graphql-cascade/relay

Relay Modern integration for GraphQL Cascade. Automatically applies cascade updates to Relay's normalized store.

## Installation

```bash
npm install @graphql-cascade/relay relay-runtime
```

## Quick Start

```typescript
import { createCascadeRelayEnvironment } from '@graphql-cascade/relay';
import { Network, Store, RecordSource } from 'relay-runtime';

// Create Relay environment with cascade support
const network = Network.create(fetchQuery);
const store = new Store(new RecordSource());
const environment = createCascadeRelayEnvironment(network, store);

// Use like a regular Relay environment
// Cascade responses are automatically processed
```

## Features

- **Automatic Store Updates**: Cascade responses from mutations are automatically applied to Relay's normalized store
- **Entity Updates**: Handles created, updated, and deleted entities
- **Type-Safe**: Full TypeScript support with Relay types
- **Zero Configuration**: Drop-in replacement for standard Relay environments

## API

### `createCascadeRelayEnvironment(network, store, config?)`

Creates a Relay Environment that automatically processes cascade responses.

**Parameters:**
- `network`: Relay Network instance
- `store`: Relay Store instance
- `config`: Optional configuration object

**Returns:** Relay Environment with cascade support

### `createCascadeUpdater(cascade)`

Creates a store updater function for applying cascade updates.

**Parameters:**
- `cascade`: CascadeUpdates object

**Returns:** Function that can be used with `store.commitUpdates()`

## Example

```typescript
import { commitMutation, graphql } from 'relay-runtime';
import { createCascadeRelayEnvironment } from '@graphql-cascade/relay';

const environment = createCascadeRelayEnvironment(network, store);

const mutation = graphql`
  mutation CreateUserMutation($input: CreateUserInput!) {
    createUser(input: $input) {
      success
      data {
        id
        name
        email
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
          deletedAt
        }
        invalidations {
          queryName
          strategy
          scope
        }
        metadata {
          timestamp
          affectedCount
        }
      }
    }
  }
`;

commitMutation(environment, {
  mutation,
  variables: { input: { name: 'John', email: 'john@example.com' } },
  onCompleted: (response) => {
    // Cascade updates have been automatically applied to the store
    console.log('User created:', response.createUser.data);
  }
});
```

## License

MIT