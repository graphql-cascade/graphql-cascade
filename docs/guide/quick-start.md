# Quick Start

Build your first GraphQL Cascade application in 5 minutes.

## 1. Initialize a New Project

```bash
npx @graphql-cascade/cli init my-cascade-app
cd my-cascade-app
npm install
```

## 2. Server Setup

Create a GraphQL server with Cascade support:

```typescript
// server.ts
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { createCascadeContext, CascadePlugin } from '@graphql-cascade/server-node';

const typeDefs = `#graphql
  type Todo {
    id: ID!
    title: String!
    completed: Boolean!
  }

  type Query {
    todos: [Todo!]!
  }

  type Mutation {
    createTodo(title: String!): TodoMutationResponse!
    updateTodo(id: ID!, completed: Boolean!): TodoMutationResponse!
    deleteTodo(id: ID!): TodoMutationResponse!
  }

  type TodoMutationResponse {
    todo: Todo
    __cascade: Cascade
  }

  type Cascade {
    created: [EntityRef!]!
    updated: [EntityRef!]!
    deleted: [EntityRef!]!
    invalidated: [InvalidationRef!]!
  }

  type EntityRef {
    __typename: String!
    id: ID!
  }

  type InvalidationRef {
    __typename: String!
    field: String
  }
`;

const todos: any[] = [];

const resolvers = {
  Query: {
    todos: () => todos,
  },
  Mutation: {
    createTodo: async (_: any, { title }: any, context: any) => {
      const todo = {
        id: String(todos.length + 1),
        title,
        completed: false,
      };
      todos.push(todo);

      // Track the creation
      context.cascade.trackCreated('Todo', todo.id);

      return {
        todo,
        __cascade: context.cascade.getCascade(),
      };
    },
    updateTodo: async (_: any, { id, completed }: any, context: any) => {
      const todo = todos.find(t => t.id === id);
      if (!todo) throw new Error('Todo not found');

      todo.completed = completed;

      // Track the update
      context.cascade.trackUpdated('Todo', todo.id);

      return {
        todo,
        __cascade: context.cascade.getCascade(),
      };
    },
    deleteTodo: async (_: any, { id }: any, context: any) => {
      const index = todos.findIndex(t => t.id === id);
      if (index === -1) throw new Error('Todo not found');

      todos.splice(index, 1);

      // Track the deletion
      context.cascade.trackDeleted('Todo', id);

      return {
        todo: null,
        __cascade: context.cascade.getCascade(),
      };
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [new CascadePlugin()],
});

startStandaloneServer(server, {
  context: async () => ({
    cascade: createCascadeContext(),
  }),
  listen: { port: 4000 },
}).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
```

Start the server:

```bash
npm run dev
```

## 3. Client Setup

Create a React app with Apollo Client and Cascade:

```typescript
// App.tsx
import { ApolloClient, InMemoryCache, ApolloProvider, gql } from '@apollo/client';
import { createCascadeLink } from '@graphql-cascade/client-apollo';
import { HttpLink } from '@apollo/client/link/http';

// Create Cascade-enabled Apollo Client
const cascadeLink = createCascadeLink();
const httpLink = new HttpLink({ uri: 'http://localhost:4000' });

const client = new ApolloClient({
  link: cascadeLink.concat(httpLink),
  cache: new InMemoryCache(),
});

function App() {
  return (
    <ApolloProvider client={client}>
      <TodoApp />
    </ApolloProvider>
  );
}
```

## 4. Use Mutations with Automatic Cache Updates

```typescript
// TodoApp.tsx
import { useQuery, useMutation, gql } from '@apollo/client';

const GET_TODOS = gql`
  query GetTodos {
    todos {
      id
      title
      completed
    }
  }
`;

const CREATE_TODO = gql`
  mutation CreateTodo($title: String!) {
    createTodo(title: $title) {
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

const UPDATE_TODO = gql`
  mutation UpdateTodo($id: ID!, $completed: Boolean!) {
    updateTodo(id: $id, completed: $completed) {
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

function TodoApp() {
  const { data, loading } = useQuery(GET_TODOS);
  const [createTodo] = useMutation(CREATE_TODO);
  const [updateTodo] = useMutation(UPDATE_TODO);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>My Todos</h1>

      {/* Create new todo */}
      <form onSubmit={(e) => {
        e.preventDefault();
        const title = (e.target as any).title.value;
        createTodo({ variables: { title } });
        (e.target as any).reset();
      }}>
        <input name="title" placeholder="New todo..." />
        <button type="submit">Add</button>
      </form>

      {/* List todos */}
      <ul>
        {data?.todos.map((todo: any) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() =>
                updateTodo({
                  variables: {
                    id: todo.id,
                    completed: !todo.completed
                  }
                })
              }
            />
            <span style={{
              textDecoration: todo.completed ? 'line-through' : 'none'
            }}>
              {todo.title}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 5. Run and Test

1. Start the server: `npm run dev` (in server directory)
2. Start the client: `npm start` (in client directory)
3. Create a todo - notice the list updates automatically
4. Toggle a todo's completion - notice it updates without manual cache logic
5. Delete a todo - it disappears from the list automatically

## What Just Happened?

- The server tracked entity changes during mutations
- Mutation responses included `__cascade` metadata
- The Cascade link automatically updated the Apollo cache
- Your UI stayed in sync without any manual cache update code

## Next Steps

- **[Core Concepts](/guide/concepts)** - Understand the cascade data model
- **[Client Integration](/clients/)** - Deep dive into your specific client
- **[Server Implementation](/server/)** - Learn advanced server patterns
- **[Optimistic Updates](/guide/optimistic-updates)** - Add instant UI feedback
