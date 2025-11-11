# Todo App Tutorial

Build a complete todo application with GraphQL Cascade from scratch.

## Overview

This tutorial walks through building a todo app with user authentication, demonstrating how GraphQL Cascade automatically manages cache invalidation across complex relationships.

## What You'll Build

A todo app with:
- User registration and authentication
- Todo CRUD operations
- Automatic cache updates when todos are created/updated/deleted
- Real-time todo counts for users
- Optimistic updates for better UX

## Prerequisites

- Node.js 16+
- Basic React knowledge
- GraphQL basics

## Architecture

```
Frontend (React + Apollo) <-> GraphQL Server <-> Database
     ↑                                       ↑
     └─ Automatic cache updates ─────────────┘
```

## Step 1: Set Up the Project

Create a new project structure:

```bash
mkdir todo-cascade-app
cd todo-cascade-app
npm init -y

# Install dependencies
npm install @apollo/client graphql react react-dom
npm install @graphql-cascade/apollo @graphql-cascade/core
```

## Step 2: Define the Schema

```graphql
# schema.graphql
type User {
  id: ID!
  name: String!
  email: String!
  todoCount: Int!
  todos: [Todo!]!
}

type Todo {
  id: ID!
  title: String!
  completed: Boolean!
  createdAt: String!
  author: User!
}

type Query {
  users: [User!]!
  todos: [Todo!]!
  user(id: ID!): User
  todo(id: ID!): Todo
}

type Mutation {
  createUser(input: CreateUserInput!): User
    @cascade(entity: "User", operation: "create")
  createTodo(input: CreateTodoInput!): Todo
    @cascade(entity: "Todo", operation: "create")
  updateTodo(id: ID!, input: UpdateTodoInput!): Todo
    @cascade(entity: "Todo", operation: "update")
  deleteTodo(id: ID!): Boolean
    @cascade(entity: "Todo", operation: "delete")
  toggleTodo(id: ID!): Todo
    @cascade(entity: "Todo", operation: "update")
}

input CreateUserInput {
  name: String!
  email: String!
}

input CreateTodoInput {
  title: String!
  authorId: ID!
}

input UpdateTodoInput {
  title: String
  completed: Boolean
}
```

## Step 3: Set Up Apollo Client

```javascript
// client/src/apollo.js
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { cascadeLink } from '@graphql-cascade/apollo';

const httpLink = createHttpLink({
  uri: 'http://localhost:4000/graphql'
});

export const client = new ApolloClient({
  link: cascadeLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      User: {
        fields: {
          todoCount: {
            read(existing, { readField }) {
              // Auto-calculate from todos relationship
              const todos = readField('todos');
              return todos ? todos.length : 0;
            }
          }
        }
      }
    }
  })
});
```

## Step 4: Create React Components

### TodoList Component

```javascript
// client/src/components/TodoList.js
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';

const GET_TODOS = gql`
  query GetTodos {
    todos {
      id
      title
      completed
      author {
        id
        name
      }
    }
  }
`;

const TOGGLE_TODO = gql`
  mutation ToggleTodo($id: ID!) {
    toggleTodo(id: $id) {
      id
      completed
    }
  }
`;

export function TodoList() {
  const { loading, error, data } = useQuery(GET_TODOS);
  const [toggleTodo] = useMutation(TOGGLE_TODO);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <ul>
      {data.todos.map(todo => (
        <li key={todo.id}>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => toggleTodo({ variables: { id: todo.id } })}
          />
          {todo.title} (by {todo.author.name})
        </li>
      ))}
    </ul>
  );
}
```

### CreateTodo Component

```javascript
// client/src/components/CreateTodo.js
import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

const GET_USERS = gql`
  query GetUsers {
    users {
      id
      name
    }
  }
`;

const CREATE_TODO = gql`
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      id
      title
      completed
      author {
        id
        name
        todoCount
      }
    }
  }
`;

export function CreateTodo() {
  const [title, setTitle] = useState('');
  const [authorId, setAuthorId] = useState('');
  const { data: usersData } = useQuery(GET_USERS);
  const [createTodo, { loading }] = useMutation(CREATE_TODO, {
    optimisticResponse: {
      createTodo: {
        id: 'temp-' + Date.now(),
        title,
        completed: false,
        author: {
          id: authorId,
          name: usersData?.users.find(u => u.id === authorId)?.name || '',
          todoCount: (usersData?.users.find(u => u.id === authorId)?.todoCount || 0) + 1
        }
      }
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createTodo({
      variables: { input: { title, authorId } }
    });
    setTitle('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Todo title"
        required
      />
      <select
        value={authorId}
        onChange={(e) => setAuthorId(e.target.value)}
        required
      >
        <option value="">Select author</option>
        {usersData?.users.map(user => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Todo'}
      </button>
    </form>
  );
}
```

## Step 5: See Cascades in Action

When you create a todo:

1. **Mutation executes** - Todo is created in database
2. **Cascade response** - Server returns cascade data
3. **Cache updates** - Apollo cache automatically updates:
   - New todo added to `todos` query
   - Author's `todoCount` recalculated
   - Related queries refetched if needed

## Key Benefits Demonstrated

- **Zero manual cache management** - No `cache.modify()` or `cache.evict()` calls
- **Automatic relationship updates** - Author's todo count updates automatically
- **Optimistic updates** - UI updates immediately while mutation is in progress
- **Consistent data** - Cache stays synchronized with server state

## Next Steps

- Add user authentication
- Implement real-time subscriptions
- Add todo categories and complex relationships
- Deploy to production

This tutorial demonstrates the core value of GraphQL Cascade: automatic, intelligent cache management that scales with your application's complexity.