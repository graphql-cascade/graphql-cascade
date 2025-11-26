# Server Node API

Server-side types and implementation.

## CascadeContext

### createCascadeContext

```typescript
function createCascadeContext(options?: CascadeOptions): CascadeContext;

interface CascadeOptions {
  maxDepth?: number; // Default: 2
  maxEntities?: number; // Default: 1000
  debug?: boolean; // Default: false
}
```

### CascadeContext Interface

```typescript
interface CascadeContext {
  // Track operations
  trackCreated(typename: string, id: string): void;
  trackUpdated(typename: string, id: string, options?: TrackOptions): void;
  trackDeleted(typename: string, id: string): void;

  // Batch operations
  trackCreatedMany(typename: string, ids: string[]): void;
  trackUpdatedMany(typename: string, ids: string[]): void;
  trackDeletedMany(typename: string, ids: string[]): void;

  // Invalidation
  invalidate(typename: string, field?: string): void;
  invalidateType(typename: string): void;

  // Get result
  getCascade(): Cascade;

  // Utilities
  reset(): void;
  isEmpty(): boolean;
}

interface TrackOptions {
  propagate?: boolean; // Track related entities
  depth?: number; // Traversal depth
}
```

## Types

### Cascade

```typescript
interface Cascade {
  created: EntityRef[];
  updated: EntityRef[];
  deleted: EntityRef[];
  invalidated: InvalidationRef[];
}
```

### EntityRef

```typescript
interface EntityRef {
  __typename: string;
  id: string;
}
```

### InvalidationRef

```typescript
interface InvalidationRef {
  __typename: string;
  field?: string;
}
```

## Usage Example

```typescript
import { createCascadeContext } from '@graphql-cascade/server-node';

const resolvers = {
  Mutation: {
    createTodo: async (_, { input }, context) => {
      const cascade = createCascadeContext();
      const todo = await db.createTodo(input);

      cascade.trackCreated('Todo', todo.id);
      cascade.trackUpdated('TodoList', input.listId);

      return {
        todo,
        __cascade: cascade.getCascade()
      };
    }
  }
};
```

## Next Steps

- **[Client Core API](/api/client-core)** - Client types
- **[Server Guide](/server/)** - Implementation guide
