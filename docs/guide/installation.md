# Installation

Get started with GraphQL Cascade in your project.

## Prerequisites

- **Node.js**: 18.x or higher
- **GraphQL**: 16.x or higher
- A GraphQL client (Apollo Client, React Query, Relay, or URQL)

## Client Installation

Choose the client library that matches your GraphQL client:

### Apollo Client

```bash
npm install @graphql-cascade/client-apollo
```

### React Query

```bash
npm install @graphql-cascade/client-react-query
```

### Relay

```bash
npm install @graphql-cascade/client-relay
```

### URQL

```bash
npm install @graphql-cascade/client-urql
```

## Server Installation

### Node.js/TypeScript

```bash
npm install @graphql-cascade/server
```



## CLI Tools

Install the Cascade CLI for project initialization and validation:

```bash
npm install -g @graphql-cascade/cli
```

Or use with npx (without global installation):

```bash
npx @graphql-cascade/cli init
```

After installation, use the `cascade` command:

```bash
cascade init
cascade validate
cascade doctor
```

## Verify Installation

### Client

```typescript
import { createCascadeLink } from '@graphql-cascade/client-apollo';

// If this imports without errors, installation was successful
console.log('Cascade installed successfully!');
```

### Server

```typescript
import { createCascadeContext } from '@graphql-cascade/server';

// If this imports without errors, installation was successful
console.log('Cascade server installed successfully!');
```

### CLI

```bash
cascade --version
```

## TypeScript Configuration

Cascade includes full TypeScript support. Add these settings to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Next Steps

- **[Quick Start](/guide/quick-start)** - Build your first Cascade-enabled app
- **[Core Concepts](/guide/concepts)** - Understand how Cascade works
- **[Client Integration](/clients/)** - Detailed client setup for your framework
- **[Server Setup](/server/)** - Configure your GraphQL server
