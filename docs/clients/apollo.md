# Apollo Client

`@graphql-cascade/apollo` applies cascades to Apollo Client's normalized cache.

## Installation

```bash
npm install @graphql-cascade/apollo @graphql-cascade/client @apollo/client graphql
```

## Mutations in React

`useCascadeMutation` wraps Apollo's `useMutation`. When the mutation completes, it applies the response's cascade to the cache:

```tsx
import { gql } from "@apollo/client";
import { CascadeOperation } from "@graphql-cascade/client";
import { useCascadeMutation } from "@graphql-cascade/apollo";

const TOGGLE_TODO = gql`
  mutation ToggleTodo($id: ID!) {
    toggleTodo(id: $id) {
      success
      errors { code message }
      data { id completed }
      cascade {
        updated { typename id operation entity { __typename id ... on Todo { completed } } }
        deleted { typename id }
        invalidations { queryName strategy scope }
        typeInvalidations { typename }
        metadata { timestamp affectedCount }
      }
    }
  }
`;

function TodoItem({ todo }) {
  const [toggleTodo, { loading }] = useCascadeMutation(TOGGLE_TODO, {
    onCompleted: (data, cascade) => {
      console.log(`${cascade.metadata.affectedCount} entities updated`);
    },
    onError: (error) => console.error(error),
  });

  return (
    <input
      type="checkbox"
      checked={todo.completed}
      disabled={loading}
      onChange={() => toggleTodo({ variables: { id: todo.id } })}
    />
  );
}
```

The mutate function resolves to `{ data, cascade }`, where `data` is the payload's `data`. The hook's result adds `cascade`, the last cascade applied, to Apollo's `data`, `loading`, `error` and `called`.

| Option | Description |
|--------|-------------|
| `onCompleted(data, cascade)` | Called after the cascade is applied |
| `onError(error, variables)` | Called when the mutation fails, or when its response carries no cascade |
| `optimistic`, `optimisticCascadeResponse` | Optimistic cascades; see below |
| `conflictResolution` | How server data that differs from the optimistic data is resolved: `SERVER_WINS` (default), `CLIENT_WINS`, `MERGE` |

Other options pass through to `useMutation`.

## Optimistic Cascades

With `optimistic: true`, the hook applies a cascade you build from the variables before the server answers:

```tsx
const [toggleTodo] = useCascadeMutation(TOGGLE_TODO, {
  optimistic: true,
  optimisticCascadeResponse: ({ id }) => ({
    success: true,
    data: { __typename: "Todo", id, completed: !todo.completed },
    cascade: {
      updated: [
        {
          typename: "Todo",
          id,
          operation: CascadeOperation.UPDATED,
          entity: { __typename: "Todo", id, completed: !todo.completed },
        },
      ],
      deleted: [],
      invalidations: [],
      metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 },
    },
  }),
});
```

The optimistic cascade goes into its own Apollo optimistic layer. When the server responds, or the mutation fails, the layer is removed, so a failure restores exactly what the cache held.

## Outside React

`ApolloCascadeClient` runs mutations through an `ApolloClient` and applies their cascades:

```typescript
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloCascadeClient } from "@graphql-cascade/apollo";

const apollo = new ApolloClient({ uri: "/graphql", cache: new InMemoryCache() });
const cascade = new ApolloCascadeClient(apollo);

const todo = await cascade.mutate(TOGGLE_TODO, { id: "1" });
```

`mutate` returns the payload's `data`. `applyCascade(response)` applies a cascade you received another way.

## How Cascades Map to Apollo's Cache

| Cascade | Apollo cache |
|---------|--------------|
| `updated` | `writeFragment` of the entity's fields, keyed by `cache.identify({ __typename, id })` |
| `deleted` | `evict` the entity, then `gc` |
| `INVALIDATE` and `REMOVE` hints | Evict the `ROOT_QUERY` fields whose names match the hint's `queryName` (`EXACT`), prefix (`PREFIX`) or glob `queryPattern` (`PATTERN`), with all their arguments |
| `REFETCH` hints | Evict the matching fields as above inside `refetchQueries`, so the active queries reading them refetch at once |
| `typeInvalidations` | Evict every entity of the type, and every field that references one or holds an empty list |

Queries reading an evicted field refetch the next time they read it. Name hints after root query fields (`todos`, `searchTodos`) so they match Apollo's store.

`ApolloCascadeCache` is the adapter behind this mapping; pass it to `CascadeClient` from `@graphql-cascade/client` to apply cascades with your own executor. Give it your `ApolloClient` as second argument for `REFETCH` hints to refetch; without it they evict like `INVALIDATE`.

## Retrying Failed Mutations

`createCascadeErrorLink` returns a link that retries operations failing with retryable cascade errors (`TIMEOUT`, `SERVICE_UNAVAILABLE`, `RATE_LIMITED`), with exponential backoff and the server's `retryAfter` when it sends one:

```typescript
import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";
import { createCascadeErrorLink } from "@graphql-cascade/apollo";

const client = new ApolloClient({
  link: from([
    createCascadeErrorLink({ maxRetries: 3, baseDelay: 1000 }),
    new HttpLink({ uri: "/graphql" }),
  ]),
  cache: new InMemoryCache(),
});
```

## More Exports

- `CascadeSubscriptionManager` applies cascades received through subscriptions: `new CascadeSubscriptionManager(cascadeClient, apollo).subscribe(document, { onCascade, filter })`.
- `CascadeCachePersistence` saves the cache to a storage (`createLocalStoragePersistence()`, `createInMemoryPersistence()`) and records a history of applied cascades.
- `CascadeFragmentGenerator` builds fragments from cascade entities, for writing entities outside `applyCascade`.

## Next Steps

- **[Client Core API](/api/client-core)**: the types and `CascadeCache`
- **[Server](/server/)**: producing cascades
