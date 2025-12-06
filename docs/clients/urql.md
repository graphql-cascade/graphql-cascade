# URQL Integration

Complete guide to using GraphQL Cascade with URQL. Learn how to integrate automatic cache management into URQL's exchange architecture for seamless GraphQL state management.

## Overview

GraphQL Cascade integrates with URQL through a custom exchange that automatically processes cascade metadata from your GraphQL mutations. This exchange sits in URQL's exchange pipeline, intercepting responses and applying cache updates based on the `__cascade` field returned by your mutations.

The integration works with URQL's normalized cache system, including `@urql/exchange-graphcache`, and provides automatic invalidation, entity updates, and cache synchronization without manual cache management.

## Installation

```bash
npm install @graphql-cascade/client-urql @urql/core
```

For normalized caching support, also install:

```bash
npm install @urql/exchange-graphcache
```

## Quick Start

Get started with GraphQL Cascade in under 5 minutes:

```typescript
import { createClient, Provider } from '@urql/core';
import { cascadeExchange } from '@graphql-cascade/client-urql';
import { graphExchange, fetchExchange } from '@urql/core';

const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    // Add cascade exchange before graphExchange
    cascadeExchange(),
    graphExchange({ schema }),
    fetchExchange
  ]
});

function App() {
  return (
    <Provider value={client}>
      <TodoApp />
    </Provider>
  );
}

// Your mutations now automatically update the cache
const CREATE_TODO = `
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      todo { id title completed }
      __cascade {
        created { __typename id }
        updated { __typename id }
        deleted { __typename id }
        invalidated { __typename field }
      }
    }
  }
`;

function TodoForm() {
  const [, createTodo] = useMutation(CREATE_TODO);

  const handleSubmit = (title: string) => {
    createTodo({ input: { title } });
    // Cache updates automatically - no manual cache management needed!
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e.target.title.value); }}>
      <input name="title" placeholder="New todo..." />
      <button type="submit">Create</button>
    </form>
  );
}
```

## The Cascade Exchange

The `cascadeExchange` is the core of URQL integration. It processes cascade metadata and applies cache updates automatically.

### Exchange Pipeline Position

```typescript
import { createClient } from '@urql/core';
import { cascadeExchange } from '@graphql-cascade/client-urql';
import { graphExchange, fetchExchange } from '@urql/core';

const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    // 1. Add cascade exchange early in the pipeline
    cascadeExchange({
      // Configuration options
    }),

    // 2. Graph cache exchange (for normalized caching)
    graphExchange({ schema }),

    // 3. Other exchanges...

    // 4. Fetch exchange (must be last)
    fetchExchange
  ]
});
```

### Configuration Options

```typescript
const cascadeExchange = cascadeExchange({
  // Enable debug logging in development
  debug: process.env.NODE_ENV === 'development',

  // Callback for each cascade operation
  onCascade: (cascade) => {
    console.log('Processing cascade:', cascade);
  },

  // Custom cache update logic
  onCacheUpdate: (typename, id, data) => {
    console.log(`Updated ${typename}:${id}`, data);
  },

  // Custom entity deletion logic
  onCacheDelete: (typename, id) => {
    console.log(`Deleted ${typename}:${id}`);
  },

  // Error handling
  onError: (error) => {
    console.error('Cascade processing error:', error);
  },

  // Filter which cascades to process
  shouldProcessCascade: (cascade) => {
    return cascade.updated.length < 1000; // Skip large cascades
  },

  // Custom cache adapter (advanced)
  cacheAdapter: customCacheAdapter
});
```

## Cache Integration

### With Graph Cache (@urql/exchange-graphcache)

GraphQL Cascade works seamlessly with URQL's normalized cache:

```typescript
import { createClient } from '@urql/core';
import { graphExchange } from '@urql/exchange-graphcache';
import { cascadeExchange } from '@graphql-cascade/client-urql';

const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    cascadeExchange(),
    graphExchange({
      schema,
      updates: {
        // Manual updates still work alongside cascade
        Mutation: {
          deleteTodo: (result, args, cache) => {
            // Cascade handles most updates, add custom logic here
          }
        }
      }
    }),
    fetchExchange
  ]
});
```

