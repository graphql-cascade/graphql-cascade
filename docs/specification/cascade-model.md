# Cascade Data Model

The core data structures of GraphQL Cascade.

## Cascade Object

The root cascade object contains all change metadata:

```typescript
interface Cascade {
  created: EntityRef[];
  updated: EntityRef[];
  deleted: EntityRef[];
  invalidated: InvalidationRef[];
}
```

## Entity Reference

Identifies an entity in the cache:

```typescript
interface EntityRef {
  __typename: string;
  id: string;
}
```

### Example

```json
{
  "__typename": "Todo",
  "id": "123"
}
```

This uniquely identifies the Todo with ID "123".

## Invalidation Reference

Identifies a query that should be refetched:

```typescript
interface InvalidationRef {
  __typename: string;
  field?: string;
}
```

### Examples

Invalidate specific query field:
```json
{
  "__typename": "Query",
  "field": "todos"
}
```

Invalidate all queries for a type:
```json
{
  "__typename": "Query"
}
```

## Complete Example

```json
{
  "data": {
    "createTodo": {
      "todo": {
        "id": "123",
        "title": "New todo",
        "completed": false,
        "list": {
          "id": "456",
          "name": "My List"
        }
      },
      "__cascade": {
        "created": [
          { "__typename": "Todo", "id": "123" }
        ],
        "updated": [
          { "__typename": "TodoList", "id": "456" }
        ],
        "deleted": [],
        "invalidated": [
          { "__typename": "Query", "field": "todos" }
        ]
      }
    }
  }
}
```

## Interpretation

Given the above cascade:

1. **Created**: A new Todo (id: 123) was created
   - Client adds it to the cache
   - Client updates any lists that should include it

2. **Updated**: TodoList (id: 456) was modified
   - Client merges updated data
   - Components using this list re-render

3. **Deleted**: Nothing was deleted
   - No cache removal needed

4. **Invalidated**: The `todos` query is stale
   - Client marks it for refetch
   - Next component that uses this query will trigger a refetch

## Entity Identification

Entities are identified by the combination of `__typename` and `id`:

```typescript
function getCacheKey(entityRef: EntityRef): string {
  return `${entityRef.__typename}:${entityRef.id}`;
}

// Example: "Todo:123"
```

## Cache Operations

### Created Entities
```typescript
cascade.created.forEach(ref => {
  cache.write(getCacheKey(ref), entityData);
});
```

### Updated Entities
```typescript
cascade.updated.forEach(ref => {
  cache.merge(getCacheKey(ref), entityData);
});
```

### Deleted Entities
```typescript
cascade.deleted.forEach(ref => {
  cache.delete(getCacheKey(ref));
});
```

### Invalidated Queries
```typescript
cascade.invalidated.forEach(ref => {
  if (ref.field) {
    cache.invalidate(ref.__typename, ref.field);
  } else {
    cache.invalidateType(ref.__typename);
  }
});
```

## Next Steps

- **[Conformance](/specification/conformance)** - Requirements
- **[Full Specification](/specification/full)** - Complete details
- **[Client Guide](/clients/)** - Using cascades in your app
