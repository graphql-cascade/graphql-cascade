# GraphQL Cascade Specification v1.2.0 Release Notes

**Release Date**: 2026-09-30
**Type**: Minor version (backward compatible for clients)

## Overview

Version 1.2 makes cascades complete under size limits, and separates application-specific error conditions from the standard error categories.

## What's New

### Complete Cascades Under Limits

Earlier versions let servers cut `updated` and `deleted` at a fixed size, which silently left stale data in client caches. In 1.2:

- **Completeness**: every affected entity is either listed or covered by a type invalidation. Servers MUST NOT omit entities silently.
- **`cascade.typeInvalidations`**: `[{ typename, affectedCount }]`. Clients treat every cached entity of the type, and every cached query that may contain one, as stale.
- **`metadata.truncated`**: `true` exactly when the server moved entities or hints into type invalidations.
- **Truncation algorithm**: move whole types into type invalidations, largest first, until the response fits.
- **Configurable limits**: 500 updated, 100 deleted and 5 MB are now RECOMMENDED defaults rather than fixed values. Pagination of cascades is no longer suggested.

See [Cascade Size Limits and Truncation](../specification/04_mutation_responses.md#cascade-size-limits-and-truncation) and [Type Invalidation](../specification/05_invalidation.md#type-invalidation).

### Domain-Specific Error Codes

- **`CascadeError.domainCode`**: an optional application-defined code such as `INSUFFICIENT_FUNDS` or `BILLING.INSUFFICIENT_FUNDS`, which refines the standard `code`.
- **Forward compatibility**: clients treat unrecognized `code` values as `INTERNAL_ERROR`, so later minor versions can add codes safely.

See [Domain-Specific Error Codes](../specification/04_mutation_responses.md#domain-specific-error-codes).

### Database-Derived Tracking

A new non-normative appendix describes building cascades from the rows an incremental view maintenance engine rewrites, which removes the depth limit and catches changes made outside application code. See [Appendix G](../specification/appendices/G_database_derived_tracking.md).

### Clarifications

- Asynchronous mutations: the cascade describes only committed changes, and a persisted job entity appears in `cascade.updated`.

## Backward Compatibility

- **Clients**: every change is additive. A 1.1 client ignores `typeInvalidations`, `truncated` and `domainCode` and behaves as before.
- **Servers**: servers adopting 1.2 add `typeInvalidations` and `metadata.truncated`, and replace list-cutting truncation with type invalidations.

## Reference Implementation

- `@graphql-cascade/server`: truncation produces type invalidations; `withDomainCode()` helper.
- `@graphql-cascade/client`: `applyTypeInvalidations()`, applied automatically by `CascadeClient`; optional `CascadeCache.invalidateType()`.
- `@graphql-cascade/apollo`: precise `invalidateType()` for `InMemoryCache`.
- `@graphql-cascade/urql`, `@graphql-cascade/relay`, `@graphql-cascade/react-query`: apply type invalidations.
- `@graphql-cascade/conformance`: validates `domainCode`, `typeInvalidations` and `truncated`.

## Resources

- [GitHub Issue #4: Extensibility of CascadeErrorCode](https://github.com/graphql-cascade/graphql-cascade/issues/4)
- [GitHub Issue #6: Database-derived tracking and type-level invalidation](https://github.com/graphql-cascade/graphql-cascade/issues/6)
- [Conformance Tests](../conformance-tests/)
