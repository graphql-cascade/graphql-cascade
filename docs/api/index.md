# API Reference

## Packages

| Package | Contents | Documentation |
|---------|----------|---------------|
| `@graphql-cascade/server` | Tracker, builder, invalidators, and the Express, NestJS and Apollo Server integrations | [API](/api/server-node) · [Guide](/server/) |
| `@graphql-cascade/client` | Response types, `CascadeClient`, `CascadeCache`, error helpers | [API](/api/client-core) |
| `@graphql-cascade/apollo` | Apollo Client integration | [Guide](/clients/apollo) |
| `@graphql-cascade/relay` | Relay integration | [Guide](/clients/relay) |
| `@graphql-cascade/react-query` | TanStack Query integration | [Guide](/clients/react-query) |
| `@graphql-cascade/urql` | urql integration | [Guide](/clients/urql) |
| `@graphql-cascade/nuxt` | Nuxt module for the Apollo integration | [README](https://github.com/graphql-cascade/graphql-cascade/tree/main/packages/nuxt-module/module) |
| `@graphql-cascade/codegen` | GraphQL Code Generator plugin: the `CascadeEntity` fragment and typed helpers | [README](https://github.com/graphql-cascade/graphql-cascade/tree/main/packages/codegen) |
| `@graphql-cascade/cli` | `cascade` command: schema validation, codegen, conformance | [CLI](/cli/) |
| `@graphql-cascade/conformance` | Conformance tests for implementations | [README](https://github.com/graphql-cascade/graphql-cascade/tree/main/packages/conformance) |

Every package ships TypeScript definitions. The response types are exported by both `@graphql-cascade/server` and `@graphql-cascade/client`:

```typescript
import type { CascadeResponse, CascadeUpdates } from "@graphql-cascade/client";
```

## Next Steps

- **[Server API](/api/server-node)**
- **[Client Core API](/api/client-core)**
