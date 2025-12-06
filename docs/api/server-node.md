# Server Node API

Complete API reference for `@graphql-cascade/server`. This package provides server-side entity tracking and cascade response building for GraphQL mutations.

## Installation

```bash
npm install @graphql-cascade/server
```

## CascadeTracker

The `CascadeTracker` class tracks entity changes during GraphQL mutations for cascade response construction.

### Constructor

```typescript
import { CascadeTracker } from '@graphql-cascade/server';

const tracker = new CascadeTracker(config?: CascadeTrackerConfig);
```

### CascadeTrackerConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxDepth` | `number` | `3` | Maximum depth for relationship traversal |
| `excludeTypes` | `string[]` | `[]` | GraphQL types to exclude from tracking |
| `enableRelationshipTracking` | `boolean` | `true` | Whether to automatically traverse and track related entities |
| `maxEntities` | `number` | `1000` | Maximum total entities to track (prevents memory exhaustion) |
| `maxRelatedPerEntity` | `number` | `100` | Maximum related entities to traverse per entity (breadth limit) |
| `onSerializationError` | `(entity: unknown, error: Error) =&gt; void` | `undefined` | Handler called when entity serialization fails |

```typescript
const tracker = new CascadeTracker({
  maxDepth: 2,
  excludeTypes: ['AuditLog', 'SystemEvent'],
  enableRelationshipTracking: true,
  maxEntities: 500,
  maxRelatedPerEntity: 50,
  onSerializationError: (entity, error) =&gt; {
    console.warn('Failed to serialize entity:', entity, error);
  }
});
```

### Methods

#### startTransaction(): string

Starts a new cascade transaction. Must be called before tracking any entities.

- **Returns:** Transaction ID (unique identifier for this transaction)
- **Throws:** `Error` if a transaction is already in progress

```typescript
const transactionId = tracker.startTransaction();
// transactionId: "cascade_1234567890_abc123def"
```

#### endTransaction(): Record&lt;string, any&gt;

Ends the current transaction and returns the cascade data. Resets the tracker state.

- **Returns:** Cascade data object containing `updated`, `deleted`, and `metadata`
- **Throws:** `Error` if no transaction is in progress

```typescript
const cascadeData = tracker.endTransaction();
// {
//   updated: [...],
//   deleted: [...],
//   metadata: { transactionId, timestamp, depth, affectedCount, trackingTime }
// }
```

#### getCascadeData(): Record&lt;string, any&gt;

Gets the current cascade data without ending the transaction.

- **Returns:** Cascade data object
- **Throws:** `Error` if no transaction is in progress

```typescript
const currentData = tracker.getCascadeData();
// Transaction remains active
```

#### trackCreate(entity: TrackedEntity): void

Tracks an entity creation. The entity is added to the cascade's `updated` array with operation `CREATED`.

- **Parameters:**
  - `entity` - Entity object with at least `id` and optionally `__typename`
- **Throws:** `Error` if no transaction is in progress

```typescript
tracker.trackCreate({
  __typename: 'User',
  id: '123',
  name: 'John Doe',
  email: 'john@example.com'
});
```

#### trackUpdate(entity: TrackedEntity): void

Tracks an entity update. The entity is added to the cascade's `updated` array with operation `UPDATED`.

- **Parameters:**
  - `entity` - Entity object with at least `id` and optionally `__typename`
- **Throws:** `Error` if no transaction is in progress

```typescript
tracker.trackUpdate({
  __typename: 'User',
  id: '123',
  name: 'John Smith' // Updated name
});
```

#### trackDelete(typename: string, entityId: string | number): void

Tracks an entity deletion. The entity is added to the cascade's `deleted` array.

- **Parameters:**
  - `typename` - GraphQL type name
  - `entityId` - Entity ID
- **Throws:** `Error` if no transaction is in progress

```typescript
tracker.trackDelete('User', '123');
```

#### resetTransactionState(): void

Resets all transaction state. Called automatically by `endTransaction()`.

```typescript
tracker.resetTransactionState();
```

#### getUpdatedStream(): IterableIterator&lt;[any, string]&gt;

Returns an iterator over updated entities for streaming. Useful for large cascades.

- **Returns:** Iterator yielding `[entity, operation]` tuples

```typescript
for (const [entity, operation] of tracker.getUpdatedStream()) {
  console.log(operation, entity.id);
}
```

#### getDeletedStream(): IterableIterator&lt;[string, string]&gt;

Returns an iterator over deleted entities for streaming.

- **Returns:** Iterator yielding `[typename, entityId]` tuples

```typescript
for (const [typename, id] of tracker.getDeletedStream()) {
  console.log('Deleted', typename, id);
}
```

---

## CascadeTransaction

A context manager for cascade transactions. Provides automatic cleanup on errors.

```typescript
import { CascadeTransaction, CascadeTracker } from '@graphql-cascade/server';

const tracker = new CascadeTracker();
const transaction = new CascadeTransaction(tracker);

// Manual usage
const txId = transaction.enter();
// ... track entities ...
transaction.exit();
```

