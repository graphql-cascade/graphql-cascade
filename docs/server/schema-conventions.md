# Schema Conventions

How to shape a schema for Cascade. The normative rules are in the specification's [Schema Conventions](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/07_schema_conventions.md) chapter.

## Core Types

Add the types from the [reference schema](https://github.com/graphql-cascade/graphql-cascade/blob/main/reference/cascade_base.graphql) to your schema: `Node`, `CascadeResponse`, `CascadeUpdates`, `UpdatedEntity`, `DeletedEntity`, `QueryInvalidation`, `TypeInvalidation`, `CascadeMetadata`, `CascadeError`, their enums, and the `DateTime` and `JSON` scalars. Keep them unchanged; the specification's conformance checks compare against them.

## Entities

Every entity implements `Node`, with an `id` that should be unique across all types (a UUID, or an encoded `Type:key`):

```graphql
type Todo implements Node {
  id: ID!
  title: String!
  completed: Boolean!
  owner: User!
}
```

## Mutations

Mutations follow `{verb}{EntityType}`, take a `{Verb}{EntityType}Input`, and return a `{Verb}{EntityType}Cascade` payload implementing `CascadeResponse`. The payload's `data` field is the mutation's result, typed as that result:

```graphql
input UpdateTodoInput {
  title: String
  completed: Boolean
}

type UpdateTodoCascade implements CascadeResponse {
  success: Boolean!
  errors: [CascadeError!]
  data: Todo
  cascade: CascadeUpdates!
}

type Mutation {
  updateTodo(id: ID!, input: UpdateTodoInput!): UpdateTodoCascade!
}
```

### Result Unions

A mutation may instead return a union of a success payload and `CascadeFailure`. The success payload implements `CascadePayload` and reports non-critical problems as `warnings`; `CascadeFailure` means nothing was committed:

```graphql
type UpdateTodoPayload implements CascadePayload {
  data: Todo!
  cascade: CascadeUpdates!
  warnings: [CascadeError!]!
}

union UpdateTodoResult = UpdateTodoPayload | CascadeFailure

type Mutation {
  updateTodo(id: ID!, input: UpdateTodoInput!): UpdateTodoResult!
}
```

The Cascade client libraries accept both forms.

## Queries

Queries follow `get{EntityType}` for one entity, `list{EntityType}s` for lists and `search{EntityType}s` for searches. Consistent names let invalidation hints use `PREFIX` and `PATTERN` scopes, for example `{ queryName: "listTodos", scope: PREFIX }` for every variant of the todo list.

## Errors

Payloads report errors as `CascadeError`: a standard `code` that clients act on generically, an optional `domainCode` for application-specific conditions, and `field`/`path` pointing at the input that caused it.

## Checking a Schema

```bash
npx cascade validate schema.graphql
```

It reports Cascade types that differ from the reference schema, types with an `id` that don't implement `Node`, and mutations whose results carry no cascade; see [cascade validate](/cli/validate).

## Next Steps

- **[Entity Identification](/server/entity-identification)**: IDs and `node`
- **[Directives](/server/directives)**: the specification's schema directives
