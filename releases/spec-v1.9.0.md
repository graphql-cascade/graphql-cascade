# GraphQL Cascade Specification v1.9.0 Release Notes

**Release Date**: 2026-09-30
**Type**: Minor version (backward compatible for servers)

## Overview

Version 1.9 lets mutations report failure as a union member, the GraphQL "errors as data" pattern, as proposed in [RFC 0001](../design/rfc-0001-cascade-2.md).

## What's New

### Result Unions

```graphql
union UpdateUserResult = UpdateUserPayload | CascadeFailure

type UpdateUserPayload implements CascadePayload {
  data: User!
  cascade: CascadeUpdates!
  warnings: [CascadeError!]!
}
```

- **`CascadePayload`**: the success member's interface. Its cascade works exactly like a `CascadeResponse`'s; `warnings` carries the errors of a partial success.
- **`CascadeFailure`**: the mutation committed no change, so it carries `errors` and no cascade.
- Clients discriminate with `__typename`, so they never read a result or cascade that does not exist.

Servers MAY keep returning `CascadeResponse`. Clients MUST accept both forms (REQ-105, cases TC-C-005 and TC-C-006). See [Result Unions](../specification/04_mutation_responses.md#result-unions).

## Backward Compatibility

Existing servers need no change. Clients add handling for the union; the reference clients handle it from this release.
