# Relay

`@graphql-cascade/relay` applies cascades to the Relay store.

## Installation

```bash
npm install @graphql-cascade/relay @graphql-cascade/client relay-runtime graphql
```

## Environment Setup

`createCascadeRelayEnvironment` wraps a network so that every mutation response's cascades are applied to the store:

```typescript
import { Network, RecordSource, Store } from "relay-runtime";
import { createCascadeRelayEnvironment } from "@graphql-cascade/relay";

const network = Network.create(async (operation, variables) => {
  const response = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: operation.text, variables }),
  });
  return response.json();
});

export const environment = createCascadeRelayEnvironment(
  network,
  new Store(new RecordSource()),
);
```

Mutations then need no `updater` for the entities their cascades carry:

```tsx
import { graphql, useMutation } from "react-relay";

const [commit] = useMutation(graphql`
  mutation TodoItemToggleMutation($id: ID!) {
    toggleTodo(id: $id) {
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
`);
```

Each mutation field's cascade is applied in field order. A cascade that cannot be applied is logged, and the response still reaches the application: the server has committed the mutation.

`createBasicCascadeEnvironment(fetchFn)` builds the network and store for you, for tests and quick setups.

## Options

| Option | Description |
|--------|-------------|
| `getDataID` | The environment's `getDataID`, when records aren't keyed by `id` |
| `debug` | Log each applied cascade |

## Record IDs

Relay keys records by `id` alone, so cascades work without configuration when IDs are unique across types, as the specification recommends (see [Entity Identification](/server/entity-identification)). If your IDs repeat across types, give Relay a `getDataID` that includes the type, and pass the same function to the cascade environment:

```typescript
const getDataID = (value: { id?: string }, typename: string) => `${typename}:${value.id}`;

const environment = createCascadeRelayEnvironment(network, store, { getDataID });
```

## How Cascades Map to the Store

| Cascade | Relay store |
|---------|-------------|
| `updated` | Scalar fields with `setValue`; fields holding entities (objects with `__typename` and `id`) as linked records; other nested objects are left to the next query that selects them |
| `deleted` | `store.delete` of the record |
| `invalidations` | Unset the root fields the hint selects, such as `user(id:"1")`, so the queries reading them refetch on their next read |
| `typeInvalidations` | `invalidateStore`, since Relay cannot mark one type's records stale |

Hints match root fields by name and arguments, as the specification's scopes define. Connections stored under handle keys (`@connection`) are not root fields of the query name; keep them current in the mutation instead, with Relay's `@appendEdge` / `@deleteEdge` directives or an `updater`.

## Applying a Cascade Yourself

`commitCascade(environment, cascade)` applies a cascade received another way, such as through a subscription, exactly as cascade environments apply mutation responses:

```typescript
import { commitCascade } from "@graphql-cascade/relay";

commitCascade(environment, cascade);
```

`createCascadeUpdater(cascade, { getDataID, rootFields })` returns the store updater itself, for a mutation's `updater`; `applyCascadeToStore(store, cascade)` applies one directly. They need the root record's storage keys in `rootFields` to single out queries; without them, a hint marks every query stale.

## Retrying Failed Requests

`createCascadeNetwork(networkFn, options)` wraps a function returning a Relay `Observable`, such as a network's `execute`, so requests failing with retryable cascade errors (`TIMEOUT`, `SERVICE_UNAVAILABLE`, `RATE_LIMITED`) are retried with backoff. `options` takes `maxRetries`, `onRetry`, and `shouldRetryFn` / `calculateDelayFn` to replace the defaults.

## Next Steps

- **[Client Core API](/api/client-core)**: the types
- **[Entity Identification](/server/entity-identification)**: IDs Relay can use as they are
