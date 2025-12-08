# React Query Integration

Complete guide to using GraphQL Cascade with React Query (TanStack Query).

## Overview

GraphQL Cascade integrates with React Query to provide automatic cache management for non-normalized cache scenarios. Unlike Apollo Client's normalized cache, React Query uses a document-based cache that requires different invalidation strategies.

Cascade automatically handles:
- **Query invalidation** based on cascade hints from your GraphQL server
- **Entity updates** within cached query data
- **Optimistic updates** with automatic rollback on errors
- **Cache cleanup** for deleted entities

## Installation

```bash
npm install @graphql-cascade/client-react-query @tanstack/react-query
```

**Peer Dependencies:**
- `@tanstack/react-query: ^4.0.0`
- `graphql: ^16.0.0`
- `react: ^16.8.0`

## Quick Start

Get started with GraphQL Cascade in 5 minutes:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryCascadeClient } from '@graphql-cascade/client-react-query';
import { GraphQLClient } from 'graphql-request';

// 1. Configure React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    }
  }
});

// 2. Create GraphQL client
const graphqlClient = new GraphQLClient('/graphql');

// 3. Create executor function
const executor = async (query: DocumentNode, variables: any) => {
  return graphqlClient.request(query, variables);
};

// 4. Create cascade client
const cascadeClient = new ReactQueryCascadeClient(queryClient, executor);

// 5. Use in your app
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TodoApp />
    </QueryClientProvider>
  );
}
```

## Configuration

### QueryClient Setup

Configure React Query with appropriate defaults for GraphQL Cascade:

```typescript
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

### Cascade Client Options

```typescript
const cascadeClient = new ReactQueryCascadeClient(queryClient, executor, {
  // Enable debug logging
  debug: process.env.NODE_ENV === 'development',

  // Custom cascade processing
  onCascade: (cascade) => {
    console.log('Processing cascade:', cascade);
  },

  // Error handling
  onError: (error) => {
    console.error('Cascade error:', error);
  },

  // Filter cascades
  shouldProcessCascade: (cascade) => {
    return cascade.updated.length < 1000;
  },

  // Custom invalidation patterns
  invalidationPatterns: {
    'getUser*': 'PREFIX', // Invalidate all queries starting with 'getUser'
    'listUsers': 'EXACT'  // Exact match invalidation
  }
});
```

## Hooks

### useCascadeMutation

Basic mutation hook with automatic cache updates:

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

### useOptimisticCascadeMutation

Mutation hook with optimistic updates:

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

## Cache Integration

### Query Key Patterns

Structure your query keys for effective invalidation:

```typescript
// Good: Structured keys for precise invalidation
const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (filters: TodoFilters) => [...todoKeys.lists(), filters] as const,
  details: () => [...todoKeys.all, 'detail'] as const,
  detail: (id: string) => [...todoKeys.details(), id] as const,
};

// Usage
const { data: todos } = useQuery({
  queryKey: todoKeys.list({ completed: false }),
  queryFn: () => fetchTodos({ completed: false })
});

const { data: todo } = useQuery({
  queryKey: todoKeys.detail('123'),
  queryFn: () => fetchTodo('123')
});
```

### Manual Invalidation

Combine cascade with manual invalidation when needed:

```typescript
const mutation = useCascadeMutation(cascadeClient, UPDATE_USER, {
  onSuccess: (data, variables) => {
    // Cascade handles most invalidation automatically
    // Add manual invalidation for specific cases
    if (variables.shouldInvalidatePreferences) {
      queryClient.invalidateQueries(['userPreferences']);
    }
  }
});
```

## Advanced Patterns

### Parallel Mutations

Handle multiple related mutations:

```typescript
function BulkUpdateTodos({ todoIds, completed }: { todoIds: string[], completed: boolean }) {
  const mutations = useMutations({
    mutations: todoIds.map(id => ({
      mutationFn: () => cascadeClient.mutate({
        mutation: TOGGLE_TODO,
        variables: { id }
      })
    }))
  });

  const handleBulkUpdate = () => {
    mutations.mutate();
  };

  return (
    <button onClick={handleBulkUpdate} disabled={mutations.isPending}>
      Mark {todoIds.length} todos as {completed ? 'complete' : 'incomplete'}
    </button>
  );
}
```

### Dependent Mutations

Chain mutations with dependencies:

```typescript
function CreateProjectWithTasks({ projectName, taskTitles }: {
  projectName: string;
  taskTitles: string[]
}) {
  const createProjectMutation = useCascadeMutation(cascadeClient, CREATE_PROJECT);
  const createTaskMutation = useCascadeMutation(cascadeClient, CREATE_TASK);

  const handleCreate = async () => {
    // Create project first
    const projectResult = await createProjectMutation.mutateAsync({
      input: { name: projectName }
    });

    // Then create tasks for the project
    await Promise.all(
      taskTitles.map(title =>
        createTaskMutation.mutateAsync({
          input: { title, projectId: projectResult.data.createProject.id }
        })
      )
    );
  };

  return (
    <button onClick={handleCreate} disabled={createProjectMutation.isPending}>
      Create Project with Tasks
    </button>
  );
}
```

### Prefetching

Prefetch related data:

```typescript
function TodoList() {
  const { data: todos } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos
  });

  // Prefetch individual todo details on hover
  const prefetchTodo = useCallback((todoId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['todo', todoId],
      queryFn: () => fetchTodo(todoId),
      staleTime: 5 * 60 * 1000
    });
  }, []);

  return (
    <ul>
      {todos?.map(todo => (
        <li
          key={todo.id}
          onMouseEnter={() => prefetchTodo(todo.id)}
        >
          {todo.title}
        </li>
      ))}
    </ul>
  );
}
```

## TypeScript Support

