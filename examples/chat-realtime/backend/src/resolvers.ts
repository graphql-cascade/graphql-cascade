import { CascadeBuilder } from '@graphql-cascade/server';
import {
  getChannels,
  getChannelById,
  getMessagesWithSenders,
  createMessage,
  getUserById,
  getMessagesByChannelId,
  Message,
  Channel,
} from './db.js';
import { pubsub, MESSAGE_ADDED, CHANNEL_UPDATED } from './pubsub.js';

export const resolvers = {
  Query: {
    channels: () => getChannels(),
    channel: (_: any, { id }: { id: string }) => getChannelById(id),
  },

  Mutation: {
    sendMessage: (_: any, { content, channelId, senderId }: { content: string; channelId: string; senderId: string }) => {
      const message = createMessage(content, senderId, channelId);
      const messageWithSender = getMessagesWithSenders(channelId).find(m => m.id === message.id);
      if (!messageWithSender) {
        throw new Error('Failed to create message');
      }

      // Use CascadeBuilder for proper cascade data
      const cascade = cascadeBuilder
        .invalidate(`Channel:${channelId}`)
        .update(`Channel:${channelId}`, {
          messages: getMessagesWithSenders(channelId),
        })
        .build();

      // Publish to subscriptions with cascade data
      pubsub.publish(`${MESSAGE_ADDED}_${channelId}`, {
        messageAdded: {
          message: messageWithSender,
          cascade,
        },
      });

      return {
        message: messageWithSender,
        cascade,
      };
    },
  },

  Subscription: {
    messageAdded: {
      subscribe: (_: any, { channelId }: { channelId: string }) =>
        pubsub.asyncIterator([`${MESSAGE_ADDED}_${channelId}`]),
    },
  },

  Channel: {
    messages: (channel: Channel) => getMessagesWithSenders(channel.id),
  },

  Message: {
    sender: (message: Message) => getUserById(message.senderId)!,
    channel: (message: Message) => getChannelById(message.channelId)!,
  },
};