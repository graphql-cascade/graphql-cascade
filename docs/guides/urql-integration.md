# URQL Integration

This guide covers integrating GraphQL Cascade with URQL.

## Installation

```bash
npm install @graphql-cascade/urql
```

## Setup

```javascript
import { createClient } from 'urql';
import { cascadeExchange } from '@graphql-cascade/urql';

const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    cascadeExchange(),
    // other exchanges
  ],
});
```

## Usage

```javascript
import { useCascadeMutation } from '@graphql-cascade/urql';

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

function UserForm() {
  const [result, createUser] = useCascadeMutation(CREATE_USER);

  // Cache automatically updated via cascade
  return (
    // form JSX
  );
}
```

## Configuration

```javascript
const client = createClient({
  exchanges: [
    cascadeExchange({
      enabled: true,
      debug: false,
      maxDepth: 5
    }),
  ],
});
```