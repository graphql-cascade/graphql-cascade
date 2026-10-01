# Server Implementation

A Cascade server does three things for each mutation: it records the entities the mutation changes, computes hints about stale queries, and returns both in the payload's `cascade` field. `@graphql-cascade/server` provides the pieces for Node.js servers.

## The Model

- **`CascadeTracker`** records what a mutation changes: `trackCreate`, `trackUpdate`, `trackDelete`. With relationship tracking on, tracking an entity also walks the entities it references, up to `maxDepth`.
- **`Invalidator`** (optional) turns the tracked changes into invalidation hints, for queries that entity updates alone cannot fix, such as lists.
- **`CascadeBuilder`** builds the payload: `success`, `errors`, `data` and `cascade`. It enforces size limits by moving whole types into `typeInvalidations` rather than dropping entities.

```typescript
import { CascadeBuilder, CascadeTracker } from "@graphql-cascade/server";

async function updateUser(_: unknown, { id, input }, { db }) {
  const tracker = new CascadeTracker();
  tracker.startTransaction();

  const user = await db.users.update(id, input);
  tracker.trackUpdate(
    { __typename: "User", ...user },
    { updatedFields: Object.keys(input) },
  );

  return new CascadeBuilder(tracker, invalidator).buildResponse(user);
}
```

## Integrations

Pick how trackers reach your resolvers:

| Setup | What it does | Page |
|-------|--------------|------|
| Per resolver | Create a tracker and builder in each mutation resolver, as above | [Node.js](/server/node) |
| Express | `cascadeMiddleware()` from `@graphql-cascade/server/express` puts a tracker and builder on each request | [Node.js](/server/node#express) |
| NestJS | `CascadeModule` from `@graphql-cascade/server/nestjs` provides a request-scoped `CascadeService` | [NestJS](/server/nestjs) |
| Apollo Server | `createCascadePlugin()` from `@graphql-cascade/server/apollo` sends one cascade per operation in `extensions.cascade` | [Apollo Server](/server/apollo-server) |

Each integration has its own entry point, so `@graphql-cascade/server` loads without the frameworks you don't use installed.

The payload `cascade` field is the normative place for a cascade. The Apollo Server plugin's `extensions.cascade` delivery is an optional alternative for schemas whose payload types cannot carry a `cascade` field.

## Schema

Add the core types from the [reference schema](https://github.com/graphql-cascade/graphql-cascade/blob/main/reference/cascade_base.graphql) to your schema, and give each mutation a payload that implements `CascadeResponse`, or a result union with `CascadePayload`. See [Schema Conventions](/server/schema-conventions).

## Invalidation Hints

An `Invalidator` receives the tracked entries and returns spec `QueryInvalidation` hints:

```typescript
import {
  InvalidationScope,
  InvalidationStrategy,
  type Invalidator,
} from "@graphql-cascade/server";

const invalidator: Invalidator = {
  computeInvalidations(updated, deleted) {
    const created = updated.some(
      (e) => e.typename === "Todo" && e.operation === "CREATED",
    );
    const removed = deleted.some((e) => e.typename === "Todo");
    return created || removed
      ? [
          {
            queryName: "todos",
            strategy: InvalidationStrategy.INVALIDATE,
            scope: InvalidationScope.PREFIX,
          },
        ]
      : [];
  },
};
```

Hint what entity updates cannot fix: lists that gained or lost members, counts, search results. Updated entities themselves need no hint; clients write them into the cache.

## Limits and Completeness

The builder never drops an affected entity silently. Past a limit (`maxUpdatedEntities`, default 500; `maxDeletedEntities`, 100; `maxResponseSizeMb`, 5), it moves whole types into `typeInvalidations`, largest first, and sets `metadata.truncated`. The tracker's `maxEntities` limit (default 1000) is covered the same way.

## Errors

`buildErrorResponse(errors)` returns `success: false` and an empty cascade. Error helpers (`validationError`, `notFoundError`, `unauthorizedError`, `forbiddenError`, `conflictError`, `timeoutError`, `rateLimitedError`, `serviceUnavailableError`) build errors with standard codes, and `withDomainCode` adds an application-specific code:

```typescript
import { conflictError, withDomainCode } from "@graphql-cascade/server";

return builder.buildErrorResponse([
  withDomainCode(conflictError("Balance too low", "amount"), "INSUFFICIENT_FUNDS"),
]);
```

## Next Steps

- **[Node.js](/server/node)**: the tracker in depth, Express, security filters, observability
- **[Schema Conventions](/server/schema-conventions)**: payload types and naming
- **[API Reference](/api/server-node)**: every class and option
