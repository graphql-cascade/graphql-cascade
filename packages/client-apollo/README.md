# GraphQL Cascade Apollo Client Integration

Seamless integration with Apollo Client's normalized cache for automatic cascade updates. This package provides comprehensive support for GraphQL Cascade operations including optimistic updates, real-time subscriptions, cache persistence, and advanced error handling.

## Installation

```bash
npm install @graphql-cascade/client-apollo @apollo/client
```

### Peer Dependencies

This package requires the following peer dependencies:

- `@apollo/client`: ^3.8.0 or later
- `@graphql-cascade/client`: ^1.0.0 or later
- `react`: ^16.8.0 or later (for React hooks)
- `graphql`: ^16.0.0 or later

## Quick Start

### Basic Setup

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { ApolloCascadeClient } from '@graphql-cascade/client-apollo';

const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cache: new InMemoryCache()
});

const cascade = new ApolloCascadeClient(client);

// Mutations automatically update the cache
const result = await cascade.mutate(gql`
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      success
      errors { message code }
      data { id title completed }
      cascade {
        updated { __typename id operation entity }
        deleted { __typename id }
        invalidations { queryName strategy scope }
        metadata { timestamp affectedCount }
      }
    }
  }
`, { input: { title: 'Learn GraphQL Cascade' } });

console.log(result); // { id: '1', title: 'Learn GraphQL Cascade', completed: false }
```

### React Integration with Optimistic Updates

```tsx
import React from 'react';
import { ApolloProvider } from '@apollo/client';
import { useCascadeMutation } from '@graphql-cascade/client-apollo';

const TodoItem: React.FC<{ todo: Todo }> = ({ todo }) => {
  const [toggleTodo, { loading }] = useCascadeMutation(
    gql`
      mutation ToggleTodo($id: ID!) {
        toggleTodo(id: $id) {
          success
          data { id completed }
          cascade {
            updated { __typename id operation entity }
            metadata { timestamp affectedCount }
          }
        }
      }
    `,
    {
      optimistic: true,
      optimisticCascadeResponse: ({ id }) => ({
        success: true,
        data: { id, completed: !todo.completed },
        cascade: {
          updated: [{
            __typename: 'Todo',
            id,
            operation: 'UPDATED',
            entity: { id, completed: !todo.completed }
          }],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: new Date().toISOString(), affectedCount: 1 }
        }
      }),
      conflictResolution: 'SERVER_WINS'
    }
  );

  return (
    <div>
      <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
        {todo.title}
      </span>
      <button
        onClick={() => toggleTodo({ variables: { id: todo.id } })}
        disabled={loading}
      >
        {loading ? 'Updating...' : 'Toggle'}
      </button>
    </div>
  );
};
```

## API Reference

### ApolloCascadeClient

The main client class that wraps Apollo Client with cascade functionality.

```typescript
class ApolloCascadeClient {
  constructor(private apollo: ApolloClient<any>);

  // Execute mutations with automatic cascade application
  async mutate<T = any>(mutation: DocumentNode, variables?: any): Promise<T>;

  // Execute queries (no cascade processing)
  async query<T = any>(query: DocumentNode, variables?: any): Promise<T>;

  // Refetch queries based on invalidation rules
  async refetch(invalidation: QueryInvalidation): Promise<void>;

  // Get the underlying Apollo Client instance
  getApolloClient(): ApolloClient<any>;
}
```

### React Hooks

#### useCascadeMutation

A React hook that wraps Apollo's `useMutation` with cascade support and optimistic updates.

```typescript
interface UseCascadeMutationOptions<TData, TVariables> extends Omit<MutationHookOptions<TData, TVariables>, 'onCompleted' | 'onError' | 'update'> {
  optimistic?: boolean;
  optimisticCascadeResponse?: OptimisticResponseGenerator<TData, TVariables>;
  onCompleted?: (data: TData, cascade: CascadeUpdates) => void;
  onError?: (error: Error, variables: TVariables) => void;
  conflictResolution?: ConflictResolutionStrategy;
}

