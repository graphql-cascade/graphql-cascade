---
"@graphql-cascade/server": patch
---

Serialized entities in `cascade.updated[].entity` keep their `__typename`. The tracker skipped every key starting with `_` to drop private fields, which also removed `__typename`.
