# Platform Compatibility

## Node.js Versions

| Version | Linux | macOS | Windows | Status |
|---------|-------|-------|---------|--------|
| 18.x | Supported | Supported | Supported | LTS (Maintenance) |
| 20.x | Supported | Supported | Supported | LTS (Active) - Recommended |
| 22.x | Supported | Supported | Supported | Current |

**Minimum version:** Node.js 18.0.0

The server packages use ES2022 features. Ensure your Node.js version supports:
- Top-level await
- Private class fields
- Optional chaining and nullish coalescing

## Platform-Specific Notes

### Linux
- Fully supported on all major distributions
- Tested on Ubuntu 22.04, Debian 12, Alpine 3.18+
- No native dependencies required

### macOS
- Fully supported on macOS 12+
- Works on both Intel and Apple Silicon

### Windows
- Fully supported on Windows 10/11
- Works with PowerShell and Command Prompt
- WSL2 recommended for development

### Docker / Alpine Linux
- Fully supported
- No native dependencies - works with slim/alpine base images
- Example Dockerfile:
  ```dockerfile
  FROM node:20-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --production
  COPY . .
  CMD ["node", "dist/server.js"]
  ```

## Browser Compatibility (Client Packages)

| Browser | Minimum Version | Status |
|---------|-----------------|--------|
| Chrome | 90+ | Fully supported |
| Firefox | 88+ | Fully supported |
| Safari | 14+ | Fully supported |
| Edge | 90+ | Fully supported |

**Requirements:**
- ES2020 environment
- `Map`, `Set`, `Promise`, `Symbol` (no polyfills needed in supported browsers)

**Older browsers:**
If you need to support older browsers, ensure your bundler transpiles to ES2015 and includes necessary polyfills.

## TypeScript Versions

| Version | Status |
|---------|--------|
| 4.7+ | Supported |
| 5.0+ | Recommended |

The package uses modern TypeScript features:
- `satisfies` operator (5.0+)
- Template literal types
- Conditional types

## Bundle Sizes

Client packages are optimized for minimal bundle impact:

| Package | Minified | Gzipped |
|---------|----------|---------|
| @graphql-cascade/client | ~8KB | ~3KB |
| @graphql-cascade/apollo | ~12KB | ~4KB |
| @graphql-cascade/react-query | ~6KB | ~2KB |
| @graphql-cascade/urql | ~5KB | ~2KB |

*Sizes measured with latest versions. Actual sizes may vary.*

## Tree Shaking

All packages support tree shaking. Import only what you need:

```typescript
// Good - only imports used exports
import { createCascadeLink } from '@graphql-cascade/apollo';

// Avoid - imports entire package
import * as cascade from '@graphql-cascade/apollo';
```

## ES Modules

All packages are published as ESM with CommonJS fallback:
- `"type": "module"` in package.json
- Dual `exports` field for ESM/CJS
- `.d.ts` type definitions included

```typescript
// ESM (recommended)
import { CascadeTracker } from '@graphql-cascade/server-node';

// CommonJS (supported)
const { CascadeTracker } = require('@graphql-cascade/server-node');
```

## GraphQL Client Compatibility

| Client | Supported Versions |
|--------|-------------------|
| Apollo Client | 3.0+ |
| React Query / TanStack Query | 4.0+, 5.0+ |
| URQL | 3.0+, 4.0+ |
| Relay | 14.0+ |

## Server Framework Compatibility

| Framework | Integration |
|-----------|-------------|
| Express | Middleware available |
| Apollo Server | Plugin available |
| NestJS | Module available |
| Fastify | Manual integration |
| Koa | Manual integration |

## ORM Compatibility

GraphQL Cascade works with any ORM that supports hooks or events:

| ORM | Integration Method |
|-----|-------------------|
| Prisma | Middleware/Extensions |
| TypeORM | Entity subscribers |
| Sequelize | Model hooks |
| Drizzle | Manual tracking |
| MikroORM | Entity hooks |
