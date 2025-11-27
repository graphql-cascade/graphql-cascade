import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { ApolloCascadeClient } from '@graphql-cascade/apollo';

const httpLink = new HttpLink({ uri: 'http://localhost:4000/graphql' });

export const client = new ApolloCascadeClient({
  link: httpLink,
  cache: new InMemoryCache(),
});