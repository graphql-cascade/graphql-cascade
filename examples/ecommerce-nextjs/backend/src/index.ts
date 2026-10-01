import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { createCascadePlugin } from '@graphql-cascade/server/apollo';
import { CascadeTracker } from '@graphql-cascade/server';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [createCascadePlugin()],
});

startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async () => ({
    cascadeTracker: new CascadeTracker(),
  }),
}).then(({ url }) => {
  console.log('🚀 E-commerce server ready at', url);
});