# Optimistic Updates

This guide covers implementing optimistic updates with GraphQL Cascade.

## Overview

Optimistic updates provide immediate UI feedback while mutations are in progress, with automatic rollback on errors.

## Basic Implementation

```javascript
const [createUser, { loading }] = useMutation(CREATE_USER_MUTATION, {
  optimisticResponse: {
    createUser: {
      id: 'temp-id',
      name: variables.input.name,
      email: variables.input.email,
      __typename: 'User'
    }
  },
  update: (cache, { data }) => {
    // GraphQL Cascade handles cache updates
  }
});
```

## With Cascade Data

GraphQL Cascade enhances optimistic updates:

```javascript
const [createUser] = useCascadeMutation(CREATE_USER_MUTATION, {
  optimisticResponse: {
    createUser: {
      success: true,
      data: {
        id: 'temp-id',
        name: variables.input.name,
        email: variables.input.email
      },
      cascade: {
        updated: [{
          __typename: 'User',
          id: 'temp-id',
          operation: 'CREATE'
        }]
      }
    }
  }
});
```

## Rollback Handling

On mutation failure, optimistic updates are automatically rolled back:

```javascript
const [createUser] = useCascadeMutation(CREATE_USER_MUTATION, {
  optimisticResponse: { /* ... */ },
  onError: (error) => {
    // Optimistic update automatically rolled back
    console.error('Mutation failed:', error);
  }
});
```

## Advanced Patterns

### Conditional Optimistic Updates

```javascript
const [updateUser] = useCascadeMutation(UPDATE_USER_MUTATION, {
  optimisticResponse: (variables) => ({
    updateUser: {
      success: true,
      data: {
        id: variables.id,
        name: variables.input.name || existingUser.name,
        email: variables.input.email || existingUser.email
      }
    }
  })
});
```

### Complex Cascades

For mutations affecting multiple entities:

```javascript
const optimisticResponse = {
  createPost: {
    success: true,
    data: { /* post data */ },
    cascade: {
      updated: [
        { __typename: 'Post', id: 'temp-post', operation: 'CREATE' },
        { __typename: 'User', id: userId, operation: 'UPDATE' } // author stats
      ]
    }
  }
};
```