type UseCascadeMutationResult<TData, TVariables> = [
  (options?: MutationHookOptions<TData, TVariables>) => Promise<CascadeMutationResult<TData>>,
  {
    data?: TData;
    loading: boolean;
    error?: Error;
    called: boolean;
    cascade?: CascadeUpdates;
  }
];
```

**Example with Conflict Resolution:**

```tsx
const [updateUser, { loading, error }] = useCascadeMutation(
  UPDATE_USER_MUTATION,
  {
    optimistic: true,
    optimisticCascadeResponse: (variables) => ({
      success: true,
      data: { id: variables.id, name: variables.name },
      cascade: {
        updated: [{
          __typename: 'User',
          id: variables.id,
          operation: 'UPDATED',
          entity: { name: variables.name }
        }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: new Date().toISOString(), affectedCount: 1 }
      }
    }),
    conflictResolution: 'MERGE', // Merge server and client changes
    onCompleted: (data, cascade) => {
      console.log('User updated:', data);
      console.log('Cascade applied:', cascade);
    },
    onError: (error, variables) => {
      console.error('Update failed:', error);
    }
  }
);
```

### Cache Operations

#### ApolloCascadeCache

Apollo Client cache adapter implementing the CascadeCache interface.

```typescript
class ApolloCascadeCache implements CascadeCache {
  constructor(private cache: ApolloCache<any>);

  write(typename: string, id: string, data: any): void;
  read(typename: string, id: string): any | null;
  evict(typename: string, id: string): void;
  invalidate(invalidation: QueryInvalidation): void;
  identify(entity: any): string;
}
```

### Real-time Subscriptions

#### CascadeSubscriptionManager

Manages real-time cascade updates via GraphQL subscriptions.

```typescript
class CascadeSubscriptionManager {
  constructor(cascadeClient: ApolloCascadeClient, apolloClient: ApolloClient<unknown>);

  subscribe<TData = unknown>(
    subscription: DocumentNode,
    options: CascadeSubscriptionOptions<TData> = {}
  ): CascadeSubscriptionHandle;

  subscribeToEntity(
    typename: string,
    subscription: DocumentNode,
    options: CascadeSubscriptionOptions = {}
  ): CascadeSubscriptionHandle;

  subscribeToEntityById(
    typename: string,
    id: string,
    subscription: DocumentNode,
    options: CascadeSubscriptionOptions = {}
  ): CascadeSubscriptionHandle;
}
```

**Example:**

```typescript
const subscriptionManager = new CascadeSubscriptionManager(cascadeClient, apolloClient);

const handle = subscriptionManager.subscribeToEntity(
  'Todo',
  gql`
    subscription OnTodoUpdate {
      todoUpdated {
        cascade {
          updated { __typename id operation entity }
          deleted { __typename id }
          metadata { timestamp affectedCount }
        }
      }
    }
  `,
  {
    onCascade: (cascade) => {
      console.log('Todos updated:', cascade);
    },
    autoApply: true, // Automatically apply to cache
    filter: (event) => event.cascade.updated.length > 0
  }
);

// Later: handle.unsubscribe();
```

### Fragment Generation

#### CascadeFragmentGenerator

Automatically generates GraphQL fragments for cascade entities.

```typescript
class CascadeFragmentGenerator {
  constructor(options: FragmentGeneratorOptions = {});

  generateFragment(
    typename: string,
    entity: Record<string, unknown>,
    depth = 0
  ): FragmentInfo;

  generateFragmentsForCascade(cascade: CascadeUpdates): Map<string, FragmentInfo>;
  generateCombinedFragment(cascade: CascadeUpdates): DocumentNode;
}
```

**Example:**

```typescript
const generator = new CascadeFragmentGenerator({
  maxDepth: 2,
  includeTypename: true
});

