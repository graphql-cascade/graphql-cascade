---
"@graphql-cascade/server": minor
"@graphql-cascade/conformance": minor
---

Invalidation hints follow the specification's `QueryInvalidation` shape, so the reference clients can apply them.

- server: **Breaking.** `CascadeInvalidation` (`{ __typename, id?, field?, reason }`) is replaced by `QueryInvalidation` (`{ queryName?, queryHash?, arguments?, queryPattern?, strategy, scope }`), with exported `InvalidationStrategy` and `InvalidationScope` enums. `Invalidator.computeInvalidations` must return it. The builder drops hints without a valid `strategy` and `scope` and reports them through `onInvalidationError`.

  Migration: `{ __typename: "Query", field: "listTodos", reason }` becomes `{ queryName: "listTodos", strategy: InvalidationStrategy.INVALIDATE, scope: InvalidationScope.EXACT }`.
- conformance: invalidations must have a valid `strategy` and `scope`, plus `queryName` for PREFIX (or EXACT without `queryHash`) and `queryPattern` for PATTERN. `queryName` is no longer required for ALL.
