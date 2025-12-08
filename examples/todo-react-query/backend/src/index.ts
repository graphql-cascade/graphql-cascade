import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { createCascadePlugin } from '@graphql-cascade/server';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';

async function main() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [
      createCascadePlugin({
        // Cascade plugin configuration
      }),
    ],
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
    context: async () => ({
      // Add any context you need for resolvers
    }),
  });

  console.log(`🚀 Server ready at ${url}`);
}

main().catch(console.error);