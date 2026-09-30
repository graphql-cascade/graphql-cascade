---
"@graphql-cascade/apollo": minor
"@graphql-cascade/urql": patch
---

Apollo and urql caches select queries by the specification's invalidation scopes, through `invalidationMatches`.

- Apollo: `EXACT` hints with `arguments` evict only the root field stored with those arguments, instead of every argument set.
- Apollo: removed `ApolloCascadeClient.trackQuery`, `untrackQuery`, `handleInvalidation`, `invalidateQueries`, `removeQueries` and `refetch`. `applyCascade` never used them, and they compiled `queryPattern` as a regular expression instead of a glob. Hints are applied by `applyCascade`.
- urql: `InMemoryCascadeCache` matches `EXACT` hints without `arguments` against every query of that name, compares arguments whatever their key order, matches `PATTERN` against query names rather than name-and-arguments keys, and accepts patterns of any length instead of throwing part-way through a cascade.
