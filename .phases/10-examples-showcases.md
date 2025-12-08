# AXIS 10: Real-World Examples & Showcases

**Engineer Persona**: Solutions Architect
**Status**: Analysis Complete
**Priority**: High (Proves real-world value)

---

## Executive Summary

Developers learn best from working examples. This axis focuses on creating comprehensive, real-world example applications that demonstrate graphql-cascade in production-like scenarios. Each example serves as both a learning resource and a template for new projects.

---

## Current State Assessment

### Existing Examples

| Example | Status | Complexity | Frameworks |
|---------|--------|------------|------------|
| Todo App | Complete | Beginner | Apollo, Python |
| Blog Platform | Planned | Intermediate | - |
| Real-time Collab | Planned | Advanced | - |

### Example Gaps

1. **No React Query example** - Missing major framework
2. **No mobile example** - Missing platform
3. **No microservices example** - Missing architecture
4. **No offline-first example** - Missing capability
5. **No e-commerce example** - Missing domain
6. **No multi-tenant example** - Missing pattern

---

## Example Portfolio

### Example Matrix

| Example | Complexity | Client | Server | Key Concepts |
|---------|------------|--------|--------|--------------|
| Todo App | Beginner | Apollo | Python | Basic CRUD, cascade basics |
| Blog Platform | Intermediate | Apollo | Node.js | Relationships, nested updates |
| E-commerce Cart | Intermediate | React Query | Python | Document cache, complex state |
| Social Feed | Advanced | Apollo | Node.js | Pagination, optimistic updates |
| Real-time Collab | Advanced | Apollo | Node.js | Subscriptions, conflict resolution |
| Offline Notes | Advanced | Apollo | Python | Offline-first, sync |
| Multi-tenant SaaS | Enterprise | Relay | Node.js | Authorization, isolation |
| Mobile App | Advanced | Apollo iOS/Android | Python | Native clients |

---

## Example Specifications

### 1. Todo App (Complete - Enhance)

**Purpose**: First-touch learning experience

**Current Features:**
- Create/update/delete todos
- Basic cascade response
- Single user

**Enhancements:**
```
enhancements/
├── Add filtering (all/active/completed)
├── Add drag-and-drop reordering
├── Add multiple lists
├── Add due dates
├── Add user authentication
└── Add React Query variant
```

**Final Structure:**
```
examples/todo-app/
├── README.md                    # Getting started
├── server/
│   ├── python/                  # Python server
│   │   ├── schema.graphql
│   │   ├── resolvers.py
│   │   └── cascade_config.py
│   └── node/                    # Node.js server
│       ├── schema.graphql
│       ├── resolvers.ts
│       └── cascade.config.ts
│
├── clients/
│   ├── apollo/                  # Apollo Client
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   └── graphql/
│   │   └── package.json
│   │
│   └── react-query/             # React Query variant
│       ├── src/
│       └── package.json
│
└── docs/
    ├── TUTORIAL.md              # Step-by-step guide
    └── ARCHITECTURE.md          # How it works
```

---

### 2. Blog Platform

**Purpose**: Demonstrate relationships and nested updates

**Features:**
- Posts with authors
- Comments with replies
- Tags and categories
- User profiles
- Like/bookmark functionality

**Schema:**
```graphql
type User {
  id: ID!
  name: String!
  email: String!
  avatar: String
  posts: [Post!]!
  comments: [Comment!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  tags: [Tag!]!
  comments: [Comment!]!
  likes: Int!
  publishedAt: DateTime
  status: PostStatus!
}

type Comment {
  id: ID!
  content: String!
  author: User!
  post: Post!
  parent: Comment
  replies: [Comment!]!
  likes: Int!
  createdAt: DateTime!
}

type Tag {
  id: ID!
  name: String!
  posts: [Post!]!
}
```

