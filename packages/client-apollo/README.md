# GraphQL Cascade Apollo Client Integration

Seamless integration with Apollo Client's normalized cache for automatic cascade updates.

## Installation

```bash
npm install @graphql-cascade/client-apollo @apollo/client
```

## Features

- Automatic cache updates from cascade responses
- Query invalidation based on cascade hints
- Support for optimistic updates
- Full Apollo Client compatibility

## Usage

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { ApolloCascadeClient } from '@graphql-cascade/client-apollo';

const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cache: new InMemoryCache()
});

const cascade = new ApolloCascadeClient(client);

// Mutations automatically update the cache
const result = await cascade.mutate(CREATE_TODO, variables);
```

## API Reference

See [Client API](../../docs/api/client-api.md) for complete documentation.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## License

MIT