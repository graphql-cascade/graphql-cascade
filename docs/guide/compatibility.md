# Platform Compatibility

GraphQL Cascade is designed for modern JavaScript environments with broad platform support. This guide documents version requirements, platform compatibility, and optimization capabilities.

## Node.js Versions

| Version | Linux | macOS | Windows | Status |
|---------|-------|-------|---------|--------|
| 18.x | ✅ | ✅ | ✅ | LTS (Maintenance) |
| 20.x | ✅ | ✅ | ✅ | LTS (Active) - Recommended |
| 22.x | ✅ | ✅ | ✅ | Current |

**Minimum version:** Node.js 18.0.0

The server packages use ES2022 features. Ensure your Node.js version supports:
- Top-level await
- Private class fields
- Optional chaining and nullish coalescing
- Logical assignment operators (`??=`, `&&=`, `||=`)

For maximum compatibility and latest security updates, **Node.js 20.x LTS is recommended for production**.

## Platform-Specific Notes

### Linux

- Fully supported on all major distributions
- Tested on Ubuntu 22.04+, Debian 12+, Alpine 3.18+
- No native dependencies required
- Recommended for production servers
- Works with standard Node.js packages from all package managers

### macOS

- Fully supported on macOS 12+
- Works on both Intel and Apple Silicon (arm64)
- No special configuration needed
- Ideal for development and local testing

### Windows

- Fully supported on Windows 10 and 11
- Works with both PowerShell and Command Prompt
- WSL2 (Windows Subsystem for Linux) recommended for development
- No native dependencies required

### Docker / Alpine Linux

- Fully supported with slim and alpine base images
- No native dependencies - extremely lightweight
- Ideal for containerized deployments

**Example Dockerfile:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

**Multi-stage build example:**
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY --from=builder /build/dist ./dist
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

## Browser Compatibility (Client Packages)

Client packages (`@graphql-cascade/client`, `@graphql-cascade/apollo`, etc.) support modern browsers:

| Browser | Minimum Version | Status |
|---------|-----------------|--------|
| Chrome | 90+ | ✅ Fully supported |
| Firefox | 88+ | ✅ Fully supported |
| Safari | 14+ | ✅ Fully supported |
| Edge | 90+ | ✅ Fully supported |

**Required JavaScript Features:**
- `Map` and `Set` - standard in all modern browsers
- `Promise` - standard in all modern browsers
- `Symbol` - standard in all modern browsers
- `WeakMap` - used for internal caching
- ES2020 features (optional chaining, nullish coalescing)

**No polyfills needed** for supported browser versions - Cascade clients use only standardized features available in modern browsers.

### Older Browser Support

If you need to support older browsers (IE 11, Safari <14, Firefox <88), you have two options:

1. **Transpilation with Babel:**
```json
{
  "devDependencies": {
    "@babel/core": "^7.23.0",
    "@babel/preset-env": "^7.23.0"
  }
}
```

2. **Polyfills for older environments:**
```javascript
// Only needed for browsers before ES2015
import 'core-js/stable';
import 'regenerator-runtime/runtime';
```

For best compatibility, ensure your bundler transpiles to at least ES2015 and includes necessary polyfills.

## TypeScript Versions

| Version | Status | Notes |
|---------|--------|-------|
| 4.7+ | ✅ Supported | Basic support, all features work |
| 5.0+ | ✅ Recommended | Best experience, full feature support |

The `@graphql-cascade` packages use modern TypeScript features:

**TypeScript 5.0+ features used:**
- `satisfies` operator for type narrowing
- Template literal types for schema inference
- Conditional types for advanced type inference
- `const` type parameters
- `as const` satisfaction

**TypeScript 4.7+ compatibility:**
The packages are compatible with TypeScript 4.7+, though some advanced type inference may be limited. Upgrade to TypeScript 5.0+ for the best experience and full type safety.

**ESLint and tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

## Bundle Sizes

Client packages are optimized for minimal bundle impact:

| Package | Minified | Gzipped | Brotli |
|---------|----------|---------|--------|
| @graphql-cascade/client | ~8KB | ~3KB | ~2.5KB |
| @graphql-cascade/apollo | ~12KB | ~4KB | ~3.5KB |
| @graphql-cascade/react-query | ~6KB | ~2KB | ~1.8KB |
| @graphql-cascade/urql | ~5KB | ~2KB | ~1.6KB |

*Sizes measured with latest versions. Actual sizes depend on tree shaking and your bundler configuration.*

### Measuring Bundle Impact

To measure the actual bundle impact in your project:

