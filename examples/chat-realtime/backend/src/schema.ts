 import { gql } from 'graphql-tag';

export const typeDefs = gql`
  type Message {
    id: ID!
    content: String!
    sender: User!
    channel: Channel!
    createdAt: String!
  }

  type Channel {
    id: ID!
    name: String!
    messages: [Message!]!
  }

  type User {
    id: ID!
    name: String!
  }

  type Subscription {
    messageAdded(channelId: ID!): MessageAddedPayload!
  }

  type MessageAddedPayload {
    message: Message!
    cascade: CascadeData!
  }

  type CascadeData {
    invalidate: [String!]!
    update: String
  }

  type Mutation {
    sendMessage(channelId: ID!, content: String!, senderId: ID!): MessageAddedPayload!
  }

  type Query {
    channels: [Channel!]!
    channel(id: ID!): Channel
  }
`;