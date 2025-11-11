# Relay Integration

This guide covers integrating GraphQL Cascade with Relay.

## Installation

```bash
npm install @graphql-cascade/relay
```

## Setup

```javascript
import { Environment } from 'relay-runtime';
import { cascadeEnvironment } from '@graphql-cascade/relay';

const environment = cascadeEnvironment({
  // Relay configuration
  network: Network.create(fetchQuery),
  store: new Store(new RecordSource()),
}, {
  // Cascade configuration
  enabled: true,
  debug: false
});
```

## Usage

```javascript
import { useCascadeMutation } from '@graphql-cascade/relay';

const CREATE_USER = graphql`
  mutation CreateUserMutation($input: CreateUserInput!) {
    createUser(input: $input) {
      success
      data { id name email }
      cascade {
        updated { __typename id operation }
        metadata { affectedCount }
      }
    }
  }
`;

function UserForm() {
  const [commit] = useCascadeMutation(CREATE_USER);

  // Cache automatically updated via cascade
  return (
    // form JSX
  );
}
```

## Store Updates

Relay store is automatically updated based on cascade data:

- **Invalidations**: Records are invalidated
- **Updates**: Store records are updated
- **Connections**: Connection data is maintained