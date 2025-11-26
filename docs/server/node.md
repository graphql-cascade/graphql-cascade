# Node.js/TypeScript Server

Complete guide to implementing GraphQL Cascade in Node.js/TypeScript servers.

## Installation

```bash
npm install @graphql-cascade/server-node
```

## Basic Setup

```typescript
import { createCascadeContext } from '@graphql-cascade/server-node';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

const server = new ApolloServer({
  typeDefs,
  resolvers
});

const { url } = await startStandaloneServer(server, {
  context: async () => ({
    cascade: createCascadeContext()
  }),
  listen: { port: 4000 }
});

console.log(`Server ready at ${url}`);
```

## Cascade Context API

### Creating a Context

```typescript
import { createCascadeContext, CascadeContext } from '@graphql-cascade/server-node';

const cascade: CascadeContext = createCascadeContext({
  maxDepth: 2, // Relationship traversal depth
  maxEntities: 1000, // Maximum entities in cascade
  debug: true // Enable debug logging
});
```

### Tracking Operations

```typescript
// Track created entity
cascade.trackCreated(typename: string, id: string);

// Track updated entity
cascade.trackUpdated(typename: string, id: string, options?: {
  propagate?: boolean; // Track related entities
  depth?: number; // Traversal depth
});

// Track deleted entity
cascade.trackDeleted(typename: string, id: string);

// Batch operations
cascade.trackCreatedMany(typename: string, ids: string[]);
cascade.trackUpdatedMany(typename: string, ids: string[]);
cascade.trackDeletedMany(typename: string, ids: string[]);

// Invalidate queries
cascade.invalidate(typename: string, field?: string);
cascade.invalidateType(typename: string);

// Get the cascade result
const result = cascade.getCascade();
```

## Complete Example

```typescript
import { createCascadeContext } from '@graphql-cascade/server-node';

const typeDefs = `
  type Todo {
    id: ID!
    title: String!
    completed: Boolean!
    list: TodoList!
  }

  type TodoList {
    id: ID!
    name: String!
    todos: [Todo!]!
  }

  type Query {
    todos: [Todo!]!
    todoLists: [TodoList!]!
  }

  type Mutation {
    createTodo(listId: ID!, title: String!): TodoMutationResponse!
    updateTodo(id: ID!, completed: Boolean!): TodoMutationResponse!
    deleteTodo(id: ID!): TodoMutationResponse!
  }

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
`;

const resolvers = {
  Query: {
    todos: () => db.getAllTodos(),
    todoLists: () => db.getAllTodoLists()
  },

  Mutation: {
    createTodo: async (_, { listId, title }, { cascade }) => {
      const todo = await db.createTodo({ listId, title });

      // Track the created todo
      cascade.trackCreated('Todo', todo.id);

      // Track the updated list
      cascade.trackUpdated('TodoList', listId);

      return {
        todo,
        __cascade: cascade.getCascade()
      };
    },

    updateTodo: async (_, { id, completed }, { cascade }) => {
      const todo = await db.updateTodo(id, { completed });

      // Track the update
      cascade.trackUpdated('Todo', id);

      // If status changed, invalidate filtered queries
      if (completed !== todo.previousCompleted) {
        cascade.invalidate('Query', 'activeTodos');
        cascade.invalidate('Query', 'completedTodos');
      }

      return {
        todo,
        __cascade: cascade.getCascade()
      };
    },

    deleteTodo: async (_, { id }, { cascade }) => {
      const todo = await db.getTodo(id);
      await db.deleteTodo(id);

      // Track the deletion
      cascade.trackDeleted('Todo', id);

      // Track the updated list
      cascade.trackUpdated('TodoList', todo.listId);

      return {
        todo: null,
        __cascade: cascade.getCascade()
      };
    }
  }
};
```

## Advanced Features

### Relationship Propagation

```typescript
// Automatic relationship tracking
cascade.trackUpdated('Todo', todoId, {
  propagate: true,
  depth: 2
});

// Manually tracks:
// - Todo:123 (explicit)
// - TodoList:456 (parent, depth 1)
// - User:789 (owner, depth 2)
```

### Transaction Support

```typescript
async function createProject(_, { input }, { cascade, db }) {
  return db.transaction(async (trx) => {
    const project = await trx.projects.create(input);
    const tasks = await Promise.all(
      input.tasks.map(t => trx.tasks.create({ ...t, projectId: project.id }))
    );

    cascade.trackCreated('Project', project.id);
    cascade.trackCreatedMany('Task', tasks.map(t => t.id));

    return {
      project,
      __cascade: cascade.getCascade()
    };
  });
}
```

### Custom Cascade Logic

```typescript
// Extend CascadeContext for custom logic
class CustomCascadeContext extends CascadeContext {
  trackUpdated(typename: string, id: string) {
    super.trackUpdated(typename, id);

    // Custom logic: Log updates
    logger.info(`Entity updated: ${typename}:${id}`);

    // Custom logic: Notify subscribers
    pubsub.publish('ENTITY_UPDATED', { typename, id });
  }
}
```

## TypeScript Support

Full type safety:

```typescript
import { CascadeContext, Cascade, EntityRef } from '@graphql-cascade/server-node';

interface Context {
  cascade: CascadeContext;
  db: Database;
  user: User;
}

type Resolvers = {
  Mutation: {
    createTodo: (
      parent: unknown,
      args: { input: CreateTodoInput },
      context: Context
    ) => Promise<{ todo: Todo; __cascade: Cascade }>;
  };
};
```

## Testing

```typescript
import { createCascadeContext } from '@graphql-cascade/server-node';

describe('createTodo resolver', () => {
  test('tracks created entity', async () => {
    const cascade = createCascadeContext();
    const mockDb = { createTodo: jest.fn().mockResolvedValue(mockTodo) };

    const result = await resolvers.Mutation.createTodo(
      null,
      { listId: '1', title: 'Test' },
      { cascade, db: mockDb }
    );

    expect(result.__cascade.created).toContainEqual({
      __typename: 'Todo',
      id: mockTodo.id
    });
  });

  test('propagates to related entities', async () => {
    const cascade = createCascadeContext();

    cascade.trackUpdated('Todo', '123', { propagate: true });

    const result = cascade.getCascade();
    expect(result.updated).toEqual(
      expect.arrayContaining([
        { __typename: 'Todo', id: '123' },
        { __typename: 'TodoList', id: expect.any(String) }
      ])
    );
  });
});
```

## Next Steps

- **[Apollo Server Integration](/server/apollo-server)** - Plugin-based setup
- **[Schema Conventions](/server/schema-conventions)** - Best practices
- **[Performance](/guide/performance)** - Optimization techniques
