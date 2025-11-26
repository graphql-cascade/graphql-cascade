# Server Implementation

Implement GraphQL Cascade in your server to provide automatic cache updates to clients.

## Overview

GraphQL Cascade servers track entity changes during mutation execution and include cascade metadata in responses. This enables clients to automatically update their caches without manual code.

## Supported Servers

### Node.js/TypeScript
Pure Node.js implementation for any GraphQL server.

- **Package**: `@graphql-cascade/server-node`
- **Setup time**: 10 minutes
- **Features**: Complete cascade tracking, transaction support
- **[Get Started →](/server/node)**

### Apollo Server Plugin
Drop-in plugin for Apollo Server.

- **Package**: `@graphql-cascade/apollo-server-plugin`
- **Setup time**: 5 minutes
- **Features**: Automatic context injection, schema extension
- **[Get Started →](/server/apollo-server)**

### NestJS Module
First-class NestJS integration.

- **Package**: `@graphql-cascade/nestjs`
- **Setup time**: 10 minutes
- **Features**: Decorator-based tracking, dependency injection
- **[Get Started →](/server/nestjs)**

## Quick Start

### 1. Install Package

```bash
npm install @graphql-cascade/server-node
```

### 2. Add to Your Server

```typescript
import { createCascadeContext, CascadePlugin } from '@graphql-cascade/server-node';
import { ApolloServer } from '@apollo/server';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [new CascadePlugin()]
});

startStandaloneServer(server, {
  context: async () => ({
    cascade: createCascadeContext()
  })
});
```

### 3. Track Changes in Resolvers

```typescript
const resolvers = {
  Mutation: {
    createTodo: async (_, { input }, { cascade }) => {
      const todo = await db.createTodo(input);

      // Track the creation
      cascade.trackCreated('Todo', todo.id);

      return {
        todo,
        __cascade: cascade.getCascade()
      };
    },

    updateTodo: async (_, { id, input }, { cascade }) => {
      const todo = await db.updateTodo(id, input);

      // Track the update
      cascade.trackUpdated('Todo', todo.id);

      return {
        todo,
        __cascade: cascade.getCascade()
      };
    }
  }
};
```

### 4. Extend Your Schema

```graphql
type TodoMutationResponse {
  todo: Todo
  __cascade: Cascade!
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
```

## Core Concepts

### Cascade Context

The cascade context tracks all entity changes during a request:

```typescript
const cascade = createCascadeContext();

// Track operations
cascade.trackCreated('Todo', '123');
cascade.trackUpdated('User', '456');
cascade.trackDeleted('Comment', '789');
cascade.invalidate('Query', 'searchResults');

// Get the cascade
const result = cascade.getCascade();
```

### Entity Tracking

Track entities that are created, updated, or deleted:

```typescript
// Creation
cascade.trackCreated('Todo', todo.id);

// Update
cascade.trackUpdated('Todo', todo.id);

// Deletion
cascade.trackDeleted('Todo', todo.id);

// Batch tracking
cascade.trackCreatedMany('Todo', todoIds);
```

### Query Invalidation

Mark queries that need to be refetched:

```typescript
// Invalidate specific query
cascade.invalidate('Query', 'todos');

// Invalidate all queries for a type
cascade.invalidateType('Query');

// Conditional invalidation
if (shouldInvalidateSearch(update)) {
  cascade.invalidate('Query', 'searchTodos');
}
```

### Relationship Propagation

Automatically track related entities:

```typescript
cascade.trackUpdated('Todo', todo.id, {
  propagate: true, // Track related entities
  depth: 2 // How many levels to traverse
});

// Tracks:
// - Todo:123 (directly updated)
// - TodoList:456 (parent)
// - User:789 (owner)
```

## Best Practices

### 1. Track at the Right Level

Track changes where they happen, typically in resolvers:

```typescript
// Good: Track in resolver
const createTodo = async (_, { input }, { cascade, db }) => {
  const todo = await db.createTodo(input);
  cascade.trackCreated('Todo', todo.id);
  return { todo, __cascade: cascade.getCascade() };
};

// Avoid: Tracking in database layer
// (harder to test, couples DB to GraphQL)
```

### 2. Use Transactions

Ensure cascade tracking is atomic with database operations:

```typescript
const createProject = async (_, { input }, { cascade, db }) => {
  return db.transaction(async (trx) => {
    const project = await trx.createProject(input);
    const tasks = await trx.createTasks(project.id, input.tasks);

    cascade.trackCreated('Project', project.id);
    cascade.trackCreatedMany('Task', tasks.map(t => t.id));

    return { project, __cascade: cascade.getCascade() };
  });
};
```

### 3. Invalidate Carefully

Only invalidate queries that are actually affected:

```typescript
// Good: Selective invalidation
if (todo.status === 'completed') {
  cascade.invalidate('Query', 'activeTodos');
} else {
  cascade.invalidate('Query', 'completedTodos');
}

// Avoid: Over-invalidation
cascade.invalidateType('Query'); // Refetches ALL queries
```

### 4. Handle Errors Properly

Don't return cascades on errors:

```typescript
const updateTodo = async (_, { id, input }, { cascade }) => {
  try {
    const todo = await db.updateTodo(id, input);
    cascade.trackUpdated('Todo', todo.id);

    return { todo, __cascade: cascade.getCascade() };
  } catch (error) {
    // Don't include cascade on error
    throw error;
  }
};
```

## Schema Design

### Response Types

All mutations should return a response type with cascade:

```graphql
type Mutation {
  createTodo(input: CreateTodoInput!): TodoMutationResponse!
  updateTodo(id: ID!, input: UpdateTodoInput!): TodoMutationResponse!
  deleteTodo(id: ID!): TodoMutationResponse!
}

type TodoMutationResponse {
  # The mutation result
  todo: Todo

  # Cascade metadata (required)
  __cascade: Cascade!

  # Optional fields
  errors: [Error!]
}
```

### Standardized Cascade Type

Use the standard cascade type across all mutations:

```graphql
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
```

## Testing

Test cascade tracking in your resolvers:

```typescript
describe('createTodo resolver', () => {
  test('tracks created entity', async () => {
    const cascade = createCascadeContext();
    const context = { cascade, db: mockDb };

    const result = await resolvers.Mutation.createTodo(
      null,
      { input: { title: 'Test' } },
      context
    );

    expect(result.__cascade.created).toEqual([
      { __typename: 'Todo', id: result.todo.id }
    ]);
  });
});
```

## Performance

### Optimize Entity Tracking

Use efficient data structures:

```typescript
// Built-in optimization
const cascade = createCascadeContext({
  maxDepth: 2, // Limit relationship traversal
  maxEntities: 1000 // Limit cascade size
});
```

### Database Query Optimization

Minimize queries for relationship tracking:

```typescript
// Bad: N+1 queries
for (const todo of todos) {
  const list = await db.getTodoList(todo.listId);
  cascade.trackUpdated('TodoList', list.id);
}

// Good: Single query
const listIds = new Set(todos.map(t => t.listId));
listIds.forEach(id => cascade.trackUpdated('TodoList', id));
```

## Next Steps

Choose your server platform:

- **[Node.js/TypeScript](/server/node)** - Pure Node.js implementation
- **[Apollo Server](/server/apollo-server)** - Plugin-based integration
- **[NestJS](/server/nestjs)** - Decorator-based approach

Learn more:

- **[Schema Conventions](/server/schema-conventions)** - Schema design patterns
- **[Directives](/server/directives)** - Custom cascade directives
- **[Entity Identification](/server/entity-identification)** - ID strategies
