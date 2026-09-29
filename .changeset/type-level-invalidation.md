---
"@graphql-cascade/server": minor
"@graphql-cascade/client": minor
"@graphql-cascade/apollo": minor
"@graphql-cascade/urql": minor
"@graphql-cascade/relay": minor
"@graphql-cascade/react-query": minor
"@graphql-cascade/conformance": minor
---

Type-level invalidation (spec 1.2): cascades no longer lose entities when they exceed size limits.

- server: truncation moves whole types into `cascade.typeInvalidations`, largest first, and sets `metadata.truncated`. Entities dropped by the tracker's `maxEntities` limit are covered too. **Breaking:** `metadata.truncatedUpdated`, `truncatedDeleted`, `truncatedInvalidations` and `truncatedSize` are replaced by `metadata.truncated`, and the tracker returns an `overflow` map.
- client: `applyTypeInvalidations()`, applied by `CascadeClient`, plus optional `CascadeCache.invalidateType()`. Caches without it invalidate every query.
- apollo: `ApolloCascadeCache.invalidateType()` evicts entities of the type and every field that references them or holds an empty list.
- urql, relay: apply type invalidations (Relay invalidates the store).
- conformance: validates `typeInvalidations` and `truncated`.
