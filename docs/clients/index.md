# Client Libraries

A Cascade client reads the `cascade` of each mutation response and applies it to the client's cache: it writes updated entities, evicts deleted ones, and acts on invalidation hints. Components reading the cache re-render with the new data, with no `refetchQueries` or manual `update` functions.

## Packages

| Package | For | Applies cascades |
|---------|-----|------------------|
| [`@graphql-cascade/apollo`](/clients/apollo) | Apollo Client | To Apollo's normalized cache, from `useCascadeMutation` or `ApolloCascadeClient` |
| [`@graphql-cascade/relay`](/clients/relay) | Relay | To the Relay store, from every mutation of a cascade environment |
| [`@graphql-cascade/react-query`](/clients/react-query) | TanStack Query | To query data holding the entities, and to query keys named by hints |
| [`@graphql-cascade/urql`](/clients/urql) | urql | To a `CascadeCache` you provide |
| [`@graphql-cascade/client`](/api/client-core) | Any client | The shared types, `CascadeClient`, and the `CascadeCache` interface for other caches |

## Selecting the Cascade

Clients apply what the mutation selects, so select `cascade` in every mutation. Select the entity fields your queries read under `entity`:

```graphql
mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
  updateTodo(id: $id, input: $input) {
    success
    errors { code message field }
    data { id title completed }
    cascade {
      updated {
        typename
        id
        operation
        entity {
          __typename
          id
          ... on Todo { title completed }
          ... on User { todoCount }
        }
      }
      deleted { typename id }
      invalidations { queryName strategy scope }
      typeInvalidations { typename }
      metadata { timestamp affectedCount truncated }
    }
  }
}
```

In a real project, generate the `entity` selection: [`@graphql-cascade/codegen`](https://github.com/graphql-cascade/graphql-cascade/tree/main/packages/codegen#cascadeentityfragment) builds a `CascadeEntity` fragment from the fields your queries read, and mutations select `entity { ...CascadeEntity }`.

## What Clients Do With a Cascade

| Cascade field | Client action |
|---------------|---------------|
| `updated` | Write each entity into the cache under its type name and `id` |
| `deleted` | Evict each entity |
| `invalidations` | `INVALIDATE` marks matching queries stale, `REFETCH` refetches them, `REMOVE` drops them |
| `typeInvalidations` | Treat every cached entity of the type, and every query that may contain one, as stale |

Each library maps these onto its cache; the library pages say where a cache cannot follow a hint exactly and what it does instead.

## Response Forms

Every library reads both mutation response forms: a `CascadeResponse` payload (`success`, `errors`, `data`, `cascade`) and a result union of a `CascadePayload` and `CascadeFailure`. `toCascadeResponse()` from `@graphql-cascade/client` normalizes either one:

```typescript
import { toCascadeResponse } from "@graphql-cascade/client";

const response = toCascadeResponse(result.data.updateTodo);
if (response && !response.success) {
  showErrors(response.errors);
}
```

## Errors

Cascade errors carry a standard `code`. `@graphql-cascade/client` exports helpers that act on it: `isRetryableError`, `isAuthError`, `isClientError`, `shouldRetry` and `calculateRetryDelay`. See [Client Core](/api/client-core#errors).

## Next Steps

- **[Apollo Client](/clients/apollo)**
- **[Relay](/clients/relay)**
- **[React Query](/clients/react-query)**
- **[urql](/clients/urql)**
- **[Client Core API](/api/client-core)**: types and the cache interface
