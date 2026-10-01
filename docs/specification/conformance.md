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

No tool yet runs these cases against an implementation; the runner in `@graphql-cascade/conformance` does not test the implementation it is given ([#65](https://github.com/graphql-cascade/graphql-cascade/issues/65)). Until it does, check an implementation against the cases in your own test suite: set up each case's `input`, run it, and compare the result with `expected`.

## Next Steps

- **[Specification](/specification/)**: the chapters
- **[Server](/server/)** and **[Clients](/clients/)**: the implementations in this repository
