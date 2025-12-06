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
    cascade: CascadeUpdates
  }

  type UpdateTodoCascade {
    success: Boolean!
    data: Todo
    cascade: CascadeUpdates
  }

  type DeleteTodoCascade {
    success: Boolean!
    data: Todo
    cascade: CascadeUpdates
  }

  type ToggleTodoCascade {
    success: Boolean!
    data: Todo
    cascade: CascadeUpdates
  }

  type CascadeUpdates {
    updated: [UpdatedEntity!]!
    deleted: [DeletedEntity!]!
    invalidations: [QueryInvalidation!]!
    metadata: CascadeMetadata!
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

  type QueryInvalidation {
    queryName: String
    queryHash: String
    arguments: JSON
    queryPattern: String
    strategy: InvalidationStrategy!
    scope: InvalidationScope!
  }

  type CascadeMetadata {
    timestamp: String!
    transactionId: ID
    depth: Int!
    affectedCount: Int!
  }

  enum CascadeOperation {
    CREATED
    UPDATED
    DELETED
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

  scalar JSON

  type Mutation {
    createTodo(title: String!): CreateTodoCascade!
    updateTodo(id: ID!, title: String, completed: Boolean): UpdateTodoCascade!
    deleteTodo(id: ID!): DeleteTodoCascade!
    toggleTodo(id: ID!): ToggleTodoCascade!
  }
`;