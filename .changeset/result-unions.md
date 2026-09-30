---
"@graphql-cascade/client": minor
"@graphql-cascade/apollo": minor
"@graphql-cascade/urql": minor
"@graphql-cascade/conformance": minor
---

Specification 1.9.0: result unions.

- client: `toCascadeResponse(result)` normalizes a `CascadeResponse`, a `CascadePayload` (warnings as partial-success errors) or a `CascadeFailure` (an empty cascade); `CascadeClient.mutate` uses it and returns non-cascade results unchanged.
- apollo: `ApolloCascadeClient.mutate` and `useCascadeMutation` accept both forms; a response with no mutation field rejects with a clear error.
- urql: the client applies the cascade in each mutation field's payload, in order, and falls back to `extensions.cascade` only when no payload carries one; before, it ignored payload cascades.
- conformance: validates `CascadePayload` and `CascadeFailure` results.
