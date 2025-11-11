# Apollo Client Integration

This guide covers integrating GraphQL Cascade with Apollo Client.

## Installation

```bash
npm install @graphql-cascade/apollo
```

## Setup

```javascript
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { cascadeLink } from '@graphql-cascade/apollo';

const client = new ApolloClient({
  link: cascadeLink.concat(httpLink),
  cache: new InMemoryCache(),
  cascade: {
    enabled: true,
    // Cascade-specific options
  }
});
```

## Usage

Mutations automatically return cascade data:

```javascript
const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
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

const [createUser] = useMutation(CREATE_USER);
// Cache updates automatically based on cascade data
```

## Configuration Options

- `enabled`: Enable/disable cascade processing
- `debug`: Enable debug logging
- `maxDepth`: Maximum cascade depth
- `timeout`: Cascade processing timeout

## Cache Updates

Apollo Client automatically processes cascade data to update the cache:

1. **Invalidations**: Remove stale data
2. **Updates**: Add/update entities
3. **Optimistic Updates**: Handle pending changes

## Error Handling

Cascade errors are handled gracefully:

```javascript
const [createUser, { error }] = useMutation(CREATE_USER);

if (error?.cascade) {
  // Handle cascade-specific errors
  console.error('Cascade error:', error.cascade);
}
```