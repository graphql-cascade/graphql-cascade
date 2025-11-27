# @graphql-cascade/client

The core client library providing framework-agnostic interfaces and base classes for GraphQL Cascade client implementations.

## Installation

```bash
npm install @graphql-cascade/client
```

## Overview

This package provides the foundation for all GraphQL Cascade client integrations:

- **`CascadeClient`**: Base client class for processing cascade responses
- **`OptimisticCascadeClient`**: Extended client with optimistic update support
- **`CascadeCache`**: Interface for cache implementations
- **TypeScript types**: Complete type definitions for cascade responses
- **Logging utilities**: Debug and trace logging support

## When to Use This Package

- You're building a **custom integration** for a GraphQL client not yet supported
- You want **direct control** over cache operations
- You're implementing **framework-agnostic** cascade processing

For specific framework integrations, use:
- `@graphql-cascade/client-apollo` - Apollo Client
- `@graphql-cascade/client-react-query` - React Query
- `@graphql-cascade/client-relay` - Relay
- `@graphql-cascade/client-urql` - URQL

## Basic Usage

```typescript
import { CascadeClient, CascadeCache, CascadeResponse } from '@graphql-cascade/client';
import { DocumentNode } from 'graphql';

// Implement the CascadeCache interface for your cache
class MyCacheAdapter implements CascadeCache {
  write(typename: string, id: string, data: any): void {
    // Write entity to your cache
  }

  read(typename: string, id: string): any {
    // Read entity from your cache
  }

  evict(typename: string, id: string): void {
    // Remove entity from your cache
  }

  invalidate(invalidation: QueryInvalidation): void {
    // Mark queries as stale
  }

  refetch(invalidation: QueryInvalidation): void {
    // Refetch invalidated queries
  }

  remove(invalidation: QueryInvalidation): void {
    // Remove cached query data
  }
}

// Create the client
const cache = new MyCacheAdapter();
const executor = async (query: DocumentNode, variables: any) => {
  // Execute GraphQL query/mutation
  return fetch('/graphql', {
    method: 'POST',
    body: JSON.stringify({ query, variables })
  }).then(r => r.json());
};

const cascade = new CascadeClient(cache, executor);

// Execute mutations - cascade updates are applied automatically
const user = await cascade.mutate(UPDATE_USER_MUTATION, { id: '123', name: 'John' });
```

## CascadeClient API

### Constructor

```typescript
new CascadeClient(cache: CascadeCache, executor: GraphQLExecutor)
```

### Methods

```typescript
// Execute a mutation with automatic cascade application
async mutate<T>(mutation: DocumentNode, variables?: any): Promise<T>

// Execute a query (no cascade processing)
async query<T>(query: DocumentNode, variables?: any): Promise<T>

// Manually apply a cascade response
applyCascade(response: CascadeResponse): void

// Get the underlying cache
getCache(): CascadeCache
```

## OptimisticCascadeClient

For optimistic updates that provide immediate UI feedback:

```typescript
import { OptimisticCascadeClient } from '@graphql-cascade/client';

const cascade = new OptimisticCascadeClient(cache, executor);

// Execute with optimistic response
const user = await cascade.mutateOptimistic(
  UPDATE_USER_MUTATION,
  { id: '123', name: 'John' },
  {
    // Optimistic data applied immediately
    optimisticResponse: {
      __typename: 'User',
      id: '123',
      name: 'John'
    }
  }
);
```

## Type Definitions

### CascadeResponse

```typescript
interface CascadeResponse<T = any> {
  success: boolean;
  data: T;
  errors?: CascadeError[];
  cascade: CascadeUpdates;
}
```

### CascadeUpdates

```typescript
interface CascadeUpdates {
  updated: UpdatedEntity[];
  deleted: DeletedEntity[];
  invalidations: QueryInvalidation[];
  metadata: CascadeMetadata;
}
```

### CascadeCache Interface

```typescript
interface CascadeCache {
  write(typename: string, id: string, data: any): void;
  read(typename: string, id: string): any;
  evict(typename: string, id: string): void;
  invalidate(invalidation: QueryInvalidation): void;
  refetch(invalidation: QueryInvalidation): void;
  remove(invalidation: QueryInvalidation): void;
}
```

### QueryInvalidation

```typescript
interface QueryInvalidation {
  queryName?: string;
  strategy: InvalidationStrategy;
  scope: InvalidationScope;
  variables?: Record<string, any>;
}

enum InvalidationStrategy {
  INVALIDATE = 'INVALIDATE',  // Mark as stale
  REFETCH = 'REFETCH',        // Refetch immediately
  REMOVE = 'REMOVE'           // Remove from cache
}

enum InvalidationScope {
  EXACT = 'EXACT',    // Exact query match
  PREFIX = 'PREFIX',  // Query name prefix
  ALL = 'ALL'         // All queries
}
```

## Building Custom Integrations

To integrate with a new GraphQL client:

1. **Implement `CascadeCache`** for your client's cache
2. **Create an executor function** that calls your client's query method
3. **Extend `CascadeClient`** if needed for client-specific features

Example for a hypothetical client:

```typescript
import { CascadeClient, CascadeCache, QueryInvalidation } from '@graphql-cascade/client';

class MyClientCache implements CascadeCache {
  constructor(private myClient: MyGraphQLClient) {}

  write(typename: string, id: string, data: any): void {
    this.myClient.cache.writeEntity(typename, id, data);
  }

  read(typename: string, id: string): any {
    return this.myClient.cache.readEntity(typename, id);
  }

  evict(typename: string, id: string): void {
    this.myClient.cache.removeEntity(typename, id);
  }

  invalidate(invalidation: QueryInvalidation): void {
    this.myClient.cache.markStale(invalidation.queryName);
  }

  refetch(invalidation: QueryInvalidation): void {
    this.myClient.refetchQueries([invalidation.queryName]);
  }

  remove(invalidation: QueryInvalidation): void {
    this.myClient.cache.removeQuery(invalidation.queryName);
  }
}

export class MyCascadeClient extends CascadeClient {
  constructor(myClient: MyGraphQLClient) {
    super(
      new MyClientCache(myClient),
      (query, variables) => myClient.execute(query, variables)
    );
  }
}
```

## Logging

Enable debug logging for troubleshooting:

```typescript
import { setLogLevel, LogLevel } from '@graphql-cascade/client';

// Enable verbose logging
setLogLevel(LogLevel.DEBUG);

// Or use environment variable
// CASCADE_LOG_LEVEL=debug
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build
```

## Related Packages

- [@graphql-cascade/server](../server-node) - Server implementation
- [@graphql-cascade/client-apollo](../client-apollo) - Apollo Client integration
- [@graphql-cascade/client-react-query](../client-react-query) - React Query integration
- [@graphql-cascade/client-relay](../client-relay) - Relay integration
- [@graphql-cascade/client-urql](../client-urql) - URQL integration

## License

MIT