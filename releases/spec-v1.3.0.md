# GraphQL Cascade Specification v1.3.0 Release Notes

**Release Date**: 2026-09-30
**Type**: Minor version (backward compatible during a deprecation period)

## Overview

Version 1.3 makes the core schema valid GraphQL. The entity type name on cascade entries moves from `__typename` to `typename`, and the reference schema becomes the normative, CI-checked source of every type definition.

## What's New

### `typename` on UpdatedEntity and DeletedEntity

GraphQL reserves names beginning with `__`. The `__typename` field that earlier versions declared on `UpdatedEntity` and `DeletedEntity` could not exist in a real schema, and selecting `updated { __typename }` returned `"UpdatedEntity"` rather than the entity's type.

- **`typename: String!`** replaces it on both types, matching `TypeInvalidation.typename`.
- **Deprecation**: `__typename` on these entries is deprecated and will be removed in 2.0.0. Until then, servers that serialize cascades as JSON outside GraphQL execution SHOULD send both, and clients SHOULD fall back to `__typename` when `typename` is absent.

See [Deprecated: `__typename` on UpdatedEntity and DeletedEntity](../specification/04_mutation_responses.md#deprecated-__typename-on-updatedentity-and-deletedentity).

### Normative Reference Schema

- [`reference/cascade_base.graphql`](../reference/cascade_base.graphql) now parses and builds as a GraphQL schema. Naming conventions for queries and mutations moved into comments, and `CascadeErrorCode` lists all ten codes.
- It is the normative definition of the core types. Chapters show excerpts, and `node scripts/check-spec.mjs` checks that every `graphql` block parses, that no field uses a reserved `__` name, and that every excerpt of a core type matches the reference.
- Chapters 02, 03 and 07 link to the definitions in chapter 04 instead of repeating them.

## Backward Compatibility

- **Clients**: a 1.3 client falls back to `__typename`, so it works with earlier servers. A 1.2 client keeps working with 1.3 servers that still send `__typename`.
- **Servers**: add `typename`; keep `__typename` in JSON cascades until 2.0.0.

## Reference Implementation

Package support for `typename` follows in the reference packages; see the repository CHANGELOG.
