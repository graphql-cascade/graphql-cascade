# Core Concepts

This page explains what a cascade contains, how the server builds it and how clients apply it. The [specification](/specification/) is the normative reference.

## The Cascade

A cascade is the `cascade` field of a mutation payload, of type `CascadeUpdates`:

```graphql
type CascadeUpdates {
  updated: [UpdatedEntity!]!
  deleted: [DeletedEntity!]!
  invalidations: [QueryInvalidation!]!
  typeInvalidations: [TypeInvalidation!]!
  metadata: CascadeMetadata!
}
```

### Updated Entities

Every entity the mutation created or updated, with its full current data:

```graphql
type UpdatedEntity {
  typename: String!
  id: ID!
  operation: CascadeOperation!
  entity: Node!
  updatedFields: [String!]
}
```

- `operation` is `CREATED` or `UPDATED`.
- `entity` is the entity itself. It is typed `Node`, so selections name each type's fields through fragments: `entity { ...CascadeEntity }`.
- `updatedFields` lists the fields an update changed, when the server knows them.

### Deleted Entities

```graphql
type DeletedEntity {
  typename: String!
  id: ID!
  deletedAt: DateTime!
}
```

### Invalidation Hints

`invalidations` names cached queries that may be stale in ways entity updates cannot fix, typically lists that gained or lost an item:

```json
{ "queryName": "listTodos", "strategy": "INVALIDATE", "scope": "PREFIX" }
```

- **Strategy**: `INVALIDATE` marks the queries stale, so they refetch on their next read; `REFETCH` refetches them now; `REMOVE` drops them from the cache.
- **Scope**: `EXACT` matches the query name (and `arguments`, if given); `PREFIX` matches names starting with `queryName`; `PATTERN` matches the `queryPattern` glob; `ALL` matches every query.

### Type Invalidations

`typeInvalidations` lists types whose affected entities are not all listed, usually because the cascade exceeded a size limit. Clients treat every cached entity of the type, and every query that may contain one, as stale. `metadata.truncated` is `true` when this happened.

## Building a Cascade

On the server, a `CascadeTracker` records what a mutation changes, and a `CascadeBuilder` turns that into the payload:

```typescript
import { CascadeBuilder, CascadeTracker } from "@graphql-cascade/server";

const tracker = new CascadeTracker({ maxDepth: 2 });
tracker.startTransaction();

tracker.trackCreate(order);
tracker.trackUpdate(customer, { updatedFields: ["orderCount"] });
tracker.trackDelete("Cart", cart.id);

return new CascadeBuilder(tracker, invalidator).buildResponse(order);
```

- **Relationships.** When relationship tracking is on, tracking an entity also walks its related entities up to `maxDepth`, so a mutation's side effects on related data are included. Each entity appears once, and cycles are handled.
- **Invalidation hints** come from an optional `Invalidator`, which receives the tracked entities and returns hints.
- **Completeness.** The builder enforces size limits (by default 500 updated entities, 100 deleted, 5 MB). Past a limit, it moves whole types from `updated`/`deleted` into `typeInvalidations`, largest first, rather than dropping entities. Nothing affected is ever silently left out.
- **Failures.** `buildErrorResponse(errors)` returns `success: false` and an empty cascade: a failed mutation committed nothing.

Trackers can also be fed from the database: an incremental view maintenance engine knows exactly which rows a mutation rewrote. See the specification's appendix on database-derived tracking.

## Applying a Cascade

A Cascade client library applies each response, in this order:

1. **Updated entities** are written into the cache. Every query showing them is current, without a network request.
2. **Deleted entities** are evicted.
3. **Invalidation hints** are applied to the queries they name.
4. **Type invalidations** mark every entity and query that may contain the type as stale.

Clients do not refetch a query just because it contains an updated entity: the cascade already carries that entity's data.

## Where the Cascade Travels

- **In the payload** (normative): each mutation field's payload carries its own cascade, with only that field's changes. With several mutation fields, clients apply them in field order.
- **In `extensions.cascade`** (optional): one cascade for the whole operation, for schemas whose payload types cannot carry a `cascade` field. The Apollo Server plugin (`createCascadePlugin`) delivers cascades this way.

A mutation can also return a **result union**, `CreateTodoPayload | CascadeFailure`: the success member implements `CascadePayload` (`cascade`, `warnings`), and `CascadeFailure` carries `errors` and no cascade. The client libraries accept both forms.

## Entity Identity

Entities implement `Node` with an `id` that should be unique across all types, following Relay's Global Object Identification: UUIDs, or encoded IDs such as `base64("User:123")`. Clients key entities by type name and `id`, as Apollo and urql do; Relay keys them by `id` alone, which is why global uniqueness matters.

## Errors

Payloads report errors as `CascadeError`: a `message`, a standard `code` (`VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, …) that drives generic handling, and an optional application-specific `domainCode` such as `INSUFFICIENT_FUNDS`. Clients treat a `code` they don't recognize as `INTERNAL_ERROR`.

## Optimistic Updates

Clients can apply a predicted cascade before the server answers. `useCascadeMutation` in `@graphql-cascade/apollo` applies it in an Apollo optimistic layer, which it removes when the mutation settles: the real cascade replaces it on success, and a failure restores the cache exactly.

## Next Steps

- **[Server Setup](/server/)**: tracking in Apollo Server, Express and NestJS
- **[Client Integration](/clients/)**: setting up each client library
- **[Specification](/specification/)**: the normative reference
