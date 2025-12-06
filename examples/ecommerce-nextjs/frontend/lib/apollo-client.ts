import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { createCascadeLink } from '@graphql-cascade/apollo';

const httpLink = new HttpLink({
  uri: 'http://localhost:4000/graphql',
});

const cascadeLink = createCascadeLink();

const client = new ApolloClient({
  link: cascadeLink.concat(httpLink),
  cache: new InMemoryCache(),
});

export default client;