**Cascade Scenarios:**
```markdown
## Scenario 1: Create Comment
When user creates a comment:
- New Comment entity added to cache
- Post.comments updated
- Post.commentCount incremented
- User.comments updated (optional)

## Scenario 2: Update Post
When author edits a post:
- Post entity updated
- Tag relationships updated
- Feed queries invalidated

## Scenario 3: Delete Comment
When comment is deleted:
- Comment removed from cache
- Post.commentCount decremented
- Reply thread updated
- Parent comment's replies updated
```

**Structure:**
```
examples/blog-platform/
├── README.md
├── docker-compose.yml           # Full stack setup
├── server/
│   ├── prisma/
│   │   └── schema.prisma        # Database schema
│   ├── src/
│   │   ├── schema.graphql
│   │   ├── resolvers/
│   │   │   ├── user.ts
│   │   │   ├── post.ts
│   │   │   └── comment.ts
│   │   └── cascade/
│   │       └── config.ts
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Post.tsx
│   │   │   ├── Profile.tsx
│   │   │   └── Editor.tsx
│   │   ├── components/
│   │   │   ├── PostCard.tsx
│   │   │   ├── CommentThread.tsx
│   │   │   └── TagList.tsx
│   │   └── graphql/
│   │       ├── queries.ts
│   │       └── mutations.ts
│   └── package.json
│
└── docs/
    ├── TUTORIAL.md
    ├── RELATIONSHIPS.md         # How relationships cascade
    └── PERFORMANCE.md           # Performance considerations
```

---

### 3. E-commerce Shopping Cart

**Purpose**: Document cache pattern with React Query

**Features:**
- Product catalog
- Shopping cart
- Inventory tracking
- Order management
- Price calculations

**Schema:**
```graphql
type Product {
  id: ID!
  name: String!
  description: String!
  price: Float!
  inventory: Int!
  images: [String!]!
  category: Category!
}

type Cart {
  id: ID!
  user: User!
  items: [CartItem!]!
  subtotal: Float!
  tax: Float!
  total: Float!
}

type CartItem {
  id: ID!
  product: Product!
  quantity: Int!
  price: Float!
}

type Order {
  id: ID!
  user: User!
  items: [OrderItem!]!
  status: OrderStatus!
  total: Float!
  createdAt: DateTime!
}
```

**Cascade Scenarios:**
```markdown
## Scenario 1: Add to Cart
When user adds item:
- CartItem created
- Cart.items updated
- Cart.subtotal recalculated
- Product.inventory decremented (optional - depends on strategy)
- Related queries invalidated

## Scenario 2: Update Quantity
When user changes quantity:
- CartItem.quantity updated
- Cart totals recalculated
- Inventory check performed

## Scenario 3: Place Order
When order is placed:
- Order created
- Cart cleared
- Product inventory updated
- Order confirmation queries invalidated
```

**Structure:**
```
examples/ecommerce-cart/
├── README.md
├── server/
│   └── python/
│       ├── app/
│       │   ├── schema.py
│       │   ├── resolvers/
│       │   └── cascade/
│       └── requirements.txt
│
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Catalog.tsx
│   │   │   ├── Product.tsx
│   │   │   ├── Cart.tsx
│   │   │   └── Checkout.tsx
│   │   ├── components/
│   │   │   ├── ProductGrid.tsx
│   │   │   ├── CartDrawer.tsx
│   │   │   └── CartItem.tsx
│   │   └── hooks/
│   │       ├── useCart.ts       # React Query mutations
│   │       └── useProducts.ts
│   └── package.json
│
└── docs/
    ├── DOCUMENT_CACHE.md        # React Query cascade patterns
    └── INVENTORY.md             # Inventory sync strategies
```

---

### 4. Social Feed

**Purpose**: Demonstrate pagination and optimistic updates

**Features:**
- Infinite scroll feed
- Post creation
- Like/comment/share
- Real-time updates
- Optimistic UI

