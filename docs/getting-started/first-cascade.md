# Your First GraphQL Cascade

This tutorial walks you through implementing GraphQL Cascade in a simple todo application.

## Prerequisites

- Node.js and npm
- Basic knowledge of GraphQL
- A GraphQL client (Apollo Client recommended)

## Step 1: Set Up Your Schema

First, define your GraphQL schema with cascade directives:

```graphql
type Todo {
  id: ID!
  title: String!
  completed: Boolean!
  createdAt: String!
}

type Query {
  todos: [Todo!]!
  todo(id: ID!): Todo
}

type Mutation {
  createTodo(input: CreateTodoInput!): Todo
    @cascade(updates: ["Todo"], invalidates: ["Query.todos"])
  updateTodo(id: ID!, input: UpdateTodoInput!): Todo
    @cascade(updates: ["Todo"])
  deleteTodo(id: ID!): Boolean
    @cascade(deletes: ["Todo"], invalidates: ["Query.todos"])
}

input CreateTodoInput {
  title: String!
}

input UpdateTodoInput {
  title: String
  completed: Boolean
}
```

## Step 2: Server Implementation

### Python (FraiseQL)

```python
from graphql_cascade import CascadeTracker, CascadeMiddleware

# Set up cascade tracking
tracker = CascadeTracker()
middleware = CascadeMiddleware(tracker)

# In your mutation resolver
def resolve_create_todo(self, info, input):
    with tracker:
        todo = Todo.objects.create(**input)
        tracker.track_create(todo)
        return todo
```

### Node.js (Apollo Server)

```typescript
import { CascadeExtension } from 'graphql-cascade';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  extensions: [new CascadeExtension()]
});
```

## Step 3: Client Integration

### Apollo Client

```typescript
import { ApolloCascadeClient } from '@graphql-cascade/apollo';

const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cache: new InMemoryCache()
});

const cascade = new ApolloCascadeClient(client);

// Mutations automatically update the cache
function TodoApp() {
  const [createTodo] = useMutation(CREATE_TODO);

  const handleCreate = async (title) => {
    await createTodo({ variables: { input: { title } } });
    // Cache is automatically updated!
  };

  // Queries automatically reflect changes
  const { data } = useQuery(GET_TODOS);
  // No manual cache updates needed
}
```

### React Query

```typescript
import { ReactQueryCascadeClient, useCascadeMutation } from '@graphql-cascade/react-query';

const queryClient = new QueryClient();
const cascade = new ReactQueryCascadeClient(queryClient, executor);

function TodoApp() {
  const mutation = useCascadeMutation(cascade, CREATE_TODO);

  const handleCreate = (title) => {
    mutation.mutate({ input: { title } });
    // Cache automatically updated
  };
}
```

## Step 4: Test Your Implementation

1. **Create a todo**: Verify it appears in the list without manual cache updates
2. **Update a todo**: Check that the change is reflected immediately
3. **Delete a todo**: Confirm it disappears from the list
4. **Multiple clients**: Open two browser tabs and verify changes sync automatically

## Common Issues

### Mutations not updating cache
- Check that cascade directives are on your schema
- Verify server is tracking entity changes
- Ensure client library is processing cascade responses

### Performance issues
- Configure appropriate cascade depth
- Use invalidation hints for complex relationships
- Monitor cascade response sizes

## Next Steps

- **[Server Implementation](../../guides/server-implementation.md)** - Advanced server setup
- **[Client Integration](../../guides/client-integration.md)** - Framework-specific guides
- **[Examples](../../examples/)** - Complete working implementations