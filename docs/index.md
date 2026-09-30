---
layout: home

hero:
  name: GraphQL Cascade
  text: Cache updates that come with the mutation
  tagline: The server returns everything a mutation changed. Clients apply it. No update functions, no guessing which queries to refetch.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: View Specification
      link: /specification/

features:
  - title: Complete by design
    details: The server lists every entity a mutation changed, or covers it with a type invalidation when the list would be too large. Nothing stale survives in the cache.

  - title: Works with your client
    details: Libraries for Apollo Client, urql, Relay and React Query apply cascades to the cache you already use.

  - title: Plain GraphQL
    details: A cascade is an ordinary field of the mutation payload, defined by a reference schema and checked by a conformance suite.

  - title: Fewer round trips
    details: Updated entities are written into the cache in place, so queries that show them are current without a refetch.
---

## What is GraphQL Cascade?

GraphQL Cascade is a specification and a set of libraries for keeping client caches in sync after mutations. The server returns, with each mutation, the entities it created, updated or deleted, plus hints about which cached queries became stale. Client libraries apply that cascade to the cache.

```typescript
// Without Cascade: every mutation carries its own cache logic
const [createTodo] = useMutation(CREATE_TODO, {
  update(cache, { data }) {
    const existing = cache.readQuery({ query: GET_TODOS });
    cache.writeQuery({
      query: GET_TODOS,
      data: { todos: [...existing.todos, data.createTodo.data] },
    });
  },
});

// With Cascade: the response says what changed
const [createTodo] = useCascadeMutation(CREATE_TODO);
```

## How It Works

1. **The server tracks changes.** While a mutation runs, the server records every entity it creates, updates or deletes.
2. **The response carries the cascade.** The mutation payload has a `cascade` field listing those entities and the queries they affect.
3. **The client applies it.** A Cascade client library writes the entities into the cache, evicts deleted ones and invalidates the queries the server named.

```graphql
mutation CreateTodo($input: CreateTodoInput!) {
  createTodo(input: $input) {
    data { id title completed }
    cascade {
      updated { typename id operation entity { ...CascadeEntity } }
      deleted { typename id }
      invalidations { queryName strategy scope }
      metadata { timestamp affectedCount }
    }
  }
}
```

`CascadeEntity` is a fragment selecting the fields your queries read on each type; [`@graphql-cascade/codegen`](https://github.com/graphql-cascade/graphql-cascade/tree/main/packages/codegen#cascadeentityfragment) generates it.

<div style="display: flex; gap: 1rem; margin-top: 1rem;">
  <a href="/guide/" style="display: inline-block; padding: 0.75rem 1.5rem; background: var(--vp-button-brand-bg); color: var(--vp-button-brand-text); border-radius: 8px; text-decoration: none; font-weight: 500;">Get Started →</a>
  <a href="/specification/" style="display: inline-block; padding: 0.75rem 1.5rem; background: var(--vp-button-alt-bg); color: var(--vp-button-alt-text); border-radius: 8px; text-decoration: none; font-weight: 500;">Read the Spec</a>
</div>
