# GraphQL Cascade Specification v1.4.0 Release Notes

**Release Date**: 2026-09-30
**Type**: Minor version (backward compatible)

## Overview

Version 1.4 ties the specification and the conformance suite together, and defines how cascades are delivered when an operation has several mutation fields or cannot change its payload types.

## What's New

### Traceable Requirements

Normative statements tested by the conformance suite carry a tag such as **[REQ-012]** where the specification states them. Every case in `conformance-tests/` cites one, and `node scripts/check-spec.mjs` fails if a case cites an undefined requirement, a requirement is defined twice, or a tagged requirement has no case. Cases that described behavior the specification never defined were rewritten to match it.

### Cascade Delivery

- **Payload field (normative)**: each mutation field's payload carries its own cascade with only that field's changes. GraphQL runs mutation fields serially, so clients apply the cascades in field order. A failed field's cascade is empty and does not affect the others. See [Cascade Delivery](../specification/04_mutation_responses.md#cascade-delivery).
- **`extensions.cascade` (optional)**: for schemas whose payload types cannot carry a cascade, one cascade covers the whole operation. It combines all mutation fields: each entity appears once with its final state, and failed fields contribute nothing. If both forms are present, clients use the payload cascades.

### Update In Place, Don't Refetch

Clients SHOULD NOT invalidate or refetch a query only because it contains an updated entity. The cascade already carries the entity's full data, so the cache update makes those queries current without a network request. Invalidation is reserved for `invalidations` and `typeInvalidations`.

### Clarified Server Requirements

Tracking requirements now state what created, updated, deleted and related entities look like in the cascade, that traversal terminates on cycles with each entity listed once, and that a failed mutation returns a present but empty cascade.

## Backward Compatibility

Every change is compatible: the delivery rules match how servers already behave, the extensions transport is optional, and the no-refetch rule is a recommendation.

## Reference Implementation

`@graphql-cascade/server`'s Apollo plugin already writes one operation-level cascade to `extensions.cascade`, from the request's tracker, and the urql exchange reads it.
