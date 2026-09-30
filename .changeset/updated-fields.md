---
"@graphql-cascade/server": minor
"@graphql-cascade/client": minor
"@graphql-cascade/conformance": minor
---

Specification 1.8.0: `updatedFields` on cascade entries.

- server: `trackUpdate(entity, { updatedFields })` records the fields an update changed; repeated updates of one entity merge them, and entries carry `updatedFields` when known. New `CascadeTracker.getUpdatedChanges()` streams the tracked changes with their fields.
- client: `UpdatedEntity.updatedFields?: string[] | null`.
- conformance: rejects an `updatedFields` that is not null or a list of field names.
