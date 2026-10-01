# GraphQL Cascade - TypeScript/Node.js Server

A TypeScript/Node.js implementation of GraphQL Cascade server functionality for automatic cache updates.

## Overview

This package provides the core server-side components for GraphQL Cascade:

- **CascadeTracker**: Tracks entity changes during GraphQL mutations
- **CascadeBuilder**: Constructs cascade response objects
- **CascadeInvalidator**: Computes query invalidations (optional)
- **Framework Integrations**: Apollo Server, NestJS, and Express middleware
- **TypeScript Types**: Complete type definitions for cascade operations

## Installation

```bash
# Using npm
npm install @graphql-cascade/server

# Using yarn
yarn add @graphql-cascade/server

# Using pnpm
pnpm add @graphql-cascade/server
```

### Peer Dependencies

For framework integrations, install the appropriate peer dependencies:

```bash
# For Apollo Server integration
npm install @apollo/server

# For NestJS integration
npm install @nestjs/common

# For Express integration
npm install express
```

## Quick Start

```typescript
import { CascadeTracker, CascadeBuilder } from "@graphql-cascade/server";

// Create tracker and builder
const tracker = new CascadeTracker();
const builder = new CascadeBuilder(tracker);

// Start a cascade transaction
const transactionId = tracker.startTransaction();

// Track entity changes during your mutation
tracker.trackCreate({
  id: 1,
  __typename: "User",
  name: "John",
  email: "john@example.com",
});
tracker.trackUpdate({
  id: 2,
  __typename: "Post",
  title: "Updated Title",
  authorId: 1,
});

// Build cascade response
const response = builder.buildResponse(mutationResult);

// Response includes cascade data for automatic cache updates
console.log(response.cascade.updated); // Updated entities
console.log(response.cascade.deleted); // Deleted entities
console.log(response.cascade.metadata); // Performance metadata
```

## Core Concepts

### CascadeTracker

The `CascadeTracker` is the heart of GraphQL Cascade. It tracks entity changes during GraphQL mutations and automatically discovers related entities that may be affected.

```typescript
import { CascadeTracker } from "@graphql-cascade/server";

const tracker = new CascadeTracker({
  maxDepth: 3, // Maximum relationship traversal depth
  excludeTypes: ["AuditLog"], // Types to exclude from tracking
  enableRelationshipTracking: true, // Auto-discover related entities
  maxEntities: 1000, // Maximum entities to track
  maxRelatedPerEntity: 100, // Maximum related entities per entity
});

// Use with context manager (recommended)
import { trackCascade } from "@graphql-cascade/server";

const transaction = trackCascade();
const transactionId = transaction.enter();

// ... perform mutation logic ...

transaction.exit(); // Automatically handles cleanup
```

### CascadeBuilder

The `CascadeBuilder` constructs GraphQL Cascade responses from tracked changes, including optional query invalidations.

```typescript
import { CascadeBuilder } from "@graphql-cascade/server";

const builder = new CascadeBuilder(tracker, invalidator, {
  maxResponseSizeMb: 5.0, // Maximum response size
  maxUpdatedEntities: 500, // Maximum updated entities in response
  maxDeletedEntities: 100, // Maximum deleted entities in response
  maxInvalidations: 50, // Maximum invalidations in response
});

// Build successful response
const response = builder.buildResponse(mutationResult, true);

// Build error response
const errorResponse = builder.buildErrorResponse(errors, partialResult);
```

### Invalidators

An invalidator (optional) computes which cached queries clients should invalidate, as spec `QueryInvalidation` hints. Implement the `Invalidator` interface and pass it to the builder:

```typescript
import {
  CascadeBuilder,
  InvalidationScope,
  InvalidationStrategy,
  type Invalidator,
} from "@graphql-cascade/server";

const invalidator: Invalidator = {
  computeInvalidations(updated, deleted) {
    const touchedTodos = [...updated, ...deleted].some(
      (entry) => entry.typename === "Todo",
    );
    return touchedTodos
      ? [
          {
            queryName: "listTodos",
            strategy: InvalidationStrategy.INVALIDATE,
            scope: InvalidationScope.PREFIX,
          },
        ]
      : [];
  },
};

const builder = new CascadeBuilder(tracker, invalidator);
```

