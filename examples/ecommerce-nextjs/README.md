# E-commerce App with GraphQL Cascade - Next.js Example

This example demonstrates a complete E-commerce application using GraphQL Cascade with Apollo Server (backend) and Next.js with Apollo Client (frontend).

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development servers:**
   ```bash
   npm run dev
   ```

   This will start both the backend (port 4000) and frontend (port 3000) simultaneously.

3. **Open your browser:**
   - Frontend: http://localhost:3000
   - Backend GraphQL playground: http://localhost:4000/graphql

## Architecture

### Backend (Apollo Server + GraphQL Cascade)
- **Framework:** Apollo Server with GraphQL Cascade plugin
- **Database:** In-memory storage (for demo purposes)
- **Features:**
  - CRUD operations for products, cart, and orders
  - Cascade responses for cache invalidation
  - Automatic cache updates on the frontend

### Frontend (Next.js + Apollo Client + GraphQL Cascade)
- **Framework:** Next.js with Apollo Client
- **State Management:** Apollo Cache with Cascade invalidation
- **Features:**
  - Real-time UI updates via cache invalidation
  - Optimistic updates for better UX
  - Automatic cache management
  - Server-side rendering support

## Key Files

### Backend
- `backend/src/index.ts` - Apollo Server setup with Cascade plugin
- `backend/src/schema.ts` - GraphQL schema with Product, Cart, Order types and cascade mutations
- `backend/src/resolvers.ts` - Resolvers using CascadeBuilder for cache invalidation
- `backend/src/db.ts` - Simple in-memory database

### Frontend
- `frontend/lib/apollo-client.ts` - Apollo Client configured with ApolloCascadeClient
- `frontend/app/page.tsx` - Main page component
- `frontend/app/products/page.tsx` - Products listing page
- `frontend/app/cart/page.tsx` - Shopping cart page

## Features Demonstrated

- ✅ **Cascade Mutations:** All mutations return cascade data for cache invalidation
- ✅ **Automatic Cache Updates:** Frontend cache updates automatically without manual refetching
- ✅ **Optimistic Updates:** UI updates immediately on user actions
- ✅ **Type Safety:** Full TypeScript support throughout
- ✅ **Real-time Sync:** Changes reflect instantly across the UI
- ✅ **Server-Side Rendering:** Next.js SSR with Apollo Client

## GraphQL Schema

```graphql
type Product {
  id: ID!
  name: String!
  price: Float!
  description: String
  inStock: Boolean!
}

type CartItem {
  id: ID!
  product: Product!
  quantity: Int!
}

type Order {
  id: ID!
  items: [CartItem!]!
  total: Float!
  status: String!
}

type Query {
  products: [Product!]!
  product(id: ID!): Product
  cart: [CartItem!]!
  orders: [Order!]!
}

type Mutation {
  addToCart(productId: ID!, quantity: Int!): AddToCartCascade!
  updateCartItem(cartItemId: ID!, quantity: Int!): UpdateCartItemCascade!
  removeFromCart(cartItemId: ID!): RemoveFromCartCascade!
  checkout: CheckoutCascade!
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