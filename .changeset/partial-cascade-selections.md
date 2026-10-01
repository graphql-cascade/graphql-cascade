---
"@graphql-cascade/client": minor
"@graphql-cascade/relay": patch
"@graphql-cascade/urql": patch
"@graphql-cascade/apollo": patch
---

Cascades whose mutation selects only some lists apply instead of crashing.

A mutation selecting only `cascade { updated { … } }` made clients throw on the missing `deleted` or `invalidations` list; Relay then dropped the whole cascade. New `normalizeCascade()` fills unselected lists with empty ones; `toCascadeResponse`, `applyCascade`, the Relay updater, urql's client, exchange and `extractCascadeData`, and Apollo's subscription manager apply normalized cascades.
