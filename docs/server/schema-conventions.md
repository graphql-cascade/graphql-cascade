# Schema Conventions

Best practices for designing GraphQL schemas with Cascade support.

## Mutation Response Pattern

All mutations should return a response type with cascade:

```graphql
type Mutation {
  createTodo(input: CreateTodoInput!): TodoMutationResponse!
  updateTodo(id: ID!, input: UpdateTodoInput!): TodoMutationResponse!
  deleteTodo(id: ID!): TodoMutationResponse!
}

type TodoMutationResponse {
  todo: Todo
  __cascade: Cascade!
}
```

## Cascade Types

Include these standard types in your schema:

```graphql
type Cascade {
  created: [EntityRef!]!
  updated: [EntityRef!]!
  deleted: [EntityRef!]!
  invalidated: [InvalidationRef!]!
}

type EntityRef {
  __typename: String!
  id: ID!
}

type InvalidationRef {
  __typename: String!
  field: String
}
```

## Entity Identification

All entities must have:
- A `__typename` field (automatic in GraphQL)
- An `id` field of type `ID!`

```graphql
type Todo {
  id: ID! # Required for cascade
  title: String!
  completed: Boolean!
}
```

## Error Handling

Include error information in mutation responses:

```graphql
type TodoMutationResponse {
  todo: Todo
  errors: [MutationError!]
  __cascade: Cascade!
}

type MutationError {
  message: String!
  field: String
  code: String!
}
```

## Next Steps

- **[Directives](/server/directives)** - Custom cascade directives
- **[Entity Identification](/server/entity-identification)** - ID strategies
