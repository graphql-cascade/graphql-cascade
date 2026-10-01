---
"@graphql-cascade/conformance": minor
"@graphql-cascade/urql": minor
"@graphql-cascade/relay": minor
---

The client conformance cases run against real clients, and every client package passes them.

- `@graphql-cascade/conformance`: `runClientCases(createHarness)` runs the specification's client cases against a client through a small harness (seed, apply, read an entity, read a query), and reports each case's requirement, level, status and differences. The package ships the cases, the conformance domain and the reference schema (`CASES`, `DOMAIN_SCHEMA`, `REFERENCE_SCHEMA`).
- `@graphql-cascade/urql`: `InMemoryCascadeCache` is normalized: stored query results refer to entities, so entity updates show in every query holding them (REQ-102), and writes merge fields into the cached entity instead of replacing it.
- `@graphql-cascade/relay`: invalidation hints unset exactly the root fields of the queries they name, instead of marking every query stale (REQ-103, REQ-030). New `commitCascade(environment, cascade)` applies a cascade as cascade environments do; `createCascadeUpdater` takes the root fields as `rootFields`.
