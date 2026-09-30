---
"@graphql-cascade/cli": patch
---

Setup commands give complete, correct guidance.

- `cascade doctor` recognizes every Cascade package (server, client, Apollo, Relay, React Query, urql, Nuxt, codegen), and no longer advises installing all client packages when a project uses one.
- `cascade init` prints its next steps after creating the configuration, not only after an overwrite or with `--yes`.
- `cascade codegen init` enables `cascadeEntityFragment`, which generates the entity selection mutations need.
