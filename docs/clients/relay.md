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
| `invalidations` | `invalidateRecord` on the root, so every query refetches on its next read |
| `typeInvalidations` | `invalidateStore`, since Relay cannot mark one type's records stale |

Relay marks records stale, not queries, so a hint naming one query marks every query stale: always correct, only less precise. Where that refetches too much, keep lists current in the mutation instead, with Relay's `@appendEdge` / `@deleteEdge` directives or an `updater`, and have the server send no hint for them.

## Applying a Cascade Yourself

`createCascadeUpdater(cascade, { getDataID })` returns a store updater, for `commitUpdate` or a mutation's `updater`; `applyCascadeToStore(store, cascade)` applies one directly.

```typescript
import { createCascadeUpdater } from "@graphql-cascade/relay";

environment.commitUpdate(createCascadeUpdater(cascade));
```

## Retrying Failed Requests

`createCascadeNetwork(networkFn, options)` wraps a function returning a Relay `Observable`, such as a network's `execute`, so requests failing with retryable cascade errors (`TIMEOUT`, `SERVICE_UNAVAILABLE`, `RATE_LIMITED`) are retried with backoff. `options` takes `maxRetries`, `onRetry`, and `shouldRetryFn` / `calculateDelayFn` to replace the defaults.

## Next Steps

- **[Client Core API](/api/client-core)**: the types
- **[Entity Identification](/server/entity-identification)**: IDs Relay can use as they are
