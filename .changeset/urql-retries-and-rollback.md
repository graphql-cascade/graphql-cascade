---
"@graphql-cascade/urql": minor
---

`cascadeErrorExchange` retries, and optimistic changes are rolled back after failed mutations.

- `cascadeErrorExchange` never retried: it called `onRetryFailure` for every failed operation. It now retries operations failing with retryable cascade errors, from GraphQL errors or failed mutation payloads, with the server's `retryAfter` or exponential backoff, and calls `onRetryAttempt`, `onRetrySuccess` and `onRetryFailure` as they describe.
- `URQLCascadeClient.mutateOptimistic` rolled back only when the mutation rejected, which urql never does for GraphQL or network errors. It now rolls back whenever the mutation does not succeed, including failure payloads.
- Removed the `optimistic` and `maxDepth` options of `URQLCascadeConfig`, which were never read.