---

## CascadeBuilder

Builds GraphQL Cascade responses from tracked changes.

### Constructor

```typescript
import { CascadeBuilder } from '@graphql-cascade/server';

const builder = new CascadeBuilder(
  tracker: CascadeTracker,
  invalidator?: Invalidator,
  config?: CascadeBuilderConfig
);
```

### CascadeBuilderConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxResponseSizeMb` | `number` | `5.0` | Maximum response size in MB before truncation |
| `maxUpdatedEntities` | `number` | `500` | Maximum updated entities in response |
| `maxDeletedEntities` | `number` | `100` | Maximum deleted entities in response |
| `maxInvalidations` | `number` | `50` | Maximum invalidation entries in response |
| `onInvalidationError` | `(error: Error) =&gt; void` | `undefined` | Handler for invalidation computation errors |

```typescript
const builder = new CascadeBuilder(tracker, invalidator, {
  maxUpdatedEntities: 200,
  maxDeletedEntities: 50,
  maxInvalidations: 20,
  onInvalidationError: (error) =&gt; {
    console.warn('Invalidation error:', error);
  }
});
```

### Methods

#### buildResponse&lt;T&gt;(primaryResult, success, errors): CascadeResponse

Builds a complete cascade response.

- **Parameters:**
  - `primaryResult` - The primary mutation result data
  - `success` - Whether the operation succeeded (default: `true`)
  - `errors` - Array of error objects (default: `[]`)
- **Returns:** `CascadeResponse` object

```typescript
const response = builder.buildResponse(createdUser, true);
// {
//   success: true,
//   data: { id: '123', name: 'John' },
//   cascade: { updated: [...], deleted: [], invalidations: [], metadata: {...} },
//   errors: []
// }
```

#### buildErrorResponse(errors, primaryResult): CascadeResponse

Builds an error response with minimal cascade data.

- **Parameters:**
  - `errors` - Array of error objects
  - `primaryResult` - Optional partial result data
- **Returns:** `CascadeResponse` with `success: false`

```typescript
const response = builder.buildErrorResponse([
  { message: 'Validation failed', code: 'VALIDATION_ERROR', field: 'email' }
]);
```

---

## StreamingCascadeBuilder

Extended builder for handling large cascades using streaming.

```typescript
import { StreamingCascadeBuilder } from '@graphql-cascade/server';

const builder = new StreamingCascadeBuilder(tracker, invalidator, config);
```

### Methods

#### buildStreamingResponse(primaryResult, success, errors): CascadeResponse

Builds a response using streaming to avoid loading all entities in memory.

```typescript
const response = builder.buildStreamingResponse(result, true);
// Metadata includes: { streaming: true, ... }
```

---

## Convenience Functions

### buildSuccessResponse

```typescript
import { buildSuccessResponse } from '@graphql-cascade/server';

const response = buildSuccessResponse(
  tracker: CascadeTracker,
  invalidator?: Invalidator,
  primaryResult?: any
): CascadeResponse;
```

### buildErrorResponse

```typescript
import { buildErrorResponse } from '@graphql-cascade/server';

const response = buildErrorResponse(
  tracker: CascadeTracker,
  errors: CascadeError[],
  primaryResult?: any
): CascadeResponse;
```

### buildStreamingSuccessResponse

```typescript
import { buildStreamingSuccessResponse } from '@graphql-cascade/server';

const response = buildStreamingSuccessResponse(
  tracker: CascadeTracker,
  invalidator?: Invalidator,
  primaryResult?: any
): CascadeResponse;
```

### trackCascade

Creates a cascade transaction context manager.

```typescript
import { trackCascade } from '@graphql-cascade/server';

const transaction = trackCascade(config?: CascadeTrackerConfig): CascadeTransaction;
```

---

## Types

### CascadeResponse

```typescript
interface CascadeResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** The primary result data */
  data?: any;
  /** Cascade data for cache updates */
  cascade: CascadeData;
  /** List of errors (if any) */
  errors: CascadeError[];
}
```

### CascadeData

```typescript
interface CascadeData {
  /** List of updated entities */
  updated: CascadeUpdatedEntity[];
  /** List of deleted entities */
  deleted: CascadeDeletedEntity[];
  /** List of cache invalidations */
  invalidations: CascadeInvalidation[];
  /** Metadata about the cascade operation */
  metadata: CascadeMetadata;
}
```

### CascadeUpdatedEntity

```typescript
interface CascadeUpdatedEntity {
  /** GraphQL type name */
  __typename: string;
  /** Entity ID */
  id: string;
  /** Operation performed: 'CREATED' | 'UPDATED' | 'DELETED' */
  operation: 'CREATED' | 'UPDATED' | 'DELETED';
  /** The entity data */
  entity: Record&lt;string, any&gt;;
}
```

### CascadeDeletedEntity

```typescript
interface CascadeDeletedEntity {
  /** GraphQL type name */
  __typename: string;
  /** Entity ID */
  id: string;
  /** ISO timestamp when deleted */
  deletedAt: string;
}
```

