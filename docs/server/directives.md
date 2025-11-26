# Cascade Directives

Custom GraphQL directives for controlling cascade behavior.

## @cascade Directive

Control cascade behavior at the field level:

```graphql
type Mutation {
  updateUser(id: ID!, input: UpdateUserInput!): UserMutationResponse!
    @cascade(propagate: true, depth: 2)
}
```

## @invalidates Directive

Declare which queries a mutation invalidates:

```graphql
type Mutation {
  completeTask(id: ID!): TaskMutationResponse!
    @invalidates(types: ["Query"], fields: ["activeTasks", "pendingTasks"])
}
```

## @cascadeIgnore Directive

Exclude fields from cascade tracking:

```graphql
type User {
  id: ID!
  name: String!
  metadata: JSON @cascadeIgnore
}
```

## Implementation

```typescript
import { cascadeDirectives } from '@graphql-cascade/server-node';

const schema = makeExecutableSchema({
  typeDefs: [cascadeDirectives, yourTypeDefs],
  resolvers
});
```

## Next Steps

- **[Entity Identification](/server/entity-identification)** - ID strategies
- **[Client Integration](/clients/)** - Using cascades on the client
