# GraphQL Cascade URQL Integration

Seamless integration with URQL for automatic cascade cache updates. This package provides a custom exchange that processes GraphQL Cascade responses and automatically updates URQL's cache.

## Installation

```bash
npm install @graphql-cascade/client-urql @urql/core
```

### Peer Dependencies

- `@urql/core`: ^4.0.0 or later
- `graphql`: ^16.0.0 or later

## Features

- **Cascade Exchange** - Custom URQL exchange for automatic cache updates
- **Query Invalidation** - Automatically invalidates queries based on cascade hints
- **Optimistic Updates** - Full support for optimistic UI patterns
- **Normalized Cache Integration** - Works with @urql/exchange-graphcache
- **TypeScript Support** - Full type safety with generic parameters
- **Lightweight** - Minimal bundle size impact (~2KB gzipped)

## Quick Start

### Basic Setup

```typescript
import { createClient, fetchExchange } from '@urql/core';
import { cascadeExchange } from '@graphql-cascade/client-urql';

const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    cascadeExchange({
      debug: process.env.NODE_ENV === 'development',
      onCascade: (cascade) => {
        console.log('Cascade received:', cascade);
      }
    }),
    fetchExchange
  ]
});
```

### React Integration

```tsx
import { Provider } from 'urql';
import { createClient, fetchExchange } from '@urql/core';
import { cascadeExchange } from '@graphql-cascade/client-urql';

const client = createClient({
  url: '/graphql',
  exchanges: [cascadeExchange(), fetchExchange]
});

function App() {
  return (
    <Provider value={client}>
      <YourApp />
    </Provider>
  );
}
```

### Using URQLCascadeClient

For more control, use the `URQLCascadeClient` wrapper:

```typescript
import { createClient, fetchExchange } from '@urql/core';
import { URQLCascadeClient, InMemoryCascadeCache } from '@graphql-cascade/client-urql';

const urqlClient = createClient({
  url: '/graphql',
  exchanges: [fetchExchange]
});

const cache = new InMemoryCascadeCache();
const cascadeClient = new URQLCascadeClient(urqlClient, cache);

// Mutations automatically process cascade responses
const result = await cascadeClient.mutate(
  `mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      success
      data { id title completed }
      cascade {
        updated { __typename id operation entity }
        deleted { __typename id }
        invalidations { queryName scope }
      }
    }
  }`,
  { input: { title: 'New Todo' } }
);
```

## The Cascade Exchange

### How It Works

The cascade exchange intercepts mutation responses and processes the `cascade` field:

1. **Updated Entities** - Writes new/updated entities to the cache
2. **Deleted Entities** - Removes entities from the cache
3. **Invalidations** - Marks affected queries for refetching

### Exchange Pipeline Position

Position the cascade exchange before the fetch exchange but after other processing exchanges:

```typescript
import { cacheExchange, fetchExchange } from '@urql/core';
import { cascadeExchange } from '@graphql-cascade/client-urql';

const client = createClient({
  url: '/graphql',
  exchanges: [
    // Cache exchange first (optional)
    cacheExchange,
    // Cascade exchange processes responses
    cascadeExchange(),
    // Fetch exchange last
    fetchExchange
  ]
});
```

### Configuration Options

```typescript
interface CascadeExchangeOptions {
  /** Callback when cascade data is received */
  onCascade?: (cascade: CascadeData) => void;

  /** Callback when an entity is written to cache */
  onCacheUpdate?: (typename: string, id: string, data: any) => void;

  /** Callback when an entity is deleted from cache */
  onCacheDelete?: (typename: string, id: string) => void;

  /** Enable debug logging */
  debug?: boolean;

  /** Custom cache adapter */
  cacheAdapter?: CascadeCache;

  /** Filter which cascade responses to process */
  shouldProcess?: (cascade: CascadeData) => boolean;
}
```

## Optimistic Updates

### Basic Optimistic Update

