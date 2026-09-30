# Conflict Resolution

A conflict happens when two writers change the same entity: two users editing one todo, or a server response that differs from what an optimistic update predicted. Cascade keeps caches consistent with the server, and the server decides who wins. The specification's [Conflict Resolution](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/15_conflict_resolution.md) chapter covers the model.

## On the Server: Reject Stale Writes

Guard updates with a version, and report a stale write as a `CONFLICT` error:

```graphql
type Todo implements Node {
  id: ID!
  title: String!
  version: Int!
}

input UpdateTodoInput {
  title: String
  expectedVersion: Int!
}
```

```typescript
import { CascadeBuilder, CascadeTracker, conflictError } from "@graphql-cascade/server";

async function updateTodo(_: unknown, { id, input }, { db }) {
  const tracker = new CascadeTracker();
  tracker.startTransaction();
  const builder = new CascadeBuilder(tracker);

  const todo = await db.todos.updateWhere(
    { id, version: input.expectedVersion },
    { title: input.title, version: input.expectedVersion + 1 },
  );
  if (!todo) {
    return builder.buildErrorResponse([
      conflictError("The todo changed since you loaded it", "expectedVersion"),
    ]);
  }

  tracker.trackUpdate({ __typename: "Todo", ...todo }, { updatedFields: ["title", "version"] });
  return builder.buildResponse(todo);
}
```

A failed payload commits nothing, so its cascade is empty, and clients roll back any optimistic update. The client shows the conflict and refetches the entity, or lets the user retry against the new version.

## On the Client: Server Data Differs From the Optimistic Data

When a response arrives, its cascade replaces the optimistic data: the server wins. Apollo's `useCascadeMutation` can resolve differences another way with `conflictResolution`:

| Strategy | Result |
|----------|--------|
| `SERVER_WINS` (default) | The server's entity |
| `CLIENT_WINS` | The optimistic entity |
| `MERGE` | The server's entity, with optimistic values filling its null fields |

`CLIENT_WINS` and `MERGE` show data the server does not hold; use them only where the next write will reconcile it.

## Detecting Conflicts Yourself

`CascadeConflictResolver` from `@graphql-cascade/client` compares a local entity with the server's:

```typescript
import { CascadeConflictResolver } from "@graphql-cascade/client";

const resolver = new CascadeConflictResolver();
const conflict = resolver.detectConflicts(localTodo, serverTodo);

if (conflict.hasConflict) {
  // VERSION_MISMATCH, TIMESTAMP_MISMATCH or FIELD_CONFLICT
  console.warn(conflict.conflictType, conflict.conflictingFields);
  const resolved = resolver.resolveConflicts(conflict, "SERVER_WINS");
}
```

It reports a `VERSION_MISMATCH` when the `version` fields differ, a `TIMESTAMP_MISMATCH` when the local `updatedAt` is newer, and otherwise a `FIELD_CONFLICT` listing the fields whose values differ.

## Next Steps

- **[Optimistic Updates](/guide/optimistic-updates)**
- **[Server](/server/)**: errors and error helpers
