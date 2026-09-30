# urql

`@graphql-cascade/urql` provides an exchange that receives cascades and a client that applies them to a `CascadeCache`.

## Installation

```bash
npm install @graphql-cascade/urql @graphql-cascade/client @urql/core graphql
```

## urql's Own Caches

Selecting `cascade` already helps urql's caches, because cascade entities are ordinary objects with `__typename` and `id` in the mutation result:

- **Document cache** (`cacheExchange`): refetches cached queries containing any type name in the mutation result, including the cascade's entity types.
- **Graphcache** (`@urql/exchange-graphcache`): normalizes the cascade's entities like any other result data, so their new fields reach every query reading them.

Select `__typename` and `id` in `entity` for both. Neither cache acts on `deleted`, `invalidations` or `typeInvalidations`; `URQLCascadeClient` and `cascadeExchange` handle those for a `CascadeCache`.

## URQLCascadeClient

`URQLCascadeClient` runs mutations through an urql client and applies their cascades to a `CascadeCache`:

```typescript
import { createClient, cacheExchange, fetchExchange } from "@urql/core";
import { InMemoryCascadeCache, URQLCascadeClient } from "@graphql-cascade/urql";

const client = createClient({ url: "/graphql", exchanges: [cacheExchange, fetchExchange] });
const cache = new InMemoryCascadeCache();
const cascadeClient = new URQLCascadeClient(client, cache);

const { data, error, cascade } = await cascadeClient.mutate(TOGGLE_TODO, { id: "1" });
```

It applies the cascade of every mutation field, and falls back to `extensions.cascade` when no payload carries one. `cascade` in the result is the first field's.

| Option | Default | Description |
|--------|---------|-------------|
| `autoApply` | `true` | Apply cascades as mutations complete |
| `excludeTypes` | `[]` | Types whose entries are never applied |

`mutateOptimistic(mutation, variables, { optimisticResponse, optimisticCascade })` applies the cascade `optimisticCascade(variables, response)` returns before the server answers, and restores the previous entities if the mutation rejects. urql resolves failed operations with `error` set rather than rejecting, so check `error` and restore what you need yourself.

`applyCascade(cascade)` applies a cascade you received another way.

## InMemoryCascadeCache

A `CascadeCache` holding entities by type name and `id`, and query results by name and arguments. Pass `refetchFn(queryName, args)` to act on `REFETCH` hints; without it they mark queries stale like `INVALIDATE`:

```typescript
const cache = new InMemoryCascadeCache({
  refetchFn: (queryName, args) => refetchQuery(queryName, args),
});
```

Implement `CascadeCache` from `@graphql-cascade/client` to apply cascades to another store.

## cascadeExchange

`cascadeExchange` reads the cascade that the [Apollo Server plugin](/server/apollo-server) sends in `extensions.cascade`, calls `onCascade`, and applies it to `cacheAdapter` when you give one:

```typescript
import { createClient, cacheExchange, fetchExchange } from "@urql/core";
import { cascadeExchange } from "@graphql-cascade/urql";

const client = createClient({
  url: "/graphql",
  exchanges: [
    cacheExchange,
    cascadeExchange({ cacheAdapter: cache, onCascade: (cascade) => console.log(cascade) }),
    fetchExchange,
  ],
});
```

The exchange reads extensions only; for cascades in payloads, use `URQLCascadeClient`. `onCacheUpdate` and `onCacheDelete` report each write and eviction, and `debug` logs them. `extractCascadeData(result)` and `hasCascadeData(result)` read `extensions.cascade` yourself.

## Cascade Errors

`cascadeErrorExchange({ onRetryFailure })` calls `onRetryFailure(operation, errors, 1)` with the cascade errors of each failed operation; it does not retry. `extractCascadeErrors(error)` reads cascade errors from an urql `CombinedError`, and the helpers in `@graphql-cascade/client` (`shouldRetry`, `calculateRetryDelay`) decide whether and when to retry.

## Next Steps

- **[Client Core API](/api/client-core)**: `CascadeCache` and the types
- **[Apollo Server](/server/apollo-server)**: cascades in extensions
