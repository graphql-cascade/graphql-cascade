import { createClient, cacheExchange, subscriptionExchange, fetchExchange } from 'urql';
import { createClient as createWSClient } from 'graphql-ws';
import { cascadeExchange } from './cascade-exchange';

const wsClient = createWSClient({
  url: 'ws://localhost:4000/graphql',
});

export const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    cacheExchange,
    cascadeExchange,
    fetchExchange,
    subscriptionExchange({
      forwardSubscription: (operation) => ({
        subscribe: (sink) => ({
          unsubscribe: wsClient.subscribe(operation, sink),
        }),
      }),
    }),
  ],
});