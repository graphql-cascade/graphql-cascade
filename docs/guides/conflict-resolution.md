# Conflict Resolution

This guide covers handling conflicts and concurrent mutations with GraphQL Cascade.

## Conflict Types

### Data Conflicts

When multiple users modify the same data simultaneously:

```javascript
// User A updates user name
updateUser({ id: "1", input: { name: "Alice" } })

// User B updates user email
updateUser({ id: "1", input: { email: "alice@example.com" } })
```

### Cascade Conflicts

When mutations create conflicting cascade effects.

## Detection Strategies

### Version-based Conflict Detection

```graphql
type Mutation {
  updateUser(input: UpdateUserInput!): UpdateUserPayload
}

input UpdateUserInput {
  id: ID!
  name: String
  email: String
  version: Int!  # Optimistic concurrency control
}
```

### Timestamp-based Detection

```javascript
const [updateUser] = useCascadeMutation(UPDATE_USER_MUTATION, {
  onError: (error) => {
    if (error.code === 'CONFLICT') {
      // Handle conflict
      refetch(); // Reload latest data
    }
  }
});
```

## Resolution Strategies

### Client-side Resolution

```javascript
const [updateUser] = useCascadeMutation(UPDATE_USER_MUTATION, {
  conflictResolution: 'CLIENT_WINS', // or 'SERVER_WINS', 'MERGE'
  onConflict: (serverData, clientData) => {
    // Custom merge logic
    return {
      ...serverData,
      ...clientData,
      lastModified: new Date()
    };
  }
});
```

### Automatic Retry

```javascript
const [updateUser] = useCascadeMutation(UPDATE_USER_MUTATION, {
  retryOnConflict: true,
  maxRetries: 3,
  retryDelay: 1000
});
```

## Best Practices

1. **Use optimistic locking** for critical data
2. **Implement conflict resolution UI** for user experience
3. **Log conflicts** for analysis
4. **Consider data importance** when choosing resolution strategy