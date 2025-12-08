---
layout: home

hero:
  name: GraphQL Cascade
  text: Automatic Cache Updates for GraphQL
  tagline: Stop writing manual cache update code. Let Cascade handle it automatically.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: View Specification
      link: /specification/

features:
  - icon: 🚀
    title: Zero Configuration
    details: Works out of the box with Apollo Client, React Query, Relay, and URQL. No complex cache update logic required.

  - icon: 🎯
    title: Type Safe
    details: Full TypeScript support with automatic type inference. Catch errors at compile time, not runtime.

  - icon: ⚡
    title: High Performance
    details: Minimal overhead with intelligent batching and deduplication. Servers track what changed, clients update automatically.

  - icon: 🔄
    title: Real-time Ready
    details: Built-in support for subscriptions and optimistic updates. Keep your UI in sync effortlessly.

  - icon: 🛡️
    title: Production Tested
    details: Battle-tested patterns with comprehensive security and performance requirements.

  - icon: 📦
    title: Framework Agnostic
    details: Works with any GraphQL client or server. Integrate with your existing stack in minutes.
---

## What is GraphQL Cascade?

GraphQL Cascade is a protocol and set of libraries that **automatically update your client cache** when mutations occur. Instead of manually writing cache update logic for every mutation, Cascade extends GraphQL responses with metadata that tells clients exactly what changed.

```typescript
// Without Cascade: Manual cache updates
const [createTodo] = useMutation(CREATE_TODO, {
  update(cache, { data }) {
    // 😫 Manual cache management
    const existing = cache.readQuery({ query: GET_TODOS });
    cache.writeQuery({
      query: GET_TODOS,
      data: { todos: [...existing.todos, data.createTodo] }
    });
  }
});

// With Cascade: Automatic cache updates
const [createTodo] = useMutation(CREATE_TODO);
// ✨ Cache updates automatically!
```

## How It Works

1. **Server Tracks Changes**: Your GraphQL server tracks which entities are created, updated, or invalidated during mutations
2. **Response Includes Metadata**: Mutation responses include cascade metadata describing what changed
3. **Client Auto-Updates**: Client libraries automatically update the cache based on the metadata

No manual cache management code. No complex update logic. It just works.

## Quick Example

```graphql
mutation CreateTodo($input: CreateTodoInput!) {
  createTodo(input: $input) {
    todo {
      id
      title
      completed
    }
    # Cascade metadata included automatically
    __cascade {
      created {
        __typename
        id
      }
      invalidated {
        __typename
        id
      }
    }
  }
}
```

The client reads the cascade metadata and automatically:
- Adds new entities to the cache
- Updates existing entities
- Invalidates outdated queries
- Triggers re-fetches where needed

## Ready to Start?

<div style="display: flex; gap: 1rem; margin-top: 1rem;">
  <a href="/guide/" style="display: inline-block; padding: 0.75rem 1.5rem; background: var(--vp-button-brand-bg); color: var(--vp-button-brand-text); border-radius: 8px; text-decoration: none; font-weight: 500;">Get Started →</a>
  <a href="/specification/" style="display: inline-block; padding: 0.75rem 1.5rem; background: var(--vp-button-alt-bg); color: var(--vp-button-alt-text); border-radius: 8px; text-decoration: none; font-weight: 500;">Read the Spec</a>
</div>
