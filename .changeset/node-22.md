---
"@graphql-cascade/apollo": minor
"@graphql-cascade/cli": minor
"@graphql-cascade/client": minor
"@graphql-cascade/codegen": minor
"@graphql-cascade/conformance": minor
"@graphql-cascade/nuxt": minor
"@graphql-cascade/react-query": minor
"@graphql-cascade/relay": minor
"@graphql-cascade/server": minor
"@graphql-cascade/urql": minor
---

**Breaking:** Requires Node.js 22 or later. Every package declares `engines.node` `>=22`, and `@graphql-cascade/server` `>=22.12`, the first Node.js 22 release that can `require` the ES modules NestJS 12 ships; CI tests Node.js 22, 24 and 26.
