# Todo App with GraphQL Cascade - Apollo Example

This example demonstrates a complete Todo application using GraphQL Cascade with Apollo Server (backend) and Apollo Client (frontend).

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development servers:**
   ```bash
   npm run dev
   ```

   This will start both the backend (port 4000) and frontend (port 5173) simultaneously.

3. **Open your browser:**
   - Frontend: http://localhost:5173
   - Backend GraphQL playground: http://localhost:4000/graphql

## Architecture

### Backend (Apollo Server + GraphQL Cascade)
- **Framework:** Apollo Server with GraphQL Cascade plugin
- **Database:** In-memory storage (for demo purposes)
- **Features:**
  - CRUD operations for todos
  - Cascade responses for cache invalidation
  - Automatic cache updates on the frontend

### Frontend (Apollo Client + GraphQL Cascade)
- **Framework:** React with Apollo Client
- **State Management:** Apollo Cache with Cascade invalidation
- **Features:**
  - Real-time UI updates via cache invalidation
  - Optimistic updates for better UX
  - Automatic cache management

## Key Files

### Backend
- `backend/src/index.ts` - Apollo Server setup with Cascade plugin
- `backend/src/schema.ts` - GraphQL schema with Todo type and cascade mutations
- `backend/src/resolvers.ts` - Resolvers using CascadeBuilder for cache invalidation
- `backend/src/db.ts` - Simple in-memory database

### Frontend
- `frontend/src/apollo-client.ts` - Apollo Client configured with ApolloCascadeClient
- `frontend/src/App.tsx` - Main app component with todo query
- `frontend/src/components/TodoList.tsx` - List of todos
- `frontend/src/components/TodoItem.tsx` - Individual todo with toggle/delete actions
- `frontend/src/components/AddTodo.tsx` - Form to add new todos

## Features Demonstrated

- ✅ **Cascade Mutations:** All mutations return cascade data for cache invalidation
- ✅ **Automatic Cache Updates:** Frontend cache updates automatically without manual refetching
- ✅ **Optimistic Updates:** UI updates immediately on user actions
- ✅ **Type Safety:** Full TypeScript support throughout
- ✅ **Real-time Sync:** Changes reflect instantly across the UI

## GraphQL Schema

```graphql
type Todo {
  id: ID!
  title: String!
  completed: Boolean!
}

type Query {
  todos: [Todo!]!
  todo(id: ID!): Todo
}

type Mutation {
  createTodo(title: String!): CreateTodoCascade!
  updateTodo(id: ID!, title: String, completed: Boolean): UpdateTodoCascade!
  deleteTodo(id: ID!): DeleteTodoCascade!
  toggleTodo(id: ID!): ToggleTodoCascade!
}
```

## Development

### Backend Only
```bash
cd backend
npm run dev
```

### Frontend Only
```bash
cd frontend
npm run dev
```

### Building for Production
```bash
npm run build
npm run start
```