const fragment = generator.generateFragment('User', {
  id: '1',
  name: 'John',
  profile: { avatar: 'url.jpg' }
});

console.log(fragment.document); // Generated fragment
```

### Error Handling

#### CascadeError & CascadeErrorRecovery

Comprehensive error handling with automatic recovery.

```typescript
class CascadeError extends Error {
  readonly code: CascadeErrorCode;
  readonly severity: CascadeErrorSeverity;
  readonly recoverable: boolean;
  readonly context: CascadeErrorContext;

  static fromApolloError(error: ApolloError, context?: Partial<CascadeErrorContext>): CascadeError;
  getRecoveryActions(): RecoveryAction[];
}

class CascadeErrorRecovery {
  constructor(options: ErrorRecoveryOptions = {});

  async withRecovery<T>(
    operation: () => Promise<T>,
    errorHandler?: (error: CascadeError) => void
  ): Promise<T>;
}
```

**Example:**

```typescript
const recovery = new CascadeErrorRecovery({
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true
});

try {
  const result = await recovery.withRecovery(() =>
    cascade.mutate(CREATE_POST_MUTATION, variables)
  );
} catch (error) {
  if (error instanceof CascadeError) {
    console.log('Recovery actions:', error.getRecoveryActions());
  }
}
```

### Cache Persistence

#### CascadeCachePersistence

Persistent cache storage with cascade history tracking.

```typescript
class CascadeCachePersistence {
  constructor(apolloClient: ApolloClient<NormalizedCacheObject>, options: CachePersistenceOptions);

  async persist(): Promise<void>;
  async restore(): Promise<boolean>;
  async clear(): Promise<void>;
  recordCascade(cascade: CascadeUpdates): void;
  getCascadeHistory(): CascadeHistoryEntry[];
}
```

**Example:**

```typescript
const persistence = new CascadeCachePersistence(apolloClient, {
  storage: createLocalStoragePersistence(),
  key: 'myapp_cache',
  persistOnChange: true,
  debounceMs: 1000,
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
});

// Restore on app start
await persistence.restore();

// Record cascades after application
onCascadeApplied(persistence, cascadeResponse);
```

## Advanced Usage

### Custom Conflict Resolution

```typescript
const [updateItem, result] = useCascadeMutation(UPDATE_MUTATION, {
  optimistic: true,
  conflictResolution: 'MANUAL',
  optimisticCascadeResponse: (variables) => ({
    // ... optimistic response
  }),
  onCompleted: (data, cascade) => {
    // Handle manual conflict resolution
    const conflictResolver = new CascadeConflictResolver();
    const conflicts = conflictResolver.detectConflicts(
      optimisticData,
      serverData
    );

    if (conflicts.hasConflict) {
      // Custom resolution logic
      const resolved = customResolveFunction(conflicts);
      cascadeClient.applyCascade({
        ...cascade,
        updated: cascade.updated.map(u =>
          u.id === resolved.id ? { ...u, entity: resolved } : u
        )
      });
    }
  }
});
```

### Batch Operations

```typescript
// Multiple mutations in sequence
const results = await Promise.all([
  cascade.mutate(CREATE_USER, userData),
  cascade.mutate(CREATE_POST, postData),
  cascade.mutate(CREATE_COMMENT, commentData)
]);

// All cache updates are applied automatically
```

### Custom Cache Configuration

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        todos: {
          // Custom merge function for pagination
          merge(existing, incoming) {
            return incoming;
          }
        }
      }
    }
  }
});

const cascade = new ApolloCascadeClient(
  new ApolloClient({
    cache,
    uri: '/graphql'
  })
);
```

## Migration Guide

### From Manual Apollo Cache Updates

**Before (Manual Cache Updates):**