```bash
# Using webpack-bundle-analyzer
npm install --save-dev webpack-bundle-analyzer

# Using esbuild
esbuild --bundle --analyze your-entry.js

# Using rollup
npm install --save-dev rollup-plugin-visualizer
```

## Tree Shaking

All Cascade packages support full tree shaking. Your bundler will automatically remove unused code:

**Good - only imports used exports:**
```typescript
import { createCascadeLink } from '@graphql-cascade/apollo';
import { useCascadeMutation } from '@graphql-cascade/react';
```

**Avoid - imports entire package:**
```typescript
import * as cascade from '@graphql-cascade/apollo';
```

Tree shaking works automatically with:
- webpack 4+
- esbuild
- Rollup
- Vite
- TypeScript compiler (`preserveModules`)

## ES Modules

All Cascade packages are published as ESM (EcmaScript Modules) with CommonJS fallback:

- `"type": "module"` in package.json
- Dual `exports` field for ESM/CJS interoperability
- Full `.d.ts` type definitions included
- Source maps for debugging

**ESM (Recommended):**
```typescript
import { CascadeTracker } from '@graphql-cascade/server-node';
import { createCascadeLink } from '@graphql-cascade/apollo';

const tracker = new CascadeTracker();
```

**CommonJS (Supported for backward compatibility):**
```javascript
const { CascadeTracker } = require('@graphql-cascade/server-node');
const { createCascadeLink } = require('@graphql-cascade/apollo');

const tracker = new CascadeTracker();
```

### Module Resolution

Ensure your `package.json` or build configuration supports ESM:

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  }
}
```

### Dual Package Hazard

To avoid issues with dual packages, ensure consistent module resolution:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

## Performance Characteristics

### Memory Usage

- Server: ~50MB baseline + ~1MB per 1000 concurrent clients
- Client: ~5MB per application instance

### CPU Usage

- Server mutation tracking: <1ms per mutation
- Client cascade processing: <5ms for typical 10-100 entity cascades

### Network Impact

- Cascade metadata adds ~50-200 bytes per mutation response
- Gzip compression reduces impact to ~20-50 bytes
- Significantly reduces total network traffic through fewer refetch queries

## Compatibility Matrix

Quick reference for all supported platform combinations:

```
╔════════════════════════════════════════════════════════════════╗
║                   Cascade Compatibility Matrix                 ║
╠════════════════════╦═══════════╦═══════════╦═══════════════════╣
║ Component          ║ Minimum   ║ Recommended ║ Tested Versions  ║
╠════════════════════╬═══════════╬═══════════╬═══════════════════╣
║ Server             ║ Node 18.0 ║ Node 20.x ║ 18, 20, 22       ║
║ Client (Browsers)  ║ ES2020    ║ Latest    ║ Chrome 90+, FF   ║
║                    ║           ║           ║ 88+, Safari 14+  ║
║ TypeScript         ║ 4.7       ║ 5.0+      ║ 4.7, 5.0, 5.1+   ║
║ React              ║ 16.8+     ║ 18+       ║ 16.8, 17, 18     ║
║ Apollo Client      ║ 3.7+      ║ 3.9+      ║ 3.7, 3.8, 3.9    ║
║ React Query        ║ 3.0+      ║ 4+        ║ 3.x, 4.x, 5.x    ║
║ URQL               ║ 2.0+      ║ 3+        ║ 2.x, 3.x, 4.x    ║
╚════════════════════╩═══════════╩═══════════╩═══════════════════╝
```

## Version Policy

### Semantic Versioning

Cascade follows semantic versioning (semver):
- **MAJOR**: Breaking API changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes

### LTS Versions

Long-term support versions (LTS) receive security updates for 24 months:
- 2.x: Active LTS through Q4 2026
- 1.x: Maintenance mode through Q2 2025

### End of Life

When support ends, no further updates are provided. Plan upgrades accordingly.

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

## Getting Started

Choose the right platform for your use case:

- **Production Servers**: Node.js 20.x LTS on Linux (Docker recommended)
- **Local Development**: Node.js 20.x with any OS (macOS/Windows/Linux)
- **Browser Apps**: TypeScript 5.0+ with React 18+ or Vue 3+
- **Type Safety**: Ensure TypeScript strict mode is enabled

## Next Steps

- **[Quick Start](/guide/quick-start)** - Set up Cascade in your environment
- **[Installation](/guide/installation)** - Install packages for your platform
- **[Core Concepts](/guide/concepts)** - Learn how Cascade works
- **[Server Setup](/server/index)** - Configure server-side Cascade
- **[Client Setup](/clients/index)** - Configure client-side Cascade
