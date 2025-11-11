# GraphQL Cascade Examples

This directory contains working examples and reference implementations demonstrating GraphQL Cascade in real applications. Each example shows how to implement automatic cache management with different complexity levels and use cases.

## 📚 Available Examples

### ✅ Complete Working Examples

#### 🗂️ Todo App (`todo-app/`)
**Status**: ✅ Complete | **Complexity**: Beginner | **Features**: CRUD operations, relationships

A complete todo application demonstrating GraphQL Cascade with basic CRUD operations. Shows how mutations automatically update related cache entries without manual invalidation.

**What you'll learn:**
- Basic GraphQL Cascade setup
- Entity relationships and cascading updates
- Apollo Client integration
- Server-side cascade tracking

**Technologies:**
- **Backend**: Python/FraiseQL server
- **Frontend**: TypeScript/React with Apollo Client
- **Database**: In-memory (easily replaceable)

**Quick Start:**
```bash
cd todo-app/backend
python server.py

# In another terminal:
cd todo-app/frontend
npm install
npm start
```

**Files:**
- `backend/schema.graphql` - Complete GraphQL schema with cascade types
- `backend/server.py` - Python server implementation
- `frontend/src/example.ts` - Apollo Client integration examples

---

### 🚧 Planned Examples

#### 📝 Blog Platform (`blog-platform/`)
**Status**: 🚧 Planned | **Complexity**: Intermediate | **Features**: Complex relationships, real-time

A comprehensive blog platform with users, posts, comments, and likes. Demonstrates cascading updates through complex entity relationships.

**Planned Features:**
- User management and authentication
- Blog post creation and editing
- Nested comments system
- Like/favorite functionality
- Real-time notifications
- Multiple client implementations

**Technologies (Planned):**
- **Backend**: Python/FraiseQL or Node.js
- **Frontend**: React with Apollo Client + React Query
- **Real-time**: GraphQL Subscriptions

#### 🤝 Real-time Collaboration (`real-time-collab/`)
**Status**: 🚧 Planned | **Complexity**: Advanced | **Features**: Multi-user editing, conflict resolution

An advanced collaborative editing application demonstrating real-time features with GraphQL Cascade and operational transforms.

**Planned Features:**
- Multi-user document editing
- Live cursors and user presence
- Conflict-free replicated data types (CRDT)
- Operational transforms for consistency
- Real-time subscriptions with cascades

**Technologies (Planned):**
- **Backend**: Node.js with real-time subscriptions
- **Frontend**: React with operational transforms
- **Real-time**: WebSocket-based updates

---

## 📋 Schema Examples

Reference GraphQL schemas demonstrating different Cascade patterns:

### `schema_simple_crud.graphql`
Basic CRUD operations with cascade compliance. Shows the minimum required schema structure.

### `schema_nested_entities.graphql`
Demonstrates cascading through nested entity relationships and complex data structures.

### `schema_many_to_many.graphql`
Shows cascade handling for many-to-many relationships and junction tables.

### `schema_custom_actions.graphql`
Examples of custom business logic actions with cascade support.

---

## 🏗️ Server Implementation Examples

### `server_strawberry.py`
Python/FraiseQL server implementation showing cascade tracking integration.

### `server_apollo.ts`
Node.js/Apollo Server implementation demonstrating cascade middleware.

---

## 🎯 Learning Path

### For Beginners
1. **Start Here**: [Todo App](todo-app/) - Complete working example
2. **Understand Schemas**: Review `schema_simple_crud.graphql`
3. **Try Client Integration**: Run the todo app frontend

### For Intermediate Developers
1. **Complex Relationships**: Study `schema_nested_entities.graphql`
2. **Many-to-Many**: Review `schema_many_to_many.graphql`
3. **Custom Actions**: Check `schema_custom_actions.graphql`

### For Advanced Users
1. **Real-time Features**: Wait for collaboration example
2. **Custom Server Logic**: Study server implementations
3. **Performance Optimization**: Review cascade metadata handling

---

## 🛠️ Running Examples

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+ (for Python examples)
- Basic understanding of GraphQL

### Todo App Setup
```bash
# Backend
cd examples/todo-app/backend
pip install graphql-cascade strawberry-graphql
python server.py

# Frontend (new terminal)
cd examples/todo-app/frontend
npm install
npm run dev
```

### General Setup
```bash
# Install dependencies
npm install
# or
pip install -r requirements.txt

# Run the example
npm start
# or
python server.py
```

---

## 🤝 Contributing Examples

We welcome contributions of new examples! See our [contributing guide](../CONTRIBUTING.md) for details.

**Example Ideas:**
- E-commerce application
- Social media platform
- Project management tool
- Content management system
- Chat application

**Guidelines:**
- Include both backend and frontend implementations
- Provide clear setup instructions
- Add comprehensive documentation
- Test with multiple GraphQL clients
- Demonstrate real-world use cases

---

## 📊 Example Status

| Example | Status | Backend | Frontend | Complexity | Features |
|---------|--------|---------|----------|------------|----------|
| Todo App | ✅ Complete | Python | React/Apollo | Beginner | CRUD, Relationships |
| Blog Platform | 🚧 Planned | Python/Node | React | Intermediate | Complex relationships |
| Real-time Collab | 🚧 Planned | Node | React | Advanced | Multi-user, CRDT |

---

## 🔗 Related Resources

- **[Specification](../specification/)** - Formal technical specification
- **[Packages](../packages/)** - Client libraries and integrations
- **[Reference](../reference/)** - Reference implementations
- **[Docs](../docs/)** - Implementation guides and tutorials

---

*Examples help you learn GraphQL Cascade by seeing it in action!*
