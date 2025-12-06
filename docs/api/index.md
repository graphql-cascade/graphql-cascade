# API Reference

Detailed API documentation for GraphQL Cascade packages.

## Client Libraries

### @graphql-cascade/client-core
Core client functionality shared across all clients.

**[View API →](/api/client-core)**

### @graphql-cascade/client-apollo
Apollo Client integration.

**Documentation**: [Client Guide](/clients/apollo)

### @graphql-cascade/client-react-query
React Query integration.

**Documentation**: [Client Guide](/clients/react-query)

### @graphql-cascade/client-relay
Relay Modern integration.

**Documentation**: [Client Guide](/clients/relay)

### @graphql-cascade/client-urql
URQL integration.

**Documentation**: [Client Guide](/clients/urql)

## Server Libraries

### @graphql-cascade/server
Node.js/TypeScript server implementation.

**[View API →](/api/server-node)**



### @graphql-cascade/nestjs
NestJS module.

**Documentation**: [Server Guide](/server/nestjs)

## CLI

### @graphql-cascade/cli
Command-line tools.

**Documentation**: [CLI Guide](/cli/)

## Type Definitions

All packages include full TypeScript definitions.

```typescript
import type { Cascade, EntityRef, CascadeContext } from '@graphql-cascade/server';
import type { CascadeLink } from '@graphql-cascade/client-apollo';
```

## Next Steps

- **[Client Core API](/api/client-core)** - Core client types
- **[Server Node API](/api/server-node)** - Server implementation
- **[Client Guides](/clients/)** - Usage examples
- **[Server Guides](/server/)** - Implementation guides
