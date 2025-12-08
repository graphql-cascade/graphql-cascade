# Quick Start Guide

Get the GraphQL Cascade + React Query Todo app running in 5 minutes.

## Prerequisites

- Node.js 16+ installed
- npm, yarn, or pnpm
- (Optional) A GraphQL backend server

## Step 1: Install Dependencies

```bash
cd examples/todo-react-query
npm install
```

## Step 2: Start the Development Server

```bash
npm run dev
```

The app will open at `http://localhost:3000`

## Step 3: (Optional) Start Backend Server

If you want full functionality, start the GraphQL backend:

```bash
# In a new terminal, from repository root
cd examples/todo-app/backend

# Install Python dependencies (first time only)
pip install graphql-cascade strawberry-graphql

# Start the server
python server.py
```

The backend will run at `http://localhost:4000`

## What to Try

### Without Backend (Mock Mode)

Even without a backend, you can:
- Explore the code structure
- See the React Query DevTools
- Understand the Cascade integration patterns

### With Backend

1. **Create a todo** - Type in the input and click "Add Todo"
   - Open React Query DevTools (bottom-right)
   - Watch the `['todos']` query invalidate and refetch automatically
   - No manual cache management code!

2. **Update a todo** - Click the checkbox or edit the title
   - Notice both the list and detail views stay in sync
   - Check DevTools to see automatic cache updates

3. **Delete a todo** - Click the delete button
   - Todo is removed from all queries instantly
   - DevTools shows automatic cache eviction

## Key Files to Explore

Start with these files to understand the Cascade integration:

1. **`src/api/client.ts`**
   - How Cascade client is set up
   - How cascade metadata is processed

2. **`src/hooks/useTodoMutations.ts`**
   - Compare with traditional React Query (see COMPARISON.md)
   - Notice the lack of onSuccess callbacks

3. **`src/components/TodoList.tsx`**
   - See how components "just work" with Cascade
   - No manual refetch or invalidation logic

## Troubleshooting

### Port 3000 Already in Use

```bash
# Edit vite.config.ts to use a different port:
export default defineConfig({
  server: { port: 3001 },
});
```

### Cannot Connect to Backend

Make sure:
1. Backend is running: `curl http://localhost:4000/graphql`
2. CORS is enabled on the backend
3. GraphQL endpoint URL is correct in `src/api/client.ts`

### TypeScript Errors

```bash
# Check TypeScript compilation
npm run type-check

# Reinstall dependencies if needed
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- Read [`README.md`](./README.md) for detailed documentation
- Compare with traditional approach in [`COMPARISON.md`](./COMPARISON.md)
- Explore the GraphQL Cascade [specification](../../specification/)
- Try building your own Cascade-powered app!

## Learning Resources

- **React Query Docs**: https://tanstack.com/query/latest
- **GraphQL Cascade Spec**: ../../specification/
- **Other Examples**: ../

## Questions?

- Check the main README for more details
- Review the comparison document for detailed code examples
- Explore the source code - it's heavily commented!

---

**Pro Tip:** Open React Query DevTools while using the app to see Cascade in action. Watch queries invalidate and update automatically without any manual cache management code!
