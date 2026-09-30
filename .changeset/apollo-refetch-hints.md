---
"@graphql-cascade/apollo": minor
"@graphql-cascade/client": patch
---

`REFETCH` hints refetch Apollo queries.

- `ApolloCascadeCache.refetch` always rejected, so every `REFETCH` hint applied by `useCascadeMutation` or `ApolloCascadeClient` caused an unhandled promise rejection and refetched nothing. The cache now takes an optional `ApolloClient` and refetches the active queries reading the hinted fields; without a client it evicts them like `INVALIDATE`. `ApolloCascadeClient` passes its client.
- `CascadeClient.applyCascade` logs a failed refetch instead of leaving its rejection unhandled.
- Removed the `exampleUsage` export, which was sample code.
