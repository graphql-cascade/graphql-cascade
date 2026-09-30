# Appendix G: Database-Derived Tracking

*This appendix is non-normative.*

[Entity Tracking Algorithm](../10_tracking_algorithm.md) describes tracking as application code: record each change, walk relationships up to `max_depth`, deduplicate. This appendix describes a second strategy for servers whose read model is materialized inside the database.

## The Idea

Many GraphQL servers resolve queries from a read model: denormalized tables or views shaped like the GraphQL types, one row per entity. When that read model is maintained incrementally by the database (incremental view maintenance, IVM), the maintenance engine already does the work a cascade tracker needs. For each transaction it computes which read-model rows must be rewritten, by following the actual dependency graph between base tables and views.

The cascade is therefore the set of read-model rows the engine rewrote:

| Relationship-walk tracker | Database-derived tracker |
|---------------------------|--------------------------|
| Guesses the affected set by walking relationships in application code | Reads the affected set the engine computed |
| Bounded by `max_depth`; entities beyond it are missed | No depth: completeness follows from the dependency graph |
| Misses entities changed by triggers, cascading foreign keys or other code paths | Catches every rewritten row, whatever caused the change |
| Serializes entities from ORM objects | Rewritten rows already have the GraphQL shape |

## Mapping Rows to the Cascade

Each read-model row maps to one GraphQL entity:

- The view identifies the GraphQL type, giving `typename`.
- The row's key gives `id`.
- The row's projection (often a JSON column) gives `entity`.
- Inserted and updated rows go to `updated` with operation `CREATED` or `UPDATED`; removed rows go to `deleted`.

`metadata.depth` has no natural meaning here. A server can report the number of propagation levels if the engine exposes it, or `0` otherwise; clients do not rely on it.

## Ordering

The affected set is final only after the engine has propagated every change of the transaction. Engines that defer propagation to commit time or batch it need an explicit flush. The server has to trigger that flush inside the mutation's transaction, before building the cascade. Otherwise the cascade misses rows that are rewritten later in the same transaction.

The flush and the cascade read happen in the same transaction as the mutation, so the cascade reflects exactly the committed state, as [Transaction Semantics](../02_cascade_model.md#transaction-semantics) requires.

## Truncation

A database-derived tracker knows the exact fan-out, per type, before it serializes a single entity. It can therefore decide on [truncation](../04_mutation_responses.md#cascade-size-limits-and-truncation) cheaply: count rewritten rows per view, choose the types to cover with `typeInvalidations`, and serialize only the rows it keeps.

## Authorization

Read-model rows are subject to the same visibility rules as query results. Servers apply row-level security, or the equivalent filter, when reading the affected rows, and apply it to type invalidations too.

## Example Implementation

[pg_tviews](https://github.com/fraiseql/pg_tviews) provides incremental views for PostgreSQL. [FraiseQL](https://github.com/fraiseql/fraiseql) uses it to build cascades from the rows pg_tviews rewrites, flushing pending propagation before it builds each mutation response.