### Manual Cache Updates

Combine cascade with manual updates when needed:

```typescript
import { useMutation } from '@urql/core';

const [assignTask] = useMutation(ASSIGN_TASK);

const handleAssign = async (taskId, userId) => {
  const result = await assignTask({ taskId, userId });

  // Cascade updates are applied automatically
  // Add custom logic if needed
  if (result.data?.assignTask?.__cascade) {
    // Custom post-processing
    updateSidebarCounts();
  }
};
```

### Invalidation Patterns

Cascade handles query invalidation automatically:

```typescript
const INVALIDATE_CACHE = `
  mutation InvalidateCache {
    invalidateCache {
      __cascade {
        invalidated { __typename field }
      }
    }
  }
`;

function AdminPanel() {
  const [, invalidate] = useMutation(INVALIDATE_CACHE);

  const handleInvalidate = () => {
    invalidate({});
    // All queries matching invalidated patterns are refetched
  };

  return (
    <button onClick={handleInvalidate}>
      Clear Cache
    </button>
  );
}
```

## Hooks and Direct Usage

### Standard URQL Hooks

Use standard URQL hooks with automatic cascade processing:

```typescript
import { useQuery, useMutation } from '@urql/core';

function TodoList() {
  const [result] = useQuery({
    query: GET_TODOS,
    variables: { status: 'active' }
  });

  const [, createTodo] = useMutation(CREATE_TODO);
  const [, updateTodo] = useMutation(UPDATE_TODO);
  const [, deleteTodo] = useMutation(DELETE_TODO);

  // All mutations automatically update cache via cascade
  const handleCreate = (title) => createTodo({ input: { title } });
  const handleUpdate = (id, completed) => updateTodo({ id, completed });
  const handleDelete = (id) => deleteTodo({ id });

  return (
    <div>
      {result.data?.todos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      ))}
      <button onClick={() => handleCreate('New todo')}>
        Add Todo
      </button>
    </div>
  );
}
```

### Direct Client Usage

For advanced use cases, use the client directly:

```typescript
import { useClient } from '@urql/core';

function CustomComponent() {
  const client = useClient();

  const handleComplexOperation = async () => {
    // Execute multiple mutations
    const results = await Promise.all([
      client.mutation(CREATE_TODO, { title: 'Task 1' }),
      client.mutation(CREATE_TODO, { title: 'Task 2' })
    ]);

    // Cascade updates applied to both
    console.log('Created tasks:', results);
  };

  return (
    <button onClick={handleComplexOperation}>
      Create Multiple Tasks
    </button>
  );
}
```

## Subscriptions

Cascade supports real-time updates through GraphQL subscriptions:

```typescript
import { useSubscription } from '@urql/core';

const TODOS_SUBSCRIPTION = `
  subscription OnTodoUpdates {
    todoUpdates {
      todo { id title completed }
      __cascade {
        created { __typename id }
        updated { __typename id }
        deleted { __typename id }
        invalidated { __typename field }
      }
    }
  }
`;

function RealtimeTodoList() {
  // Subscribe to real-time updates
  useSubscription({ query: TODOS_SUBSCRIPTION });

  // Regular query for initial data
  const [result] = useQuery({ query: GET_TODOS });

  // Cache updates automatically from subscription cascades
  return (
    <div>
      {result.data?.todos.map(todo => (
        <div key={todo.id}>
          {todo.title} {todo.completed ? '✓' : ''}
        </div>
      ))}
    </div>
  );
}
```

### WebSocket Integration

For WebSocket subscriptions, ensure cascade exchange is included:

```typescript
import { createClient, subscriptionExchange } from '@urql/core';
import { cascadeExchange } from '@graphql-cascade/client-urql';

const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    cascadeExchange(), // Process subscription cascades
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

## Optimistic Updates

URQL's optimistic updates work seamlessly with cascade:

```typescript
const [, updateTodo] = useMutation(UPDATE_TODO);

