# Apollo Server Integration

Apollo Server works with Cascade in two ways:

- **Payload cascades** (recommended): each mutation payload has a `cascade` field, built in the resolver as on the [Node.js](/server/node) page. Nothing Apollo-specific is needed.
- **The plugin**: `createCascadePlugin()` sends one cascade for the whole operation in the response's `extensions.cascade`. Use it when your payload types cannot carry a `cascade` field.

## The Plugin

```typescript
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { CascadeTracker, createCascadePlugin } from "@graphql-cascade/server";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [createCascadePlugin()],
});

await startStandaloneServer(server, {
  context: async () => ({ cascadeTracker: new CascadeTracker() }),
});
```

Resolvers track changes on the request's tracker:

```typescript
const resolvers = {
  Mutation: {
    async updateUser(_: unknown, { id, input }, { cascadeTracker, db }) {
      if (!cascadeTracker.inTransaction) cascadeTracker.startTransaction();
      const user = await db.users.update(id, input);
      cascadeTracker.trackUpdate({ __typename: "User", ...user });
      return user;
    },
  },
};
```

Before sending the response, the plugin adds the tracked changes as `extensions.cascade`:

```json
{
  "data": { "updateUser": { "id": "1", "name": "Ada" } },
  "extensions": {
    "cascade": {
      "updated": [{ "typename": "User", "id": "1", "operation": "UPDATED", "entity": { "id": "1", "name": "Ada" } }],
      "deleted": [],
      "invalidations": [],
      "typeInvalidations": [],
      "metadata": { "timestamp": "2026-09-30T10:00:00Z", "depth": 1, "affectedCount": 1, "truncated": false }
    }
  }
}
```

### Failed Mutation Fields

With several mutation fields in one operation, a field that throws, or returns a payload with `success: false`, contributes nothing: the plugin checkpoints the tracker before each mutation field and restores it when the field fails. Clients never receive entities from a rolled-back change.

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `contextKey` | `"cascadeTracker"` | Context property holding the tracker |
| `autoInject` | `true` | Add `extensions.cascade` to responses |
| `onInjectionError` | none | Called when building the cascade fails; the response is sent without it |
| `invalidator` | none | Computes the cascade's invalidation hints |
| `maxUpdatedEntities`, `maxDeletedEntities`, `maxResponseSizeMb`, `maxInvalidations` | 500, 100, 5, 50 | Size limits; past them, whole types move into `typeInvalidations` |

The plugin builds the cascade asynchronously, so async `entityFilter` authorization checks on the tracker apply.

## Clients

`@graphql-cascade/urql` reads `extensions.cascade`: its exchange applies it, and its client falls back to it when no payload carries a cascade. The Apollo, Relay and React Query libraries read payload cascades, so pair them with payload cascades rather than the plugin.

## Next Steps

- **[Node.js](/server/node)**: tracking in depth
- **[Client Integration](/clients/)**: applying cascades
