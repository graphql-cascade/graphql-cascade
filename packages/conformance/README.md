# @graphql-cascade/conformance

Runs the GraphQL Cascade specification's conformance cases against a server or a client. Each case tests one requirement (`REQ-NNN`) and belongs to a conformance level; the report gives the level an implementation achieves.

```bash
npm install -D @graphql-cascade/conformance
```

The cases, their formats and the conformance domain are described in [`conformance-tests/`](https://github.com/graphql-cascade/graphql-cascade/tree/main/conformance-tests). The package ships them, with the domain and reference schemas (`CASES`, `DOMAIN_SCHEMA`, `REFERENCE_SCHEMA`).

## Testing a Server

Server cases run against a server implementing the **conformance domain**: users and posts, defined in `DOMAIN_SCHEMA`, merged with `REFERENCE_SCHEMA`, with the behavior the cases README describes. Implement it once with your server stack, then give the runner a target:

```typescript
import {
  runServerCases,
  type ServerTarget,
} from "@graphql-cascade/conformance";

const target: ServerTarget = {
  // Replace the server's data with the case's, and apply its cascade limits
  setup: async (state, limits) => {
    await db.reset(state.users ?? [], state.posts ?? []);
    cascadeLimits.set(limits ?? {});
  },
  // Execute an operation, returning the GraphQL response
  execute: (query, variables) => server.execute({ query, variables }),
  // Add "extensions" if the server sends cascades in extensions.cascade
  capabilities: [],
};

const results = await runServerCases(target);
```

For a server reached over HTTP, `httpTarget(endpoint, { setup, headers })` builds the target; `setup` puts the server into a case's state, for example through a test-only endpoint or the database.

Besides each case's expectations, every cascade is checked for the requirements that always hold: its fields (REQ-010), entities listed once (REQ-005), no entity both updated and deleted (REQ-003), and type invalidations whenever it is truncated (REQ-050).

## Testing a Client

Client cases seed a cache, apply one mutation result, and inspect the cache. Give the runner a function creating a fresh harness around your client for each case:

```typescript
import {
  runClientCases,
  type ClientHarness,
} from "@graphql-cascade/conformance";

const results = await runClientCases(
  (): ClientHarness => ({
    cache: "normalized", // or "document": cases for the other kind are skipped
    seed: ({ entities, queries }) => {
      // write the entities, and each query's result under its name and arguments
    },
    apply: (result) => {
      // apply a mutation field's result as the client does on a response
    },
    entity: (typename, id) => {
      // the cached entity's fields, or null
      return null;
    },
    query: (name, args) => {
      // "fresh" with its data, or "invalidated" if stale, refetched or removed
      return { state: "invalidated" };
    },
  }),
);
```

The client libraries in this repository run the cases this way in their test suites; their `conformance.test.ts` files are worked examples for Apollo Client, Relay, TanStack Query and urql.

## Reports

```typescript
import {
  formatReport,
  getExitCode,
  summarize,
} from "@graphql-cascade/conformance";

summarize(results).achieved; // "none" | "basic" | "standard" | "complete"
console.log(formatReport(results, { format: "console" })); // or "json", "markdown"
process.exitCode = getExitCode(results, "standard"); // 1 if a case up to that level fails
```

A level is achieved when every case of that level and the levels below passes; skipped cases don't count against it.

## CLI

```bash
npx cascade-conformance --config conformance.config.mjs --level standard
```

The configuration file exports the server and the client to test:

```javascript
// conformance.config.mjs
export default {
  server: { setup, execute }, // a ServerTarget, or a function returning one
  client: () => createHarness(), // a ClientHarness factory
};
```

| Option                                | Description                          |
| ------------------------------------- | ------------------------------------ |
| `--config <file>`                     | Configuration file (required)        |
| `--target <server\|client>`           | Run one side only                    |
| `--level <basic\|standard\|complete>` | Fail only for cases up to this level |
| `--format <console\|json\|markdown>`  | Output format (default `console`)    |
| `--verbose`                           | List passed and skipped cases too    |
| `--no-colors`                         | Plain console output                 |
