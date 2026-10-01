---
"@graphql-cascade/nuxt": minor
---

The Nuxt module builds, and its composables apply cascades.

- `useCascadeMutation`, `useCascadeBatch` and `useCascadeOptimistic().mutate` apply the cascade of each successful mutation to the Apollo cache: they write the updated entities, evict the deleted ones and apply the invalidations. Before, they only extracted it.
- `useCascadeOptimistic` writes each update to an Apollo optimistic layer and removes the layers when the mutation settles, so a failed mutation reverts them. `clearOptimisticUpdates()` removes them too.
- The package ships its composables (`dist/runtime`), which the module auto-imports, and type declarations for its entry. Before, both were missing from the build.
- **Breaking:** supports Apollo Client 3 only. `@vue/apollo-composable` 4, which the composables build on, does not support Apollo Client 4.
- **Breaking:** removed the `$cascadeLink` plugin, which only logged cascades, and `useCascadeQuery`'s `watchInvalidations` option, which did nothing: a query refetches when a cascade evicts the fields it reads.