```typescript
import { useMutation } from 'urql';

const [result, updateTodo] = useMutation(UPDATE_TODO);

const handleUpdate = () => {
  updateTodo(
    { id: '123', completed: true },
    {
      optimistic: {
        __typename: 'Mutation',
        updateTodo: {
          __typename: 'UpdateTodoResponse',
          success: true,
          data: {
            __typename: 'Todo',
            id: '123',
            completed: true
          },
          cascade: {
            updated: [{
              __typename: 'Todo',
              id: '123',
              operation: 'UPDATED',
              entity: { completed: true }
            }],
            deleted: [],
            invalidations: []
          }
        }
      }
    }
  );
};
```

### Using URQLCascadeClient for Optimistic Updates

```typescript
const result = await cascadeClient.mutateOptimistic(
  UPDATE_TODO,
  { id: '1', title: 'Updated Title' },
  {
    optimisticResponse: {
      updateTodo: {
        __typename: 'UpdateTodoResponse',
        success: true,
        data: {
          __typename: 'Todo',
          id: '1',
          title: 'Updated Title'
        },
        cascade: {
          updated: [{
            __typename: 'Todo',
            id: '1',
            operation: 'UPDATED',
            entity: { title: 'Updated Title' }
          }],
          deleted: [],
          invalidations: []
        }
      }
    },
    onRollback: (error) => {
      console.error('Optimistic update rolled back:', error);
    }
  }
);
```

## Integration with @urql/exchange-graphcache

For normalized caching, combine with graphcache:

```typescript
import { createClient, fetchExchange } from '@urql/core';
import { cacheExchange } from '@urql/exchange-graphcache';
import { cascadeExchange } from '@graphql-cascade/client-urql';

const client = createClient({
  url: '/graphql',
  exchanges: [
    cacheExchange({
      keys: {
        Todo: (data) => data.id,
        User: (data) => data.id
      },
      resolvers: {
        Query: {
          todo: (_, args) => ({ __typename: 'Todo', id: args.id })
        }
      }
    }),
    cascadeExchange({
      onCascade: (cascade) => {
        // Cascade updates are automatically normalized
      }
    }),
    fetchExchange
  ]
});
```

## API Reference

### `cascadeExchange(options?)`

Creates a URQL exchange that processes cascade responses.

```typescript
import { cascadeExchange } from '@graphql-cascade/client-urql';

const exchange = cascadeExchange({
  debug: true,
  onCascade: (cascade) => { /* ... */ },
  onCacheUpdate: (typename, id, data) => { /* ... */ },
  onCacheDelete: (typename, id) => { /* ... */ },
  shouldProcess: (cascade) => cascade.updated.length > 0
});
```

### `URQLCascadeClient`

Wrapper client for URQL with enhanced cascade support.

```typescript
class URQLCascadeClient {
  constructor(client: Client, cache: CascadeCache);

  /** Execute a mutation with cascade processing */
  mutate<T = any>(
    document: string | DocumentNode,
    variables?: Record<string, any>
  ): Promise<T>;

  /** Execute a mutation with optimistic updates */
  mutateOptimistic<T = any>(
    document: string | DocumentNode,
    variables: Record<string, any>,
    config: OptimisticConfig<T>
  ): Promise<T>;

  /** Get the underlying URQL client */
  getClient(): Client;

  /** Get the cache instance */
  getCache(): CascadeCache;
}
```

### `InMemoryCascadeCache`

In-memory cache implementation for cascade updates.

```typescript
class InMemoryCascadeCache implements CascadeCache {
  /** Write an entity to the cache */
  write(typename: string, id: string, data: any): void;

  /** Read an entity from the cache */
  read(typename: string, id: string): any | null;

  /** Remove an entity from the cache */
  evict(typename: string, id: string): void;

  /** Invalidate queries matching the pattern */
  invalidate(invalidation: CascadeInvalidation): void;

  /** Clear all cached data */
  clear(): void;

  /** Get all cached entities of a type */
  getByType(typename: string): Map<string, any>;
}
```

## TypeScript Support

