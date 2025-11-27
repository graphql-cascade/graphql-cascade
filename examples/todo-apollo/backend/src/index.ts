import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { createCascadePlugin } from '@graphql-cascade/server';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [createCascadePlugin()],
});

startStandaloneServer(server, { listen: { port: 4000 } }).then(({ url }) => {
  console.log('🚀 Server ready at', url);
});