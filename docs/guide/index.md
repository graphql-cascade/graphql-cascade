# What is GraphQL Cascade?

GraphQL Cascade is a protocol and set of libraries that **automatically update your client cache** when mutations occur. Instead of manually writing cache update logic for every mutation, Cascade extends GraphQL responses with metadata that tells clients exactly what changed.

## The Problem

Every GraphQL developer has written code like this hundreds of times:

```typescript
const [updateUser] = useMutation(UPDATE_USER, {
  update(cache, { data }) {
    // Read existing data
    const existingUsers = cache.readQuery({ query: LIST_USERS });

    // Update the specific user
    cache.writeQuery({
      query: LIST_USERS,
      data: {
        listUsers: existingUsers.listUsers.map(u =>
          u.id === data.updateUser.id ? data.updateUser : u
        )
      }
    });

    // Invalidate related queries
    cache.evict({ fieldName: 'searchUsers' });

    // Update related entities
    if (data.updateUser.company) {
      cache.writeFragment({
        id: `Company:${data.updateUser.company.id}`,
        fragment: COMPANY_FRAGMENT,
        data: data.updateUser.company
      });
    }
  }
});
```

This manual cache management code is:
- **Error-prone**: Easy to forget edge cases or miss related entities
- **Repetitive**: Every mutation needs similar boilerplate
- **Framework-specific**: Apollo's `update` functions, Relay's `updater` functions, etc.
- **Hard to maintain**: Changes to data relationships break cache logic
- **Performance-sensitive**: Incorrect invalidation causes stale data or unnecessary refetches

## The Solution

GraphQL Cascade eliminates manual cache management by having servers automatically track and return all affected entities (the "cascade") when mutations execute. Clients apply these cascades automatically, keeping caches synchronized without any manual code.

```typescript
// Before: Manual cache updates (20+ lines)
const [updateUser] = useMutation(UPDATE_USER, {
  update(cache, { data }) { /* ... lots of manual logic ... */ }
});

// After: Automatic cascade (1 line)
const [updateUser] = useCascadeMutation(UPDATE_USER);
```

## How It Works

When a mutation executes, the server tracks all entities that were affected and returns them in a structured format:

1. **Server Tracks Changes**: Your GraphQL server tracks which entities are created, updated, or invalidated during mutations
2. **Response Includes Metadata**: Mutation responses include cascade metadata describing what changed
3. **Client Auto-Updates**: Client libraries automatically update the cache based on the metadata

### Example Response

```json
{
  "data": {
    "updateUser": {
      "user": {
        "id": "123",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "__cascade": {
        "created": [],
        "updated": [
          { "__typename": "User", "id": "123" }
        ],
        "deleted": [],
        "invalidated": [
          { "__typename": "Query", "field": "searchUsers" }
        ]
      }
    }
  }
}
```

The client reads the cascade metadata and automatically:
- Adds new entities to the cache
- Updates existing entities
- Removes deleted entities
- Invalidates outdated queries
- Triggers re-fetches where needed

## Key Benefits

1. **Zero Boilerplate**: No manual `update` functions or cache manipulation code
2. **Automatic Consistency**: Cache stays synchronized with server state
3. **Framework Agnostic**: Works with any GraphQL client (Apollo, Relay, React Query, URQL, etc.)
4. **Performance Optimized**: Reduces over-fetching and unnecessary network requests
5. **Developer Experience**: Focus on business logic, not cache management
6. **Type Safe**: Full TypeScript support with automatic type inference
7. **Production Ready**: Battle-tested patterns with comprehensive security and performance requirements

## Comparison with Existing Solutions

### vs Manual Cache Updates
- **Manual**: Write 10-50 lines of cache logic per mutation
- **Cascade**: Zero lines of cache logic

### vs Apollo's Automatic Updates
- **Apollo**: Only updates entities already in cache
- **Cascade**: Provides full context of all affected entities and invalidations

### vs Relay's Updater Functions
- **Relay**: Framework-specific updater functions
- **Cascade**: Standardized protocol that works with any client

### vs Refetch Queries
- **Refetch**: Network request for every affected query
- **Cascade**: Surgical cache updates, only refetch when necessary

## Next Steps

- **[Installation](/guide/installation)** - Install Cascade in your project
- **[Quick Start](/guide/quick-start)** - Build your first Cascade-enabled app
- **[Core Concepts](/guide/concepts)** - Deep dive into how Cascade works
