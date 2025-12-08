# Client Libraries

GraphQL Cascade provides official integrations for all major GraphQL clients.

## Supported Clients

### Apollo Client
The most popular GraphQL client for React applications.

- **Package**: `@graphql-cascade/client-apollo`
- **Setup time**: 5 minutes
- **Features**: Full cascade support, optimistic updates, cache persistence
- **[Get Started →](/clients/apollo)**

### React Query (TanStack Query)
Modern data fetching for React with built-in caching.

- **Package**: `@graphql-cascade/client-react-query`
- **Setup time**: 5 minutes
- **Features**: Integration with React Query's mutation system
- **[Get Started →](/clients/react-query)**

### Relay
Facebook's GraphQL client optimized for performance.

- **Package**: `@graphql-cascade/client-relay`
- **Setup time**: 10 minutes
- **Features**: Works with Relay's store and updater functions
- **[Get Started →](/clients/relay)**

### URQL
Lightweight and extensible GraphQL client.

- **Package**: `@graphql-cascade/client-urql`
- **Setup time**: 5 minutes
- **Features**: Custom exchange for cascade processing
- **[Get Started →](/clients/urql)**

## Common Features

All client libraries provide:

- **Automatic cache updates** from cascade metadata
- **Optimistic update support** with rollback on errors
- **TypeScript support** with full type inference
- **Framework agnostic core** with React hooks
- **Conflict resolution** for concurrent updates
- **Performance optimization** with batching and deduplication

## Quick Comparison

| Feature | Apollo | React Query | Relay | URQL |
|---------|--------|-------------|-------|------|
| Normalized Cache | ✅ | ⚠️ (optional) | ✅ | ⚠️ (optional) |
| Optimistic Updates | ✅ | ✅ | ✅ | ✅ |
| Subscriptions | ✅ | ⚠️ (via plugin) | ✅ | ✅ |
| Bundle Size | 33KB | 12KB | 50KB | 5KB |
| React Native | ✅ | ✅ | ✅ | ✅ |
| Server-Side Rendering | ✅ | ✅ | ✅ | ✅ |
| Cascade Support | ✅ | ✅ | ✅ | ✅ |

## Installation

Each client library is installed separately:

```bash
# Apollo Client
npm install @graphql-cascade/client-apollo

# React Query
npm install @graphql-cascade/client-react-query

# Relay
npm install @graphql-cascade/client-relay

# URQL
npm install @graphql-cascade/client-urql
```

## Basic Usage Pattern

All clients follow a similar pattern:

### 1. Wrap Your Client

```typescript
import { createCascadeLink } from '@graphql-cascade/client-apollo';

const cascadeLink = createCascadeLink();
const client = new ApolloClient({
  link: cascadeLink.concat(httpLink),
  cache: new InMemoryCache()
});
```

### 2. Use Mutations Normally

```typescript
const [createTodo] = useMutation(CREATE_TODO);

// Cascade is processed automatically
await createTodo({ variables: { title: 'New todo' } });
```

### 3. Include Cascade in Queries

```graphql
mutation CreateTodo($input: CreateTodoInput!) {
  createTodo(input: $input) {
    todo {
      id
      title
      completed
    }
    __cascade {
      created { __typename id }
      updated { __typename id }
      deleted { __typename id }
      invalidated { __typename field }
    }
  }
}
```

## Framework Support

### React

All client libraries provide React hooks:

```typescript
import { useMutation, useQuery } from '@apollo/client';

function TodoApp() {
  const { data } = useQuery(GET_TODOS);
  const [createTodo] = useMutation(CREATE_TODO);
  // ...
}
```

### Vue

Use with Vue's composition API:

```typescript
import { useQuery, useMutation } from '@vue/apollo-composable';

export default {
  setup() {
    const { result } = useQuery(GET_TODOS);
    const { mutate } = useMutation(CREATE_TODO);
    // ...
  }
};
```

### Svelte

Works with Svelte stores:

```typescript
import { query, mutation } from 'svelte-apollo';

const todos = query(GET_TODOS);
const createTodo = mutation(CREATE_TODO);
```

### React Native

Full support for mobile apps:

```typescript
import { useQuery, useMutation } from '@apollo/client';
// Same API as React web
```

## Advanced Features

### Custom Cache Updates

Override automatic updates when needed:

```typescript
const [createTodo] = useMutation(CREATE_TODO, {
  update(cache, { data }) {
    // Cascade is applied automatically
    // Add custom logic if needed
    const cascade = data.createTodo.__cascade;
    console.log('Cascade processed:', cascade);
  }
});
```

### Cascade Filtering

Filter which cascades are processed:

```typescript
const cascadeLink = createCascadeLink({
  shouldProcessCascade: (cascade) => {
    // Skip cascades with too many updates
    return cascade.updated.length < 100;
  }
});
```

### Error Handling

Handle cascade processing errors:

```typescript
const cascadeLink = createCascadeLink({
  onError: (error) => {
    console.error('Cascade processing failed:', error);
    analytics.track('Cascade Error', { error: error.message });
  }
});
```

## Debugging

Enable debug logging:

```typescript
const cascadeLink = createCascadeLink({
  debug: true // Logs all cascade operations
});
```

View cascade metadata in browser DevTools:

```typescript
// Available in window.__CASCADE__
window.__CASCADE__.getLastCascade();
window.__CASCADE__.getCascadeHistory();
```

## Migration Guides

Migrating from manual cache updates:

- **[From Apollo Manual Updates](/clients/apollo#migration)** - Remove `update` functions
- **[From Relay Updaters](/clients/relay#migration)** - Replace `updater` functions
- **[From React Query Manual Invalidation](/clients/react-query#migration)** - Remove `invalidateQueries` calls

## Next Steps

Choose your client library:

- **[Apollo Client](/clients/apollo)** - Most popular, best for React
- **[React Query](/clients/react-query)** - Modern, flexible data fetching
- **[Relay](/clients/relay)** - Performance-optimized, best for large apps
- **[URQL](/clients/urql)** - Lightweight, highly extensible