### CascadeInvalidation

```typescript
interface CascadeInvalidation {
  /** GraphQL type name */
  __typename: string;
  /** Entity ID or field path */
  id?: string;
  /** Field that was invalidated */
  field?: string;
  /** Reason for invalidation */
  reason: string;
}
```

### CascadeMetadata

```typescript
interface CascadeMetadata {
  /** Unique transaction identifier */
  transactionId?: string;
  /** ISO timestamp */
  timestamp: string;
  /** Depth of relationship traversal */
  depth: number;
  /** Total number of affected entities */
  affectedCount: number;
  /** Time spent tracking changes (ms) */
  trackingTime: number;
  /** Time spent building response (ms) */
  constructionTime?: number;
  /** Whether updated entities were truncated */
  truncatedUpdated?: boolean;
  /** Whether deleted entities were truncated */
  truncatedDeleted?: boolean;
  /** Whether invalidations were truncated */
  truncatedInvalidations?: boolean;
  /** Whether response was size-truncated */
  truncatedSize?: boolean;
  /** Whether streaming was used */
  streaming?: boolean;
  /** Number of serialization errors */
  serializationErrors?: number;
}
```

### CascadeError

```typescript
interface CascadeError {
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** Field that caused the error */
  field?: string;
  /** Path to the error */
  path?: string[];
  /** Additional error extensions */
  extensions?: Record&lt;string, any&gt;;
}
```

### TrackedEntity

```typescript
interface TrackedEntity {
  /** Entity ID (required) */
  id: string | number;
  /** GraphQL type name */
  __typename?: string;
  /** Alternative typename field */
  _typename?: string;
  /** Custom serialization method */
  toDict?: () =&gt; Record&lt;string, unknown&gt;;
  /** Custom method to get related entities */
  getRelatedEntities?: () =&gt; TrackedEntity[];
  /** Additional properties */
  [key: string]: unknown;
}
```

### Invalidator

```typescript
interface Invalidator {
  /** Compute invalidations based on entity changes */
  computeInvalidations(
    updated: CascadeUpdatedEntity[],
    deleted: CascadeDeletedEntity[],
    primaryResult: unknown
  ): CascadeInvalidation[] | null | undefined;
}
```

---

## Usage Examples

### Basic Mutation with Cascade

```typescript
import { CascadeTracker, CascadeBuilder } from '@graphql-cascade/server';

const resolvers = {
  Mutation: {
    createTodo: async (_, { input }, context) =&gt; {
      const tracker = new CascadeTracker();
      tracker.startTransaction();

      try {
        // Create the todo
        const todo = await context.db.createTodo(input);
        tracker.trackCreate(todo);

        // Track parent list update
        const list = await context.db.getTodoList(input.listId);
        tracker.trackUpdate(list);

        // Build response
        const builder = new CascadeBuilder(tracker);
        return builder.buildResponse(todo, true);
      } catch (error) {
        const builder = new CascadeBuilder(tracker);
        return builder.buildErrorResponse([{
          message: error.message,
          code: 'CREATE_FAILED'
        }]);
      }
    }
  }
};
```

### With Custom Invalidator

```typescript
const invalidator = {
  computeInvalidations(updated, deleted, result) {
    const invalidations = [];

    // Invalidate list queries when todos change
    const affectedTypes = new Set(updated.map(e =&gt; e.__typename));
    if (affectedTypes.has('Todo')) {
      invalidations.push({
        __typename: 'Query',
        field: 'todos',
        reason: 'Todo entities modified'
      });
    }

    return invalidations;
  }
};

const builder = new CascadeBuilder(tracker, invalidator);
```

### With Relationship Tracking

```typescript
const tracker = new CascadeTracker({
  maxDepth: 2,
  enableRelationshipTracking: true
});

tracker.startTransaction();

// When you track an entity with related entities,
// those relationships are automatically traversed
const user = {
  __typename: 'User',
  id: '1',
  name: 'John',
  posts: [
    { __typename: 'Post', id: '101', title: 'Hello' },
    { __typename: 'Post', id: '102', title: 'World' }
  ]
};

tracker.trackUpdate(user);
// User and both Posts will be tracked automatically
```

### Streaming for Large Cascades

```typescript
import { StreamingCascadeBuilder } from '@graphql-cascade/server';

const tracker = new CascadeTracker({ maxEntities: 10000 });
tracker.startTransaction();

// Track many entities
for (const user of bulkUpdatedUsers) {
  tracker.trackUpdate(user);
}

const builder = new StreamingCascadeBuilder(tracker, invalidator, {
  maxUpdatedEntities: 1000
});

return builder.buildStreamingResponse(result, true);
```

---

## Next Steps

- **[Client Core API](/api/client-core)** - Client types and interfaces
- **[Server Guide](/server/)** - Detailed implementation guide
- **[Troubleshooting](/guide/troubleshooting)** - Common issues and solutions
- **[Performance](/guide/performance)** - Optimization techniques
