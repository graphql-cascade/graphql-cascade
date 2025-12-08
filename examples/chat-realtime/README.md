# Real-time Chat App with GraphQL Cascade - URQL Example

This example demonstrates a real-time chat application using GraphQL Cascade with Apollo Server (backend) and URQL (frontend).

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
  - Real-time chat with WebSocket subscriptions
  - Cascade responses for cache invalidation
  - Automatic cache updates on the frontend

### Frontend (URQL + GraphQL Cascade)
- **Framework:** React with URQL
- **State Management:** URQL Cache with Cascade invalidation
- **Features:**
  - Real-time chat updates via GraphQL subscriptions
  - Automatic cache management
  - Optimistic updates for better UX

## Key Files

### Backend
- `backend/src/index.ts` - Apollo Server setup with Cascade plugin and WebSocket subscriptions
- `backend/src/schema.ts` - GraphQL schema with Message type and cascade mutations
- `backend/src/resolvers.ts` - Resolvers using CascadeBuilder for cache invalidation
- `backend/src/db.ts` - Simple in-memory database for messages

### Frontend
- `frontend/src/main.tsx` - URQL client configured with CascadeURQLClient
- `frontend/src/App.tsx` - Main app component with chat interface
- `frontend/src/components/ChatMessage.tsx` - Individual chat message component
- `frontend/src/components/ChatInput.tsx` - Input form for sending messages
- `frontend/src/components/MessageList.tsx` - List of chat messages with real-time updates

## Features Demonstrated

- ✅ **Real-time Subscriptions:** Live chat updates via GraphQL subscriptions
- ✅ **Cascade Mutations:** All mutations return cascade data for cache invalidation
- ✅ **Automatic Cache Updates:** Frontend cache updates automatically without manual refetching
- ✅ **Optimistic Updates:** UI updates immediately on user actions
- ✅ **Type Safety:** Full TypeScript support throughout
- ✅ **WebSocket Transport:** Efficient real-time communication

## GraphQL Schema

```graphql
type Message {
  id: ID!
  content: String!
  author: String!
  timestamp: String!
}

type Query {
  messages: [Message!]!
}

type Mutation {
  sendMessage(content: String!, author: String!): SendMessageCascade!
}

type Subscription {
  messageSent: Message!
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