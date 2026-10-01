# Conformance

What a conforming implementation does is defined by the specification; this page explains how those requirements are organized and checked. The normative text is the [Conformance](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/01_conformance.md) chapter.

## Levels

The specification groups features into three levels, each including the one before:

| Level | Adds |
|-------|------|
| **Cascade Basic** | The core types, cascades in mutation responses, tracking of the mutation's own entities, invalidation hints |
| **Cascade Standard** | Depth control, relationship traversal, structured errors, transaction metadata |
| **Cascade Complete** | Optimistic updates, subscriptions, conflict resolution |

## Requirements and Test Cases

Normative statements carry requirement tags, such as **[REQ-103]** for `EXACT` hint matching. The [`conformance-tests/`](https://github.com/graphql-cascade/graphql-cascade/tree/main/conformance-tests) directory holds machine-readable test cases, one JSON file each, for servers, clients and transport:

```json
{
  "id": "TC-C-003",
  "requirement": "REQ-103",
  "level": "basic",
  "category": "client",
  "input": {
    "state": { "queries": [{ "name": "user", "arguments": { "id": "u1" }, "result": { "...": "" } }] },
    "result": { "success": true, "cascade": { "invalidations": [{ "queryName": "user", "arguments": { "id": "u1" }, "strategy": "INVALIDATE", "scope": "EXACT" }] } }
  },
  "expected": {
    "queries": [{ "name": "user", "arguments": { "id": "u1" }, "state": "invalidated" }]
  }
}
```

Server cases run against a small conformance domain, users and posts, that a server under test implements once; client cases seed a cache and apply a mutation result to it. The [cases README](https://github.com/graphql-cascade/graphql-cascade/blob/main/conformance-tests/README.md) defines both formats.

The repository's checks keep the two in step: every case follows [`test-case-schema.json`](https://github.com/graphql-cascade/graphql-cascade/blob/main/conformance-tests/test-case-schema.json), cites a requirement the specification defines, and every requirement is tested by at least one case. `spec-version.json` records the specification version the cases target.

## Checking an Implementation

[`@graphql-cascade/conformance`](https://github.com/graphql-cascade/graphql-cascade/tree/main/packages/conformance) runs the cases against an implementation and reports the level it achieves:

- **Servers** implement the conformance domain once, then give the runner a target: `setup(state, limits)` loads a case's data, and `execute(operation, variables)` runs its operation.
- **Clients** provide a small harness around their cache: seed it, apply a mutation result, read an entity, read a query.

```bash
npx cascade-conformance --config conformance.config.mjs --level standard
```

Every package in this repository runs the cases in CI: `@graphql-cascade/server`, with payload cascades and with the Apollo Server plugin's extensions cascade, and the Apollo, Relay, TanStack Query and urql clients, each through a `conformance.test.ts` that doubles as an example.

## Next Steps

- **[Specification](/specification/)**: the chapters
- **[Server](/server/)** and **[Clients](/clients/)**: the implementations in this repository
