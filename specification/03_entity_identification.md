# Entity Identification

This document defines how entities are identified in GraphQL Cascade.

## Global Object Identification

All domain entities in a GraphQL Cascade system MUST implement the `Node` interface:

```graphql
"""
An object with an ID, following GraphQL Global Object Identification (the
Relay Node interface). All domain entities MUST implement this interface.
"""
interface Node {
  """
  Identifier of this entity. SHOULD be unique across all types (MUST from
  2.0.0): a UUID, or an encoded "Type:key".
  """
  id: ID!
}
```

## Identification Strategy

GraphQL Cascade follows GraphQL Global Object Identification, the model Relay uses:

- **`id`** identifies an entity. It SHOULD be unique across all types, and MUST be from 2.0.0. UUIDs meet this as they are; per-type keys meet it once encoded, for example `base64("User:123")`.
- **`__typename`** (on entities) and **`typename`** (on cascade entries) name the entity's type.

Clients key entities by type name and `id`, as Apollo and urql do: `{typename}:{id}`. This key is correct whether or not IDs are globally unique. Relay keys its store by `id` alone, so Relay clients rely on globally unique IDs, or configure a `getDataID` that adds the type.

### Examples
```javascript
{ __typename: "User", id: "550e8400-e29b-41d4-a716-446655440000" } // UUID
{ __typename: "User", id: "VXNlcjoxMjM=" }                           // base64("User:123")
```

### Refetching by ID

Servers SHOULD provide the Relay `node` field:

```graphql
type Query {
  node(id: ID!): Node
}
```

When a server provides it, `node(id: x.id)` MUST return `x` for every entity `x`: clients refetch an entity by passing back exactly the `id` they received.

## ID Generation Requirements

### Uniqueness
- IDs MUST be unique within each entity type
- IDs SHOULD be unique across all types; this becomes a requirement in 2.0.0, and IDs reused across types are deprecated
- IDs SHOULD be stable (not change for the same entity)

### Format
- IDs MUST be strings
- IDs SHOULD be URL-safe
- IDs MAY contain alphanumeric characters, hyphens, and underscores
- IDs SHOULD NOT contain spaces or special characters

### Examples of Valid IDs
```
"123"
"abc-123-def"
"user_456"
"550e8400-e29b-41d4-a716-446655440000"  # UUID
```

## Type Name Requirements

### Naming Convention
- Type names MUST be PascalCase
- Type names MUST be unique within the schema
- Type names SHOULD be descriptive and singular

### Reserved Names
The following type names are reserved for Cascade infrastructure:
- `Node`
- `CascadeResponse`
- `CascadeUpdates`
- `UpdatedEntity`
- `DeletedEntity`
- `QueryInvalidation`
- `CascadeError`
- `CascadeMetadata`

## Entity Interface Implementation

All domain entities SHOULD implement additional interfaces for consistency:

```graphql
"""
Timestamped entities for version tracking.
"""
interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int  # Optional: for optimistic concurrency control
}

"""
Example entity implementation
"""
type User implements Node & Timestamped {
  id: ID!
  email: String!
  name: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int
}
```

## Identification in Cascade Responses

Entries in `cascade.updated` and `cascade.deleted` ([`UpdatedEntity`](04_mutation_responses.md#updatedentity-details) and [`DeletedEntity`](04_mutation_responses.md#deletedentity-details)) carry the entity's type name in `typename` and its identifier in `id`. Together they form the same `{typename}:{id}` key as the entity's own `__typename` and `id`.

GraphQL reserves `__typename` for the type of the object being selected, so these wrapper types cannot declare a `__typename` field of their own; see [the deprecation note](04_mutation_responses.md#deprecated-__typename-on-updatedentity-and-deletedentity).

## Client-Side Identification

Clients MUST be able to identify entities for cache operations:

### Cache Key Generation
```typescript
function identify(entity: any): string {
  return `${entity.__typename}:${entity.id}`;
}
```

### Cache Operations
```typescript
interface CascadeCache {
  write(typename: string, id: string, data: any): void;
  read(typename: string, id: string): any | null;
  evict(typename: string, id: string): void;
  // ...
}
```

## Comparison with Other Strategies

### Relay
Cascade uses Relay's Global Object Identification, so a schema that already implements `Node` with globally unique IDs and `node(id:)` satisfies Cascade's identity requirements unchanged. Because Relay keys its store by `id`, the entities in a cascade update the same records Relay's queries read.

### Apollo and urql
Apollo and urql key their normalized caches by `__typename` and `id`, which Cascade's `typename` and `id` reproduce, with any ID format.

## Migration Considerations

### IDs Unique Only Within a Type
Servers whose IDs repeat across types (for example integer primary keys) SHOULD expose a globally unique `id` instead, before 2.0.0 requires it:

1. Use UUIDs as public IDs, keeping integer keys internal, or encode the type into the ID (`base64("User:123")`).
2. Resolve `node(id:)` from that ID.
3. Keep the old identifier available as another field during the transition, for clients that stored it.

## Implementation Examples

### Server-Side (Python)
```python
class User:
    def __init__(self, id: str, email: str, name: str):
        self.id = id
        self.email = email
        self.name = name

    @property
    def __typename__(self):
        return "User"

    def to_dict(self):
        return {
            "__typename": self.__typename__,
            "id": self.id,
            "email": self.email,
            "name": self.name,
        }
```

### Client-Side (TypeScript)
```typescript
interface Entity {
  __typename: string;
  id: string;
}

function identify(entity: Entity): string {
  return `${entity.__typename}:${entity.id}`;
}

function writeToCache(cache: CascadeCache, entity: Entity): void {
  cache.write(entity.__typename, entity.id, entity);
}
```

## Best Practices

### ID Stability
- Use database primary keys or UUIDs for IDs
- Avoid sequential IDs if they might leak information
- Consider UUID v4 for new applications

### Type Naming
- Use consistent naming conventions across your schema
- Prefer singular nouns for entity types
- Avoid abbreviations unless they are well-established

### Cache Key Management
- Implement identification logic once and reuse it
- Test identification logic thoroughly
- Handle edge cases (null/undefined entities)

## Security Considerations

### ID Entropy
- IDs SHOULD NOT be easily guessable
- Use UUIDs or cryptographically secure random IDs
- Avoid sequential integer IDs in public APIs

### Information Leakage
- IDs SHOULD NOT contain sensitive information
- Consider using opaque IDs for public APIs
- Implement proper access controls regardless of ID format