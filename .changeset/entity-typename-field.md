---
"@graphql-cascade/server": minor
"@graphql-cascade/client": minor
"@graphql-cascade/apollo": minor
"@graphql-cascade/urql": minor
"@graphql-cascade/relay": minor
"@graphql-cascade/conformance": minor
---

Specification 1.3.0: cascade entries name their entity's type in `typename`. GraphQL reserves `__` names, so `UpdatedEntity.__typename` could not be declared in a schema, and selecting it returned the wrapper type.

- server: `updated` and `deleted` entries carry `typename`, and keep the deprecated `__typename` with the same value for older clients.
- client: `UpdatedEntity` and `DeletedEntity` have `typename`; `__typename` is optional and deprecated. New `cascadeEntryTypename(entry)` reads `typename` and falls back to `__typename`, so responses from pre-1.3 servers keep working. **Breaking for code that builds entries**: set `typename`.
- apollo, urql, relay: read entries through `cascadeEntryTypename`. Select `typename` instead of `__typename` on `updated` and `deleted`.
- conformance: entries must have `typename` (a lone `__typename` is reported as deprecated), and schemas must declare `typename: String!` on `UpdatedEntity` and `DeletedEntity`. Fixtures use the 1.3 shape.
