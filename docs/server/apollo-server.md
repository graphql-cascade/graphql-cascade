# Apollo Server Plugin

Drop-in plugin for Apollo Server with automatic cascade support.

## Installation

```bash
npm install @graphql-cascade/apollo-server-plugin
```

## Quick Setup

```typescript
import { ApolloServer } from '@apollo/server';
import { CascadePlugin } from '@graphql-cascade/apollo-server-plugin';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    new CascadePlugin({
      debug: true,
      maxDepth: 2
    })
  ]
});
```

The plugin automatically:
- Injects cascade context into resolvers
- Validates cascade responses
- Adds cascade type definitions to schema
- Provides debug logging

## Usage

```typescript
const resolvers = {
  Mutation: {
    createTodo: async (_, { input }, { cascade }) => {
      // cascade context is automatically available
      const todo = await db.createTodo(input);
      cascade.trackCreated('Todo', todo.id);

      return {
        todo,
        __cascade: cascade.getCascade()
      };
    }
  }
};
```

## Configuration

```typescript
new CascadePlugin({
  // Enable debug logging
  debug: process.env.NODE_ENV === 'development',

  // Max relationship depth
  maxDepth: 2,

  // Max entities in cascade
  maxEntities: 1000,

  // Custom cascade processing
  onCascade: (cascade) => {
    console.log('Cascade:', cascade);
  }
})
```

## Next Steps

- **[NestJS Integration](/server/nestjs)** - Decorator-based approach
- **[Node.js Server](/server/node)** - Lower-level implementation
