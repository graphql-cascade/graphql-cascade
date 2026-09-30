---
"@graphql-cascade/client": patch
"@graphql-cascade/react-query": patch
---

`OptimisticCascadeClient.mutateOptimistic` rolls back unless the mutation succeeds.

- Optimistic changes stayed in the cache after a failure payload (`success: false`, or `CascadeFailure`), because only a thrown error rolled back. React Query's `useOptimisticCascadeMutation` inherited this.
- Rolling back now also restores entities that the optimistic cascade deleted, and handles IDs containing `:`.
