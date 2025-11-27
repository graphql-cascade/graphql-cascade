import { createClient, cacheExchange, fetchExchange } from '@urql/vue';
import { cascadeExchange } from './cascade-exchange';

export const client = createClient({
  url: import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql',
  exchanges: [cacheExchange, cascadeExchange, fetchExchange],
});
