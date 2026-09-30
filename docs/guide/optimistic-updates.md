# Optimistic Updates

An optimistic update shows a mutation's result before the server answers. With Cascade, you describe it as a cascade: the same `CascadeResponse` the server will send, built on the client from the mutation's variables. The client library applies it at once, replaces it with the server's cascade when the response arrives, and restores the previous data if the mutation fails.

The specification's [Optimistic Updates](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/14_optimistic_updates.md) chapter defines the protocol.

## Building an Optimistic Cascade

List what you expect the server to change. For toggling a todo:

```typescript
import {
  CascadeOperation,
  type CascadeResponse,
} from "@graphql-cascade/client";

function toggleTodoOptimistic(todo: { id: string; completed: boolean }): CascadeResponse {
  const entity = { __typename: "Todo", id: todo.id, completed: !todo.completed };
  return {
    success: true,
    data: entity,
    cascade: {
      updated: [
        { typename: "Todo", id: todo.id, operation: CascadeOperation.UPDATED, entity },
      ],
      deleted: [],
      invalidations: [],
      metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 },
    },
  };
}
```

Predict only what the client can know: the fields the user changed, and the entities they obviously affect, such as a counter on the owner. The server's cascade corrects anything else when it arrives.

## Creating Entities

A created entity needs an ID before the server assigns one. Two approaches:

- **Client-generated IDs.** If your API accepts an ID in the create input, generate a UUID on the client and use it in both the optimistic cascade and the mutation. The optimistic entity and the server's are then the same record, and nothing needs replacing. This fits schemas whose public IDs are UUIDs.
- **Temporary IDs.** Use a placeholder such as `temp-1`. Apollo drops the placeholder with its optimistic layer when the response arrives; with React Query, urql and `OptimisticCascadeClient`, the placeholder entity stays in the cache until evicted, so evict it yourself after the mutation succeeds.

## In Each Library

| Library | Optimistic API | Rollback |
|---------|----------------|----------|
| [Apollo](/clients/apollo#optimistic-cascades) | `useCascadeMutation(mutation, { optimistic: true, optimisticCascadeResponse })` | The cascade lives in its own optimistic layer, removed when the mutation settles |
| [React Query](/clients/react-query#mutations) | `useOptimisticCascadeMutation(client, mutation, variables => response)` | The entities' previous fields are written back unless the mutation succeeds |
| [urql](/clients/urql#urqlcascadeclient) | `cascadeClient.mutateOptimistic(mutation, variables, { optimisticResponse, optimisticCascade })` | The entities' previous state is restored unless the mutation succeeds |
| [Relay](/clients/relay) | Relay's own `optimisticResponse` / `optimisticUpdater` | Relay discards optimistic updates when the mutation settles |
| Any `CascadeCache` | `OptimisticCascadeClient.mutateOptimistic(mutation, variables, response)` | The entities' previous state is restored unless the mutation succeeds |

For example, with Apollo:

```tsx
import { useCascadeMutation } from "@graphql-cascade/apollo";

const [toggleTodo] = useCascadeMutation(TOGGLE_TODO, {
  optimistic: true,
  optimisticCascadeResponse: () => toggleTodoOptimistic(todo),
});
```

## When Server Data Differs

If the server's entity differs from the optimistic one, for example because another user changed it meanwhile, the server's data wins by default. Apollo's `useCascadeMutation` takes a `conflictResolution` option to choose otherwise; see [Conflict Resolution](/guide/conflict-resolution).

## Next Steps

- **[Conflict Resolution](/guide/conflict-resolution)**
- **[Client Libraries](/clients/)**