**Schema:**
```graphql
type Query {
  feed(first: Int!, after: String): FeedConnection!
}

type FeedConnection {
  edges: [FeedEdge!]!
  pageInfo: PageInfo!
}

type FeedEdge {
  cursor: String!
  node: FeedItem!
}

type FeedItem {
  id: ID!
  author: User!
  content: String!
  media: [Media!]!
  likes: Int!
  comments: Int!
  shares: Int!
  isLiked: Boolean!
  createdAt: DateTime!
}
```

**Cascade with Pagination:**
```typescript
// Optimistic like with cascade
const [likePost] = useCascadeMutation(LIKE_POST, {
  optimistic: ({ postId }) => ({
    likePost: {
      __typename: 'FeedItem',
      id: postId,
      likes: (current) => current + 1,
      isLiked: true
    }
  }),
  // Cascade handles updating the entity in all paginated results
});
```

**Structure:**
```
examples/social-feed/
├── README.md
├── server/
│   └── node/
│       ├── src/
│       │   ├── schema.graphql
│       │   ├── resolvers/
│       │   │   ├── feed.ts
│       │   │   └── social.ts
│       │   └── cascade/
│       └── package.json
│
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Feed.tsx
│   │   │   ├── FeedItem.tsx
│   │   │   ├── LikeButton.tsx
│   │   │   └── CommentSection.tsx
│   │   └── hooks/
│   │       └── useFeed.ts
│   └── package.json
│
└── docs/
    ├── PAGINATION.md            # Cursor-based pagination with cascade
    └── OPTIMISTIC.md            # Optimistic update patterns
```

---

### 5. Real-time Collaborative Editor

**Purpose**: Subscriptions and conflict resolution

