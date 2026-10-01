# Compatibility

## Runtimes

The packages are compiled to ES2020 JavaScript as CommonJS modules, with TypeScript declarations. They have no native dependencies.

`@graphql-cascade/server` requires Node.js 18 or later. CI runs every package's tests on Node.js 18, 20 and 22, on Linux, macOS and Windows (Node.js 20 and 22 only on Windows).

Client packages run in any environment with ES2020 support: current browsers, React Native, and Node.js. `@graphql-cascade/nuxt` is an ES module targeting ES2022.

## Peer Dependencies

Each package supports the current and the previous major of the libraries it works with, declared as peer dependencies:

| Package | Peer dependencies |
|---------|-------------------|
| `@graphql-cascade/server` | `@apollo/server` 4 or 5, `@nestjs/common` 11 or 12, `express` 4 or 5: each only for its integration entry |
| `@graphql-cascade/client` | `graphql` 16 or 17 |
| `@graphql-cascade/apollo` | `@apollo/client` 3 or 4, `graphql` 16 or 17, `react` 18 or 19 |
| `@graphql-cascade/relay` | `relay-runtime` 20 or 21, `graphql` 16 or 17, `react` 18 or 19 |
| `@graphql-cascade/react-query` | `@tanstack/react-query` 4 or 5, `graphql` 16 or 17, `react` 18 or 19 |
| `@graphql-cascade/urql` | `@urql/core` 5 or 6, `graphql` 16 or 17 |
| `@graphql-cascade/nuxt` | `nuxt` 3 or 4, `@apollo/client` 3 or 4, `@vue/apollo-composable` 4 |
| `@graphql-cascade/codegen` | `graphql` 16 or 17 |

CI runs every package's tests against both: the development dependencies pin the previous majors, and a second job installs the current ones. NestJS 12 is published as ES modules only; the NestJS entry loads it through Node's `require` of ES modules, available from Node.js 20.19 and 22.12.

## Servers in Other Languages

Any GraphQL server can produce cascades: the response format is defined by the [specification](/specification/), not by `@graphql-cascade/server`. The client libraries work with any server whose mutations return cascades in their payloads.

## Specification Versions

Clients read responses from servers implementing any 1.x version of the specification: they accept the `__typename` entry field that servers before 1.3.0 send in place of `typename`, and ignore fields they don't know. Servers can report the version they implement through the `cascadeInfo` query field; see [Versioning](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/VERSIONING.md).

## Next Steps

- **[Installation](/guide/installation)**
- **[Client Libraries](/clients/)**
