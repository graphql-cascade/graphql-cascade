# GraphQL Cascade

<p align="center">
  <img src="cascade.png" alt="GraphQL Cascade Logo" width="300">
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Specification](https://img.shields.io/badge/Specification-v0.1-blue)](./specification/)

**Cascading cache updates for GraphQL** - Automatic, intelligent cache invalidation that cascades through your entire data graph.

## Overview

GraphQL Cascade solves the cache invalidation problem by automatically tracking entity relationships and cascading invalidations through your data graph. When you mutate data, related cache entries are automatically invalidated and refetched, ensuring your UI stays consistent without manual cache management.

## Problem

GraphQL caching is hard. When you mutate data, you need to manually invalidate all related cache entries across your entire application. This leads to:

- **Stale data** - Cache entries become outdated after mutations
- **Complex invalidation logic** - Developers must track all relationships manually
- **Race conditions** - Multiple mutations can conflict
- **Poor UX** - Users see inconsistent data states

### Manual Cache Management (Traditional)

```mermaid
graph TD
    A[Mutation] --> B[Update Database]
    B --> C[Manual Cache Logic]
    C --> D[Find Related Queries]
    D --> E[Invalidate Cache Entries]
    E --> F[Refetch Data]
    F --> G[Update UI]

    C --> H{Missed any<br/>relationships?}
    H -->|Yes| I[Stale Data Bug]
    H -->|No| J[Correct UI]

    style I fill:#ffebee
    style J fill:#e8f5e8
```

### Automatic Cache Management (GraphQL Cascade)

```mermaid
graph TD
    A[Mutation] --> B[Update Database]
    B --> C[Server Tracks Relationships]
    C --> D[Build Cascade Response]
    D --> E[Client Applies Cascade]
    E --> F[Cache Auto-Updated]
    F --> G[UI Auto-Updated]

    style F fill:#e8f5e8
    style G fill:#e8f5e8
```

## Solution

GraphQL Cascade automatically tracks entity relationships and cascades cache invalidations through your data graph. When you update a user, all related posts, comments, and notifications are automatically invalidated.

### How It Works

```mermaid
graph TD
    A[Client Mutation] --> B[GraphQL Server]
    B --> C[Execute Mutation]
    C --> D[Track Entity Changes]
    D --> E[Find Related Entities]
    E --> F[Build Cascade Response]

    F --> G[Return to Client]
    G --> H[Apply to Cache]
    H --> I[Auto-Update UI]

    style A fill:#e1f5fe
    style C fill:#f3e5f5
    style H fill:#e8f5e8
```

### Cascade Flow Example

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Database

    Client->>Server: updateUser(id: "123", name: "John")
    Server->>Database: UPDATE users SET name = 'John' WHERE id = 123
    Database-->>Server: User updated
    Server->>Database: Find related entities (posts, comments, etc.)
    Database-->>Server: Related: Post[456], Comment[789]
    Server->>Server: Build cascade response
    Server-->>Client: { data: User, cascade: { updated: [User, Post, Comment] } }
    Client->>Client: Auto-update cache with cascade
    Note over Client: UI automatically shows updated data
```

### Entity Relationship Tracking

GraphQL Cascade automatically discovers and tracks entity relationships to ensure complete cache invalidation:

```mermaid
graph TD
    A[User<br/>id: 123] --> B[Posts<br/>authorId: 123]
    A --> C[Comments<br/>authorId: 123]
    A --> D[Profile<br/>userId: 123]
    B --> E[Post Likes<br/>postId: *]
    C --> F[Comment Likes<br/>commentId: *]

    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#f3e5f5
    style D fill:#f3e5f5

    subgraph "When User 123 is updated:"
        G[✅ User cache updated]
        H[✅ All posts cache updated]
        I[✅ All comments cache updated]
        J[✅ Profile cache updated]
        K[✅ Related likes cache updated]
    end
```

### Before GraphQL Cascade
```javascript
// Manual cache invalidation - error prone and incomplete
const updateUser = async (userId, updates) => {
  await mutate({ variables: { userId, updates } });

  // Manually invalidate all related cache entries
  cache.evict({ fieldName: 'user', args: { id: userId } });
  cache.evict({ fieldName: 'posts', args: { authorId: userId } });
  cache.evict({ fieldName: 'comments', args: { authorId: userId } });
  cache.evict({ fieldName: 'notifications', args: { userId } });
  // ... and many more - easy to miss some!
};
```

### After GraphQL Cascade
```javascript
// Automatic cascading invalidation
const updateUser = async (userId, updates) => {
  await mutate({ variables: { userId, updates } });
  // Cache automatically cascades through all relationships!
};
```

## Quick Start

### Server (Python)

```bash
pip install graphql-cascade
```

### Client (TypeScript)

```bash
npm install @graphql-cascade/client
# Or with Apollo
npm install @graphql-cascade/client @graphql-cascade/client-apollo
```

## Getting Started

- **[Quick Start Guide](./docs/getting-started/quick-start.md)** - 5-minute setup
- **[Concepts](./docs/getting-started/concepts.md)** - Core concepts explained
- **[First Cascade](./docs/getting-started/first-cascade.md)** - Build your first implementation

## Documentation

- **[Specification](./specification/)** - Complete technical specification
- **[Guides](./docs/guides/)** - Implementation guides for different frameworks
- **[API Reference](./docs/api/)** - Complete API documentation
- **[Examples](./examples/)** - Working examples for different use cases

## Examples

- **[Todo App](./examples/todo-app/)** - Simple CRUD with cascades
- **[Blog Platform](./examples/blog-platform/)** - Complex relationships
- **[Real-time Collaboration](./examples/real-time-collab/)** - Subscriptions with cascades

## Community

- **GitHub Discussions**: Ask questions and share ideas
- **Contributing**: See our [contribution guide](./CONTRIBUTING.md)

## Status

🚧 **Early Development** - Specification and reference implementations available. Production-ready packages coming soon.

- ✅ Core specification complete
- ✅ Python/FraiseQL server implementation
- ✅ Apollo Client integration
- 🚧 React Query integration (in progress)
- 🚧 Relay integration (planned)

## License

MIT License - see [LICENSE](./LICENSE) for details.
