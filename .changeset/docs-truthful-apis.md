---
"@graphql-cascade/cli": minor
"@graphql-cascade/server": patch
---

- cli: `cascade init` writes a `cascade.config.ts` typed with `import type { CascadeConfig } from "@graphql-cascade/cli"`, holding `client` and `schema`. It imported a type from `@graphql-cascade/core`, which does not exist, so generated configs failed to type-check.
- server: export the `Invalidator` interface, which custom invalidators implement.