Full TypeScript support with generic parameters:

```typescript
interface CreateTodoResponse {
  success: boolean;
  data: {
    id: string;
    title: string;
    completed: boolean;
  };
  cascade: CascadeData;
}

interface CreateTodoVariables {
  input: {
    title: string;
    completed?: boolean;
  };
}

const result = await cascadeClient.mutate<CreateTodoResponse>(
  CREATE_TODO,
  { input: { title: 'New Todo' } } as CreateTodoVariables
);

// result.data is typed as CreateTodoResponse
```

## Advanced Usage

### Custom Cache Adapter

```typescript
import { CascadeCache, CascadeInvalidation } from '@graphql-cascade/client-urql';

class CustomCache implements CascadeCache {
  private store: Map<string, any> = new Map();

  write(typename: string, id: string, data: any): void {
    this.store.set(`${typename}:${id}`, data);
  }

  read(typename: string, id: string): any | null {
    return this.store.get(`${typename}:${id}`) ?? null;
  }

  evict(typename: string, id: string): void {
    this.store.delete(`${typename}:${id}`);
  }

  invalidate(invalidation: CascadeInvalidation): void {
    // Custom invalidation logic
  }
}

const cascadeClient = new URQLCascadeClient(client, new CustomCache());
```

### Server-Side Rendering (SSR)

```typescript
import { createClient, ssrExchange, fetchExchange } from '@urql/core';
import { cascadeExchange } from '@graphql-cascade/client-urql';

// Create SSR exchange
const ssr = ssrExchange({
  isClient: typeof window !== 'undefined'
});

const client = createClient({
  url: '/graphql',
  suspense: true,
  exchanges: [
    ssr,
    cascadeExchange(),
    fetchExchange
  ]
});

// Extract data for hydration
const ssrData = ssr.extractData();
```

### Subscriptions with Cascade

```typescript
import { subscriptionExchange } from '@urql/core';
import { createClient as createWSClient } from 'graphql-ws';

const wsClient = createWSClient({
  url: 'ws://localhost:4000/graphql'
});

const client = createClient({
  url: '/graphql',
  exchanges: [
    cascadeExchange({
      onCascade: (cascade) => {
        // Handle real-time cascade updates
      }
    }),
    subscriptionExchange({
      forwardSubscription: (operation) => ({
        subscribe: (sink) => ({
          unsubscribe: wsClient.subscribe(operation, sink)
        })
      })
    }),
    fetchExchange
  ]
});
```

## Troubleshooting

### Cache Not Updating

1. Ensure the cascade exchange is positioned correctly in the exchange pipeline
2. Check that mutation responses include the `cascade` field
3. Verify entities have `__typename` and `id` fields

### Debug Logging

```typescript
const exchange = cascadeExchange({
  debug: true,
  onCascade: (cascade) => {
    console.log('Updated:', cascade.updated);
    console.log('Deleted:', cascade.deleted);
    console.log('Invalidations:', cascade.invalidations);
  }
});
```

### Common Issues

- **Exchange order matters** - Place cascade exchange before fetchExchange
- **Missing __typename** - Ensure all entities include __typename
- **Optimistic mismatch** - Optimistic response must match server response structure

## Migration Guide

### From Manual Cache Updates

**Before (Manual Updates):**
```typescript
const [result, createTodo] = useMutation(CREATE_TODO);

createTodo(variables, {
  update: (cache, result) => {
    // Complex manual cache manipulation
    const existing = cache.readQuery({ query: GET_TODOS });
    cache.writeQuery({
      query: GET_TODOS,
      data: {
        todos: [...existing.todos, result.data.createTodo]
      }
    });
  }
});
```

**After (With Cascade):**
```typescript
const [result, createTodo] = useMutation(CREATE_TODO);

createTodo(variables);
// Cache updates automatically from cascade response!
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build
npm run build

# Type checking
npm run typecheck
```

## Contributing

See the main [Contributing Guide](../../CONTRIBUTING.md) for details on how to contribute.

## License

MIT
