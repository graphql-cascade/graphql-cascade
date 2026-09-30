# What is GraphQL Cascade?

GraphQL Cascade keeps client caches in sync after mutations. The server returns, with each mutation, everything the mutation changed. Client libraries apply it to the cache, so you stop writing cache-update code by hand.

## The Problem

After a mutation, a client has to work out which cached data is now wrong:

```typescript
const [updateUser] = useMutation(UPDATE_USER, {
  update(cache, { data }) {
    // Patch the list that shows the user
    const existing = cache.readQuery({ query: LIST_USERS });
    cache.writeQuery({
      query: LIST_USERS,
      data: {
        listUsers: existing.listUsers.map((u) =>
          u.id === data.updateUser.id ? data.updateUser : u,
        ),
      },
    });

    // Drop search results that may no longer match
    cache.evict({ fieldName: "searchUsers" });

    // Remember that the company's employee count changed too
    // ...and every other side effect the server applied
  },
});
```

This code is repetitive and fragile. It depends on knowing every side effect of the mutation, which only the server really knows, and it breaks silently when those side effects change.

## The Solution

The server knows what the mutation changed, so it says so. Each mutation payload carries a **cascade**:

- `updated`: every entity the mutation created or updated, with its current data;
- `deleted`: every entity it deleted;
- `invalidations`: hints naming cached queries that may be stale, such as lists that gained an item;
- `typeInvalidations`: whole types to treat as stale, when listing every entity would be too large;
- `metadata`: a timestamp and counts.

A Cascade client library applies it: it writes updated entities into the cache, evicts deleted ones, and invalidates the queries named by the hints.

```typescript
const [updateUser] = useCascadeMutation(UPDATE_USER);
```

### Example Response

```json
{
  "data": {
    "updateUser": {
      "success": true,
      "data": { "id": "123", "name": "John Doe" },
      "cascade": {
        "updated": [
          {
            "typename": "User",
            "id": "123",
            "operation": "UPDATED",
            "entity": { "id": "123", "name": "John Doe" },
            "updatedFields": ["name"]
          },
          {
            "typename": "Company",
            "id": "7",
            "operation": "UPDATED",
            "entity": { "id": "7", "employeeCount": 42 }
          }
        ],
        "deleted": [],
        "invalidations": [
          { "queryName": "searchUsers", "strategy": "INVALIDATE", "scope": "PREFIX" }
        ],
        "typeInvalidations": [],
        "metadata": {
          "timestamp": "2026-09-30T10:00:00Z",
          "depth": 1,
          "affectedCount": 2,
          "truncated": false
        }
      }
    }
  }
}
```

## Key Properties

- **Complete.** Every entity the server identifies as affected is either listed or covered by a type invalidation. When a cascade would exceed size limits, whole types move into `typeInvalidations` instead of entities being dropped.
- **Cheap for clients.** Updated entities are written into the cache in place, so queries showing them are current without a network request. Invalidation is reserved for queries the server names.
- **Plain GraphQL.** The cascade is a field of the mutation payload, defined by a [reference schema](https://github.com/graphql-cascade/graphql-cascade/blob/main/reference/cascade_base.graphql). Entities follow Relay's Global Object Identification, so standard normalized caches recognize them.
- **Specified and tested.** The [specification](/specification/) states each requirement, and a conformance suite tests them.

## Compared With

- **Hand-written `update` functions**: Cascade replaces them; the server, which knows the side effects, describes them.
- **Refetching queries after each mutation**: Cascade sends the changed entities in the mutation response, instead of one request per affected query.
- **Apollo's automatic normalization**: Apollo updates entities that appear in the mutation's own response. Cascade makes every affected entity appear there, and adds deletions and invalidations.

## Next Steps

- **[Installation](/guide/installation)**: install the server and client libraries
- **[Quick Start](/guide/quick-start)**: build a mutation with a cascade, end to end
- **[Core Concepts](/guide/concepts)**: how cascades are built and applied