Full type safety with generic parameters:

```typescript
import { useCascadeMutation, useOptimisticCascadeMutation } from '@graphql-cascade/client-react-query';

// Strongly typed mutation hook
const createTodoMutation = useCascadeMutation<
  { createTodo: { id: string; title: string; completed: boolean } }, // TData
  { input: { title: string; completed: boolean } } // TVariables
>(cascadeClient, CREATE_TODO);

// Type-safe optimistic mutations
const toggleTodoMutation = useOptimisticCascadeMutation<
  { toggleTodo: { id: string; completed: boolean } }, // TData
  { id: string }, // TVariables
  { id: string; completed: boolean } // TOptimistic
>(
  cascadeClient,
  TOGGLE_TODO,
  (variables) => ({
    id: variables.id,
    completed: true // Optimistic value
  })
);

// Custom executor types
interface GraphQLResponse<T = any> {
  data?: T;
  errors?: GraphQLError[];
}

const typedExecutor = async (
  query: DocumentNode,
  variables: Record<string, any>
): Promise<GraphQLResponse> => {
  return graphqlClient.request(query, variables);
};
```

## Migration Guide

### From Manual Cache Updates

**Before Cascade:**
```typescript
const { data: todos, refetch } = useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos
});

const createTodoMutation = useMutation({
  mutationFn: createTodo,
  onSuccess: (newTodo) => {
    // Manual cache update - error prone and verbose
    queryClient.setQueryData(['todos'], (old: any) => [...old, newTodo]);
    // Don't forget to update other related queries...
    queryClient.invalidateQueries(['todoStats']);
    queryClient.invalidateQueries(['recentTodos']);
  }
});
```

**After Cascade:**
```typescript
const { data: todos } = useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos
});

const createTodoMutation = useCascadeMutation(cascadeClient, CREATE_TODO);
// That's it! Cache updates automatically based on cascade metadata
```

### From Apollo Client

**Apollo to React Query Migration:**
```typescript
// Apollo (before)
const [createTodo] = useMutation(CREATE_TODO, {
  update(cache, { data }) {
    // Complex manual cache updates
    cache.modify({
      fields: {
        todos(existing, { readField }) {
          return [...existing, data.createTodo];
        }
      }
    });
  }
});

// React Query + Cascade (after)
const createTodoMutation = useCascadeMutation(cascadeClient, CREATE_TODO);
// Automatic cache management
```

## Troubleshooting

### Common Issues

**Mutations not updating queries:**
- Ensure your GraphQL server returns cascade metadata
- Check that query keys match invalidation patterns
- Verify cascade client is properly configured

**Optimistic updates not reverting:**
- Make sure error boundaries catch GraphQL errors
- Check that optimistic response structure matches actual response

**Performance issues with large cascades:**
- Use `shouldProcessCascade` to filter large cascades
- Consider pagination for list invalidations
- Monitor cascade size in development

### Debug Logging

Enable debug mode to see cascade processing:

```typescript
const cascadeClient = new ReactQueryCascadeClient(queryClient, executor, {
  debug: true // Logs all cascade operations
});
```

### FAQ

**Q: When should I use React Query vs Apollo Client?**

A: Use React Query when you prefer document-based caching and don't need Apollo's normalized cache features. React Query is lighter and works well with Cascade for automatic invalidation.

**Q: How does cascade invalidation work with React Query?**

A: Cascade analyzes the `__cascade` field in mutation responses and invalidates queries based on configured patterns (exact, prefix, pattern matching).

**Q: Can I use optimistic updates with cascade?**

A: Yes! Use `useOptimisticCascadeMutation` for instant UI feedback with automatic rollback on errors.

**Q: What if I need manual cache control?**

A: Cascade handles most cases automatically, but you can combine it with manual `queryClient.invalidateQueries()` calls for complex scenarios.

## Performance Tips

1. **Use structured query keys** for precise invalidation
2. **Enable batching** for rapid mutations
3. **Monitor cascade size** in development
4. **Use optimistic updates** for better UX
5. **Implement pagination** to reduce invalidation scope

```typescript
// Example: Paginated queries with selective invalidation
const todosQuery = useInfiniteQuery({
  queryKey: ['todos', 'paginated'],
  queryFn: ({ pageParam = 0 }) => fetchTodos({ offset: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextOffset
});

// Only invalidate current page on mutations
const createTodoMutation = useCascadeMutation(cascadeClient, CREATE_TODO, {
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ['todos', 'paginated'],
      refetchType: 'active' // Only refetch active queries
    });
  }
});
```

## Testing

### Unit Testing Mutations

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

test('creates todo with cascade', async () => {
  const mockExecutor = jest.fn().mockResolvedValue({
    data: {
      createTodo: {
        success: true,
        data: { id: '1', title: 'Test todo', completed: false },
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [{ queryName: 'todos', scope: 'EXACT' }]
        }
      }
    }
  });

  const cascadeClient = new ReactQueryCascadeClient(queryClient, mockExecutor);

  const { result } = renderHook(
    () => useCascadeMutation(cascadeClient, CREATE_TODO),
    { wrapper: createWrapper() }
  );

  result.current.mutate({ input: { title: 'Test todo' } });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });

  expect(mockExecutor).toHaveBeenCalledWith(CREATE_TODO, {
    input: { title: 'Test todo' }
  });
});
```

## Next Steps

- **[Apollo Client Integration](/clients/apollo)** - Normalized cache alternative
- **[URQL Integration](/clients/urql)** - Lightweight GraphQL client
- **[Server Setup](/server/)** - Configure your GraphQL server
- **[Guide](/guide/)** - Core concepts and patterns
- **[Optimistic Updates](/guide/optimistic-updates)** - Instant UI feedback
- **[Performance](/guide/performance)** - Optimization techniques
