 import { gql } from 'graphql-tag';

export const typeDefs = gql`
  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Channel {
    id: ID!
    name: String!
    description: String
    createdAt: String!
    messages: [Message!]!
  }

  type Message {
    id: ID!
    content: String!
    author: User!
    channel: Channel!
    createdAt: String!
    updatedAt: String!
  }

  type Query {
    users: [User!]!
    channels: [Channel!]!
    channel(id: ID!): Channel
    messages(channelId: ID!): [Message!]!
  }

  type Mutation {
    createMessage(content: String!, channelId: ID!): Message!
    createChannel(name: String!, description: String): Channel!
  }

  type Subscription {
    messageAdded(channelId: ID!): Message!
    channelUpdated: Channel!
  }
`;