**Features:**
- Real-time document editing
- Presence (who's online)
- Cursor positions
- Conflict resolution
- Offline support

**Schema:**
```graphql
type Document {
  id: ID!
  title: String!
  content: String!
  version: Int!
  collaborators: [User!]!
  lastModified: DateTime!
}

type Subscription {
  documentUpdated(documentId: ID!): DocumentUpdate!
  presenceChanged(documentId: ID!): PresenceUpdate!
}

type DocumentUpdate {
  document: Document!
  operation: Operation!
  author: User!
}

type PresenceUpdate {
  user: User!
  cursor: CursorPosition
  selection: Selection
  status: PresenceStatus!
}
```

**Cascade with Subscriptions:**
```typescript
// Subscription with cascade
useSubscription(DOCUMENT_UPDATED, {
  variables: { documentId },
  onData: ({ data }) => {
    // Cascade automatically applies update
    // Conflict resolution handles version mismatch
  }
});
```

**Structure:**
```
examples/collaborative-editor/
├── README.md
├── server/
│   └── node/
│       ├── src/
│       │   ├── schema.graphql
│       │   ├── resolvers/
│       │   ├── subscriptions/
│       │   └── cascade/
│       │       └── conflict-resolution.ts
│       └── package.json
│
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Editor.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   ├── Presence.tsx
│   │   │   └── CollaboratorCursors.tsx
│   │   └── hooks/
│   │       ├── useDocument.ts
│   │       └── usePresence.ts
│   └── package.json
│
└── docs/
    ├── SUBSCRIPTIONS.md
    ├── CONFLICT_RESOLUTION.md
    └── OFFLINE.md
```

---

### 6. Offline Notes App

**Purpose**: Offline-first with sync

**Features:**
- Create/edit notes offline
- Automatic sync when online
- Conflict detection
- Local-first architecture

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Offline Notes Architecture               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Client                              Server                 │
│  ┌──────────────────┐               ┌──────────────────┐   │
│  │  Apollo Client   │               │  GraphQL Server  │   │
│  │  + Cascade       │               │  + Cascade       │   │
│  │  + Persistence   │◄─────────────►│  + Postgres      │   │
│  └──────────────────┘     Sync      └──────────────────┘   │
│          │                                                  │
│          ▼                                                  │
│  ┌──────────────────┐                                      │
│  │   IndexedDB      │                                      │
│  │   (Local Cache)  │                                      │
│  └──────────────────┘                                      │
│                                                             │
│  Flow:                                                      │
│  1. All mutations go to local cache first                   │
│  2. Background sync sends to server                         │
│  3. Cascade response updates local state                    │
│  4. Conflicts resolved via cascade rules                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 7. Multi-tenant SaaS (Enterprise)

**Purpose**: Authorization and tenant isolation

**Features:**
- Multi-tenant data isolation
- Role-based access control
- Audit logging
- Cascade with authorization

**Schema:**
```graphql
type Tenant {
  id: ID!
  name: String!
  users: [User!]! @cascade(authorized: true)
  projects: [Project!]! @cascade(authorized: true)
}

type User {
  id: ID!
  tenant: Tenant!
  role: Role!
  projects: [Project!]!
}

type Project {
  id: ID!
  tenant: Tenant!
  name: String!
  members: [User!]!
  tasks: [Task!]!
}
```

**Cascade with Authorization:**
```python
class TenantAwareCascadeBuilder(CascadeBuilder):
    def build_response(self) -> CascadeResponse:
        response = super().build_response()

        # Filter to tenant's data only
        tenant_id = self.context.tenant_id
        authorized = [
            entity for entity in response.updated
            if self.belongs_to_tenant(entity, tenant_id)
        ]

        return CascadeResponse(
            updated=authorized,
            invalidations=response.invalidations,
            metadata=response.metadata
        )
```

---

### 8. Mobile App (iOS/Android)

**Purpose**: Native mobile integration

**Platforms:**
- iOS (Swift + Apollo iOS)
- Android (Kotlin + Apollo Android)

**Features:**
- Native UI
- Background sync
- Push notifications
- Offline support

**Structure:**
```
examples/mobile-app/
├── README.md
├── server/
│   └── python/
│       └── ...
│
├── ios/
│   ├── CascadeNotes/
│   │   ├── Apollo/
│   │   │   ├── Generated/
│   │   │   └── CascadeClient.swift
│   │   ├── Views/
│   │   ├── ViewModels/
│   │   └── CascadeNotes.xcodeproj
│   └── schema.graphqls
│
├── android/
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── graphql/
│   │   │   └── kotlin/
│   │   │       ├── ui/
│   │   │       └── cascade/
│   │   └── build.gradle
│   └── schema.graphqls
│
└── docs/
    ├── IOS.md
    └── ANDROID.md
```

---

## Implementation Roadmap

### Phase 1: Enhance Todo App (Week 1)

- [ ] Add React Query variant
- [ ] Add Node.js server variant
- [ ] Improve documentation
- [ ] Add Docker setup

### Phase 2: Blog Platform (Weeks 2-4)

- [ ] Design schema
- [ ] Build Node.js server
- [ ] Build Apollo client
- [ ] Write tutorials
- [ ] Add Docker Compose

### Phase 3: E-commerce Cart (Weeks 5-6)

- [ ] Design schema
- [ ] Build Python server
- [ ] Build React Query client
- [ ] Document patterns

### Phase 4: Social Feed (Weeks 7-8)

- [ ] Design schema
- [ ] Implement pagination
- [ ] Build optimistic updates
- [ ] Write documentation

### Phase 5: Real-time Collab (Weeks 9-11)

- [ ] Design schema
- [ ] Implement subscriptions
- [ ] Build conflict resolution
- [ ] Write documentation

### Phase 6: Advanced Examples (Weeks 12-16)

- [ ] Offline Notes app
- [ ] Multi-tenant SaaS
- [ ] Mobile apps (iOS/Android)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Examples complete | 8 |
| Interactive demos | 5+ |
| CodeSandbox templates | All examples |
| GitHub template usage | 500+ clones |
| Tutorial completions | 1000+ |

---

## Dependencies

| Dependency | Source |
|------------|--------|
| Client libraries | Axis 3 |
| Server implementations | Axis 2 |
| Documentation site | Axis 6 |

---

*Axis 10 Plan v1.0 - Solutions Architect Analysis*
