# Entity Identification

Cascades identify entities the way GraphQL clients do: by type name and `id`. The specification follows Relay's Global Object Identification; see its [Entity Identification](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/03_entity_identification.md) chapter.

## IDs Unique Across Types

Entities implement `Node`, and their `id` should be unique across all types. It becomes a requirement in specification 2.0.0.

```graphql
interface Node {
  id: ID!
}
```

Two ways to get there:

- **UUIDs as public IDs.** Keep integer primary keys internal for join performance, and expose a UUID as `id`. UUIDs are unique across types as they are.
- **Encoded IDs.** Encode the type into the ID, for example `base64("User:123")`, and decode it where you look entities up.

Relay keys its store by `id` alone, so unique IDs are what let Relay clients use cascades without extra configuration. Apollo and urql key their caches by type name and `id`, which works with either form.

## Refetching by ID

Provide Relay's `node` field so clients can refetch any entity:

```graphql
type Query {
  node(id: ID!): Node
}
```

It must accept exactly the IDs your objects return: `node(id: x.id)` returns `x`.

## How the Tracker Identifies Entities

`CascadeTracker` reads an entity's type from `__typename`, then `_typename`, then its class name, and its ID from `id`. Pass plain objects with `__typename` to be explicit:

```typescript
tracker.trackUpdate({ __typename: "User", ...user });
```

Cascade entries carry the type in `typename` and the ID in `id`; clients build cache keys from them.

## Next Steps

- **[Schema Conventions](/server/schema-conventions)**: entity and payload types
- **[Node.js](/server/node)**: tracking entities
