---
"@graphql-cascade/codegen": minor
---

Generate the `CascadeEntity` fragment: `buildCascadeEntityFragment(schema, documents)` and the plugin's `cascadeEntityFragment` option select, for each type implementing `Node`, the fields the project's documents read on it, so mutations select entities with `entity { ...CascadeEntity }`.
