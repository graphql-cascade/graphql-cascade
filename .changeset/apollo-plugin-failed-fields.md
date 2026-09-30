---
"@graphql-cascade/server": minor
---

The Apollo Server plugin drops the changes of a mutation field that fails (throws, or returns a payload with `success: false`) from `extensions.cascade`, as specification 1.4.0 requires; before, clients received entities from rolled-back transactions. New `CascadeTracker.checkpoint()` and `restore()` undo tracked changes back to a point in a transaction.
