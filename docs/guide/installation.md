# Installation

GraphQL Cascade has a server library, one library per GraphQL client, a code generator and a CLI. Install the ones your project uses.

## Prerequisites

- Node.js 18 or later
- A GraphQL server you control (to add cascades to mutation payloads)
- TypeScript is recommended; every package ships its own type definitions

## Server

```bash
npm install @graphql-cascade/server graphql
```

`@graphql-cascade/server` tracks the entities a mutation changes and builds the cascade. It includes an Apollo Server plugin, Express middleware and a NestJS module. See [Server Setup](/server/).

## Client

Install the library for your GraphQL client:

| Client | Package | Install |
|--------|---------|---------|
| Apollo Client | `@graphql-cascade/apollo` | `npm install @graphql-cascade/apollo @apollo/client graphql` |
| urql | `@graphql-cascade/urql` | `npm install @graphql-cascade/urql urql graphql` |
| Relay | `@graphql-cascade/relay` | `npm install @graphql-cascade/relay relay-runtime react-relay graphql` |
| React Query | `@graphql-cascade/react-query` | `npm install @graphql-cascade/react-query @tanstack/react-query graphql` |

Each depends on `@graphql-cascade/client`, the client-independent core, which you can also use directly to support another client. See [Client Integration](/clients/).

## Code Generation

```bash
npm install -D @graphql-cascade/codegen @graphql-codegen/cli
```

`@graphql-cascade/codegen` is a [GraphQL Code Generator](https://the-guild.dev/graphql/codegen) plugin. It generates the `CascadeEntity` fragment that mutations select entities with, and typed helpers for cascade responses.

## CLI

```bash
npm install -D @graphql-cascade/cli
```

```bash
npx cascade init       # write cascade.config.ts for your client and schema
npx cascade doctor     # check that packages and configuration are in place
npx cascade validate   # check a schema against the Cascade conventions
npx cascade codegen    # run GraphQL Code Generator with the Cascade plugin
```

## Verify Installation

```typescript
import { CascadeTracker } from "@graphql-cascade/server";
import { CascadeClient } from "@graphql-cascade/client";

console.log(typeof CascadeTracker, typeof CascadeClient); // "function function"
```

```bash
npx cascade doctor
```

## Next Steps

- **[Quick Start](/guide/quick-start)**: build a mutation with a cascade, end to end
- **[Core Concepts](/guide/concepts)**: how cascades are built and applied
- **[Server Setup](/server/)** and **[Client Integration](/clients/)**: framework details
