# GraphQL Cascade Specification v0.1

## Introduction

### Problem Statement

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

### Solution

GraphQL Cascade eliminates manual cache management by having servers automatically track and return all affected entities (the "cascade") when mutations execute. Clients apply these cascades automatically, keeping caches synchronized without any manual code.

```typescript
// Before: Manual cache updates (20+ lines)
const [updateUser] = useMutation(UPDATE_USER, {
  update(cache, { data }) { /* ... lots of manual logic ... */ }
});

// After: Automatic cascade (1 line)
const [updateUser] = useCascadeMutation(UPDATE_USER);
```

### Goals

1. **Zero Boilerplate**: Eliminate manual `update` functions and cache manipulation code
2. **Automatic Consistency**: Ensure caches stay synchronized with server state
3. **Framework Agnostic**: Work with any GraphQL client (Apollo, Relay, React Query, URQL, etc.)
4. **Performance Optimized**: Reduce over-fetching and unnecessary network requests
5. **Developer Experience**: Let developers focus on business logic, not cache management
6. **Backward Compatible**: Work with existing GraphQL servers and clients
7. **Standardized**: Provide a specification that any implementation can follow

### Non-Goals

- **Client-side framework implementation details**: The spec defines interfaces, not React components or Vue directives
- **Database-specific optimizations**: Compatible with any database or ORM
- **Authentication/authorization protocols**: Assumes existing auth systems
- **GraphQL schema language extensions**: Uses standard GraphQL SDL
- **Real-time synchronization protocols**: Focuses on mutation responses, not subscriptions
- **Client-side state management**: Integrates with existing cache systems

### Audience

#### Server Developers
GraphQL backend developers who want to provide automatic cache updates to their frontend teams. You'll implement entity tracking and cascade response construction in your GraphQL resolvers.

#### Client Developers
Frontend developers using GraphQL clients who want to eliminate manual cache management. You'll integrate cascade processing into your existing Apollo/Relay/React Query setup.

#### Library Authors
Developers building GraphQL client libraries or server frameworks who want to add Cascade support. You'll implement the CascadeCache interface or server-side tracking.

### Relationship to GraphQL Specification

GraphQL Cascade builds on the official GraphQL specification without changing it:

- **Additive**: Only adds fields to mutation responses, doesn't modify core GraphQL behavior
- **Compatible**: Works with existing GraphQL queries, mutations, and subscriptions
- **Standard**: Uses standard GraphQL SDL for schema definitions
- **Optional**: Clients MAY opt-in to cascade processing

### Relationship to Other Specifications

#### GraphQL Cursor Connections
Complements pagination by providing invalidation hints for connection-based queries. Cascade responses can include invalidation for `usersConnection` queries.

#### Relay Modern
Inspired by Relay's global object identification and mutation `updater` functions, but provides a standardized, framework-agnostic alternative to manual updaters.

#### Apollo Cache Protocol
Inspired by Apollo's normalized cache patterns and optimistic updates, but defines a specification that works across all GraphQL clients, not just Apollo.

#### JSON:API
Similar to JSON:API's compound documents and automatic sideloaded relationships, but designed specifically for GraphQL's flexible query model.

## Overview

GraphQL Cascade is a specification that enables automatic frontend cache updates from GraphQL mutation responses. It defines a standardized way for GraphQL servers to communicate all affected entities (the "cascade") when a mutation executes, allowing clients to automatically update their caches without manual logic.

## Core Concept

When a mutation executes, the server tracks all entities that were affected by the mutation and returns them in a structured format. This includes:

- The primary result of the mutation
- Related entities that were updated as a consequence
- Entities that were deleted
- Cache invalidation hints for queries that may be stale

Clients can then automatically apply these updates to their cache, eliminating the need for manual cache management code.

## Key Benefits

1. **Zero Boilerplate**: No manual `update` functions or cache manipulation code
2. **Automatic Consistency**: Cache stays synchronized with server state
3. **Framework Agnostic**: Works with any GraphQL client (Apollo, Relay, React Query, etc.)
4. **Performance**: Reduces over-fetching and unnecessary network requests
5. **Developer Experience**: Focus on business logic, not cache management

## Specification Scope

### Core Features (MUST implement)
- CascadeResponse interface for mutation responses
- Entity update tracking and reporting
- Deletion tracking
- Basic cache invalidation hints

### Extended Features (SHOULD implement)
- Cascade depth control
- Relationship traversal configuration
- Transaction metadata
- Error handling with structured error codes

### Optional Features (MAY implement)
- Optimistic updates protocol
- Real-time subscriptions integration
- Conflict resolution
- Analytics hooks

### Non-Goals
- Client-side framework implementation details
- Database-specific optimizations
- Authentication/authorization protocols
- GraphQL schema language extensions

## Architecture

The specification consists of three main components:

1. **Server Requirements**: How backends track and report cascade updates
2. **Response Format**: Standardized structure for cascade data
3. **Client Integration**: Framework-agnostic patterns for applying cascades

## Compliance Levels

- **Cascade Basic**: Implements core features
- **Cascade Standard**: Implements core + extended features
- **Cascade Complete**: Implements all features

## Relationship to Existing Specifications

GraphQL Cascade builds upon and complements existing GraphQL specifications:

- **GraphQL Cursor Connections**: For pagination
- **Relay Modern**: For inspiration on global object identification
- **Apollo Cache**: For inspiration on cache normalization patterns

It is designed to be compatible with existing GraphQL clients and servers, requiring only additions to mutation responses.