# GraphQL Cascade

<p align="center">
  <img src="cascade.png" alt="GraphQL Cascade Logo" width="300">
</p>

<p align="center">
  <a href="https://github.com/graphql-cascade/graphql-cascade/actions/workflows/ci.yml">
    <img src="https://github.com/graphql-cascade/graphql-cascade/actions/workflows/ci.yml/badge.svg" alt="CI Status">
  </a>
  <a href="https://github.com/graphql-cascade/graphql-cascade/actions/workflows/codeql.yml">
    <img src="https://github.com/graphql-cascade/graphql-cascade/actions/workflows/codeql.yml/badge.svg" alt="CodeQL">
  </a>
  <a href="https://codecov.io/gh/graphql-cascade/graphql-cascade">
    <img src="https://codecov.io/gh/graphql-cascade/graphql-cascade/branch/main/graph/badge.svg" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@graphql-cascade/server">
    <img src="https://badge.fury.io/js/%40graphql-cascade%2Fserver.svg" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/@graphql-cascade/server">
    <img src="https://img.shields.io/npm/dm/@graphql-cascade/server.svg" alt="npm downloads">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  </a>
  <a href="./specification/">
    <img src="https://img.shields.io/badge/Specification-v1.1-blue" alt="Specification v1.1">
  </a>
  <a href="https://github.com/graphql-cascade/graphql-cascade/issues">
    <img src="https://img.shields.io/github/issues/graphql-cascade/graphql-cascade" alt="GitHub issues">
  </a>
  <a href="https://github.com/graphql-cascade/graphql-cascade/blob/main/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
  </a>
</p>

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

<p align="center">
  <img src="docs/diagrams/manual-cache-management.png" alt="Manual Cache Management Flow" width="600">
</p>

### Automatic Cache Management (GraphQL Cascade)

<p align="center">
  <img src="docs/diagrams/automatic-cache-management.png" alt="Automatic Cache Management Flow" width="600">
</p>

## Solution

GraphQL Cascade automatically tracks entity relationships and cascades cache invalidations through your data graph. When you update a user, all related posts, comments, and notifications are automatically invalidated.

### How It Works

**The Problem:** After a mutation, clients don't know which queries to refetch.

```graphql
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    post { id, title }
    # Now what? Need to refetch getUserPosts? getNotifications? postCount?
    # Client has to guess which queries are affected by this mutation
  }
}
```

**The Solution:** Cascade returns ALL affected data directly in the mutation response.

```graphql
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    post { id, title }
    cascade {
      updated {
        User { id, postCount }           # ← Updated automatically
        Notification { id, message }     # ← New notifications
      }
    }
  }
}
```

The client receives everything in one response — no guessing, no refetching required.

### Before GraphQL Cascade
```javascript
// Client must guess which queries to refetch
const createPost = async (input) => {
  const result = await mutate(CREATE_POST, input);

  // Did this mutation affect postCount? notifications?
  // Must manually refetch related queries
  await refetch(['getUserPosts', 'getNotifications', 'getUser']);
};
```

### After GraphQL Cascade
```javascript
// Server tells client exactly what changed
const createPost = async (input) => {
  const result = await mutate(CREATE_POST, input);

  // Cascade data is in the response - no refetching needed
  cache.updateEntity('User', result.cascade.updated.User);
  cache.updateEntity('Notification', result.cascade.updated.Notification);
};
```

### Entity Relationship Tracking

GraphQL Cascade automatically discovers and tracks entity relationships to ensure complete cache updates:

<p align="center">
  <img src="docs/diagrams/entity-relationships.png" alt="Entity Relationship Tracking" width="600">
</p>

## Quick Start

### Server (TypeScript/Node.js)

```bash
npm install @graphql-cascade/server
```

```typescript
import { CascadeTracker, CascadeBuilder } from '@graphql-cascade/server';

// Create tracker and builder
const tracker = new CascadeTracker();
const builder = new CascadeBuilder(tracker);

// In your mutation resolver
const transactionId = tracker.startTransaction();
tracker.trackUpdate({ id: userId, __typename: 'User', name: 'John' });
const response = builder.buildResponse(mutationResult);
// Response includes cascade data for automatic cache updates
```

### Client (Apollo)

```bash
npm install @graphql-cascade/client-apollo @apollo/client
```

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { ApolloCascadeClient } from '@graphql-cascade/client-apollo';

const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cache: new InMemoryCache()
});

const cascade = new ApolloCascadeClient(client);

// Mutations automatically update the cache!
const result = await cascade.mutate(UPDATE_USER, { id: '123', name: 'John' });
```

## TypeScript Code Generation

Get full type safety with automatic TypeScript code generation:

```bash
# Initialize codegen configuration
npx cascade codegen init

# Install dependencies
npm install -D @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-cascade/codegen

# Generate types
npx cascade codegen
```

**Before codegen:**
```typescript
const [createTodo] = useCascadeMutation(CREATE_TODO);
//    ^ any type, no autocomplete
```

**After codegen:**
```typescript
import { CreateTodoDocument, CreateTodoMutation } from './generated/graphql';

const [createTodo] = useCascadeMutation<CreateTodoMutation>(CreateTodoDocument);
//    ^ Fully typed with IDE autocomplete for cascade updates!

const result = await createTodo({ variables: { title: 'New Todo' } });
result.cascade.updated.forEach(entity => {
  // Full type safety on cascade data
  console.log(`Updated ${entity.__typename}`);
});
```

The codegen plugin automatically generates:
- Type-safe mutation and query types
- Cascade helper types (`CascadeOf<T>`, `DataOf<T>`)
- Union type guards for error handling
- Pre-configured `UnionCascadeConfig` objects

See [@graphql-cascade/codegen](./packages/codegen) for full documentation.

## Packages

| Package | Description |
|---------|-------------|
| [@graphql-cascade/server](./packages/server-node) | Server implementation for Node.js/TypeScript |
| [@graphql-cascade/client-apollo](./packages/client-apollo) | Apollo Client integration |
| [@graphql-cascade/client-react-query](./packages/client-react-query) | React Query integration |
| [@graphql-cascade/client-relay](./packages/client-relay) | Relay Modern integration |
| [@graphql-cascade/client-urql](./packages/client-urql) | URQL integration |
| [@graphql-cascade/codegen](./packages/codegen) | TypeScript code generation plugin |
| [@graphql-cascade/cli](./packages/cli) | CLI tools for development and debugging |
| [@graphql-cascade/conformance](./packages/conformance) | Conformance test suite |

## Documentation

- **[Guide](./docs/guide/)** - Getting started and core concepts
- **[Server Documentation](./docs/server/)** - Server implementation guides
- **[Client Documentation](./docs/clients/)** - Client library guides
- **[CLI Documentation](./docs/cli/)** - Command-line tools
- **[Specification](./docs/specification/)** - Technical specification
- **[API Reference](./docs/api/)** - Complete API documentation

## Community

- **GitHub Discussions**: Ask questions and share ideas
- **Contributing**: See our [contribution guide](./CONTRIBUTING.md)

## Status

- ✅ Core specification complete
- ✅ TypeScript server implementation
- ✅ Apollo Client integration
- ✅ React Query integration
- ✅ Relay integration
- ✅ URQL integration
- ✅ CLI tools
- ✅ Conformance test suite

## License

MIT License - see [LICENSE](./LICENSE) for details.
