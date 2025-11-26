# React Query Integration

Complete guide to using GraphQL Cascade with React Query (TanStack Query).

## Installation

```bash
npm install @graphql-cascade/client-react-query @tanstack/react-query
```

## Quick Setup

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createCascadeClient } from '@graphql-cascade/client-react-query';

const queryClient = new QueryClient();

const cascadeClient = createCascadeClient({
  endpoint: 'http://localhost:4000/graphql',
  queryClient
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  );
}
```

## Basic Usage

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { cascadeClient } from './client';

function TodoList() {
  // Query todos
  const { data: todos } = useQuery({
    queryKey: ['todos'],
    queryFn: () => cascadeClient.query({
      query: `
        query GetTodos {
          todos { id title completed }
        }
      `
    })
  });

  // Create todo with automatic cache update
  const createMutation = useMutation({
    mutationFn: (title: string) => cascadeClient.mutate({
      mutation: `
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
      `,
      variables: { input: { title } }
    })
  });

  return (
    <div>
      <ul>
        {todos?.map(todo => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
      <button onClick={() => createMutation.mutate('New todo')}>
        Create Todo
      </button>
    </div>
  );
}
```

## Cascade Integration

React Query's mutation system works seamlessly with Cascade:

```typescript
const mutation = useMutation({
  mutationFn: createTodo,
  onSuccess: (data) => {
    // Cascade automatically invalidates affected queries
    // React Query refetches them automatically
    console.log('Cascade processed:', data.__cascade);
  }
});
```

## Configuration

```typescript
const cascadeClient = createCascadeClient({
  endpoint: 'http://localhost:4000/graphql',
  queryClient,

  // Cascade options
  cascade: {
    debug: true,
    onCascade: (cascade) => {
      console.log('Cascade:', cascade);
    }
  },

  // GraphQL options
  graphql: {
    headers: {
      Authorization: 'Bearer token'
    }
  }
});
```

## Features

- Automatic query invalidation from cascade metadata
- Works with React Query's optimistic updates
- Full TypeScript support
- Server-side rendering support
- Suspense support

## Next Steps

- **[URQL Integration](/clients/urql)** - Lightweight alternative
- **[Server Setup](/server/)** - Configure your GraphQL server
- **[Guide](/guide/)** - Core concepts and patterns
