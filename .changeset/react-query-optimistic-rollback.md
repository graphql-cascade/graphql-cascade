---
"@graphql-cascade/react-query": patch
---

A failed optimistic mutation no longer removes its entities from query data. `ReactQueryCascadeCache.read` always returned null, so the rollback evicted every entity the optimistic cascade touched; it now returns the entity's fields from the cached query results holding it, and the rollback restores them.
