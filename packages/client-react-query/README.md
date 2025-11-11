# GraphQL Cascade React Query Integration

Integration with React Query for automatic cache updates in non-normalized cache scenarios.

## Installation

```bash
npm install @graphql-cascade/client-react-query @tanstack/react-query
```

## Features

- Query invalidation based on cascade hints
- Entity updates within query data
- React hooks for cascade mutations
- Optimistic update support

## Usage

```typescript
import { QueryClient } from '@tanstack/react-query';
import { ReactQueryCascadeClient, useCascadeMutation } from '@graphql-cascade/client-react-query';

const queryClient = new QueryClient();
const cascade = new ReactQueryCascadeClient(queryClient, executor);

function MyComponent() {
  const mutation = useCascadeMutation(cascade, CREATE_TODO);

  const handleSubmit = () => {
    mutation.mutate({ title: 'New Todo' });
  };

  // Cache automatically updated on success
  return <button onClick={handleSubmit}>Create Todo</button>;
}
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