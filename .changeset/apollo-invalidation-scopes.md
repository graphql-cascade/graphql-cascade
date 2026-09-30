---
"@graphql-cascade/apollo": patch
---

`ApolloCascadeCache.invalidate()` and `remove()` now honor every scope. `ALL` evicts every root query field, `PREFIX` evicts root fields whose name starts with `queryName`, and `PATTERN` evicts root fields matching the `queryPattern` glob (`*`, `?`). Previously `ALL` only ran garbage collection and `PREFIX`/`PATTERN` only logged a warning.
