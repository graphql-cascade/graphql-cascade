# GraphQL Cascade Specification v1.6.0 Release Notes

**Release Date**: 2026-09-30
**Type**: Minor version (backward compatible)

## Overview

Version 1.6 makes the `CascadeResponse` interface implementable by payloads with typed results.

## What's New

### `data` Is a Convention, Not an Interface Field

`CascadeResponse` declared `data: MutationPayload`, a placeholder scalar. GraphQL only lets an implementing field narrow an interface field's type, and nothing narrows a scalar, so a payload such as `type UpdateUserCascade implements CascadeResponse { data: User ... }` was invalid GraphQL.

- The interface now declares `success`, `errors` and `cascade`: the fields clients process generically.
- Payload types SHOULD expose the mutation's result as `data`, typed as that result (`data: User`, `data: [Order!]!`, `data: Boolean`).
- The `MutationPayload` scalar is gone from the reference schema.

See [The `data` Field](../specification/04_mutation_responses.md#the-data-field).

### Validated Example Schemas

The example schemas no longer copy the core types. `check:spec` validates each one merged with the reference schema, the way an implementation's schema is built, and fails if an example redefines a reference type differently. This check found the `data` problem.

## Backward Compatibility

Payload types keep their `data` fields, so queries are unchanged. Schemas remove `data` from their copy of the interface and drop the `MutationPayload` scalar.
