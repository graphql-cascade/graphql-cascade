import { createClient, cacheExchange, fetchExchange } from '@urql/core';
import { cascadeExchange } from './cascade-exchange';

export const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [cacheExchange, cascadeExchange, fetchExchange],
});