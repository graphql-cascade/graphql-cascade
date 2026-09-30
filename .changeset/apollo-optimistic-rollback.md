---
"@graphql-cascade/apollo": patch
---

Optimistic updates in `useCascadeMutation` are applied in an Apollo optimistic layer and removed when the mutation settles. A failed mutation now restores every field of existing entities; before, only `id` and `__typename` were restored. Failed mutations reject with the Apollo error instead of `TypeError: Cannot convert undefined or null to object`. `ApolloCascadeCache.read()` returns every stored field, including optimistic writes, so conflict detection compares real values.
