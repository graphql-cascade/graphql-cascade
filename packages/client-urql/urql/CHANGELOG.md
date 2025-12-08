# @graphql-cascade/urql

## 0.3.1

### Patch Changes

- Fix security vulnerabilities by adding pnpm override for vite >= 5.4.20. This addresses GitHub security advisories for vite's server.fs settings and middleware file serving issues. The existing esbuild override (>=0.25.0) continues to protect against the esbuild CORS bypass vulnerability.

- Updated dependencies []:
  - @graphql-cascade/client@0.3.1
