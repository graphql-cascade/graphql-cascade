# URQL Integration

Complete guide to using GraphQL Cascade with URQL.

## Installation

```bash
npm install @graphql-cascade/client-urql urql
```

## Quick Setup

```typescript
import { createClient } from 'urql';
import { cascadeExchange } from '@graphql-cascade/client-urql';

const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    // ... other exchanges
    cascadeExchange(),
    fetchExchange
  ]
});

function App() {
  return (
    <Provider value={client}>
      <YourApp />
    </Provider>
  );
}
```

## Basic Usage

```typescript
import { useQuery, useMutation } from 'urql';

const TodosQuery = `
  query GetTodos {
    todos { id title completed }
  }
`;

const CreateTodoMutation = `
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

function TodoList() {
  const [result] = useQuery({ query: TodosQuery });
  const [, createTodo] = useMutation(CreateTodoMutation);

  const handleCreate = (title: string) => {
    createTodo({ input: { title } });
    // Cache updates automatically from cascade
  };

  return (
    <div>
      {result.data?.todos.map(todo => (
        <div key={todo.id}>{todo.title}</div>
      ))}
      <button onClick={() => handleCreate('New todo')}>
        Create
      </button>
    </div>
  );
}
```

## Configuration

```typescript
const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    cascadeExchange({
      debug: true,
      onCascade: (cascade) => {
        console.log('Cascade:', cascade);
      }
    }),
    fetchExchange
  ]
});
```

## Features

- Custom URQL exchange for cascade processing
- Works with URQL's normalized cache
- Supports optimistic updates
- Full TypeScript support
- SSR support
- Lightweight (~2KB added)

## Optimistic Updates

```typescript
const [, updateTodo] = useMutation(UpdateTodoMutation);

updateTodo(
  { id: '123', completed: true },
  {
    optimistic: {
      __typename: 'Mutation',
      updateTodo: {
        todo: { __typename: 'Todo', id: '123', completed: true },
        __cascade: {
          updated: [{ __typename: 'Todo', id: '123' }]
        }
      }
    }
  }
);
```

## Next Steps

- **[Apollo Client](/clients/apollo)** - Alternative client
- **[Server Setup](/server/)** - Configure your GraphQL server
- **[Guide](/guide/)** - Core concepts
