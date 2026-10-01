# Reference Schema

[`cascade_base.graphql`](cascade_base.graphql) is the normative definition of the GraphQL types every Cascade schema includes: `Node`, the mutation result types (`CascadeResponse`, `CascadePayload`, `CascadeFailure`), `CascadeUpdates` and the types it holds, errors, subscription events and the `@cascade` directives.

Add these types to your schema unchanged; `npx cascade validate` checks that a schema's Cascade types match them. The specification's chapters show excerpts of this file, and `pnpm run check:spec` keeps them identical. `@graphql-cascade/cli` ships a copy, regenerated with `pnpm run sync:reference`.

## Implementations

- **TypeScript/Node.js:** [`@graphql-cascade/server`](../packages/server-node), maintained in this repository.
- **Python:** [FraiseQL](https://github.com/fraiseql/fraiseql) implements Cascade in its mutation layer.
