# Apollo Client Integration

Complete guide to using GraphQL Cascade with Apollo Client.

## Installation

```bash
npm install @graphql-cascade/client-apollo
```

## Quick Setup

```typescript
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { createCascadeLink } from '@graphql-cascade/client-apollo';

// Create the cascade link
const cascadeLink = createCascadeLink();

// Create HTTP link
const httpLink = new HttpLink({
  uri: 'http://localhost:4000/graphql'
});

// Combine links
const client = new ApolloClient({
  link: cascadeLink.concat(httpLink),
  cache: new InMemoryCache()
});
```

## Usage with React

```typescript
import { ApolloProvider } from '@apollo/client';

function App() {
  return (
    <ApolloProvider client={client}>
      <YourApp />
    </ApolloProvider>
  );
}
```

## Basic Mutations

```typescript
import { useMutation, gql } from '@apollo/client';

const CREATE_TODO = gql`
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
`;

function CreateTodoForm() {
  const [createTodo, { loading, error }] = useMutation(CREATE_TODO);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = e.target.title.value;

    // Cache updates automatically from cascade
    await createTodo({ variables: { input: { title } } });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" placeholder="New todo..." />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create'}
      </button>
      {error && <p>Error: {error.message}</p>}
    </form>
  );
}
```

## Optimistic Updates

```typescript
const [updateTodo] = useMutation(UPDATE_TODO, {
  optimisticResponse: ({ id, completed }) => ({
    updateTodo: {
      __typename: 'TodoMutationResponse',
      todo: {
        __typename: 'Todo',
        id,
        completed,
      },
      __cascade: {
        created: [],
        updated: [{ __typename: 'Todo', id }],
        deleted: [],
        invalidated: []
      }
    }
  })
});
```

## Configuration Options

```typescript
const cascadeLink = createCascadeLink({
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

  // Custom cache updates
  customUpdates: {
    Todo: (cache, entity, cascade) => {
      // Custom logic for Todo entities
    }
  }
});
```

## Advanced Patterns

### Manual Cache Updates

Combine cascade with manual updates when needed:

```typescript
const [assignTask] = useMutation(ASSIGN_TASK, {
  update(cache, { data }) {
    // Cascade is applied automatically first
    const cascade = data.assignTask.__cascade;

    // Then add custom logic
    if (shouldUpdateSidebar()) {
      cache.modify({
        fields: {
          taskCounts(existing) {
            return { ...existing, assigned: existing.assigned + 1 };
          }
        }
      });
    }
  }
});
```

### Refetch Queries

Combine cascade invalidation with refetch policies:

```typescript
const [createTodo] = useMutation(CREATE_TODO, {
  // Cascade handles most updates automatically
  // Add refetchQueries for specific cases
  refetchQueries: (result) => {
    const cascade = result.data.createTodo.__cascade;

    // Only refetch if cascade indicates invalidation
    if (cascade.invalidated.some(inv => inv.field === 'todos')) {
      return [{ query: GET_TODOS }];
    }
    return [];
  }
});
```

### Cache Eviction

For complex cache cleanup:

```typescript
const [deleteProject] = useMutation(DELETE_PROJECT, {
  update(cache, { data }) {
    const cascade = data.deleteProject.__cascade;

    // Cascade removes the project automatically
    // Manually clean up related data
    cascade.deleted.forEach(({ __typename, id }) => {
      if (__typename === 'Project') {
        // Evict all related queries
        cache.evict({
          id: cache.identify({ __typename, id }),
          broadcast: false
        });

        // Clean up related tasks
        cache.modify({
          fields: {
            tasks(existingRefs, { readField }) {
              return existingRefs.filter(
                ref => readField('projectId', ref) !== id
              );
            }
          }
        });
      }
    });

    cache.gc();
  }
});
```

## TypeScript Support

Full type safety with generated types:

```typescript
import { gql, TypedDocumentNode } from '@apollo/client';

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

const CREATE_TODO: TypedDocumentNode<CreateTodoMutation, CreateTodoVariables> = gql`
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

function CreateTodo() {
  const [createTodo] = useMutation(CREATE_TODO);
  // Fully typed variables and response
}
```

## Testing

### Mock Cascade Responses

```typescript
import { MockedProvider } from '@apollo/client/testing';

const mocks = [
  {
    request: {
      query: CREATE_TODO,
      variables: { input: { title: 'Test todo' } }
    },
    result: {
      data: {
        createTodo: {
          todo: {
            __typename: 'Todo',
            id: '1',
            title: 'Test todo',
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

test('creates todo with cascade', async () => {
  const { getByText } = render(
    <MockedProvider mocks={mocks}>
      <CreateTodoForm />
    </MockedProvider>
  );

  // Test implementation
});
```

## Migration from Manual Updates

### Before Cascade

```typescript
const [updateUser] = useMutation(UPDATE_USER, {
  update(cache, { data }) {
    // 20+ lines of manual cache management
    const existingUsers = cache.readQuery({ query: LIST_USERS });
    cache.writeQuery({
      query: LIST_USERS,
      data: {
        listUsers: existingUsers.listUsers.map(u =>
          u.id === data.updateUser.id ? data.updateUser : u
        )
      }
    });
    cache.evict({ fieldName: 'searchUsers' });
    // ... more manual updates
  }
});
```

### After Cascade

```typescript
const [updateUser] = useMutation(UPDATE_USER);
// That's it! Cache updates automatically
```

## Performance Tips

1. **Use fragments** to ensure cascade includes all required fields
2. **Enable batching** for multiple rapid mutations
3. **Monitor cascade size** in development
4. **Use cache persistence** for offline support

```typescript
import { persistCache } from 'apollo3-cache-persist';

await persistCache({
  cache,
  storage: window.localStorage
});
```

## Debugging

Enable the Apollo Client DevTools extension and Cascade debug mode:

```typescript
const cascadeLink = createCascadeLink({
  debug: true // Logs all cascade operations
});
```

View cascade history:

```typescript
import { getCascadeHistory } from '@graphql-cascade/client-apollo';

// In browser console
window.__CASCADE_HISTORY__ = getCascadeHistory();
```

## Next Steps

- **[React Query Integration](/clients/react-query)** - Alternative to Apollo
- **[Optimistic Updates](/guide/optimistic-updates)** - Instant UI feedback
- **[Performance](/guide/performance)** - Optimization techniques