The builder drops hints without a valid `strategy` and `scope` and reports them through `onInvalidationError`.

## Framework Integrations

### Apollo Server Integration

```typescript
import { createCascadePlugin } from "@graphql-cascade/server/apollo";
import { CascadeTracker } from "@graphql-cascade/server";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [createCascadePlugin()],
});

await startStandaloneServer(server, {
  // Resolvers track changes on the request's tracker
  context: async () => ({ cascadeTracker: new CascadeTracker() }),
});
```

The plugin writes one cascade for the whole operation to `extensions.cascade`. A mutation field that throws, or returns a payload with `success: false`, contributes no changes: the plugin undoes whatever that field tracked, so clients never receive entities from a rolled-back transaction.

### NestJS Integration

```typescript
import { CascadeModule } from "@graphql-cascade/server/nestjs";
import { Module } from "@nestjs/common";

@Module({
  imports: [
    CascadeModule.forRoot({
      trackerConfig: { maxDepth: 3 },
      invalidatorConfig: {
        /* ... */
      },
    }),
  ],
})
export class AppModule {}

@Injectable()
export class UserService {
  constructor(private cascadeService: CascadeService) {}

  async createUser(input: CreateUserInput) {
    const transaction = this.cascadeService.startTransaction();

    try {
      const user = await this.userRepository.create(input);
      this.cascadeService.trackCreate(user);

      return this.cascadeService.buildResponse(user);
    } finally {
      transaction.end();
    }
  }
}
```

### Express Integration

```typescript
import {
  cascadeMiddleware,
  getCascadeData,
} from "@graphql-cascade/server/express";
import express from "express";

const app = express();

// Add cascade middleware
app.use(
  cascadeMiddleware({
    tracker: new CascadeTracker(),
    invalidator: new CascadeInvalidator(schema),
  }),
);

// In your GraphQL resolver
app.post("/graphql", async (req, res) => {
  // ... execute GraphQL operation ...

  const cascadeData = getCascadeData();
  const response = buildCascadeResponse(result, cascadeData);

  res.json(response);
});
```

## Configuration Options

### CascadeTracker Configuration

```typescript
interface CascadeTrackerConfig {
  maxDepth?: number; // Default: 3
  excludeTypes?: string[]; // Default: []
  enableRelationshipTracking?: boolean; // Default: true
  maxEntities?: number; // Default: 1000
  maxRelatedPerEntity?: number; // Default: 100
}
```

### CascadeBuilder Configuration

```typescript
interface CascadeBuilderConfig {
  maxResponseSizeMb?: number; // Default: 5.0
  maxUpdatedEntities?: number; // Default: 500
  maxDeletedEntities?: number; // Default: 100
  maxInvalidations?: number; // Default: 50
}
```

## API Reference

### CascadeTracker Methods

```typescript
class CascadeTracker {
  constructor(config?: CascadeTrackerConfig);

  // Transaction management
  startTransaction(): string;
  endTransaction(): CascadeData;
  getCascadeData(): CascadeData;
  resetTransactionState(): void;

  // Entity tracking
  trackCreate(entity: any): void;
  trackUpdate(entity: any): void;
  trackDelete(typename: string, entityId: string | number): void;

  // Streaming (for large datasets)
  *getUpdatedStream(): IterableIterator<[any, string]>;
  *getDeletedStream(): IterableIterator<[string, string]>;
}
```

### CascadeBuilder Methods

```typescript
class CascadeBuilder {
  constructor(
    tracker: CascadeTracker,
    invalidator?: any,
    config?: CascadeBuilderConfig,
  );

  buildResponse(
    primaryResult?: any,
    success?: boolean,
    errors?: CascadeError[],
  ): CascadeResponse;
  buildErrorResponse(
    errors: CascadeError[],
    primaryResult?: any,
  ): CascadeResponse;
}
```

### Convenience Functions

