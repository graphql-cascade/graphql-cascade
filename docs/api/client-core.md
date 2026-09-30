# Client Core API

`@graphql-cascade/client` holds what every Cascade client shares: the response types, `CascadeClient`, and the `CascadeCache` interface that client libraries implement.

```bash
npm install @graphql-cascade/client graphql
```

## CascadeClient

Applies cascades to a `CascadeCache`.

```typescript
import { CascadeClient } from "@graphql-cascade/client";

const client = new CascadeClient(cache, (document, variables) => execute(document, variables));
```

| Method | Description |
|--------|-------------|
| `mutate(mutation, variables?)` | Execute a mutation, apply the first field's cascade, and return that field's `data` |
| `query(query, variables?)` | Execute a query and return its `data` |
| `applyCascade(response)` | Apply a `CascadeResponse`: write `data` if it has `__typename` and `id`, then the steps below |
| `getCache()` | The cache |

`applyCascade` writes each `updated` entity, evicts each `deleted` entity, calls `invalidate`, `refetch` or `remove` for each hint by its strategy, and applies `typeInvalidations`.

The executor returns a GraphQL response (`{ data, errors }`).

### OptimisticCascadeClient

Extends `CascadeClient` with `mutateOptimistic(mutation, variables, optimisticResponse)`: it applies `optimisticResponse` first and, if the mutation throws, restores the entities it changed from what `cache.read` returned before.

## CascadeCache

The interface a cache implements to receive cascades:

```typescript
interface CascadeCache<T = Record<string, unknown>> {
  write(typename: string, id: string, data: T): void;
  read(typename: string, id: string): T | null;
  evict(typename: string, id: string): void;
  invalidate(invalidation: QueryInvalidation): void;
  refetch(invalidation: QueryInvalidation): Promise<void>;
  remove(invalidation: QueryInvalidation): void;
  invalidateType?(typename: string): void;
  identify(entity: T): string;
}
```

Without `invalidateType`, a type invalidation invalidates every query (`scope: ALL`): always correct, only less precise.

## Functions

### toCascadeResponse(result)

Normalizes a mutation field's result to a `CascadeResponse`, or returns `undefined` for a result that is not a cascade result:

- a `CascadeResponse` is returned as it is;
- a `CascadePayload` becomes `success: true`, with its `warnings` as `errors`;
- a `CascadeFailure` becomes `success: false` with an empty cascade, since nothing was committed.

### cascadeEntryTypename(entry)

The type name of an `updated` or `deleted` entry: `typename`, or `__typename` from servers before specification 1.3.0.

### invalidationMatches(invalidation, queryName, args?)

Whether a hint selects a cached query with that name and arguments, by the specification's scopes: `EXACT` compares the name, and the arguments when the hint has them; `PREFIX` the start of the name; `PATTERN` a glob (`*`, `?`); `ALL` matches every query. Caches implementing `CascadeCache` use it to find the queries a hint names.

### applyTypeInvalidations(cache, typeInvalidations)

Calls `cache.invalidateType` for each type, or invalidates every query once when the cache has no `invalidateType`.

## Types

### CascadeResponse

```typescript
interface CascadeResponse<T = unknown> {
  success: boolean;
  errors?: CascadeError[];
  data: T;
  cascade: CascadeUpdates;
}
```

### CascadeUpdates

```typescript
interface CascadeUpdates {
  updated: UpdatedEntity[];
  deleted: DeletedEntity[];
  invalidations: QueryInvalidation[];
  typeInvalidations?: TypeInvalidation[];
  metadata: CascadeMetadata;
}
```

### UpdatedEntity and DeletedEntity

```typescript
interface UpdatedEntity<T = Record<string, unknown>> {
  typename: string;
  id: string;
  operation: CascadeOperation; // CREATED | UPDATED | DELETED
  entity: T;
  updatedFields?: string[] | null;
}

interface DeletedEntity {
  typename: string;
  id: string;
  deletedAt: string;
}
```

Read type names with `cascadeEntryTypename()` to accept servers before specification 1.3.0 too.

### QueryInvalidation and TypeInvalidation

```typescript
interface QueryInvalidation {
  queryName?: string;
  queryHash?: string;
  arguments?: Record<string, unknown>;
  queryPattern?: string;
  strategy: InvalidationStrategy; // INVALIDATE | REFETCH | REMOVE
  scope: InvalidationScope; // EXACT | PREFIX | PATTERN | ALL
}

interface TypeInvalidation {
  typename: string;
  affectedCount?: number;
}
```

### CascadeMetadata

```typescript
interface CascadeMetadata {
  timestamp: string;
  transactionId?: string;
  depth: number;
  affectedCount: number;
  truncated?: boolean;
}
```

### CascadeError

```typescript
interface CascadeError {
  message: string;
  code: CascadeErrorCode;
  domainCode?: string;
  field?: string;
  path?: string[];
  extensions?: Record<string, unknown>;
}
```

`CascadeErrorCode` lists the standard codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `INTERNAL_ERROR`, `TRANSACTION_FAILED`, `TIMEOUT`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`. Treat a code you don't know as `INTERNAL_ERROR`: later specification versions may add codes.

## Errors

| Function | Description |
|----------|-------------|
| `isRetryableError(error)` | `TIMEOUT`, `SERVICE_UNAVAILABLE` or `RATE_LIMITED` |
| `isAuthError(error)` | `UNAUTHORIZED` or `FORBIDDEN` |
| `isClientError(error)` | An error the request caused: validation, not found, auth, conflict |
| `getRetryDelay(error)` | The server's `extensions.retryAfter`, in seconds |
| `shouldRetry(error, attempt, options?)` | Retryable and under `maxRetries` (default 3) |
| `calculateRetryDelay(error, attempt, options?)` | `retryAfter` if sent, else exponential backoff from `baseDelay` (1000 ms) up to `maxDelay` (30000 ms) |

## Conflict Resolution

`CascadeConflictResolver` compares a local entity with the server's:

- `detectConflicts(local, server)` reports a `VERSION_MISMATCH` (different `version`), a `TIMESTAMP_MISMATCH` (local `updatedAt` newer), or a `FIELD_CONFLICT` with the differing fields.
- `resolveConflicts(conflict, strategy)` returns the server entity (`SERVER_WINS`), the local one (`CLIENT_WINS`), the server's with local values filling its nulls (`MERGE`), or throws (`MANUAL`).

## Logging

`configureLogger({ level, logger, prefix })` sets the level (`debug` to `silent`) and destination of the client libraries' logs; `createScopedLogger(prefix)` makes a logger for your own code.

## Next Steps

- **[Client Libraries](/clients/)**: the adapters built on this package
- **[Server API](/api/server-node)**
