# GraphQL Cascade Concepts

This guide explains the core concepts behind GraphQL Cascade and how it solves common cache management problems.

## The Cache Management Problem

In traditional GraphQL applications, when you perform a mutation, you need to manually update your cache:

```typescript
// Manual cache updates are error-prone
const [createTodo] = useMutation(CREATE_TODO, {
  update(cache, { data }) {
    // Manually update the cache
    const query = GET_TODOS;
    const todos = cache.readQuery({ query });
    cache.writeQuery({
      query,
      data: {
        todos: [...todos.todos, data.createTodo]
      }
    });
  }
});
```

This approach has several problems:
- **Error-prone**: Easy to forget updates or make mistakes
- **Maintenance burden**: Cache logic scattered throughout your app
- **Inconsistency**: Different parts of your app may update cache differently
- **Complexity**: Complex relationships require complex cache logic

## The GraphQL Cascade Solution

GraphQL Cascade moves cache update logic to the server. When you perform a mutation, the server automatically tracks all affected entities and returns them in a structured format.

```typescript
// With GraphQL Cascade, cache updates are automatic
const [createTodo] = useMutation(CREATE_TODO);
// No manual cache updates needed!
// The cache is automatically updated based on server response
```

## How It Works

### 1. Entity Tracking

GraphQL Cascade tracks entities by their GraphQL type and ID:

```typescript
type User {
  id: ID!
  name: String
  email: String
}

type Todo {
  id: ID!
  title: String
  completed: Boolean
  author: User
}
```

### 2. Cascade Responses

Mutations return cascade information alongside their primary result:

```typescript
mutation CreateTodo($input: CreateTodoInput!) {
  createTodo(input: $input) {
    # Primary result
    id
    title
    completed
    author {
      id
      name
    }

    # Cascade information
    cascade {
      updated {
        __typename
        id
        # ... full entity data
      }
      deleted {
        __typename
        id
      }
      invalidated {
        __typename
        field
        args
      }
    }
  }
}
```

### 3. Automatic Cache Updates

Client libraries automatically process cascade responses:

```typescript
// Apollo Client automatically updates cache
const result = await cascade.mutate(CREATE_TODO, variables);
// Cache now contains the new todo and updated user
```

## Key Concepts

### Entity Identity

Every entity has a unique identity consisting of `__typename` and `id`. This allows GraphQL Cascade to:

- Track which entities changed
- Update existing cache entries
- Maintain referential integrity

### Cascade Depth

GraphQL Cascade follows relationships to a configurable depth:

```yaml
cascade:
  max_depth: 3  # Follow relationships up to 3 levels deep
```

### Invalidation Hints

For complex cache invalidation, GraphQL Cascade provides hints:

```typescript
cascade: {
  invalidated: [
    {
      __typename: "Query",
      field: "todos",
      args: { completed: false }
    }
  ]
}
```

## Benefits

### 1. **Automatic Updates**
No more manual cache management. Mutations automatically update related queries.

### 2. **Consistency**
Cache update logic is centralized on the server, ensuring consistency across all clients.

### 3. **Performance**
Only affected parts of the cache are updated, minimizing re-renders and network requests.

### 4. **Maintainability**
Cache logic is declarative and lives with your schema, not scattered in client code.

### 5. **Framework Agnostic**
Works with any GraphQL client that supports cache manipulation.

## Next Steps

- **[Quick Start](../quick-start.md)** - See GraphQL Cascade in action
- **[First Cascade](first-cascade.md)** - Implement in your own project
- **[Server Implementation](../../guides/server-implementation.md)** - Set up cascade tracking