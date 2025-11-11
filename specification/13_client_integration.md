# Client Integration

This section defines how GraphQL clients consume and apply GraphQL Cascade responses. The specification provides framework-agnostic interfaces that can be implemented for any GraphQL client library.

## Table of Contents

- [Generic Cascade Client](#generic-cascade-client)
  - [CascadeCache Interface](#cascadecache-interface)
  - [Cascade Processing](#cascade-processing)
  - [Invalidation Handling](#invalidation-handling)
  - [Error Recovery](#error-recovery)
- [Apollo Client Integration](#apollo-client-integration)
  - [ApolloCascadeClient](#apollocascadeclient)
  - [Cache Updates](#cache-updates)
  - [Query Invalidation](#query-invalidation)
  - [Optimistic Updates](#optimistic-updates)
- [Relay Integration](#relay-integration)
  - [RelayCascadeClient](#relaycascadeclient)
  - [Store Updates](#store-updates)
  - [Connection Handling](#connection-handling)
  - [Subscription Integration](#subscription-integration)
- [React Query Integration](#react-query-integration)
  - [ReactQueryCascadeClient](#reactquerycascadeclient)
  - [Query Updates](#query-updates)
  - [Mutation Integration](#mutation-integration)
  - [Cache Synchronization](#cache-synchronization)
- [URQL Integration](#urql-integration)
  - [URQLCascadeClient](#urqlcascadeclient)
  - [Exchange Implementation](#exchange-implementation)
  - [Cache Operations](#cache-operations)
  - [Extension Points](#extension-points)
- [Error Handling](#error-handling)
  - [Network Errors](#network-errors)
  - [Cascade Errors](#cascade-errors)
  - [Recovery Strategies](#recovery-strategies)
  - [User Feedback](#user-feedback)
- [Performance Considerations](#performance-considerations)
  - [Batch Processing](#batch-processing)
  - [Memory Management](#memory-management)
  - [Update Optimization](#update-optimization)
  - [Monitoring](#monitoring)
- [Examples](#examples)
  - [Apollo Client Example](#apollo-client-example)
  - [React Query Example](#react-query-example)
  - [Error Handling Example](#error-handling-example)

## Generic Cascade Client

### CascadeCache Interface

All Cascade-compliant clients MUST implement the `CascadeCache` interface:

```typescript
/**
 * Generic cache interface for GraphQL Cascade.
 * Implement this interface to integrate with any cache system.
 */
export interface CascadeCache {
  /**
   * Write an entity to the cache.
   */
  write(typename: string, id: string, data: any): void;

  /**
   * Read an entity from the cache.
   */
  read(typename: string, id: string): any | null;

  /**
   * Evict (remove) an entity from the cache.
   */
  evict(typename: string, id: string): void;

  /**
   * Invalidate queries matching the pattern.
   */
  invalidate(invalidation: QueryInvalidation): void;

  /**
   * Refetch queries matching the pattern.
   */
  refetch(invalidation: QueryInvalidation): Promise<void>;

  /**
   * Remove queries from cache.
   */
  remove(invalidation: QueryInvalidation): void;

  /**
   * Identify an entity (get cache key).
   */
  identify(entity: any): string;
}
```

### CascadeResponse Types

```typescript
/**
 * GraphQL Cascade response structure.
 */
export interface CascadeResponse<T = any> {
  success: boolean;
  errors?: CascadeError[];
  data: T;
  cascade: CascadeUpdates;
}

export interface CascadeUpdates {
  updated: UpdatedEntity[];
  deleted: DeletedEntity[];
  invalidations: QueryInvalidation[];
  metadata: CascadeMetadata;
}

export interface UpdatedEntity {
  __typename: string;
  id: string;
  operation: 'CREATED' | 'UPDATED' | 'DELETED';
  entity: any;
}

export interface DeletedEntity {
  __typename: string;
  id: string;
  deletedAt: string;
}

export interface CascadeMetadata {
  timestamp: string;
  transactionId?: string;
  depth: number;
  affectedCount: number;
}

export interface CascadeError {
  message: string;
  code: string;
  field?: string;
  path?: string[];
  extensions?: any;
}
```

### QueryInvalidation Types

```typescript
export interface QueryInvalidation {
  queryName?: string;
  queryHash?: string;
  arguments?: Record<string, any>;
  queryPattern?: string;
  strategy: InvalidationStrategy;
  scope: InvalidationScope;
}

export enum InvalidationStrategy {
  INVALIDATE = 'INVALIDATE',
  REFETCH = 'REFETCH',
  REMOVE = 'REMOVE'
}

export enum InvalidationScope {
  EXACT = 'EXACT',
  PREFIX = 'PREFIX',
  PATTERN = 'PATTERN',
  ALL = 'ALL'
}
```

### Generic Cascade Client Implementation

```typescript
/**
 * Generic GraphQL Cascade client.
 */
export class CascadeClient {
  constructor(
    private cache: CascadeCache,
    private executor: (query: DocumentNode, variables: any) => Promise<any>
  ) {}

  /**
   * Apply a cascade response to the cache.
   */
  applyCascade(response: CascadeResponse): void {
    const { data, cascade } = response;

    // 1. Write primary result
    if (data && typeof data === 'object' && '__typename' in data && 'id' in data) {
      this.cache.write(data.__typename, data.id, data);
    }

    // 2. Apply all updates
    cascade.updated.forEach(({ __typename, id, entity }) => {
      this.cache.write(__typename, id, entity);
    });

    // 3. Handle deletions
    cascade.deleted.forEach(({ __typename, id }) => {
      this.cache.evict(__typename, id);
    });

    // 4. Process invalidations
    cascade.invalidations.forEach(invalidation => {
      switch (invalidation.strategy) {
        case InvalidationStrategy.INVALIDATE:
          this.cache.invalidate(invalidation);
          break;
        case InvalidationStrategy.REFETCH:
          this.cache.refetch(invalidation);
          break;
        case InvalidationStrategy.REMOVE:
          this.cache.remove(invalidation);
          break;
      }
    });
  }

  /**
   * Execute a mutation and apply the cascade automatically.
   */
  async mutate<T = any>(
    mutation: DocumentNode,
    variables?: any
  ): Promise<T> {
    const result = await this.executor(mutation, variables);

    // Extract the mutation result (first field in data)
    const mutationName = Object.keys(result.data)[0];
    const cascadeResponse = result.data[mutationName] as CascadeResponse<T>;

    // Apply cascade
    this.applyCascade(cascadeResponse);

    // Return the primary data
    return cascadeResponse.data;
  }
}
```

## Apollo Client Integration

### ApolloCascadeCache Implementation

```typescript
import { ApolloClient, InMemoryCache, gql, DocumentNode } from '@apollo/client';
import { CascadeClient, CascadeCache, QueryInvalidation } from '@graphql-cascade/client';

/**
 * Apollo Client cache adapter for GraphQL Cascade.
 */
export class ApolloCascadeCache implements CascadeCache {
  constructor(private cache: InMemoryCache) {}

  write(typename: string, id: string, data: any): void {
    const cacheId = this.cache.identify({ __typename: typename, id });

    // Write using cache.writeFragment
    this.cache.writeFragment({
      id: cacheId,
      fragment: gql`
        fragment _ on ${typename} {
          ${Object.keys(data).join('\n')}
        }
      `,
      data
    });
  }

  read(typename: string, id: string): any | null {
    const cacheId = this.cache.identify({ __typename: typename, id });
    return this.cache.readFragment({
      id: cacheId,
      fragment: gql`fragment _ on ${typename} { id }`
    });
  }

  evict(typename: string, id: string): void {
    const cacheId = this.cache.identify({ __typename: typename, id });
    this.cache.evict({ id: cacheId });
    this.cache.gc(); // Garbage collect
  }

  invalidate(invalidation: QueryInvalidation): void {
    // Apollo doesn't have direct invalidation API
    // Use evict with broadcast: false
    if (invalidation.queryName) {
      this.cache.evict({ fieldName: invalidation.queryName });
    }
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    // Trigger refetch via Apollo's refetchQueries
    // (requires access to ApolloClient, not just cache)
    this.invalidate(invalidation);
  }

  remove(invalidation: QueryInvalidation): void {
    this.invalidate(invalidation);
  }

  identify(entity: any): string {
    return this.cache.identify(entity) || `${entity.__typename}:${entity.id}`;
  }
}
```

### ApolloCascadeClient Implementation

```typescript
/**
 * Apollo Client integration for GraphQL Cascade.
 */
export class ApolloCascadeClient extends CascadeClient {
  constructor(private apollo: ApolloClient<any>) {
    super(
      new ApolloCascadeCache(apollo.cache as InMemoryCache),
      (query, variables) => apollo.query({ query, variables })
    );
  }

  /**
   * Execute a mutation with automatic cascade application.
   */
  async mutate<T = any>(
    mutation: DocumentNode,
    variables?: any
  ): Promise<T> {
    const result = await this.apollo.mutate({
      mutation,
      variables
    });

    const mutationName = Object.keys(result.data!)[0];
    const cascadeResponse = result.data![mutationName];

    this.applyCascade(cascadeResponse);

    return cascadeResponse.data;
  }
}
```

### Apollo Usage Example

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { ApolloCascadeClient } from '@graphql-cascade/apollo';
import gql from 'graphql-tag';

const apollo = new ApolloClient({ cache: new InMemoryCache() });
const cascade = new ApolloCascadeClient(apollo);

const updatedUser = await cascade.mutate(
  gql`
    mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
      updateUser(id: $id, input: $input) {
        success
        errors { message code }
        data { id name email }
        cascade {
          updated { __typename id operation entity }
          deleted { __typename id }
          invalidations { queryName strategy scope }
          metadata { timestamp affectedCount }
        }
      }
    }
  `,
  { id: '123', input: { name: 'New Name' } }
);
// Cache updated automatically!
```

## Relay Integration

### RelayCascadeCache Implementation

```typescript
import {
  Environment,
  RecordSource,
  Store,
  RecordProxy,
  commitLocalUpdate
} from 'relay-runtime';
import { CascadeClient, CascadeCache } from '@graphql-cascade/client';

/**
 * Relay cache adapter for GraphQL Cascade.
 */
export class RelayCascadeCache implements CascadeCache {
  constructor(private environment: Environment) {}

  write(typename: string, id: string, data: any): void {
    commitLocalUpdate(this.environment, store => {
      const record = store.get(id) || store.create(id, typename);

      Object.entries(data).forEach(([key, value]) => {
        record.setValue(value as any, key);
      });
    });
  }

  read(typename: string, id: string): any | null {
    const snapshot = this.environment.lookup({
      dataID: id,
      node: { kind: 'Fragment', /* ... */ } as any,
      variables: {}
    });
    return snapshot.data;
  }

  evict(typename: string, id: string): void {
    commitLocalUpdate(this.environment, store => {
      store.delete(id);
    });
  }

  invalidate(invalidation: QueryInvalidation): void {
    // Relay doesn't have query invalidation
    // Instead, we'd need to refetch queries manually
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    // Would need to track active queries and refetch them
  }

  remove(invalidation: QueryInvalidation): void {
    this.invalidate(invalidation);
  }

  identify(entity: any): string {
    return entity.id;
  }
}
```

### RelayCascadeClient Implementation

```typescript
/**
 * Relay integration for GraphQL Cascade.
 */
export class RelayCascadeClient extends CascadeClient {
  constructor(environment: Environment) {
    super(
      new RelayCascadeCache(environment),
      (query, variables) => environment.execute({ operation: query as any, variables })
    );
  }
}
```

## React Query Integration

### ReactQueryCascadeCache Implementation

```typescript
import { QueryClient } from '@tanstack/react-query';
import { CascadeClient, CascadeCache } from '@graphql-cascade/client';

/**
 * React Query cache adapter for GraphQL Cascade.
 *
 * Note: React Query doesn't have normalized cache,
 * so we focus on query invalidation.
 */
export class ReactQueryCascadeCache implements CascadeCache {
  constructor(private queryClient: QueryClient) {}

  write(typename: string, id: string, data: any): void {
    // React Query stores data by query key, not by entity
    // We update all queries that might contain this entity
    this.queryClient.setQueriesData(
      { predicate: query => this.queryContainsEntity(query, typename, id) },
      oldData => this.updateEntityInData(oldData, typename, id, data)
    );
  }

  read(typename: string, id: string): any | null {
    // Can't directly read entities from React Query
    return null;
  }

  evict(typename: string, id: string): void {
    // Remove entity from all queries
    this.queryClient.setQueriesData(
      { predicate: query => this.queryContainsEntity(query, typename, id) },
      oldData => this.removeEntityFromData(oldData, typename, id)
    );
  }

  invalidate(invalidation: QueryInvalidation): void {
    const queryKey = this.invalidationToQueryKey(invalidation);
    this.queryClient.invalidateQueries(queryKey);
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    const queryKey = this.invalidationToQueryKey(invalidation);
    await this.queryClient.refetchQueries(queryKey);
  }

  remove(invalidation: QueryInvalidation): void {
    const queryKey = this.invalidationToQueryKey(invalidation);
    this.queryClient.removeQueries(queryKey);
  }

  identify(entity: any): string {
    return `${entity.__typename}:${entity.id}`;
  }

  private invalidationToQueryKey(invalidation: QueryInvalidation): any {
    if (invalidation.scope === 'EXACT') {
      return [invalidation.queryName, invalidation.arguments];
    } else if (invalidation.scope === 'PREFIX') {
      return { queryKey: [invalidation.queryName] };
    } else {
      return { predicate: () => true }; // Invalidate all
    }
  }

  private queryContainsEntity(query: any, typename: string, id: string): boolean {
    // Check if query data contains this entity
    const data = query.state.data;
    return this.searchForEntity(data, typename, id);
  }

  private searchForEntity(data: any, typename: string, id: string): boolean {
    if (!data) return false;
    if (Array.isArray(data)) {
      return data.some(item => this.searchForEntity(item, typename, id));
    }
    if (typeof data === 'object') {
      if (data.__typename === typename && data.id === id) return true;
      return Object.values(data).some(value => this.searchForEntity(value, typename, id));
    }
    return false;
  }

  private updateEntityInData(data: any, typename: string, id: string, newData: any): any {
    if (!data) return data;
    if (Array.isArray(data)) {
      return data.map(item => this.updateEntityInData(item, typename, id, newData));
    }
    if (typeof data === 'object') {
      if (data.__typename === typename && data.id === id) {
        return { ...data, ...newData };
      }
      const updated: any = {};
      for (const [key, value] of Object.entries(data)) {
        updated[key] = this.updateEntityInData(value, typename, id, newData);
      }
      return updated;
    }
    return data;
  }

  private removeEntityFromData(data: any, typename: string, id: string): any {
    if (!data) return data;
    if (Array.isArray(data)) {
      return data
        .filter(item => !(item?.__typename === typename && item?.id === id))
        .map(item => this.removeEntityFromData(item, typename, id));
    }
    if (typeof data === 'object') {
      const updated: any = {};
      for (const [key, value] of Object.entries(data)) {
        updated[key] = this.removeEntityFromData(value, typename, id);
      }
      return updated;
    }
    return data;
  }
}
```

### ReactQueryCascadeClient Implementation

```typescript
/**
 * React Query integration for GraphQL Cascade.
 */
export class ReactQueryCascadeClient extends CascadeClient {
  constructor(
    queryClient: QueryClient,
    executor: (query: any, variables: any) => Promise<any>
  ) {
    super(new ReactQueryCascadeCache(queryClient), executor);
  }
}
```

### React Query Hook

```typescript
/**
 * React Hook for GraphQL Cascade mutations with React Query.
 */
export function useCascadeMutation<T = any>(
  cascadeClient: ReactQueryCascadeClient,
  mutation: DocumentNode
) {
  return useMutation({
    mutationFn: (variables: any) => cascadeClient.mutate<T>(mutation, variables)
  });
}
```

## URQL Integration

### UrqlCascadeCache Implementation

```typescript
import { Client, cacheExchange } from '@urql/core';
import { CascadeClient, CascadeCache } from '@graphql-cascade/client';

/**
 * URQL cache adapter for GraphQL Cascade.
 */
export class UrqlCascadeCache implements CascadeCache {
  constructor(private client: Client) {}

  write(typename: string, id: string, data: any): void {
    // URQL's cache is more complex, would need to use cache.updateQuery
    // This is a simplified version
  }

  read(typename: string, id: string): any | null {
    return null;
  }

  evict(typename: string, id: string): void {
    // URQL doesn't have direct eviction
  }

  invalidate(invalidation: QueryInvalidation): void {
    // Use URQL's cache invalidation
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    // Refetch via URQL
  }

  remove(invalidation: QueryInvalidation): void {
    this.invalidate(invalidation);
  }

  identify(entity: any): string {
    return `${entity.__typename}:${entity.id}`;
  }
}
```

### UrqlCascadeClient Implementation

```typescript
/**
 * URQL integration for GraphQL Cascade.
 */
export class UrqlCascadeClient extends CascadeClient {
  constructor(client: Client, executor: any) {
    super(new UrqlCascadeCache(client), executor);
  }
}
```

## Error Handling

Cascade-compliant clients MUST handle errors gracefully:

```typescript
export class CascadeClient {
  // ... existing code ...

  /**
   * Apply cascade with error handling.
   */
  applyCascade(response: CascadeResponse): void {
    try {
      const { data, cascade } = response;

      // 1. Write primary result
      if (data && typeof data === 'object' && '__typename' in data && 'id' in data) {
        try {
          this.cache.write(data.__typename, data.id, data);
        } catch (error) {
          console.warn(`Failed to write primary result to cache:`, error);
          // Continue processing cascade
        }
      }

      // 2. Apply all updates
      cascade.updated.forEach(({ __typename, id, entity }) => {
        try {
          this.cache.write(__typename, id, entity);
        } catch (error) {
          console.warn(`Failed to write entity ${__typename}:${id} to cache:`, error);
          // Continue with other updates
        }
      });

      // 3. Handle deletions
      cascade.deleted.forEach(({ __typename, id }) => {
        try {
          this.cache.evict(__typename, id);
        } catch (error) {
          console.warn(`Failed to evict entity ${__typename}:${id} from cache:`, error);
          // Continue with other deletions
        }
      });

      // 4. Process invalidations
      cascade.invalidations.forEach(invalidation => {
        try {
          switch (invalidation.strategy) {
            case InvalidationStrategy.INVALIDATE:
              this.cache.invalidate(invalidation);
              break;
            case InvalidationStrategy.REFETCH:
              this.cache.refetch(invalidation);
              break;
            case InvalidationStrategy.REMOVE:
              this.cache.remove(invalidation);
              break;
          }
        } catch (error) {
          console.warn(`Failed to process invalidation:`, error);
          // Continue with other invalidations
        }
      });
    } catch (error) {
      console.error(`Cascade application failed:`, error);
      // Don't throw - cascade failures shouldn't break the mutation
    }
  }
}
```

## Performance Considerations

### Asynchronous Processing
Clients SHOULD process cascades asynchronously to avoid blocking the UI:

```typescript
export class CascadeClient {
  async applyCascadeAsync(response: CascadeResponse): Promise<void> {
    // Process in next tick to avoid blocking
    await new Promise(resolve => setTimeout(resolve, 0));

    this.applyCascade(response);
  }
}
```

### Batching Updates
Clients SHOULD batch cache updates when possible:

```typescript
export class BatchingCascadeCache implements CascadeCache {
  private updates: Array<() => void> = [];

  write(typename: string, id: string, data: any): void {
    this.updates.push(() => this.cache.write(typename, id, data));
  }

  // ... other methods queue operations ...

  flush(): void {
    // Execute all queued operations
    this.updates.forEach(update => update());
    this.updates = [];
  }
}
```

### Debounced Invalidation
Clients SHOULD debounce invalidation operations:

```typescript
export class DebouncedCascadeCache implements CascadeCache {
  private invalidationQueue: QueryInvalidation[] = [];
  private timeoutId: number | null = null;

  invalidate(invalidation: QueryInvalidation): void {
    this.invalidationQueue.push(invalidation);

    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      // Process all queued invalidations
      this.processInvalidations();
      this.timeoutId = null;
    }, 100); // 100ms debounce
  }

  private processInvalidations(): void {
    // Deduplicate and process invalidations
    const uniqueInvalidations = this.deduplicateInvalidations(this.invalidationQueue);
    uniqueInvalidations.forEach(inv => this.cache.invalidate(inv));
    this.invalidationQueue = [];
  }
}
```

## Examples

### Simple Mutation with Cascade

```typescript
// GraphQL mutation
const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      success
      errors { message code }
      data { id name email }
      cascade {
        updated { __typename id operation entity }
        deleted { __typename id }
        invalidations { queryName strategy scope }
        metadata { timestamp affectedCount }
      }
    }
  }
`;

// Client usage
const cascadeClient = new ApolloCascadeClient(apolloClient);

const updatedUser = await cascadeClient.mutate(UPDATE_USER, {
  id: '123',
  input: { name: 'New Name' }
});

// Cache automatically updated with:
// - The updated User entity
// - Any related entities (company, etc.)
// - Invalidated queries (listUsers, searchUsers, etc.)
```

### Handling Cascade Errors

```typescript
try {
  const result = await cascadeClient.mutate(CREATE_POST, {
    input: { title: 'New Post', content: 'Content' }
  });

  if (!result.success) {
    // Handle mutation errors
    console.error('Mutation failed:', result.errors);
  }
} catch (error) {
  // Handle network or other errors
  console.error('Request failed:', error);
}
// Cascade still applied even if there were errors
```

### Custom Cache Implementation

```typescript
class CustomCascadeCache implements CascadeCache {
  constructor(private myCache: MyCustomCache) {}

  write(typename: string, id: string, data: any): void {
    this.myCache.set(`${typename}:${id}`, data);
  }

  read(typename: string, id: string): any | null {
    return this.myCache.get(`${typename}:${id}`);
  }

  evict(typename: string, id: string): void {
    this.myCache.delete(`${typename}:${id}`);
  }

  invalidate(invalidation: QueryInvalidation): void {
    // Custom invalidation logic
    if (invalidation.queryName) {
      this.myCache.invalidatePattern(`${invalidation.queryName}*`);
    }
  }

  // ... implement other methods ...
}

const customClient = new CascadeClient(
  new CustomCascadeCache(myCustomCache),
  myGraphQLExecutor
);
```</content>
</xai:function_call">The file has been written successfully.