const handleToggle = (id, currentCompleted) => {
  updateTodo(
    { id, completed: !currentCompleted },
    {
      // Optimistic response with cascade data
      optimistic: {
        __typename: 'Mutation',
        updateTodo: {
          __typename: 'TodoMutationResponse',
          todo: {
            __typename: 'Todo',
            id,
            completed: !currentCompleted
          },
          __cascade: {
            updated: [{ __typename: 'Todo', id }]
          }
        }
      }
    }
  );
};
```

## Advanced Patterns

### Custom Exchanges

Create custom exchanges that work with cascade:

```typescript
import { pipe, tap } from 'wonka';
import { cascadeExchange } from '@graphql-cascade/client-urql';

const loggingExchange = ({ forward }) => (ops$) => {
  return pipe(
    ops$,
    tap((operation) => {
      if (operation.kind === 'mutation') {
        console.log('Executing mutation:', operation.query);
      }
    }),
    forward,
    tap((result) => {
      if (result.data?.__cascade) {
        console.log('Cascade applied:', result.data.__cascade);
      }
    })
  );
};

const client = createClient({
  exchanges: [
    loggingExchange,
    cascadeExchange(),
    fetchExchange
  ]
});
```

### Server-Side Rendering (SSR)

Cascade works with URQL's SSR:

```typescript
import { ssrExchange } from '@urql/core';
import { cascadeExchange } from '@graphql-cascade/client-urql';

const isServer = typeof window === 'undefined';

const ssr = ssrExchange({
  isClient: !isServer,
  initialState: isServer ? undefined : window.__URQL_DATA__
});

const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    cascadeExchange(),
    ssr,
    fetchExchange
  ]
});
```

### Error Boundaries

Handle cascade processing errors gracefully:

```typescript
import { useError } from '@urql/core';

function CascadeErrorBoundary() {
  const [error] = useError();

  if (error?.message?.includes('cascade')) {
    return (
      <div className="error">
        Cache update failed. Please refresh the page.
        <button onClick={() => window.location.reload()}>
          Refresh
        </button>
      </div>
    );
  }

  return null;
}
```

## TypeScript Support

Full TypeScript support with generated types:

```typescript
import { useMutation, TypedDocumentNode } from '@urql/core';

type CreateTodoMutation = {
  createTodo: {
    todo: {
      id: string;
      title: string;
      completed: boolean;
    };
    __cascade: {
      created: Array<{ __typename: string; id: string }>;
      updated: Array<{ __typename: string; id: string }>;
      deleted: Array<{ __typename: string; id: string }>;
      invalidated: Array<{ __typename: string; field?: string }>;
    };
  };
};

type CreateTodoVariables = {
  input: {
    title: string;
  };
};

const CREATE_TODO: TypedDocumentNode<CreateTodoMutation, CreateTodoVariables> = `
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      todo { id title completed }
      __cascade {
        created { __typename id }
        updated { __typename id }
        deleted { __typename id }
        invalidated { __typename field }
      }
    }
  }
`;

function CreateTodoForm() {
  const [result, createTodo] = useMutation(CREATE_TODO);

  const handleSubmit = (variables: CreateTodoVariables) => {
    createTodo(variables);
    // Fully typed variables and response
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit({ input: { title: e.target.title.value } });
    }}>
      <input name="title" type="text" />
      <button type="submit" disabled={result.fetching}>
        {result.fetching ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}
```

## Testing

### Mock Cascade Responses

```typescript
import { createClient, Provider } from '@urql/core';
import { cascadeExchange } from '@graphql-cascade/client-urql';

const mocks = [
  {
    request: { query: CREATE_TODO, variables: { input: { title: 'Test' } } },
    result: {
      data: {
        createTodo: {
          todo: {
            __typename: 'Todo',
            id: '1',
            title: 'Test',
            completed: false
          },
          __cascade: {
            created: [{ __typename: 'Todo', id: '1' }],
            updated: [],
            deleted: [],
            invalidated: []
          }
        }
      }
    }
  }
];

const client = createClient({
  exchanges: [
    cascadeExchange(),
    mockExchange(mocks),
    fetchExchange
  ]
});

