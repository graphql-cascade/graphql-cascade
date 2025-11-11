# React Query Integration

This guide covers integrating GraphQL Cascade with React Query/TanStack Query.

## Installation

```bash
npm install @graphql-cascade/react-query
```

## Setup

```javascript
import { QueryClient } from '@tanstack/react-query';
import { cascadeQueryClient } from '@graphql-cascade/react-query';

const queryClient = cascadeQueryClient(new QueryClient(), {
  enabled: true,
  // Cascade options
});
```

## Usage

```javascript
import { useCascadeMutation } from '@graphql-cascade/react-query';

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
  const createUser = useCascadeMutation(CREATE_USER, {
    onSuccess: (data) => {
      // Cache automatically updated via cascade
      console.log('User created:', data);
    }
  });

  // ... form logic
}
```

## Cache Invalidation

React Query cache is automatically updated based on cascade data:

- **Invalidations**: Queries are invalidated
- **Updates**: Query data is updated
- **Optimistic Updates**: Supported for better UX

## Configuration

```javascript
const queryClient = cascadeQueryClient(new QueryClient(), {
  enabled: true,
  debug: false,
  maxDepth: 5,
  invalidateOnCascade: true,
  updateOnCascade: true
});
```