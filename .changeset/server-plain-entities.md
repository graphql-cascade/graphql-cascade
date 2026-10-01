---
"@graphql-cascade/server": minor
---

Related entities that are plain objects are tracked and referenced, no entity is dropped, and streaming applies the tracker's filters.

- Plain objects with a type name and an `id`, as resolvers and ORMs return them, are entities: relationship tracking follows them and serialization writes them as `{ __typename, id }` references. They were deep-copied instead, so a cycle overflowed the stack and the entity was dropped from the cascade.
- An entity that cannot be serialized is covered by a type invalidation (`metadata.truncated` is set) instead of being dropped; `metadata.serializationErrors` counts it once per build.
- **Security:** `StreamingCascadeBuilder` serialized tracked entities itself, bypassing `entityFilter`, `fieldFilter` and `transformEntity`, and dropped `__typename`. It now goes through the tracker's new `prepareUpdated()`, like the other builders, and refuses an async `entityFilter`.
- An `entityFilter` that throws leaves the entity out, in every build path.
