# GraphQL Cascade Framework Integrations

This directory contains optional integrations for popular Node.js frameworks and GraphQL servers.

## Available Integrations

### 1. NestJS (`nestjs.ts`)

**Module and Service for NestJS applications with request-scoped cascade tracking.**

```typescript
import { Module } from '@nestjs/common';
import { CascadeModule } from '@graphql-cascade/server';

@Module({
  imports: [
    CascadeModule.forRoot({
      maxDepth: 5,
      excludeTypes: ['InternalType'],
      maxResponseSizeMb: 10,
    }),
  ],
})
export class AppModule {}
```

**Usage in Resolvers:**

```typescript
import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { CascadeService } from '@graphql-cascade/server';

@Resolver()
export class UserResolver {
  constructor(private cascadeService: CascadeService) {}

  @Mutation(() => User)
  async updateUser(@Args('id') id: string, @Args('input') input: UpdateUserInput) {
    this.cascadeService.startTransaction();

    const user = await this.userService.update(id, input);
    this.cascadeService.trackUpdate(user);

    return this.cascadeService.buildResponse(user);
  }
}
```

### 2. Apollo Server (`apollo.ts`)

**Plugin for Apollo Server v4+ that automatically injects cascade data into response extensions.**

```typescript
import { ApolloServer } from '@apollo/server';
import { createCascadePlugin } from '@graphql-cascade/server';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    createCascadePlugin({
      maxDepth: 5,
      excludeTypes: ['InternalType'],
      contextKey: 'cascadeTracker', // default
      autoInject: true, // default
    }),
  ],
});
```

**Context Setup:**

```typescript
import { CascadeTracker } from '@graphql-cascade/server';

const server = new ApolloServer({
  // ...
  context: async () => ({
    cascadeTracker: new CascadeTracker(),
  }),
});
```

**Usage in Resolvers:**

```typescript
const resolvers = {
  Mutation: {
    updateUser: async (parent, args, context) => {
      context.cascadeTracker.startTransaction();

      const user = await updateUserInDB(args.id, args.input);
      context.cascadeTracker.trackUpdate(user);

      // Cascade data will be automatically injected into response.extensions.cascade
      return user;
    },
  },
};
```

### 3. Express Middleware (`express.ts`)

**Middleware for Express applications that attaches cascade tracker to each request.**

```typescript
import express from 'express';
import { cascadeMiddleware } from '@graphql-cascade/server';

const app = express();

// Add cascade middleware before GraphQL handlers
app.use(
  cascadeMiddleware({
    maxDepth: 5,
    excludeTypes: ['InternalType'],
    maxResponseSizeMb: 10,
  })
);

// Now req.cascadeTracker and req.cascadeBuilder are available
app.post('/graphql', (req, res) => {
  req.cascadeTracker.startTransaction();
  // ... handle GraphQL
});
```

**Helper Functions:**

```typescript
import { getCascadeData, buildCascadeResponse } from '@graphql-cascade/server';

app.post('/api/users', async (req, res) => {
  req.cascadeTracker.startTransaction();

  const user = await createUser(req.body);
  req.cascadeTracker.trackCreate(user);

  const response = buildCascadeResponse(req, user);
  res.json(response);
});
```

## Configuration Options

### Tracker Configuration

```typescript
interface CascadeTrackerConfig {
  /** Maximum depth for relationship traversal (default: 3) */
  maxDepth?: number;

  /** Types to exclude from tracking */
  excludeTypes?: string[];

  /** Whether to enable relationship tracking (default: true) */
  enableRelationshipTracking?: boolean;
}
```

### Builder Configuration

```typescript
interface CascadeBuilderConfig {
  /** Maximum response size in MB (default: 5.0) */
  maxResponseSizeMb?: number;

  /** Maximum number of updated entities (default: 500) */
  maxUpdatedEntities?: number;

  /** Maximum number of deleted entities (default: 100) */
  maxDeletedEntities?: number;

  /** Maximum number of invalidations (default: 50) */
  maxInvalidations?: number;
}
```

## Peer Dependencies

These integrations require the following peer dependencies (all optional):

- `@nestjs/common` ^9.0.0 || ^10.0.0
- `@apollo/server` ^4.0.0
- `express` ^4.0.0

Install only the frameworks you need:

```bash
# For NestJS
npm install @nestjs/common reflect-metadata

# For Apollo Server
npm install @apollo/server graphql

# For Express
npm install express
```

## Testing

Each integration includes comprehensive test coverage:

```bash
npm test -- src/integrations/nestjs.test.ts
npm test -- src/integrations/apollo.test.ts
npm test -- src/integrations/express.test.ts
```

## Type Safety

All integrations are fully typed with TypeScript and include type definitions for:

- Request/Response types
- Configuration options
- Context extensions
- Plugin interfaces

## Best Practices

1. **NestJS**: Use `CascadeService` as a request-scoped provider
2. **Apollo Server**: Store tracker in context with a consistent key
3. **Express**: Apply middleware before GraphQL handlers
4. **All**: Start transactions before tracking entity changes
5. **All**: Use try-catch to handle tracking errors gracefully

## Examples

See the test files for complete working examples:

- `/home/lionel/code/graphql-cascade/packages/server-node/src/integrations/nestjs.test.ts`
- `/home/lionel/code/graphql-cascade/packages/server-node/src/integrations/apollo.test.ts`
- `/home/lionel/code/graphql-cascade/packages/server-node/src/integrations/express.test.ts`
