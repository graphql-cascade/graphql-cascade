# Client Integration Guide

Learn how to integrate GraphQL Cascade with popular GraphQL clients.

## Overview

GraphQL Cascade works with all major GraphQL clients. The integration automatically handles cache invalidation when your server sends cascade information.

## Supported Clients

- ✅ **Apollo Client** - Full support with automatic cache updates
- ✅ **Relay** - Full support with store updates
- 🚧 **React Query** - In development
- 🚧 **URQL** - Planned

## Apollo Client Integration

### Installation

```bash
npm install @graphql-cascade/apollo @graphql-cascade/core
```

### Basic Setup

```javascript
// client.js
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { cascadeLink } from '@graphql-cascade/apollo';

const httpLink = createHttpLink({
  uri: 'http://localhost:4000/graphql'
});

const client = new ApolloClient({
  link: cascadeLink.concat(httpLink),
  cache: new InMemoryCache()
});

// Use client as normal
export default client;
```

### How It Works

1. **Mutation Execution**: When you execute a mutation, the cascade link intercepts it
2. **Server Response**: Server includes cascade information in the response
3. **Automatic Invalidation**: Cascade link automatically invalidates related cache entries
4. **Refetch Queries**: Invalidated queries automatically refetch fresh data

### Example Usage

```javascript
// component.js
import { useMutation, useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

const GET_POSTS = gql`
  query GetPosts {
    posts {
      id
      title
      author {
        id
        name
      }
    }
  }
`;

const CREATE_POST = gql`
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      id
      title
      author {
        id
        name
      }
    }
  }
`;

function PostList() {
  const { data, loading } = useQuery(GET_POSTS);
  const [createPost] = useMutation(CREATE_POST);

  const handleCreatePost = async () => {
    await createPost({
      variables: {
        input: { title: 'New Post', authorId: 'user-1' }
      }
    });

    // No manual cache updates needed!
    // The GET_POSTS query automatically refetches
  };

  return (
    <div>
      {data?.posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
      <button onClick={handleCreatePost}>Create Post</button>
    </div>
  );
}
```

### Advanced Configuration

```javascript
import { cascadeLink } from '@graphql-cascade/apollo';

const link = cascadeLink({
  // Custom cascade header (default: 'x-cascade')
  cascadeHeader: 'x-graphql-cascade',

  // Enable debug logging
  debug: true,

  // Custom invalidation strategy
  onInvalidate: (entity, id, operation) => {
    console.log(`Invalidating ${entity}:${id} (${operation})`);
  },

  // Handle cascade errors
  onError: (error) => {
    console.error('Cascade error:', error);
  }
}).concat(httpLink);
```

## Relay Integration

### Installation

```bash
npm install @graphql-cascade/relay @graphql-cascade/core
```

### Basic Setup

```javascript
// environment.js
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { cascadeNetwork } from '@graphql-cascade/relay';

const network = cascadeNetwork({
  url: 'http://localhost:4000/graphql',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const source = new RecordSource();
const store = new Store(source);

export default new Environment({
  network,
  store,
});
```

### Usage with Relay Hooks

```javascript
// PostList.js
import { useQuery, useMutation } from 'react-relay';
import { graphql } from 'react-relay';

const postListQuery = graphql`
  query PostListQuery {
    posts {
      id
      title
      author {
        id
        name
      }
    }
  }
`;

const createPostMutation = graphql`
  mutation CreatePostMutation($input: CreatePostInput!) {
    createPost(input: $input) {
      id
      title
      author {
        id
        name
      }
    }
  }
`;

function PostList() {
  const data = useQuery(postListQuery);
  const [createPost, isCreating] = useMutation(createPostMutation);

  const handleCreatePost = () => {
    createPost({
      variables: {
        input: { title: 'New Post', authorId: 'user-1' }
      },
      onCompleted: () => {
        // Cache automatically updated by cascade!
      }
    });
  };

  return (
    <div>
      {data.posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
      <button onClick={handleCreatePost} disabled={isCreating}>
        Create Post
      </button>
    </div>
  );
}
```

## React Query Integration

### Installation

```bash
npm install @graphql-cascade/react-query @graphql-cascade/core
```

### Basic Setup

```javascript
// client.js
import { QueryClient } from '@tanstack/react-query';
import { cascadeQueryClient } from '@graphql-cascade/react-query';

export const queryClient = cascadeQueryClient({
  // Standard React Query options
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },

  // Cascade-specific options
  cascade: {
    debug: true,
    onInvalidate: (key) => {
      console.log('Invalidating query:', key);
    }
  }
});
```

### Usage

```javascript
// component.js
import { useQuery, useMutation } from '@tanstack/react-query';
import { request } from 'graphql-request';

const endpoint = 'http://localhost:4000/graphql';

function PostList() {
  const { data } = useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const query = `
        query GetPosts {
          posts {
            id
            title
            author { id name }
          }
        }
      `;
      return request(endpoint, query);
    }
  });

  const createPostMutation = useMutation({
    mutationFn: async (input) => {
      const mutation = `
        mutation CreatePost($input: CreatePostInput!) {
          createPost(input: $input) {
            id
            title
            author { id name }
          }
        }
      `;
      return request(endpoint, mutation, { input });
    },
    onSuccess: () => {
      // Cascade automatically invalidates related queries
      // No manual invalidation needed!
    }
  });

  return (
    <div>
      {data?.posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
      <button onClick={() => createPostMutation.mutate({
        title: 'New Post',
        authorId: 'user-1'
      })}>
        Create Post
      </button>
    </div>
  );
}
```