test('creates todo with cascade', async () => {
  const { getByText } = render(
    <Provider value={client}>
      <CreateTodoForm />
    </Provider>
  );

  // Test implementation
});
```

## Migration Guide

### From Manual Cache Updates

**Before Cascade:**
```typescript
const [, updateTodo] = useMutation(UPDATE_TODO, {
  updateResult: (result, cache) => {
    // 20+ lines of manual cache management
    const query = cache.readQuery({ query: GET_TODOS });
    cache.writeQuery({
      query: GET_TODOS,
      data: {
        todos: query.todos.map(todo =>
          todo.id === result.data.updateTodo.id
            ? result.data.updateTodo
            : todo
        )
      }
    });
  }
});
```

**After Cascade:**
```typescript
const [, updateTodo] = useMutation(UPDATE_TODO);
// That's it! Cache updates automatically
```

### From Apollo Client

Migrating from Apollo to URQL with Cascade:

```typescript
// Apollo (before)
import { ApolloClient, InMemoryCache, ApolloLink } from '@apollo/client';
import { createCascadeLink } from '@graphql-cascade/client-apollo';

const client = new ApolloClient({
  link: createCascadeLink().concat(httpLink),
  cache: new InMemoryCache()
});

// URQL (after)
import { createClient } from '@urql/core';
import { cascadeExchange } from '@graphql-cascade/client-urql';

const client = createClient({
  exchanges: [
    cascadeExchange(),
    graphExchange({ schema }),
    fetchExchange
  ]
});
```

## Performance Tips

1. **Position exchanges correctly** - Place cascade exchange early in the pipeline
2. **Use normalized caching** - Combine with `@urql/exchange-graphcache` for best performance
3. **Monitor cascade size** - Large cascades can impact performance
4. **Batch mutations** - Use URQL's batching for multiple rapid updates

```typescript
// Enable batching
const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    cascadeExchange(),
    // ... other exchanges
  ],
  requestPolicy: 'cache-and-network'
});
```

## Troubleshooting

### Common Issues

**Cascades not applying:**
- Ensure `cascadeExchange` is added to the exchange pipeline
- Check that mutations return `__cascade` field
- Verify exchange order (cascade before graphExchange)

**Cache not updating:**
- Check browser console for cascade debug logs
- Ensure entity IDs match between queries and mutations
- Verify `__typename` fields are included

**Performance issues:**
- Large cascades may cause UI blocking
- Use `shouldProcessCascade` to filter large updates
- Consider pagination for large datasets

### Debug Logging

Enable debug mode to see cascade operations:

```typescript
const client = createClient({
  exchanges: [
    cascadeExchange({
      debug: true, // Logs all cascade operations
      onCascade: (cascade) => {
        console.log('Cascade received:', cascade);
      }
    }),
    fetchExchange
  ]
});
```

### Debug Tools

```typescript
import { useClient } from '@urql/core';

function DebugPanel() {
  const client = useClient();

  const inspectCache = () => {
    // Access URQL's internal cache state
    console.log('Cache state:', client);
  };

  return (
    <button onClick={inspectCache}>
      Inspect Cache
    </button>
  );
}
```

### FAQ

**Q: Does cascade work with URQL's offline support?**
A: Yes, cascade updates are applied to the offline cache and sync when online.

**Q: Can I use cascade with custom cache implementations?**
A: Yes, implement a custom `cacheAdapter` in the exchange options.

**Q: How does cascade handle concurrent mutations?**
A: Cascades are processed sequentially to ensure cache consistency.

**Q: What's the performance impact?**
A: Minimal - cascade processing is optimized and only runs on mutations with `__cascade` data.

## Next Steps

- **[Apollo Client Integration](/clients/apollo)** - Alternative GraphQL client
- **[Server Setup](/server/)** - Configure your GraphQL server for cascade
- **[Core Concepts](/guide/concepts)** - Learn about cascade fundamentals
- **[Optimistic Updates](/guide/optimistic-updates)** - Instant UI feedback patterns
- **[Performance Guide](/guide/performance)** - Optimization techniques
