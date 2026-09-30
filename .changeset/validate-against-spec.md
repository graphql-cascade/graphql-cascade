---
"@graphql-cascade/cli": minor
---

`cascade validate` checks a schema against the specification.

- Errors: no `CascadeResponse`, `CascadePayload` or `CascadeFailure` type; Cascade types or directives that differ from the reference schema, which now ships with the CLI; types with an `id` that don't implement `Node`.
- Warnings: mutations whose results carry no cascade.
- It accepts several SDL files, merged into one schema, so the reference types can live in their own file.
- Removed the off-spec checks: a missing `id` on any object type (payload and value types have none), and self-references with advice to use a `@cascade(depth)` argument that does not exist.
- JSON introspection results load again: the wrong object was passed to `buildClientSchema`.
