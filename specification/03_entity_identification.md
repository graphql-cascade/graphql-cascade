# Entity Identification

This document defines how entities are identified in GraphQL Cascade.

## Global Object Identification

All domain entities in a GraphQL Cascade system MUST implement the `Node` interface:

```graphql
"""
Global object identification for GraphQL Cascade.
All domain entities MUST implement this interface.
"""
interface Node {
  """Globally unique identifier for this entity."""
  id: ID!
}
```

## Identification Strategy

GraphQL Cascade uses a **typename + id** strategy for entity identification:

### Components
- **`__typename`**: The GraphQL type name (e.g., "User", "Company", "Address")
- **`id`**: The entity's unique identifier within its type

### Composite Key
Entities are uniquely identified by the combination: `{__typename}:{id}`

### Examples
```javascript
// User with id "123"
{ __typename: "User", id: "123" }
// Company with id "456"
{ __typename: "Company", id: "456" }
// Address with id "789"
{ __typename: "Address", id: "789" }
```

## ID Generation Requirements

### Uniqueness
- IDs MUST be unique within each entity type
- IDs MAY be reused across different entity types
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

### UpdatedEntity
```graphql
type UpdatedEntity {
  """Type name of the entity (e.g., "User", "Company")."""
  __typename: String!

  """ID of the entity."""
  id: ID!

  """The operation performed."""
  operation: CascadeOperation!

  """The full entity data."""
  entity: Node!
}
```

### DeletedEntity
```graphql
type DeletedEntity {
  """Type name of the deleted entity."""
  __typename: String!

  """ID of the deleted entity."""
  id: ID!

  """When the entity was deleted."""
  deletedAt: DateTime!
}
```

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

### Relay Global IDs
Relay uses base64-encoded global IDs that include type information:
```
"User:123" → "VXNlcjoxMjM="
```

**Cascade Approach**: Uses plain `{__typename}:{id}` format
- **Pros**: Simpler, no encoding/decoding, human-readable
- **Cons**: Slightly more verbose in JSON

### Apollo typename + id
Apollo uses the same strategy as Cascade:
```
{ __typename: "User", id: "123" }
```

**Compatibility**: Cascade is fully compatible with Apollo's approach.

## Migration Considerations

### From Relay Global IDs
If migrating from Relay:

1. **Server**: Decode global IDs to extract type and id
2. **Schema**: Add `__typename` fields to entities
3. **Client**: Update identification logic

### From Custom ID Schemes
1. **Ensure ID uniqueness** within each type
2. **Add `__typename` fields** to all entities
3. **Update client cache** identification logic

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