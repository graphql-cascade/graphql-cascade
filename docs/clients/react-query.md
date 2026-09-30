# React Query

`@graphql-cascade/react-query` applies cascades to TanStack Query's query data.

TanStack Query caches whole query results, not entities. The adapter finds each updated entity inside cached query data, by `__typename` and `id`, and merges the new fields in place; hints and type invalidations map to query keys.

## Installation

```bash
npm install @graphql-cascade/react-query @graphql-cascade/client @tanstack/react-query graphql
```

## Setup

`ReactQueryCascadeClient` takes your `QueryClient` and a function that executes a GraphQL document:

```typescript
import { QueryClient } from "@tanstack/react-query";
import { print, type DocumentNode } from "graphql";
import { ReactQueryCascadeClient } from "@graphql-cascade/react-query";

export const queryClient = new QueryClient();

async function execute(document: DocumentNode, variables: unknown) {
  const response = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: print(document), variables }),
  });
  return response.json();
}

export const cascadeClient = new ReactQueryCascadeClient(queryClient, execute);
```

## Queries

Key queries by query name, then variables, so hints can find them, and select `__typename` wherever an entity appears, so the adapter can find entities in the data:

```typescript
import { useQuery } from "@tanstack/react-query";

function useTodos(filter: string) {
  return useQuery({
    queryKey: ["todos", { filter }],
    queryFn: () => cascadeClient.query(TODOS_QUERY, { filter }),
  });
}
```

## Mutations

`useCascadeMutation` runs the mutation through the cascade client, which applies the cascade before the mutation resolves:

```tsx
import { useCascadeMutation } from "@graphql-cascade/react-query";

function TodoItem({ todo }) {
  const toggle = useCascadeMutation(cascadeClient, TOGGLE_TODO);

  return (
    <input
      type="checkbox"
      checked={todo.completed}
      disabled={toggle.isPending}
      onChange={() => toggle.mutate({ id: todo.id })}
    />
  );
}
```

It returns TanStack Query's mutation result; the mutation's data is the payload's `data`. Besides TanStack Query's mutation options, it takes `retryOptions` (`maxRetries`, `baseDelay`, `maxDelay`, `exponentialBackoff`) and `onRetryAttempt`: mutations failing with retryable cascade errors are retried with backoff.

`useOptimisticCascadeMutation(cascadeClient, mutation, variables => optimisticResponse)` applies an optimistic `CascadeResponse` first and rolls it back unless the mutation succeeds.

## How Cascades Map to Query Data

| Cascade | TanStack Query |
|---------|----------------|
| `updated` | Merge the entity's fields into every cached query result containing an object with its `__typename` and `id` |
| `deleted` | Remove the entity from lists in cached query results |
| Hints | The queries the hint's scope selects by name, the key's first element: `EXACT` also compares `arguments` with the key's second element |
| `typeInvalidations` | Every query |

`INVALIDATE` calls `invalidateQueries`, `REFETCH` `refetchQueries`, and `REMOVE` `removeQueries`.

A created entity appears in no cached result until a query fetches it; hint the lists it belongs to, as the [server guide](/server/#invalidation-hints) describes.

## Next Steps

- **[Client Core API](/api/client-core)**: `CascadeClient` and the types
- **[Server](/server/)**: producing hints
