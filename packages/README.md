# GraphQL Cascade Client Reference Implementation

This directory contains the client-side reference implementation for GraphQL Cascade, providing integrations with popular GraphQL client libraries.

## 📦 Packages

### Core Package (`@graphql-cascade/client`)

The core package provides the fundamental interfaces and base classes for GraphQL Cascade client implementations.

**Key Components:**
- `CascadeClient`: Base client class that handles cascade response processing
- `OptimisticCascadeClient`: Extended client with optimistic update support
- `CascadeConflictResolver`: Handles conflict resolution between local and server data
- Type definitions for all Cascade response structures

**Installation:**
```bash
npm install @graphql-cascade/client
```

### Apollo Client Integration (`@graphql-cascade/apollo`)

Provides seamless integration with Apollo Client's normalized cache.

**Key Features:**
- Automatic cache updates from cascade responses
- Query invalidation based on cascade hints
- Support for optimistic updates
- Full Apollo Client compatibility

**Installation:**
```bash
npm install @graphql-cascade/apollo @apollo/client
```

**Usage:**
```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { ApolloCascadeClient } from '@graphql-cascade/apollo';

const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cache: new InMemoryCache()
});

const cascade = new ApolloCascadeClient(client);

// Mutations automatically update the cache
const result = await cascade.mutate(MY_MUTATION, variables);
```

### React Query Integration (`@graphql-cascade/react-query`)

Integrates with React Query for non-normalized cache scenarios.

**Key Features:**
- Query invalidation based on cascade hints
- Entity updates within query data
- React hooks for cascade mutations
- Optimistic update support

**Installation:**
```bash
npm install @graphql-cascade/react-query @tanstack/react-query
```

**Usage:**
```typescript
import { QueryClient } from '@tanstack/react-query';
import { ReactQueryCascadeClient, useCascadeMutation } from '@graphql-cascade/react-query';

const queryClient = new QueryClient();
const cascade = new ReactQueryCascadeClient(queryClient, executor);

function MyComponent() {
  const mutation = useCascadeMutation(cascade, MY_MUTATION);

  const handleSubmit = () => {
    mutation.mutate({ title: 'New Todo' });
  };

  // Cache automatically updated on success
  return <button onClick={handleSubmit}>Create Todo</button>;
}
```

## 🏗️ Architecture

### Generic Cache Interface

All integrations implement the `CascadeCache` interface:

```typescript
interface CascadeCache {
  write(typename: string, id: string, data: any): void;
  read(typename: string, id: string): any | null;
  evict(typename: string, id: string): void;
  invalidate(invalidation: QueryInvalidation): void;
  refetch(invalidation: QueryInvalidation): Promise<void>;
  remove(invalidation: QueryInvalidation): void;
  identify(entity: any): string;
}
```

### Cascade Response Processing

The `CascadeClient` automatically processes cascade responses:

1. **Updates**: Writes all updated entities to cache
2. **Deletions**: Evicts deleted entities from cache
3. **Invalidations**: Invalidates/refetches affected queries
4. **Metadata**: Provides cascade operation details

### Optimistic Updates

The `OptimisticCascadeClient` supports optimistic updates:

```typescript
const result = await cascade.mutateOptimistic(
  mutation,
  variables,
  optimisticResponse
);
```

## 📋 Supported Frameworks

- ✅ **Apollo Client**: Full normalized cache integration
- ✅ **React Query**: Query invalidation and entity updates
- 🚧 **URQL**: Planned (cache adapter implementation needed)
- 🚧 **Relay**: Planned (environment integration needed)

## 🧪 Testing

Each package includes comprehensive tests:

```bash
# Test core package
cd packages/core && npm test

# Test Apollo integration
cd packages/apollo && npm test

# Test React Query integration
cd packages/react-query && npm test
```

## 📚 Examples

See the `examples/` directory for complete working examples:

- **Todo App**: Apollo Client integration with full CRUD operations
- **React Query Demo**: Hook-based mutations with automatic cache updates

## 🔧 Development

### Building

```bash
# Build all packages
npm run build

# Build specific package
cd packages/core && npm run build
```

### Adding New Integrations

1. Create new package in `packages/`
2. Implement `CascadeCache` interface
3. Extend `CascadeClient` for framework-specific features
4. Add comprehensive tests
5. Update documentation

## 📄 License

MIT License - see LICENSE file for details.