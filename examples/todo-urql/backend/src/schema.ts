import { gql } from 'graphql-tag';

export const typeDefs = gql`
  type Todo {
    id: ID!
    title: String!
    completed: Boolean!
  }

  type Query {
    todos: [Todo!]!
    todo(id: ID!): Todo
  }

  type CreateTodoCascade {
    success: Boolean!
    data: Todo
    cascade: CascadeData
  }

  type UpdateTodoCascade {
    success: Boolean!
    data: Todo
    cascade: CascadeData
  }

  type DeleteTodoCascade {
    success: Boolean!
    data: Todo
    cascade: CascadeData
  }

  type ToggleTodoCascade {
    success: Boolean!
    data: Todo
    cascade: CascadeData
  }

  type Mutation {
    createTodo(title: String!): CreateTodoCascade!
    updateTodo(id: ID!, title: String, completed: Boolean): UpdateTodoCascade!
    deleteTodo(id: ID!): DeleteTodoCascade!
    toggleTodo(id: ID!): ToggleTodoCascade!
  }

  type CascadeData {
    updated: [UpdatedEntity!]!
    deleted: [DeletedEntity!]!
    invalidations: [QueryInvalidation!]!
    metadata: CascadeMetadata!
  }

  type CascadeMetadata {
    timestamp: String!
    depth: Int!
    affectedCount: Int!
  }

  type UpdatedEntity {
    __typename: String!
    id: ID!
    operation: CascadeOperation!
    entity: Todo!
  }

  type DeletedEntity {
    __typename: String!
    id: ID!
    deletedAt: String!
  }

  enum CascadeOperation {
    CREATED
    UPDATED
    DELETED
  }

  type QueryInvalidation {
    queryName: String
    strategy: InvalidationStrategy!
    scope: InvalidationScope!
  }

  enum InvalidationStrategy {
    INVALIDATE
    REFETCH
    REMOVE
  }

  enum InvalidationScope {
    EXACT
    PREFIX
    PATTERN
    ALL
  }
`;