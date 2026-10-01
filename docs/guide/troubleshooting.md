# Troubleshooting

## The Cascade Is Empty or Missing

**The mutation doesn't select `cascade`.** Clients apply only what the mutation selects. Select `cascade` with `updated`, `deleted`, `invalidations`, `typeInvalidations` and `metadata`, and the entity fields your queries read; see [Selecting the Cascade](/clients/#selecting-the-cascade).

**The resolver doesn't return a built response.** Return the builder's result, which carries `cascade`:

```typescript
tracker.startTransaction();
const user = await db.users.update(id, input);
tracker.trackUpdate({ __typename: "User", ...user }, { updatedFields: Object.keys(input) });
return new CascadeBuilder(tracker, invalidator).buildResponse(user);
```

**Nothing was tracked.** Every entity the mutation changes needs a `trackCreate`, `trackUpdate` or `trackDelete` call. An empty `updated` list with `success: true` tells clients nothing changed.

**You rely on the Apollo Server plugin.** `createCascadePlugin()` sends the cascade in `extensions.cascade`, not in payloads, and only when a tracker is in the context under `contextKey`. Only urql's `cascadeExchange` reads extensions; the other libraries read payloads. See [Apollo Server](/server/apollo-server).

## Tracker Errors

| Message | Cause |
|---------|-------|
| `No cascade transaction in progress` | `trackCreate`, `trackUpdate` or `trackDelete` before `startTransaction()` |
| `Transaction already in progress` | `startTransaction()` twice on one tracker; use one tracker per mutation |
| `No transaction in progress` | Ending or reading a transaction that was never started |
| `Entity has no 'id' attribute` | A tracked entity without `id` |
| `Cannot serialize entity` | An entity that cannot be turned into plain data; give it a `toDict()` method. Its type is covered by a type invalidation meanwhile |
| `AsyncEntityFilterError` | An async `entityFilter` with a synchronous build; use `buildResponseAsync()` |

## The Cache Doesn't Update

**Entities lack a type name.** The tracker reads the type from `__typename`, then `_typename`, then the class name. Pass plain objects with `__typename` so entries carry the GraphQL type name.

**The client keys entities differently.** Clients write entities under their type name and `id`. If Apollo `keyFields` or Relay `getDataID` use something else, cascade entities land under different keys; pass Relay's `getDataID` to the cascade environment, and keep Apollo's key fields selected under `entity`.

**Fields are missing from `entity`.** Clients write only the fields the cascade carries. A query reading a field the mutation didn't select under `entity` keeps its old value.

**Lists don't show created or deleted entities.** Entity updates change entities, not the lists that hold them. Send an invalidation hint for the list; see [Invalidation Hints](/server/#invalidation-hints).

## Hints Don't Reach Queries

- **Apollo** matches `queryName` against root query field names (`todos`), not operation names (`GetTodos`).
- **React Query** matches the first element of query keys; key queries `[queryName, variables]`.
- **Relay** cannot target one query: any hint marks every query stale.
- **urql** applies hints to a `CascadeCache` you give `URQLCascadeClient` or `cascadeExchange`, not to urql's document cache.

## Some Entities Are Missing

- The builder moved them into `typeInvalidations` because a limit was reached: `metadata.truncated` is `true`. Raise `maxUpdatedEntities`, `maxDeletedEntities` or `maxResponseSizeMb`, or accept the type invalidation.
- Their type is in `excludeTypes`, or they lie beyond `maxDepth` or `maxRelatedPerEntity`.
- `entityFilter` or `fieldFilter` removed them for this viewer.
- They failed to serialize: `onSerializationError` was called for each, and their type is in `typeInvalidations`.

## Inspecting Cascades

On the server, the built response is a plain object; log `response.cascade.metadata` to see `transactionId`, `depth`, `affectedCount`, `truncated`, and the `trackingTime` and `constructionTime` in milliseconds. Tracker options `debug: true` and a `logger` log tracking as it happens.

On the client, Apollo's `useCascadeMutation` passes each applied cascade to `onCompleted(data, cascade)`, urql's `cascadeExchange` logs cascades with `debug: true`, and `configureLogger` from `@graphql-cascade/client` sets where and at what level the client libraries log.

## Next Steps

- **[Server](/server/)** and **[Clients](/clients/)**
- **[Performance](/guide/performance)**
