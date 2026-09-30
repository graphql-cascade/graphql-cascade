---
"@graphql-cascade/relay": minor
---

Cascades now reach the records Relay queries read.

- Records are keyed by Relay's data ID (the object's `id`), or by the environment's `getDataID`, which `createCascadeRelayEnvironment` and `createCascadeUpdater` accept. They were written to `"Type:id"` records that no query read.
- `createCascadeRelayEnvironment` called `store.commitUpdates`, which Relay stores do not have, so every mutation carrying a cascade failed. It now applies cascades through `environment.commitUpdate`, applies every mutation field's cascade in order, logs a cascade it cannot apply instead of failing the mutation, and keeps subscriptions working (the wrapper dropped them).
- Deleted entities are removed from the store instead of being flagged `__isDeleted`.
- Nested entities in a cascade are linked to their records; storing them as values made Relay throw.
- The package uses `@types/relay-runtime` instead of its own simplified declarations, which hid these errors. Tests run against a real Relay store.
