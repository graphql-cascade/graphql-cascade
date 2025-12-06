import { PubSub } from 'graphql-subscriptions';

export const pubsub = new PubSub();

export const MESSAGE_ADDED = 'MESSAGE_ADDED';
export const CHANNEL_UPDATED = 'CHANNEL_UPDATED';