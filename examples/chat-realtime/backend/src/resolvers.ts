import { CascadeBuilder } from '@graphql-cascade/server';
import {
  getUsers,
  getChannels,
  getChannelById,
  getMessagesWithAuthors,
  createMessage,
  createChannel,
  Message,
  Channel,
} from './db';
import { pubsub, MESSAGE_ADDED, CHANNEL_UPDATED } from './pubsub';

const cascadeBuilder = new CascadeBuilder();

export const resolvers = {
  Query: {
    users: () => getUsers(),
    channels: () => getChannels(),
    channel: (_: any, { id }: { id: string }) => getChannelById(id),
    messages: (_: any, { channelId }: { channelId: string }) =>
      getMessagesWithAuthors(channelId),
  },

  Mutation: {
    createMessage: (_: any, { content, channelId, authorId }: { content: string; channelId: string; authorId: string }) => {
      const message = createMessage(content, authorId, channelId);
      const messageWithAuthor = getMessagesWithAuthors(channelId).find(m => m.id === message.id);
      if (!messageWithAuthor) {
        return cascadeBuilder.buildErrorResponse('Failed to create message');
      }

      // Publish to subscriptions
      pubsub.publish(`${MESSAGE_ADDED}_${channelId}`, {
        messageAdded: messageWithAuthor,
      });

      return cascadeBuilder.buildSuccessResponse(messageWithAuthor, {
        operation: 'CREATE',
        entityType: 'Message',
        entityId: message.id,
      });
    },

    createChannel: (_: any, { name, description }: { name: string; description?: string }) => {
      const channel = createChannel(name, description);

      // Publish to subscriptions
      pubsub.publish(CHANNEL_UPDATED, { channelUpdated: channel });

      return cascadeBuilder.buildSuccessResponse(channel, {
        operation: 'CREATE',
        entityType: 'Channel',
        entityId: channel.id,
      });
    },
  },

  Subscription: {
    messageAdded: {
      subscribe: (_: any, { channelId }: { channelId: string }) =>
        pubsub.asyncIterator([`${MESSAGE_ADDED}_${channelId}`]),
    },
    channelUpdated: {
      subscribe: () => pubsub.asyncIterator([CHANNEL_UPDATED]),
    },
  },

  Channel: {
    messages: (channel: Channel) => getMessagesWithAuthors(channel.id),
  },

  Message: {
    author: (message: Message) => {
      const users = getUsers();
      const author = users.find(u => u.id === message.authorId);
      if (!author) throw new Error(`Author not found for message ${message.id}`);
      return author;
    },
    channel: (message: Message) => getChannelById(message.channelId)!,
  },
};