```typescript
// Build responses without creating instances
import {
  buildSuccessResponse,
  buildErrorResponse,
} from "@graphql-cascade/server";

const response = buildSuccessResponse(tracker, invalidator, result);
const errorResponse = buildErrorResponse(tracker, errors, result);
```

## Advanced Usage

### Custom Entity Identification

By default, CascadeTracker looks for `__typename` and `id` properties. You can customize this behavior:

```typescript
class CustomTracker extends CascadeTracker {
  protected getEntityType(entity: any): string {
    return entity.type || entity.__typename || "Unknown";
  }

  protected getEntityId(entity: any): string {
    return entity.uuid || entity.id || "unknown";
  }
}
```

### Relationship Tracking

CascadeTracker automatically discovers relationships by inspecting object properties:

```typescript
// Entity with relationships
const user = {
  id: 1,
  __typename: "User",
  name: "John",
  posts: [
    { id: 1, __typename: "Post", title: "Hello" },
    { id: 2, __typename: "Post", title: "World" },
  ],
  company: { id: 1, __typename: "Company", name: "ACME" },
};

// When you track the user, related posts and company are automatically tracked
tracker.trackUpdate(user);
```

### Streaming for Large Datasets

For operations affecting many entities, use `StreamingCascadeBuilder`:

```typescript
import { StreamingCascadeBuilder } from "@graphql-cascade/server";

const builder = new StreamingCascadeBuilder(tracker);
const response = builder.buildStreamingResponse(result);
```

### Performance Monitoring

Access performance metadata in cascade responses:

```typescript
const response = builder.buildResponse(result);
console.log(`Tracking time: ${response.cascade.metadata.trackingTime}ms`);
console.log(
  `Construction time: ${response.cascade.metadata.constructionTime}ms`,
);
console.log(`Entities affected: ${response.cascade.metadata.affectedCount}`);
```

## Response Format

```typescript
interface CascadeResponse<T = any> {
  success: boolean;
  errors?: CascadeError[];
  data: T;
  cascade: CascadeUpdates;
}

interface CascadeUpdates {
  updated: UpdatedEntity[];
  deleted: DeletedEntity[];
  invalidations: QueryInvalidation[];
  metadata: CascadeMetadata;
}

interface UpdatedEntity {
  __typename: string;
  id: string;
  operation: "CREATED" | "UPDATED" | "DELETED";
  entity: any;
}

interface DeletedEntity {
  __typename: string;
  id: string;
  deletedAt: string;
}

interface CascadeMetadata {
  timestamp: string;
  transactionId?: string;
  depth: number;
  affectedCount: number;
  trackingTime: number;
  constructionTime?: number;
  truncatedUpdated?: boolean;
  truncatedDeleted?: boolean;
  truncatedInvalidations?: boolean;
}
```

## Troubleshooting

### Common Issues

**"No cascade transaction in progress"**

- Ensure you call `tracker.startTransaction()` before tracking changes
- Use the `trackCascade()` context manager for automatic cleanup

**Memory issues with large datasets**

- Use `StreamingCascadeBuilder` for operations affecting many entities
- Configure appropriate limits in `CascadeTrackerConfig`
- Consider pagination for bulk operations

**Missing related entities in cascade**

- Ensure entities have proper `__typename` and `id` properties
- Check `maxDepth` configuration for relationship traversal
- Verify `enableRelationshipTracking` is enabled

**Performance problems**

- Monitor `trackingTime` and `constructionTime` in metadata
- Adjust `maxEntities` and `maxRelatedPerEntity` limits
- Use streaming for large responses

### Debugging

Enable debug logging:

```typescript
// Set environment variable
process.env.DEBUG = "cascade:*";

// Or enable in tracker config
const tracker = new CascadeTracker({
  debug: true,
  // ... other config
});
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm run test

# Run linting
npm run lint

# Development mode
npm run dev
```

## Related Packages

- **[@graphql-cascade/client-core](../client-core/)** - Core client functionality
- **[@graphql-cascade/apollo](../client-apollo/)** - Apollo Client integration
- **[@graphql-cascade/react-query](../client-react-query/)** - React Query integration
- **[@graphql-cascade/relay](../client-relay/)** - Relay integration

## License

MIT
