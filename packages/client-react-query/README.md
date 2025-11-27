# GraphQL Cascade React Query Integration

Integration with React Query for automatic cache updates in non-normalized cache scenarios.

## Installation

```bash
npm install @graphql-cascade/client-react-query @tanstack/react-query
```

**Peer Dependencies:**
- `@tanstack/react-query: ^4.0.0`
- `graphql: ^16.0.0`
- `react: ^16.8.0`

## Features

- Query invalidation based on cascade hints
- Entity updates within query data
- React hooks for cascade mutations
- Optimistic update support
- TypeScript support

## Setup

### QueryClient Configuration

Configure React Query with appropriate defaults for GraphQL Cascade:

```typescript
import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on GraphQL errors
        if (error?.graphQLErrors?.length > 0) return false;
        return failureCount < 3;
      }
    },
    mutations: {
      retry: false, // Mutations typically shouldn't be retried
    }
  }
});
```

### ReactQueryCascadeClient

Create a cascade client instance with your GraphQL executor:

```typescript
import { ReactQueryCascadeClient } from '@graphql-cascade/client-react-query';
import { GraphQLClient } from 'graphql-request'; // or your preferred GraphQL client

const graphqlClient = new GraphQLClient('/graphql');

// Executor function that returns GraphQL response
const executor = async (query: DocumentNode, variables: any) => {
  return graphqlClient.request(query, variables);
};

const cascadeClient = new ReactQueryCascadeClient(queryClient, executor);
```

**TypeScript:**
```typescript
interface GraphQLResponse<T = any> {
  data?: T;
  errors?: GraphQLError[];
}

const executor = async (
  query: DocumentNode,
  variables: Record<string, any>
): Promise<GraphQLResponse> => {
  return graphqlClient.request(query, variables);
};
```

## Usage

### Basic Mutations with useCascadeMutation

```typescript
import { useCascadeMutation } from '@graphql-cascade/client-react-query';
import { gql } from 'graphql-tag';

const CREATE_TODO = gql`
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      success
      data {
        id
        title
        completed
        __typename
      }
      cascade {
        updated {
          __typename
          id
          field
          value
        }
        deleted {
          __typename
          id
        }
        invalidations {
          queryName
          scope
          arguments
        }
      }
    }
  }
`;

function TodoForm() {
  const mutation = useCascadeMutation(cascadeClient, CREATE_TODO, {
    onSuccess: (data) => {
      console.log('Todo created:', data);
    },
    onError: (error) => {
      console.error('Failed to create todo:', error);
    }
  });

  const handleSubmit = (title: string) => {
    mutation.mutate({
      input: { title, completed: false }
    });
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(e.target.title.value);
    }}>
      <input name="title" placeholder="Todo title" />
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create Todo'}
      </button>
    </form>
  );
}
```

### Optimistic Updates with useOptimisticCascadeMutation

```typescript
import { useOptimisticCascadeMutation } from '@graphql-cascade/client-react-query';

const TOGGLE_TODO = gql`
  mutation ToggleTodo($id: ID!) {
    toggleTodo(id: $id) {
      success
      data {
        id
        completed
        __typename
      }
      cascade { ... }
    }
  }
`;

function TodoItem({ todo }: { todo: { id: string; title: string; completed: boolean } }) {
  const mutation = useOptimisticCascadeMutation(
    cascadeClient,
    TOGGLE_TODO,
    // Generate optimistic response
    (variables) => ({
      id: variables.id,
      completed: !todo.completed,
      __typename: 'Todo'
    }),
    {
      onError: (error, variables) => {
        // Optimistic update will be reverted automatically on error
        console.error('Failed to toggle todo:', error);
      }
    }
  );

  return (
    <div>
      <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
        {todo.title}
      </span>
      <button
        onClick={() => mutation.mutate({ id: todo.id })}
        disabled={mutation.isPending}
      >
        {todo.completed ? 'Mark Incomplete' : 'Mark Complete'}
      </button>
    </div>
  );
}
```

## Cache Invalidation Strategies

GraphQL Cascade automatically handles cache invalidation based on cascade hints from your GraphQL server. The React Query integration supports several invalidation strategies:

### Exact Invalidation
Invalidates queries with exact matching keys:
```typescript
// Invalidates query: ['getUser', { id: '123' }]
cascade: {
  invalidations: [{
    queryName: 'getUser',
    scope: 'EXACT',
    arguments: { id: '123' }
  }]
}
```

### Prefix Invalidation
Invalidates all queries starting with a prefix:
```typescript
// Invalidates all queries starting with 'listUsers'
cascade: {
  invalidations: [{
    queryName: 'listUsers',
    scope: 'PREFIX'
  }]
}
```

### Pattern Invalidation
Invalidates queries matching glob patterns:
```typescript
// Invalidates queries like 'getUserById', 'getUserProfile', etc.
cascade: {
  invalidations: [{
    queryName: 'getUser*',
    scope: 'PATTERN'
  }]
}
```

### Entity Updates
Updates specific entities within cached query data:
```typescript
cascade: {
  updated: [{
    __typename: 'User',
    id: '123',
    field: 'name',
    value: 'Updated Name'
  }]
}
```

### Entity Deletion
Removes entities from cached query data:
```typescript
cascade: {
  deleted: [{
    __typename: 'Todo',
    id: '456'
  }]
}
```

## TypeScript Integration

The package is fully typed and provides excellent TypeScript support:

```typescript
import { ReactQueryCascadeClient, useCascadeMutation } from '@graphql-cascade/client-react-query';

// Strongly typed mutation hook
const mutation = useCascadeMutation<
  { createTodo: { id: string; title: string } }, // TData
  { input: { title: string; completed: boolean } } // TVariables
>(cascadeClient, CREATE_TODO);

// Type-safe optimistic mutations
const optimisticMutation = useOptimisticCascadeMutation<
  { toggleTodo: { id: string; completed: boolean } },
  { id: string },
  { id: string; completed: boolean } // Optimistic response type
>(
  cascadeClient,
  TOGGLE_TODO,
  (variables) => ({ id: variables.id, completed: true })
);
```

## Advanced Usage

### Custom Mutation Options

```typescript
const mutation = useCascadeMutation(cascadeClient, UPDATE_USER, {
  // React Query mutation options
  retry: 1,
  retryDelay: 1000,

  // Custom success handler
  onSuccess: (data, variables) => {
    toast.success('User updated successfully');
  },

  // Custom error handler
  onError: (error, variables) => {
    if (error.graphQLErrors?.[0]?.extensions?.code === 'UNAUTHORIZED') {
      // Handle auth errors
      redirectToLogin();
    }
  },

  // Custom settled handler (runs after success or error)
  onSettled: () => {
    queryClient.invalidateQueries(['userPreferences']);
  }
});
```

### Integration with React Query DevTools

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app components */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## API Reference

See [Client API](../../docs/api/client-api.md) for complete documentation.

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