```typescript
const [createTodo] = useMutation(CREATE_TODO, {
  update: (cache, { data }) => {
    // Manual cache updates
    const newTodo = data.createTodo;
    cache.modify({
      fields: {
        todos(existingTodos = []) {
          const newTodoRef = cache.writeFragment({
            data: newTodo,
            fragment: gql`
              fragment NewTodo on Todo {
                id
                title
                completed
              }
            `
          });
          return [...existingTodos, newTodoRef];
        }
      }
    });
  }
});
```

**After (GraphQL Cascade):**

```typescript
const [createTodo] = useCascadeMutation(CREATE_TODO, {
  // No manual update function needed!
  // Cache updates happen automatically via cascade
});
```

### From Apollo Cache Updates to Optimistic Updates

**Before:**

```typescript
const [updateTodo] = useMutation(UPDATE_TODO, {
  optimisticResponse: {
    updateTodo: {
      id: todoId,
      completed: !completed,
      __typename: 'Todo'
    }
  },
  update: (cache, { data }) => {
    // Manual optimistic update reversal if needed
  }
});
```

**After:**

```typescript
const [updateTodo] = useCascadeMutation(UPDATE_TODO, {
  optimistic: true,
  optimisticCascadeResponse: (variables) => ({
    success: true,
    data: { id: variables.id, completed: !variables.completed },
    cascade: {
      updated: [{
        __typename: 'Todo',
        id: variables.id,
        operation: 'UPDATED',
        entity: { completed: !variables.completed }
      }],
      deleted: [],
      invalidations: [],
      metadata: { timestamp: new Date().toISOString(), affectedCount: 1 }
    }
  })
});
```

### From Apollo Subscriptions to Cascade Subscriptions

**Before:**

```typescript
const { data } = useSubscription(TODO_UPDATED, {
  onData: ({ data }) => {
    // Manual cache updates
    cache.modify({
      // Complex manual update logic
    });
  }
});
```

**After:**

```typescript
const subscriptionManager = new CascadeSubscriptionManager(cascadeClient, apolloClient);

subscriptionManager.subscribeToEntity('Todo', TODO_UPDATED_SUBSCRIPTION, {
  onCascade: (cascade) => {
    // Automatic cache updates!
    console.log('Todos updated automatically');
  }
});
```

## TypeScript Types

### Core Types

```typescript
import type {
  CascadeUpdates,
  CascadeResponse,
  QueryInvalidation,
  InvalidationStrategy,
  InvalidationScope,
  CascadeOperation,
  UpdatedEntity,
  DeletedEntity
} from '@graphql-cascade/client';

import type {
  UseCascadeMutationOptions,
  UseCascadeMutationResult,
  CascadeMutationResult,
  ConflictResolutionStrategy,
  OptimisticResponseGenerator,
  CascadeSubscriptionOptions,
  CascadeSubscriptionHandle,
  CascadeSubscriptionEvent,
  FragmentGeneratorOptions,
  FragmentInfo,
  CachePersistenceOptions,
  PersistedCacheData,
  CascadeError,
  CascadeErrorCode,
  CascadeErrorSeverity,
  RecoveryAction,
  ErrorRecoveryOptions
} from '@graphql-cascade/client-apollo';
```

### Example Type Usage

```typescript
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

type CreateTodoVariables = {
  input: {
    title: string;
  };
};

type CreateTodoResponse = {
  success: boolean;
  errors?: Array<{ message: string; code: string }>;
  data: Todo;
  cascade: CascadeUpdates;
};

const [createTodo] = useCascadeMutation<
  CreateTodoResponse,
  CreateTodoVariables
>(CREATE_TODO_MUTATION, {
  onCompleted: (data, cascade) => {
    // Fully typed parameters
  }
});
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build the package
npm run build

# Lint code
npm run lint

# Type checking
npm run typecheck
```

## Contributing

See the main [Contributing Guide](../../CONTRIBUTING.md) for details on how to contribute to GraphQL Cascade.

## License

MIT