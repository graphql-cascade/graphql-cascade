# Core Concepts

Understanding the fundamental concepts of GraphQL Cascade.

## The Cascade Data Model

At its core, GraphQL Cascade is about **tracking what changed** during a mutation and **communicating those changes** to the client.

### Entity References

An entity reference uniquely identifies an object in your GraphQL schema:

```typescript
{
  __typename: "User",
  id: "123"
}
```

This is all the client needs to locate the entity in its cache and update it.

### Cascade Metadata

Every mutation response includes cascade metadata:

```typescript
{
  __cascade: {
    created: [/* entities that were created */],
    updated: [/* entities that were updated */],
    deleted: [/* entities that were deleted */],
    invalidated: [/* queries that should be refetched */]
  }
}
```

## The Four Types of Changes

### 1. Created Entities

When a mutation creates a new entity, the server reports it in the `created` array:

```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    user {
      id
      name
      email
    }
    __cascade {
      created {
        __typename
        id
      }
    }
  }
}
```

The client:
1. Adds the entity to the cache
2. Updates any queries that would include this entity

### 2. Updated Entities

When a mutation modifies an entity, it appears in the `updated` array:

```graphql
mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
  updateUser(id: $id, input: $input) {
    user {
      id
      name
      email
    }
    __cascade {
      updated {
        __typename
        id
      }
    }
  }
}
```

The client:
1. Merges the updated data into the cache
2. Triggers re-renders for components using this data

### 3. Deleted Entities

When a mutation deletes an entity, it's listed in the `deleted` array:

```graphql
mutation DeleteUser($id: ID!) {
  deleteUser(id: $id) {
    success
    __cascade {
      deleted {
        __typename
        id
      }
    }
  }
}
```

The client:
1. Removes the entity from the cache
2. Updates any queries that included this entity
3. Cleans up references in related entities

### 4. Invalidated Queries

When a mutation affects query results in a way that can't be represented by entity updates alone (e.g., sorting changes, new items in filtered lists), the server can mark queries for refetch:

```graphql
mutation UpdateUserRole($id: ID!, $role: Role!) {
  updateUserRole(id: $id, role: $role) {
    user {
      id
      role
    }
    __cascade {
      updated {
        __typename
        id
      }
      invalidated {
        __typename
        field
      }
    }
  }
}
```

Example invalidation:
```typescript
{
  invalidated: [
    { __typename: "Query", field: "adminUsers" },
    { __typename: "Query", field: "regularUsers" }
  ]
}
```

The client will refetch these queries to ensure they have the latest data.

## Cascade Propagation

Cascades automatically propagate through relationships. When you update a user, related entities are tracked too:

```typescript
// Updating a user's profile
mutation UpdateProfile {
  updateUser(id: "123", input: { bio: "New bio" }) {
    user { id bio }
    __cascade {
      updated {
        __typename
        id
      }
    }
  }
}

// Server tracks:
// - User:123 (directly updated)
// - Company:456 (if the user's company cache needs updating)
// - Post:* (if the user's posts show their bio)
```

## Cache Normalization

Cascade works seamlessly with normalized caches (like Apollo's `InMemoryCache`):

1. **Entities are identified** by `__typename` and `id`
2. **Cache entries are keyed** as `"User:123"`, `"Post:456"`, etc.
3. **Updates are merged** into existing cache entries
4. **Deletions remove** cache entries and clean up references

## Optimistic Updates

Cascade supports optimistic updates by letting you predict what the cascade will be:

```typescript
const [createTodo] = useMutation(CREATE_TODO, {
  optimisticResponse: {
    createTodo: {
      todo: {
        __typename: 'Todo',
        id: 'temp-id',
        title: 'New todo',
        completed: false,
      },
      __cascade: {
        created: [{ __typename: 'Todo', id: 'temp-id' }],
        updated: [],
        deleted: [],
        invalidated: []
      }
    }
  }
});
```

The UI updates instantly with the optimistic data, then reconciles with the real server response.

## Batching and Deduplication

Cascade implementations automatically batch and deduplicate changes:

- Multiple updates to the same entity are merged
- Redundant invalidations are removed
- Related changes are grouped efficiently

## Error Handling

If a mutation fails, the cascade is not applied:

```typescript
{
  data: null,
  errors: [
    {
      message: "User not found",
      extensions: {
        code: "NOT_FOUND"
      }
    }
  ]
}
```

Optimistic updates are rolled back automatically.

## Type Safety

Cascade responses are fully typed in TypeScript:

```typescript
type CreateTodoMutation = {
  createTodo: {
    todo: Todo;
    __cascade: {
      created: EntityRef[];
      updated: EntityRef[];
      deleted: EntityRef[];
      invalidated: InvalidationRef[];
    };
  };
};
```

## Next Steps

- **[Optimistic Updates](/guide/optimistic-updates)** - Instant UI feedback
- **[Conflict Resolution](/guide/conflict-resolution)** - Handle concurrent updates
- **[Performance](/guide/performance)** - Optimize cascade processing
- **[Client Integration](/clients/)** - Framework-specific guides
