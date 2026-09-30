# GraphQL Cascade Specification v1.9.1 Release Notes

**Release Date**: 2026-09-30
**Type**: Patch version (consistency fix)

## Fixes

Version 1.9.0 allowed mutations to return a result union (`<Mutation>Payload | CascadeFailure`), but chapters 01, 04 and 07 and the reference schema still said every mutation MUST return a `CascadeResponse`. They now allow either form, matching [Result Unions](../specification/04_mutation_responses.md#result-unions).

## Backward Compatibility

No normative change beyond 1.9.0.
