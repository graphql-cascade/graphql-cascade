---
"@graphql-cascade/apollo": minor
"@graphql-cascade/nuxt": patch
---

`@graphql-cascade/apollo/core` exports everything but the React hooks and never loads React, so apps without React can use the Apollo integration without installing it. Every module but the hooks imports Apollo Client from `@apollo/client/core`, whose Apollo Client 3 entry, unlike `@apollo/client`, does not load Apollo's React layer. `react` is now an optional peer dependency. The package declares its entries in `exports`, so files under `dist/` can no longer be imported directly.

The Nuxt module imports `@graphql-cascade/apollo/core`, so Nuxt apps no longer load React.
