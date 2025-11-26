# Entity Identification

Strategies for uniquely identifying entities in GraphQL Cascade.

## Global Object Identification

Use globally unique IDs across all types:

```graphql
type Todo {
  id: ID! # "Todo:123"
}

type User {
  id: ID! # "User:456"
}
```

## Type Prefix Strategy

Prefix IDs with typename:

```typescript
function createGlobalId(typename: string, localId: string): string {
  return `${typename}:${localId}`;
}

// Usage
const globalId = createGlobalId('Todo', '123'); // "Todo:123"
```

## UUID Strategy

Use UUIDs for natural global uniqueness:

```typescript
import { v4 as uuid } from 'uuid';

const todo = {
  id: uuid(), // "a1b2c3d4-..."
  title: 'Todo'
};
```

## Composite Keys

For entities without single IDs:

```graphql
type EntityRef {
  __typename: String!
  id: ID!
  compositeKey: String # "userId:projectId"
}
```

## Best Practices

1. Choose one strategy consistently
2. Make IDs globally unique
3. Include typename in cache keys
4. Document your ID format

## Next Steps

- **[Client Integration](/clients/)** - How clients use entity IDs
- **[Specification](/specification/)** - Full entity identification spec
