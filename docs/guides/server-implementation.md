# Server Implementation Guide

Learn how to implement GraphQL Cascade tracking in your GraphQL server.

## Overview

GraphQL Cascade requires server-side tracking of entity relationships to enable automatic cache invalidation. This guide covers implementation for popular GraphQL server libraries.

## Supported Servers

- ✅ **FraiseQL** (Python) - Full support
- ✅ **Apollo Server** (Node.js) - Full support
- ✅ **GraphQL Yoga** (Node.js) - Full support
- 🚧 **Other servers** - Check compatibility or contribute support

## FraiseQL Implementation (Python)

### Installation

```bash
pip install graphql-cascade
```

### Basic Setup

```python
# server.py
from graphql_cascade import CascadeTracker
from fraiseql import GraphQL

# Initialize cascade tracker
tracker = CascadeTracker()

# Create your GraphQL app with cascade tracking
app = GraphQL(
    schema_string=open('schema.graphql').read(),
    tracker=tracker
)

if __name__ == '__main__':
    app.run()
```

### Schema Configuration

Add cascade directives to your mutations:

```graphql
# schema.graphql
type Mutation {
  createUser(input: CreateUserInput!): User
    @cascade(entity: "User", operation: "create")

  updateUser(id: ID!, input: UpdateUserInput!): User
    @cascade(entity: "User", operation: "update")

  deleteUser(id: ID!): Boolean
    @cascade(entity: "User", operation: "delete")

  createPost(input: CreatePostInput!): Post
    @cascade(entity: "Post", operation: "create")

  addComment(postId: ID!, input: CreateCommentInput!): Comment
    @cascade(entity: "Comment", operation: "create")
}
```

### Advanced Configuration

```python
# Advanced tracker configuration
tracker = CascadeTracker(
    # Custom entity ID field (default: 'id')
    id_field='uuid',

    # Enable debug logging
    debug=True,

    # Custom cascade rules
    cascade_rules={
        'User': {
            'related_entities': ['Post', 'Comment', 'Notification'],
            'cascade_operations': ['update', 'delete']
        }
    }
)
```

## Apollo Server Implementation (Node.js)

### Installation

```bash
npm install @graphql-cascade/server graphql-tools
```

### Basic Setup

```javascript
// server.js
import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { cascadeDirective } from '@graphql-cascade/server';

const typeDefs = `
  type Query {
    users: [User!]!
    posts: [Post!]!
  }

  type Mutation {
    createUser(input: CreateUserInput!): User
      @cascade(entity: "User", operation: "create")
    updateUser(id: ID!, input: UpdateUserInput!): User
      @cascade(entity: "User", operation: "update")
  }

  type User {
    id: ID!
    name: String!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    author: User!
  }
`;

const resolvers = {
  // Your resolvers here
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
  schemaTransforms: [cascadeDirective]
});

const server = new ApolloServer({ schema });

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
```

### Custom Cascade Logic

```javascript
import { cascadeDirective, createCascadeTracker } from '@graphql-cascade/server';

// Custom tracker with advanced rules
const tracker = createCascadeTracker({
  rules: {
    User: {
      relationships: {
        posts: 'Post',
        comments: 'Comment'
      },
      cascadeOn: ['update', 'delete']
    }
  }
});

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
  schemaTransforms: [cascadeDirective(tracker)]
});
```

## GraphQL Yoga Implementation

### Setup

```javascript
// server.js
import { createServer } from '@graphql-yoga/node';
import { cascadeDirective } from '@graphql-cascade/server';
import { useDisableIntrospection } from '@graphql-yoga/plugin-disable-introspection';

const server = createServer({
  schema: {
    typeDefs,
    resolvers,
  },
  plugins: [
    cascadeDirective(),
    // other plugins
  ],
});

server.start();
```

## Testing Your Implementation

### Unit Tests

```python
# test_tracker.py
import pytest
from graphql_cascade import CascadeTracker

def test_cascade_tracking():
    tracker = CascadeTracker()

    # Simulate mutation
    tracker.track_cascade('User', '123', 'create')

    # Check that relationships are tracked
    relationships = tracker.get_relationships('User', '123')
    assert 'Post' in relationships  # Assuming schema relationships

def test_cascade_invalidation():
    tracker = CascadeTracker()

    # Track relationships
    tracker.track_relationship('User', '123', 'Post', '456')

    # Simulate update
    invalidated = tracker.get_invalidated_entities('User', '123', 'update')

    # Should include related posts
    assert ('Post', '456') in invalidated
```

