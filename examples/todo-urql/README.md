# GraphQL Cascade Todo App - URQL Example

This example demonstrates how to integrate GraphQL Cascade with URQL for automatic cache management and real-time updates.

## Architecture

This example showcases **exchange-based cascade processing** in URQL:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   URQL Client   │────│  Cascade Exchange │────│   GraphQL API   │
│                 │    │                  │    │  (Apollo Server) │
│ - cacheExchange │    │ - Processes      │    │ - @graphql-     │
│ - fetchExchange │    │   cascade data   │    │   cascade/server │
│ - cascadeExchange│    │ - Updates cache │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Key Files

- **`frontend/src/urql-client.ts`** - URQL client setup with cascade exchange
- **`frontend/src/cascade-exchange.ts`** - Custom exchange for processing cascade data
- **`backend/src/schema.ts`** - GraphQL schema with cascade directives
- **`backend/src/resolvers.ts`** - Resolvers using cascade builder

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development servers:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   - Frontend: http://localhost:5173
   - GraphQL Playground: http://localhost:4000/graphql

## How Cascade Works with URQL

### 1. Custom Cascade Exchange

The `cascadeExchange` intercepts GraphQL responses and processes cascade data from the `extensions` field:

```typescript
import { cascadeExchange } from '@graphql-cascade/urql';

const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    cacheExchange,
    cascadeExchange({
      onCascade: (cascade) => console.log('Cascade received:', cascade),
    }),
    fetchExchange,
  ],
});
```

### 2. Automatic Cache Updates

When you create, update, or delete todos, the server sends cascade data that automatically:

- **Updates** the cache with new/modified entities
- **Invalidates** stale queries
- **Removes** deleted entities from cache

### 3. Real-time Synchronization

All connected clients stay in sync without manual cache management. Changes from one client automatically propagate to others through cascade updates.

## API

The GraphQL API provides standard CRUD operations with cascade responses:

```graphql
mutation CreateTodo($input: CreateTodoInput!) {
  createTodo(input: $input) {
    success
    data {
      id
      title
      completed
    }
    cascade {
      updated {
        __typename
        id
        operation
      }
      invalidations {
        queryName
        strategy
        scope
      }
    }
  }
}
```

## Comparison with Manual Cache Management

**Without Cascade (Traditional URQL):**
```typescript
// Manual cache updates required
const { data } = await client.mutation(CREATE_TODO, variables);

// Manually update cache
client.cache.updateQuery({ query: LIST_TODOS }, (data) => ({
  ...data,
  todos: [...data.todos, newTodo]
}));
```

**With Cascade (Automatic):**
```typescript
// Just execute the mutation
const { data } = await client.mutation(CREATE_TODO, variables);
// Cache updates happen automatically via cascade exchange!
```

## Backend

The backend uses Apollo Server with the GraphQL Cascade plugin. See the [backend README](./backend/README.md) for details.