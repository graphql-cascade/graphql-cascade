# Quick Start

Get GraphQL Cascade working in your project in 5 minutes.

## Overview

This guide shows you how to add GraphQL Cascade to an existing GraphQL server and client. We'll use a simple todo app as an example.

## Prerequisites

- Node.js 16+ and npm
- Basic GraphQL server (we'll use Apollo Server)
- GraphQL client (we'll use Apollo Client)

## Step 1: Install GraphQL Cascade

Install the packages for your server and client:

```bash
# Server package (Python/FraiseQL)
pip install graphql-cascade

# Or for Node.js servers
npm install @graphql-cascade/server

# Client packages
npm install @graphql-cascade/apollo @graphql-cascade/core
```

## Step 2: Set Up Server Cascade Tracking

Add cascade directives to your GraphQL schema:

```graphql
# schema.graphql
type Todo {
  id: ID!
  title: String!
  completed: Boolean!
  author: User!
}

type User {
  id: ID!
  name: String!
  todos: [Todo!]!
}

type Mutation {
  createTodo(input: CreateTodoInput!): Todo
    @cascade(entity: "Todo", operation: "create")
  updateTodo(id: ID!, input: UpdateTodoInput!): Todo
    @cascade(entity: "Todo", operation: "update")
  deleteTodo(id: ID!): Boolean
    @cascade(entity: "Todo", operation: "delete")
}
```

Configure your server to track cascades:

```python
# server.py (using FraiseQL)
from graphql_cascade import CascadeTracker
from fraiseql import GraphQL

# Initialize cascade tracker
tracker = CascadeTracker()

# Add to your GraphQL app
app = GraphQL(schema_string, tracker=tracker)
```

```javascript
// server.js (using Apollo Server)
import { makeExecutableSchema } from '@graphql-tools/schema';
import { cascadeDirective } from '@graphql-cascade/server';

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
  schemaTransforms: [cascadeDirective]
});

const server = new ApolloServer({ schema });
```

## Step 3: Configure Client Integration

Set up your Apollo Client with cascade support:

```javascript
// client.js
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { cascadeLink } from '@graphql-cascade/apollo';

const httpLink = createHttpLink({
  uri: 'http://localhost:4000/graphql'
});

const client = new ApolloClient({
  link: cascadeLink.concat(httpLink),
  cache: new InMemoryCache()
});
```

## Step 4: Test the Cascade

Create a simple test to see cascades in action:

```javascript
// test.js
import { gql } from '@apollo/client';

// Query to get todos
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

// Mutation to create a todo
const CREATE_TODO = gql`
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
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

// Test the cascade
async function testCascade() {
  // Query initial data
  const { data: initialData } = await client.query({ query: GET_TODOS });
  console.log('Initial todos:', initialData.todos.length);

  // Create a new todo
  await client.mutate({
    mutation: CREATE_TODO,
    variables: {
      input: {
        title: 'Learn GraphQL Cascade',
        authorId: 'user-1'
      }
    }
  });

  // Query again - cache should be automatically updated
  const { data: updatedData } = await client.query({ query: GET_TODOS });
  console.log('Updated todos:', updatedData.todos.length);

  // The cache was automatically invalidated and refetched!
}
```

## Expected Output

When you run the test, you should see:

```
Initial todos: 0
Updated todos: 1
```

The cache automatically invalidated and refetched the todos query after the mutation, without any manual cache management!

## Step 5: Verify It's Working

Check your network tab - you should see:
1. Initial query to fetch todos
2. Mutation to create todo
3. **Automatic cache invalidation** - no manual `cache.evict()` calls needed
4. Automatic refetch of invalidated queries

## Troubleshooting

### Cascade not working?
- Check that `@cascade` directives are on your mutations
- Verify cascade link is properly configured in Apollo Client
- Ensure your server is tracking entity relationships

### Cache not updating?
- Check browser network tab for automatic queries
- Verify entity IDs match between mutations and queries
- Look for console errors about cascade tracking

## Next Steps

🎉 **Congratulations!** You now have automatic cache cascades working.

### Learn More
- **[Concepts](../getting-started/concepts.md)** - Understand how cascades work
- **[Server Guide](../guides/server-implementation.md)** - Advanced server setup
- **[Client Guide](../guides/client-integration.md)** - Other client integrations
- **[Examples](../../examples/)** - Complete working applications

### Go Deeper
- **[Specification](../../specification/)** - Technical details
- **[API Reference](../api/)** - Complete API documentation
- **[Contributing](../../CONTRIBUTING.md)** - Help improve GraphQL Cascade