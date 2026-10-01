# Node.js/TypeScript Server

`@graphql-cascade/server` works with any Node.js GraphQL server. This page covers the tracker in depth; [Server Implementation](/server/) gives the overview.

## Installation

```bash
npm install @graphql-cascade/server graphql
```

## Tracking a Mutation

Create a tracker per mutation, start a transaction, record changes, and build the response:

```typescript
import { CascadeBuilder, CascadeTracker } from "@graphql-cascade/server";

async function createPost(_: unknown, { input }, { db }) {
  const tracker = new CascadeTracker();
  tracker.startTransaction();

  const post = await db.posts.create(input);
  tracker.trackCreate({ __typename: "Post", ...post });

  const author = await db.users.incrementPostCount(input.authorId);
  tracker.trackUpdate(
    { __typename: "User", ...author },
    { updatedFields: ["postCount"] },
  );

  return new CascadeBuilder(tracker).buildResponse(post);
}
```

`buildResponse` ends the transaction and returns `{ success, errors, data, cascade }`. On failure, `buildErrorResponse(errors)` returns an empty cascade: a failed mutation committed nothing.

### Recorded Changes

| Call | Cascade entry |
|------|---------------|
| `trackCreate(entity)` | `updated`, operation `CREATED` |
| `trackUpdate(entity, { updatedFields? })` | `updated`, operation `UPDATED`, with `updatedFields` when given |
| `trackDelete(typename, id)` | `deleted`, with `deletedAt`; removes the entity from `updated` |

Tracking the same entity twice keeps one entry; the `updatedFields` of repeated updates are merged.

### Entity Types and Data

The tracker reads an entity's type from `__typename`, then `_typename`, then the class name, and its ID from `id`. Entity data is the object's own fields, minus fields starting with `_` (except `__typename`); an entity with a `toDict()` method is serialized through it. Nested entities, any object with a type name and an `id`, plain objects included, are serialized as `{ __typename, id }` references; they get entries of their own. An entity that cannot be serialized is never dropped: its type goes into `typeInvalidations`, and `onSerializationError` is called.

## Relationships

With `enableRelationshipTracking` (default `true`), tracking an entity also tracks the entities it references, found in its fields or returned by a `getRelatedEntities()` method, down to `maxDepth` levels. Each entity is tracked once, so cycles end naturally.

```typescript
const tracker = new CascadeTracker({
  maxDepth: 2,               // levels of related entities (default 3)
  maxRelatedPerEntity: 50,   // related entities followed per entity (default 100)
  excludeTypes: ["AuditLog"],
});
```

Past `maxEntities` (default 1000), further entities are counted by type instead of listed, and the response covers those types with `typeInvalidations`.

## Security

Cascades carry entity data, so apply the same access rules as your queries:

```typescript
const tracker = new CascadeTracker({
  // Leave fields out of entity data
  fieldFilter: (typename, field) => !(typename === "User" && field === "passwordHash"),

  // Leave out entities the viewer may not see (may be async)
  entityFilter: async (entity, context) => canRead(context.viewer, entity),

  // Reject entities that must never be tracked
  validateEntity: (entity) => {
    if (!entity.id) throw new Error("Entity without id");
  },

  // Mask or reshape entity data
  transformEntity: (entity) => ({ ...entity, email: mask(entity.email) }),
});

tracker.setContext({ viewer });
```

`entityFilter` receives the context passed to `setContext`. When it is async, as authorization checks usually are, build the response with `buildResponseAsync`, which awaits it:

```typescript
return await new CascadeBuilder(tracker).buildResponseAsync(post);
```

`buildResponse` cannot await the filter, so it throws `AsyncEntityFilterError` instead of sending entities the filter never checked.

## Invalidation Hints

Pass an `Invalidator` to the builder; see [Server Implementation](/server/#invalidation-hints). The builder drops hints without a valid `strategy` and `scope` and reports them through `onInvalidationError`.

## Express

`cascadeMiddleware` puts a tracker and a builder on each request:

```typescript
import express from "express";
import { cascadeMiddleware } from "@graphql-cascade/server/express";

const app = express();
app.use(cascadeMiddleware({ maxDepth: 2, invalidator }));

// In a resolver with access to the request
req.cascadeTracker.startTransaction();
req.cascadeTracker.trackUpdate(user);
return req.cascadeBuilder.buildResponse(user);
```

`getCascadeData(req)` and `buildCascadeResponse(req, data)` are shortcuts for the same objects.

## Large Cascades

`StreamingCascadeBuilder` builds the response from the tracker's change stream, applying size limits as it goes instead of first building full lists:

```typescript
import { StreamingCascadeBuilder } from "@graphql-cascade/server";

return new StreamingCascadeBuilder(tracker, invalidator).buildStreamingResponse(post);
```

## Undoing Changes

`checkpoint()` records the tracked changes, and `restore(checkpoint)` undoes everything tracked since, for example when one step of a mutation fails and its database changes are rolled back:

```typescript
const checkpoint = tracker.checkpoint();
try {
  await applyDiscount(order, tracker);
} catch {
  tracker.restore(checkpoint);
}
```

The Apollo Server plugin uses this to drop the changes of mutation fields that fail.

## Observability

```typescript
import {
  CascadeTracker,
  DefaultMetricsCollector,
  createHealthCheck,
  exportPrometheusMetrics,
} from "@graphql-cascade/server";

const metrics = new DefaultMetricsCollector();
const tracker = new CascadeTracker({ metrics, debug: true });

const health = createHealthCheck(metrics);
health(); // { status: "healthy" | "degraded" | "unhealthy", ... }

exportPrometheusMetrics(metrics); // Prometheus text format
```

`OpenTelemetryMetricsCollector` sends the same metrics to an OpenTelemetry meter, and `configureLogger` routes log output.

## Testing

Build a response and assert on its cascade:

```typescript
const tracker = new CascadeTracker();
tracker.startTransaction();
tracker.trackUpdate({ __typename: "User", id: "1", name: "Ada" });

const { cascade } = new CascadeBuilder(tracker).buildResponse(null);

expect(cascade.updated).toEqual([
  expect.objectContaining({ typename: "User", id: "1", operation: "UPDATED" }),
]);
```

## Next Steps

- **[Apollo Server](/server/apollo-server)**: the `extensions.cascade` plugin
- **[NestJS](/server/nestjs)**: the module and service
- **[API Reference](/api/server-node)**: every class and option
