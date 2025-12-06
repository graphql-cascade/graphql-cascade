import express from 'express';
import cors from 'cors';
import { createHandler } from 'graphql-http/lib/use/express';
import { buildSchema } from 'graphql';
import { cascadeMiddleware } from '@graphql-cascade/server';
import { resolvers } from './resolvers';
import { typeDefs } from './schema';

const app = express();

app.use(cors());
app.use(express.json());

// Build executable schema
const schema = buildSchema(typeDefs);

// GraphQL endpoint with cascade middleware
app.use(
  '/graphql',
  cascadeMiddleware(),
  createHandler({
    schema,
    rootValue: resolvers,
    context: (req: any) => ({
      cascadeTracker: req.cascadeTracker,
      cascadeBuilder: req.cascadeBuilder,
    }),
  })
);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server ready at http://localhost:${PORT}/graphql`);
});
