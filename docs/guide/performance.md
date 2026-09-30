# Performance

A cascade costs the server the work of collecting affected entities, the network the size of the payload, and the client the work of applying it. Each has a lever. The specification's [Performance Requirements](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/12_performance_requirements.md) chapter sets the limits implementations respect.

## Keep Entity Selections Small

Each updated entity carries the fields the mutation selects under `entity`. Select what your queries read, and no more: [`@graphql-cascade/codegen`](https://github.com/graphql-cascade/graphql-cascade/tree/main/packages/codegen#cascadeentityfragment) generates exactly that selection as a `CascadeEntity` fragment from your queries.

## Bound What the Server Collects

Tracker options limit relationship traversal:

```typescript
import { CascadeTracker } from "@graphql-cascade/server";

const tracker = new CascadeTracker({
  maxDepth: 2,                      // levels of related entities (default 3)
  maxRelatedPerEntity: 50,          // related entities per entity (default 100)
  maxEntities: 500,                 // entities per transaction (default 1000)
  excludeTypes: ["AuditLog"],       // types never collected
});
```

For bulk mutations, turn relationship traversal off with `enableRelationshipTracking: false`, track the changed entities, and hint the affected lists instead.

## Let Limits Truncate, Not Drop

Builder limits bound the payload: `maxUpdatedEntities` (default 500), `maxDeletedEntities` (100), `maxInvalidations` (50) and `maxResponseSizeMb` (5). Past a limit, the builder moves whole types into `typeInvalidations` and sets `metadata.truncated`, so clients invalidate those types rather than miss changes. Lower the limits where payload size matters more than precision. For very large cascades, `StreamingCascadeBuilder` builds the payload without holding every entity at once; see [Large Cascades](/server/node#large-cascades).

## Choose Hint Strategies

- `INVALIDATE` marks queries stale; they refetch when next read. Prefer it: queries nobody displays cost nothing.
- `REFETCH` refetches active queries immediately. Use it for data on screen that must update without interaction.
- Name queries precisely. An `EXACT` hint with `arguments` touches one query; `PREFIX`, `PATTERN` and `ALL` touch more. Type invalidations touch every query that may hold the type, and in Relay every query.

## Measure

`@graphql-cascade/server` collects metrics (cascade sizes, tracking and build durations, truncations) through a `MetricsCollector`, with Prometheus export and an OpenTelemetry collector; see [Observability](/server/node#observability). Watch `metadata.truncated` in responses: frequent truncation means limits are too low for your mutations, or relationship traversal reaches too far.

## Next Steps

- **[Node.js](/server/node)**: tracker and builder options
- **[Security](/guide/security)**: limits as a defense