### Integration Tests

```javascript
// test/server.test.js
import { ApolloServer } from 'apollo-server';
import { createTestClient } from 'apollo-server-testing';
import { cascadeDirective } from '@graphql-cascade/server';

describe('Cascade Integration', () => {
  let server;
  let client;

  beforeEach(() => {
    const schema = makeExecutableSchema({
      typeDefs: `
        type Mutation {
          createUser(input: CreateUserInput!): User
            @cascade(entity: "User", operation: "create")
        }
        type User { id: ID! name: String! }
      `,
      resolvers,
      schemaTransforms: [cascadeDirective]
    });

    server = new ApolloServer({ schema });
    client = createTestClient(server);
  });

  it('tracks cascade on mutation', async () => {
    const CREATE_USER = gql`
      mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) { id name }
      }
    `;

    const result = await client.mutate({
      mutation: CREATE_USER,
      variables: { input: { name: 'John' } }
    });

    expect(result.data.createUser).toBeDefined();
    // Verify cascade tracking occurred
  });
});
```

## Common Pitfalls

### 1. Missing Entity IDs

**Problem**: Mutations don't specify entity IDs clearly.

```graphql
# ❌ Bad - no clear entity ID
type Mutation {
  updateUser(input: UpdateUserInput!): User
    @cascade(entity: "User", operation: "update")
}

# ✅ Good - explicit ID in mutation
type Mutation {
  updateUser(id: ID!, input: UpdateUserInput!): User
    @cascade(entity: "User", operation: "update")
}
```

### 2. Incorrect Entity Types

**Problem**: Entity type doesn't match your schema.

```graphql
# ❌ Bad - "user" instead of "User"
type Mutation {
  createUser(input: CreateUserInput!): User
    @cascade(entity: "user", operation: "create")  # Wrong case
}

# ✅ Good - matches type name exactly
type Mutation {
  createUser(input: CreateUserInput!): User
    @cascade(entity: "User", operation: "create")
}
```

### 3. Missing Relationships

**Problem**: Schema doesn't define relationships between entities.

```graphql
# ❌ Bad - no relationship defined
type User {
  id: ID!
  name: String!
  posts: [Post!]!  # Relationship exists but not tracked
}

# ✅ Good - add relationship tracking
type User {
  id: ID!
  name: String!
  posts: [Post!]! @related(entity: "Post", field: "authorId")
}
```

### 4. Async Operations

**Problem**: Cascade tracking doesn't work with async resolvers.

```javascript
// ❌ Bad - async resolver not tracked
const resolvers = {
  Mutation: {
    createUser: async (parent, args, context) => {
      // Async database operation
      const user = await db.createUser(args.input);
      // Cascade tracking happens before async operation completes
      return user;
    }
  }
};

// ✅ Good - ensure tracking happens after async operations
const resolvers = {
  Mutation: {
    createUser: async (parent, args, context) => {
      const user = await db.createUser(args.input);

      // Ensure cascade tracking happens
      context.tracker.trackCascade('User', user.id, 'create');

      return user;
    }
  }
};
```

## Performance Considerations

### Memory Usage

- Cascade tracking stores entity relationships in memory
- For high-traffic apps, consider Redis or database storage
- Implement cleanup for old relationship data

### Database Queries

- Avoid N+1 queries when resolving relationships
- Use dataloaders for efficient relationship loading
- Batch relationship tracking operations

## Debugging

### Enable Debug Logging

```python
tracker = CascadeTracker(debug=True)
```

```javascript
const tracker = createCascadeTracker({ debug: true });
```

### Inspect Tracked Relationships

```python
# Check what entities are related
relationships = tracker.get_relationships('User', '123')
print(f"User 123 is related to: {relationships}")
```

### Monitor Cascade Events

```javascript
tracker.on('cascade', (entity, id, operation) => {
  console.log(`Cascade: ${operation} ${entity}:${id}`);
});
```

## Next Steps

- **[Client Integration](./client-integration.md)** - Connect your GraphQL client
- **[Testing Guide](./testing.md)** - Comprehensive testing strategies
- **[Examples](../../examples/)** - Working implementations
- **[Specification](../../specification/)** - Technical details