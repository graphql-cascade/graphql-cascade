# GraphQL Cascade Specification v1.8.0 Release Notes

**Release Date**: 2026-09-30
**Type**: Minor version (backward compatible)

## Overview

Version 1.8 aligns entity identity with Relay and lets servers say which fields an update changed. Both are the first steps of [RFC 0001](../design/rfc-0001-cascade-2.md).

## What's New

### Relay-Compatible Identity

- Entity IDs SHOULD be unique across all types (UUIDs, or encoded `Type:key` IDs). This becomes a requirement in 2.0.0; IDs reused across types are deprecated.
- Servers SHOULD provide `Query.node(id: ID!): Node`, and when they do, `node(id: x.id)` MUST return `x`.
- A schema that follows Relay's Global Object Identification already satisfies Cascade's identity rules, and Relay's store, keyed by `id`, matches the entities cascades carry.

Clients keep keying entities by type name and `id`, which works with any ID format. See [Identification Strategy](../specification/03_entity_identification.md#identification-strategy).

### `updatedFields`

`UpdatedEntity.updatedFields` lists the fields an update changed; it is null when the server does not know, and for created entities. The invalidation algorithm applies per-field rules (`@cascadeInvalidates`) from it instead of assuming every field changed.

## Backward Compatibility

Backward compatible: global uniqueness is a recommendation until 2.0.0, and `updatedFields` is optional.
