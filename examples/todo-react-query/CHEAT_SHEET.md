# GraphQL Cascade + React Query Cheat Sheet

Quick reference for common patterns and usage.

## Setup

### 1. Install Dependencies

```bash
npm install @tanstack/react-query @graphql-cascade/client-react-query graphql
```

### 2. Create Cascade Client

```typescript
// src/api/client.ts
import { QueryClient } from '@tanstack/react-query';
import { ReactQueryCascadeClient } from '@graphql-cascade/client-react-query';

export const queryClient = new QueryClient();

async function graphqlExecutor(query, variables) {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: print(query), variables }),
  });
  return response.json();
}

export const cascadeClient = new ReactQueryCascadeClient(
  queryClient,
  graphqlExecutor
);
```

### 3. Setup Provider

```tsx
// src/App.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/client';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app */}
    </QueryClientProvider>
  );
}
```

## Queries

### Basic Query

```typescript
import { useQuery } from '@tanstack/react-query';
import { graphqlRequest } from './api/client';

export function useTodos() {
  return useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const data = await graphqlRequest(LIST_TODOS_QUERY);
      return data.listTodos;
    },
  });
}
```

### Query with Variables

```typescript
export function useTodo(id: string) {
  return useQuery({
    queryKey: ['todo', id],
    queryFn: async () => {
      const data = await graphqlRequest(GET_TODO_QUERY, { id });
      return data.getTodo;
    },
    enabled: !!id, // Only run if id is present
  });
}
```

### Using Query in Component

```tsx
function TodoList() {
  const { data, isLoading, error } = useTodos();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

## Mutations

### Basic Mutation (With Cascade)

```typescript
import { useMutation } from '@tanstack/react-query';
import { graphqlRequest } from './api/client';

export function useCreateTodo() {
  return useMutation({
    mutationFn: async (input: CreateTodoInput) => {
      const data = await graphqlRequest(CREATE_TODO_MUTATION, { input });
      return data.createTodo.data;
    },
    // Cascade handles cache updates automatically!
  });
}
```

### Mutation with Variables

```typescript
export function useUpdateTodo() {
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTodoInput }) => {
      const data = await graphqlRequest(UPDATE_TODO_MUTATION, { id, input });
      return data.updateTodo.data;
    },
  });
}
```

### Using Mutation in Component

```tsx
function AddTodo() {
  const [title, setTitle] = useState('');
  const createTodo = useCreateTodo();

  const handleSubmit = (e) => {
    e.preventDefault();
    createTodo.mutate({ title }, {
      onSuccess: () => setTitle(''),
      onError: (error) => alert(error.message),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <button disabled={createTodo.isPending}>
        {createTodo.isPending ? 'Creating...' : 'Add Todo'}
      </button>
    </form>
  );
}
```

## Cascade Processing

### GraphQL Request with Cascade

```typescript
export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  // Process cascade metadata
  if (result.extensions?.cascade) {
    cascadeClient.applyCascade(result.extensions.cascade);
  }

  return result.data;
}
```

### Expected Cascade Response

```json
{
  "data": {
    "createTodo": {
      "success": true,
      "data": { "id": "123", "title": "New Todo" }
    }
  },
  "extensions": {
    "cascade": {
      "updated": [
        {
          "__typename": "Todo",
          "id": "123",
          "operation": "CREATE",
          "entity": { "id": "123", "title": "New Todo" }
        }
      ],
      "invalidations": [
        {
          "queryName": "listTodos",
          "strategy": "INVALIDATE",
          "scope": "EXACT"
        }
      ]
    }
  }
}
```

## Common Patterns

### Optimistic Updates

```typescript
export function useCreateTodoOptimistic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTodoFn,
    onMutate: async (input) => {
      // Cancel queries
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      // Snapshot previous
      const previous = queryClient.getQueryData(['todos']);

      // Optimistic update
      queryClient.setQueryData(['todos'], (old) => [...old, {
        id: 'temp-' + Date.now(),
        ...input,
      }]);

      return { previous };
    },
    onError: (err, input, context) => {
      // Rollback
      queryClient.setQueryData(['todos'], context.previous);
    },
    // Cascade replaces temp data with real data automatically!
  });
}
```

### Conditional Mutation

```typescript
function TodoItem({ todo }) {
  const updateTodo = useUpdateTodo();

  const handleToggle = () => {
    updateTodo.mutate({
      id: todo.id,
      input: { completed: !todo.completed }
    });
  };

  return (
    <div>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={handleToggle}
        disabled={updateTodo.isPending}
      />
      {todo.title}
    </div>
  );
}
```

### Delete with Confirmation

```typescript
function TodoItem({ todo }) {
  const deleteTodo = useDeleteTodo();

  const handleDelete = () => {
    if (window.confirm('Delete this todo?')) {
      deleteTodo.mutate(todo.id);
    }
  };

  return (
    <button onClick={handleDelete} disabled={deleteTodo.isPending}>
      {deleteTodo.isPending ? 'Deleting...' : 'Delete'}
    </button>
  );
}
```

## TypeScript Types

### Basic Types

```typescript
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateTodoInput {
  title: string;
  completed?: boolean;
}

interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
}
```

### Mutation Response Type

```typescript
interface MutationResponse<T> {
  success: boolean;
  errors?: Array<{
    message: string;
    code: string;
  }>;
  data: T;
}

// Usage
interface CreateTodoResponse {
  createTodo: MutationResponse<Todo>;
}
```

### Cascade Types

```typescript
interface CascadeData {
  updated?: UpdatedEntity[];
  deleted?: DeletedEntity[];
  invalidations?: QueryInvalidation[];
  metadata?: CascadeMetadata;
}

interface UpdatedEntity {
  __typename: string;
  id: string;
  operation: 'CREATE' | 'UPDATE';
  entity: any;
}

interface DeletedEntity {
  __typename: string;
  id: string;
  deletedAt: string;
}

interface QueryInvalidation {
  queryName: string;
  strategy: 'INVALIDATE' | 'REFETCH' | 'REMOVE';
  scope: 'EXACT' | 'PREFIX' | 'PATTERN' | 'ALL';
}
```

## GraphQL Queries

### Query Example

```graphql
query ListTodos {
  listTodos {
    id
    title
    completed
    createdAt
    updatedAt
  }
}

query GetTodo($id: ID!) {
  getTodo(id: $id) {
    id
    title
    completed
    createdAt
    updatedAt
  }
}
```

### Mutation Examples

```graphql
mutation CreateTodo($input: CreateTodoInput!) {
  createTodo(input: $input) {
    success
    errors {
      message
      code
    }
    data {
      id
      title
      completed
      createdAt
      updatedAt
    }
  }
}

mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
  updateTodo(id: $id, input: $input) {
    success
    data {
      id
      title
      completed
      updatedAt
    }
  }
}

mutation DeleteTodo($id: ID!) {
  deleteTodo(id: $id) {
    success
    data {
      id
    }
  }
}
```

## Debugging

### React Query DevTools

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <>
      {/* Your app */}
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}
```

### Console Logging Cascade

```typescript
if (result.extensions?.cascade) {
  console.log('Cascade data:', result.extensions.cascade);
  cascadeClient.applyCascade(result.extensions.cascade);
}
```

### Check Query Cache

```typescript
const queryClient = useQueryClient();
const todos = queryClient.getQueryData(['todos']);
console.log('Current todos:', todos);
```

## Quick Tips

### DO: Keep it Simple

```typescript
✅ GOOD - Let Cascade handle cache
export function useCreateTodo() {
  return useMutation({
    mutationFn: createTodoFn,
  });
}
```

### DON'T: Manual Cache Management

```typescript
❌ BAD - Manual cache updates
export function useCreateTodo() {
  return useMutation({
    mutationFn: createTodoFn,
    onSuccess: (data) => {
      queryClient.setQueryData(['todos'], ...); // Not needed!
      queryClient.invalidateQueries(...);        // Cascade does this!
    },
  });
}
```

### DO: Use Query Keys Consistently

```typescript
✅ GOOD - Consistent keys
const QUERY_KEYS = {
  todos: ['todos'] as const,
  todo: (id: string) => ['todo', id] as const,
};

useQuery({ queryKey: QUERY_KEYS.todos, ... });
useQuery({ queryKey: QUERY_KEYS.todo('123'), ... });
```

### DON'T: Hardcode Query Keys

```typescript
❌ BAD - Hardcoded strings
useQuery({ queryKey: ['todos'], ... });
useQuery({ queryKey: ['todo', id], ... }); // Typo risk
```

## Common Issues

### Issue: Queries Not Updating

**Check:**
1. Server returns `extensions.cascade`
2. Cascade client processes it
3. Query keys match server's `queryName`

### Issue: TypeScript Errors

**Fix:**
```bash
npm install
npm run type-check
```

### Issue: Stale Data

**Solution:**
- Check React Query DevTools
- Verify cascade invalidations
- Ensure query keys are correct

## Resources

- [React Query Docs](https://tanstack.com/query/latest)
- [GraphQL Cascade Spec](../../specification/)
- [Full Example](./README.md)

---

**Remember:** With Cascade, you write mutations once and cache updates happen automatically. Focus on your business logic, not cache management!
