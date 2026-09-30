---
"@graphql-cascade/react-query": minor
"@graphql-cascade/client": minor
---

Invalidation hints select React Query queries as the specification's scopes define.

- `EXACT` hints passed an array where TanStack Query v5 expects filters, so they matched every query. `PREFIX` matched only queries named exactly `queryName`, and `PATTERN` supported only a trailing `*`. Queries keyed `[queryName, variables]` are now selected by name prefix (`PREFIX`), glob (`PATTERN`), or name and arguments (`EXACT`).
- The peer dependency accepts `@tanstack/react-query` 4 and 5.
- `@graphql-cascade/client` exports `invalidationMatches(invalidation, queryName, args?)`, the scope rules for caches that implement `CascadeCache`.
