# Documentation Site

Source of the GraphQL Cascade documentation site, built with [VitePress](https://vitepress.dev).

```bash
pnpm --filter @graphql-cascade/docs run dev     # local preview
pnpm --filter @graphql-cascade/docs run build   # static build in .vitepress/dist
```

`pnpm run check:spec` checks the code in these pages against the packages and the reference schema.
