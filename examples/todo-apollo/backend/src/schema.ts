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
`;