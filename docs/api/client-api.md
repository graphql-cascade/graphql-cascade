# Client API Reference

Complete API reference for GraphQL Cascade client implementations.

## Universal Client API

All GraphQL Cascade clients implement the same core interface:

```typescript
interface CascadeClient {
  mutate(document: DocumentNode, variables?: any): Promise<ExecutionResult>
  mutateOptimistic(document: DocumentNode, variables: any, optimisticResponse: any): Promise<ExecutionResult>
}
```

## Apollo Client Integration

### ApolloCascadeClient

```typescript
import { ApolloCascadeClient } from '@graphql-cascade/client-apollo';

const cascade = new ApolloCascadeClient(client);

// Basic mutation
const result = await cascade.mutate(CREATE_TODO, { input: { title: 'New Todo' } });

// Optimistic update
const result = await cascade.mutateOptimistic(
  UPDATE_TODO,
  { id: '1', input: { completed: true } },
  { updateTodo: { id: '1', completed: true, __typename: 'Todo' } }
);
```

### Configuration Options

```typescript
const cascade = new ApolloCascadeClient(client, {
  enableOptimisticUpdates: true,
  maxCascadeDepth: 3,
  onCascadeUpdate: (updates) => console.log('Cache updated', updates)
});
```

## React Query Integration

### ReactQueryCascadeClient

```typescript
import { ReactQueryCascadeClient } from '@graphql-cascade/client-react-query';

const cascade = new ReactQueryCascadeClient(queryClient, executor);

// Basic usage
const result = await cascade.mutate(CREATE_TODO, variables);
```

### useCascadeMutation Hook

```typescript
import { useCascadeMutation } from '@graphql-cascade/client-react-query';

function MyComponent() {
  const mutation = useCascadeMutation(cascade, CREATE_TODO);

  const handleSubmit = (data) => {
    mutation.mutate(data, {
      onSuccess: () => console.log('Todo created'),
      onError: (error) => console.error('Failed to create todo', error)
    });
  };

  return (
    <button onClick={() => handleSubmit({ title: 'New Todo' })}>
      {mutation.isLoading ? 'Creating...' : 'Create Todo'}
    </button>
  );
}
```

## Core Client Library

### CascadeClient Base Class

```typescript
import { CascadeClient } from '@graphql-cascade/client-core';

class MyCascadeClient extends CascadeClient {
  constructor(executor: GraphQLExecutor) {
    super();
    this.executor = executor;
  }

  async mutate(document: DocumentNode, variables?: any): Promise<ExecutionResult> {
    const result = await this.executor(document, variables);

    if (result.data && result.data.cascade) {
      this.processCascade(result.data.cascade);
    }

    return result;
  }
}
```

### OptimisticCascadeClient

```typescript
import { OptimisticCascadeClient } from '@graphql-cascade/client-core';

class MyOptimisticClient extends OptimisticCascadeClient {
  // Inherits optimistic update support
}
```

## Cascade Response Types

### CascadeUpdate

```typescript
interface CascadeUpdate {
  updated: EntityUpdate[];
  deleted: EntityDeletion[];
  invalidated: QueryInvalidation[];
}
```

### EntityUpdate

```typescript
interface EntityUpdate {
  __typename: string;
  id: string;
  [field: string]: any; // Full entity data
}
```

### EntityDeletion

```typescript
interface EntityDeletion {
  __typename: string;
  id: string;
}
```

### QueryInvalidation

```typescript
interface QueryInvalidation {
  __typename: string; // Usually "Query"
  field: string;
  args?: Record<string, any>;
}
```

## Error Handling

```typescript
try {
  const result = await cascade.mutate(MUTATION, variables);
} catch (error) {
  if (error.cascade) {
    // Handle cascade-specific errors
    console.error('Cascade processing failed', error.cascade);
  } else {
    // Handle GraphQL errors
    console.error('Mutation failed', error);
  }
}
```

## Performance Considerations

- **Response Size**: Large cascade responses can impact performance
- **Deep Cascades**: Limit cascade depth to prevent excessive updates
- **Batch Updates**: Group multiple mutations when possible

## Framework-Specific Notes

### Apollo Client
- Integrates with normalized cache
- Supports optimistic updates out of the box
- Automatic query refetching

### React Query
- Works with non-normalized cache
- Manual query invalidation required
- Better for complex cache scenarios

### Relay
- Planned: Environment-based integration
- Store updater patterns

### URQL
- Planned: Cache adapter implementation
- Exchange-based integration