---
"@graphql-cascade/relay": minor
---

Query invalidation hints mark Relay queries stale.

- Hints naming a query set `__invalidated_<name>` / `__refetch_<name>` fields on the root record that nothing read, so lists the server reported stale stayed stale. Relay cannot mark a single query stale, so any hint now invalidates the root record, and every query refetches on its next read.
- Removed configuration and types that nothing implemented: `RelayCascadeEnvironmentConfig`'s `createUpdater`, `optimisticGenerator`, `connectionHandlers` and `retryOptions`, and the `RelayCascadeClient`, `CascadeMutationConfig`, `GeneratedMutationConfigs`, `OptimisticResponseGenerator`, `ConnectionOperation` and `ConnectionUpdate` types.
