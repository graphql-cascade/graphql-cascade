# GraphQL Cascade + React Query - Todo App Example

A complete Todo application demonstrating **GraphQL Cascade** with **React Query**. This example shows how Cascade eliminates manual cache management, making your React Query applications simpler and more maintainable.

## What This Example Demonstrates

This example showcases GraphQL Cascade's automatic cache management with React Query:

1. **Automatic Cache Updates** - When you create, update, or delete todos, the cache updates automatically
2. **No Manual Invalidation** - No need for `queryClient.invalidateQueries()` or `queryClient.setQueryData()` calls
3. **Real-time Sync** - All components stay in sync without manual coordination
4. **Type-Safe Mutations** - Full TypeScript support with minimal boilerplate

## The Power of Cascade: Before & After

### Without Cascade (Traditional React Query)

```typescript
export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTodoInput) => {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: CREATE_TODO_MUTATION,
          variables: { input },
        }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Manual cache management required!

      // Option 1: Optimistically update
      queryClient.setQueryData(['todos'], (old) => {
        return [...old, data.createTodo.data];
      });

      // Option 2: Or invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['todos'] });

      // Don't forget to update related queries!
      queryClient.invalidateQueries({ queryKey: ['todoStats'] });
      queryClient.invalidateQueries({ queryKey: ['recentTodos'] });
    },
  });
}
```

**Problems with this approach:**
- **Verbose** - Lots of boilerplate for every mutation
- **Error-prone** - Easy to forget to update related queries
- **Fragile** - Changes to data structure require updating multiple places
- **Tedious** - Every mutation needs custom cache logic

### With Cascade (This Example)

```typescript
export function useCreateTodo() {
  return useMutation({
    mutationFn: async (input: CreateTodoInput) => {
      const data = await graphqlRequest<CreateTodoResponse>(
        CREATE_TODO_MUTATION,
        { input }
      );
      return data.createTodo.data;
    },
    // That's it! Cascade handles everything automatically.
    // No onSuccess, no manual cache updates, no invalidations.
  });
}
```

**Benefits of Cascade:**
- **Simple** - Minimal boilerplate, focus on business logic
- **Automatic** - Server tells the client what to update
- **Reliable** - Never forget to update related queries
- **Maintainable** - Changes on the server automatically propagate

## How It Works

### 1. Server Sends Cascade Metadata

When you perform a mutation, the GraphQL server includes cascade metadata in the response:

```json
{
  "data": {
    "createTodo": {
      "success": true,
      "data": {
        "id": "123",
        "title": "Learn Cascade",
        "completed": false
      }
    }
  },
  "extensions": {
    "cascade": {
      "updated": [
        {
          "__typename": "Todo",
          "id": "123",
          "operation": "CREATE",
          "entity": { "id": "123", "title": "Learn Cascade", ... }
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

### 2. Cascade Client Processes Metadata

The Cascade client automatically:

1. **Updates entities** in all queries that contain them
2. **Removes deleted entities** from all queries
3. **Invalidates queries** that need to be refetched
4. **Keeps everything in sync** without manual intervention

### 3. React Query Re-renders Components

React Query's existing reactivity system takes over:
- Queries are refetched as needed
- Components re-render with updated data
- Loading states are handled automatically

## Project Structure

```
todo-react-query/
├── src/
│   ├── api/
│   │   └── client.ts              # Cascade + React Query setup
│   ├── components/
│   │   ├── AddTodo.tsx            # Create todo form
│   │   ├── TodoItem.tsx           # Single todo component
│   │   └── TodoList.tsx           # Todo list component
│   ├── hooks/
│   │   ├── useTodos.ts            # Query hooks
│   │   └── useTodoMutations.ts    # Mutation hooks with Cascade
│   ├── App.tsx                    # Main app component
│   ├── App.css                    # Styles
│   └── main.tsx                   # Entry point
├── index.html
├── package.json
├── tsconfig.json
└── README.md
```

## Key Files to Study

### `/src/api/client.ts` - Cascade Integration

Shows how to:
- Set up React Query with Cascade
- Create the cascade client
- Process cascade metadata from responses

### `/src/hooks/useTodoMutations.ts` - Mutation Hooks

Demonstrates:
- Simple mutation hooks without manual cache updates
- How Cascade eliminates onSuccess callbacks
- Type-safe mutations with TypeScript

### `/src/hooks/useTodos.ts` - Query Hooks

Shows:
- Standard React Query query hooks
- How queries automatically refetch when invalidated by Cascade

## Running the Example

### Prerequisites

- Node.js 16+ and npm/yarn/pnpm
- A GraphQL server that supports Cascade (see backend setup below)

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

### Backend Setup

This example expects a GraphQL server at `http://localhost:4000/graphql`. You can use the existing todo-app backend:

```bash
# From the repository root
cd examples/todo-app/backend

# Install Python dependencies
pip install graphql-cascade strawberry-graphql

# Start the server
python server.py
```

Or implement your own server following the [GraphQL Cascade specification](../../specification/).

## Usage

### Creating Todos

1. Type a todo title in the input field
2. Click "Add Todo"
3. Watch the list update automatically - no manual cache management!

### Updating Todos

1. Click the checkbox to toggle completion
2. Double-click the title to edit inline
3. Both actions update the cache automatically

### Deleting Todos

1. Click "Delete" on any todo
2. The todo is removed from all queries instantly

### Observing Cascade in Action

Open the React Query Devtools (bottom-right corner) to see:
- Queries being invalidated automatically
- Cache updates happening in real-time
- No manual cache manipulation code needed

## Technical Details

### Cascade Cache Adapter

The React Query Cascade adapter (`ReactQueryCascadeCache`) handles:

- **Entity Updates** - Updates all queries containing modified entities
- **Entity Deletion** - Removes deleted entities from all queries
- **Query Invalidation** - Invalidates queries based on cascade metadata
- **Pattern Matching** - Supports exact, prefix, and pattern-based invalidation

### Type Safety

Full TypeScript support with:
- Type-safe mutation variables
- Inferred return types
- Compile-time checks for query/mutation structure

### Performance

Cascade is efficient:
- Only affected queries are invalidated
- Entity updates happen in-place where possible
- No unnecessary re-renders

## Comparison with Manual Cache Management

| Aspect | Manual Management | With Cascade |
|--------|------------------|--------------|
| **Lines of Code** | 15-30 per mutation | 3-5 per mutation |
| **Maintenance** | Update for every schema change | Automatic |
| **Reliability** | Easy to miss edge cases | Server-controlled |
| **Complexity** | Grows with app size | Stays constant |
| **Type Safety** | Requires careful typing | Automatic inference |

## Learn More

- **[GraphQL Cascade Specification](../../specification/)** - Formal spec
- **[React Query Client Package](../../packages/client-react-query/)** - Implementation details
- **[Other Examples](../)** - Apollo Client, Relay, and more

## Troubleshooting

### Queries Not Updating

Check that:
1. Your GraphQL server returns cascade metadata in `extensions.cascade`
2. The `graphqlRequest` function is processing cascade data
3. The cascade client is properly initialized

### TypeScript Errors

Ensure:
1. All packages are installed: `npm install`
2. TypeScript version is 5.0+: `npm list typescript`
3. Run type check: `npm run type-check`

### Server Connection Issues

Verify:
1. Backend server is running on `http://localhost:4000`
2. GraphQL endpoint is accessible
3. CORS is configured if needed

## Contributing

Found a bug or want to improve this example? Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT - See repository root for details

---

**This example demonstrates the power of GraphQL Cascade - automatic cache management that scales from simple CRUD apps to complex real-time applications.**