## URQL Integration

### Installation

```bash
npm install @graphql-cascade/urql @graphql-cascade/core
```

### Basic Setup

```javascript
// client.js
import { createClient } from 'urql';
import { cascadeExchange } from '@graphql-cascade/urql';

export const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [
    cascadeExchange({
      debug: true,
      onInvalidate: (typename, id) => {
        console.log(`Invalidating ${typename}:${id}`);
      }
    }),
    // other exchanges
  ],
});
```

## Configuration Options

### Global Options

```javascript
const cascadeConfig = {
  // Enable debug logging
  debug: process.env.NODE_ENV === 'development',

  // Custom cascade header
  cascadeHeader: 'x-graphql-cascade',

  // Error handling
  onError: (error) => {
    console.error('Cascade error:', error);
  },

  // Invalidation callbacks
  onInvalidate: (entity, id, operation) => {
    console.log(`Invalidating ${entity}:${id} (${operation})`);
  },

  // Custom invalidation logic
  shouldInvalidate: (entity, id, operation, context) => {
    // Return false to skip invalidation
    return true;
  }
};
```

### Client-Specific Options

#### Apollo Client
```javascript
const link = cascadeLink(cascadeConfig).concat(httpLink);
```

#### Relay
```javascript
const network = cascadeNetwork({
  url: 'http://localhost:4000/graphql',
  ...cascadeConfig
});
```

#### React Query
```javascript
const queryClient = cascadeQueryClient({
  ...reactQueryOptions,
  cascade: cascadeConfig
});
```

## Debugging

### Enable Debug Logging

All clients support debug logging to see cascade activity:

```javascript
const config = {
  debug: true,
  onInvalidate: (entity, id, operation) => {
    console.log(`🔄 Cascade: ${operation} ${entity}:${id}`);
  }
};
```

### Common Debug Output

```
🔄 Cascade: create User:123
🔄 Cascade: invalidate Post:456 (related to User:123)
🔄 Cascade: invalidate Comment:789 (related to Post:456)
🔄 Cascade: refetching query GetPosts
```

### Inspecting Cache State

#### Apollo Client
```javascript
// Check cache contents
console.log(client.cache.extract());

// Manually trigger invalidation for debugging
client.cache.evict({
  fieldName: 'posts',
  broadcast: true
});
```

#### React Query
```javascript
// Check query cache
console.log(queryClient.getQueryCache().getAll());

// Invalidate manually for testing
queryClient.invalidateQueries(['posts']);
```

### Troubleshooting

#### Cascades Not Working

1. **Check server setup**: Ensure server includes cascade directives
2. **Verify client config**: Confirm cascade link/exchange is properly configured
3. **Check network**: Look for cascade headers in network requests
4. **Enable debug**: Turn on debug logging to see cascade activity

#### Unexpected Invalidations

1. **Check relationships**: Verify entity relationships are correctly defined
2. **Review schema**: Ensure cascade directives match your schema
3. **Debug logging**: Use debug mode to trace invalidation paths

#### Performance Issues

1. **Too many refetches**: Consider optimistic updates
2. **Large cascades**: Implement pagination or selective invalidation
3. **Frequent mutations**: Batch mutations or debounce invalidations

## Best Practices

### 1. Test Cascade Behavior

```javascript
describe('Cascade Integration', () => {
  it('automatically invalidates related queries', async () => {
    // Set up initial data
    await client.query(GET_POSTS);

    // Perform mutation
    await client.mutate(CREATE_POST, {
      variables: { input: { title: 'Test', authorId: '1' } }
    });

    // Verify cache was invalidated (query refetched)
    expect(mockFetch).toHaveBeenCalledTimes(2); // initial + refetch
  });
});
```

### 2. Handle Loading States

```javascript
function PostList() {
  const { data, loading, error } = useQuery(GET_POSTS);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.posts.map(post => (
        <Post key={post.id} post={post} />
      ))}
    </div>
  );
}
```

### 3. Optimistic Updates

Combine cascades with optimistic updates for better UX:

```javascript
const [createPost] = useMutation(CREATE_POST, {
  optimisticResponse: {
    createPost: {
      id: 'temp-id',
      title: variables.input.title,
      author: { id: variables.input.authorId, name: 'Unknown' }
    }
  },
  update: (cache, { data }) => {
    // Cascade will handle cache updates, but you can add optimistic updates here
  }
});
```

## Next Steps

- **[Server Implementation](./server-implementation.md)** - Set up cascade tracking
- **[Examples](../../examples/)** - Complete working applications
- **[Specification](../../specification/)** - Technical details
- **[API Reference](../api/)** - Complete API documentation