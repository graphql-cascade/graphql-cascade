import {
  getChannels,
  getChannelById,
  getMessagesWithAuthors,
  createMessage,
  getUserById,
  getMessagesByChannelId,
  Message,
  Channel,
} from './db';
import { pubsub, MESSAGE_ADDED } from './pubsub';

export const resolvers = {
  Query: {
    channels: () => getChannels(),
    channel: (_: any, { id }: { id: string }) => getChannelById(id),
  },

  Mutation: {
    sendMessage: (_: any, { content, channelId, authorId }: { content: string; channelId: string; authorId: string }) => {
      const message = createMessage(content, authorId, channelId);
      const messageWithSender = getMessagesWithAuthors(channelId).find(m => m.id === message.id);
      if (!messageWithSender) {
        throw new Error('Failed to create message');
      }

      // Create cascade data for real-time updates
      const cascade = {
        invalidate: [`Channel:${channelId}`],
        update: `Channel:${channelId}`,
      };

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
    messages: (channel: Channel) => getMessagesWithAuthors(channel.id),
  },

  Message: {
    sender: (message: Message) => getUserById(message.authorId)!,
    channel: (message: Message) => getChannelById(message.channelId)!,
  },
};
