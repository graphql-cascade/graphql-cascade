# GraphQL Cascade URQL Integration

Seamless integration with URQL for automatic cascade cache updates.

## Installation

```bash
npm install @graphql-cascade/urql @urql/core
```

## Features

- Cascade exchange for automatic cache updates
- Query invalidation based on cascade hints
- Support for optimistic updates
- Full URQL compatibility

## Usage

### Basic Setup

```typescript
import { createClient } from '@urql/core';
import { cascadeExchange, URQLCascadeClient, InMemoryCascadeCache } from '@graphql-cascade/urql';

// Create URQL client with cascade exchange
const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    cascadeExchange({
      onCascade: (cascade) => {
        console.log('Cascade updates:', cascade);
      }
    }),
    // ... other exchanges
  ]
});

// Or use the URQLCascadeClient wrapper
const cache = new InMemoryCascadeCache();
const cascadeClient = new URQLCascadeClient(client, cache);

// Mutations automatically update the cache
const result = await cascadeClient.mutate(CREATE_TODO, { title: 'New Todo' });
```

### With Optimistic Updates

```typescript
const result = await cascadeClient.mutateOptimistic(
  UPDATE_TODO,
  { id: '1', title: 'Updated' },
  {
    optimisticResponse: {
      updateTodo: {
        __typename: 'Todo',
        id: '1',
        title: 'Updated'
      }
    }
  }
);
```

## API Reference

### `cascadeExchange(options?)`

Creates a URQL exchange that processes cascade responses.

**Options:**
- `onCascade`: Callback when cascade data is received
- `onCacheUpdate`: Callback when cache is updated
- `onCacheDelete`: Callback when entity is deleted
- `debug`: Enable debug logging
- `cacheAdapter`: Custom cache adapter

### `URQLCascadeClient`

Wrapper client for URQL with cascade support.

**Methods:**
- `mutate(document, variables)`: Execute mutation with cascade processing
- `mutateOptimistic(document, variables, config)`: Execute with optimistic updates

### `InMemoryCascadeCache`

In-memory cache implementation for cascade updates.

**Methods:**
- `write(typename, id, data)`: Write entity to cache
- `read(typename, id)`: Read entity from cache
- `evict(typename, id)`: Remove entity from cache
- `invalidate(invalidation)`: Invalidate queries

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## License

MIT
