# Quick Start

This guide builds a todo list whose mutations return cascades: an Apollo Server back end with `@graphql-cascade/server`, and an Apollo Client front end with `@graphql-cascade/apollo`.

## 1. Install

```bash
npm install @graphql-cascade/server @apollo/server graphql
npm install @graphql-cascade/apollo @apollo/client
```

## 2. Schema

Add the core Cascade types from the [reference schema](https://github.com/graphql-cascade/graphql-cascade/blob/main/reference/cascade_base.graphql) (`CascadeResponse`, `CascadeUpdates`, `UpdatedEntity`, `DeletedEntity`, and the types they use) to your schema. Then give each mutation a payload that implements `CascadeResponse`:

```graphql
type Todo implements Node {
  id: ID!
  title: String!
  completed: Boolean!
}

type CreateTodoCascade implements CascadeResponse {
  success: Boolean!
  errors: [CascadeError!]
  data: Todo
  cascade: CascadeUpdates!
}

type DeleteTodoCascade implements CascadeResponse {
  success: Boolean!
  errors: [CascadeError!]
  data: Todo
  cascade: CascadeUpdates!
}

type Query {
  todos: [Todo!]!
}

type Mutation {
  createTodo(title: String!): CreateTodoCascade!
  deleteTodo(id: ID!): DeleteTodoCascade!
}
```

Use globally unique IDs, such as UUIDs, so every client cache recognizes the entities in a cascade.

## 3. Server

Each resolver records what it changes on a `CascadeTracker`, then builds its response with a `CascadeBuilder`:

```typescript
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import {
  CascadeBuilder,
  CascadeTracker,
  InvalidationScope,
  InvalidationStrategy,
  notFoundError,
  type Invalidator,
} from "@graphql-cascade/server";
import { randomUUID } from "node:crypto";

const todos = new Map<string, { id: string; title: string; completed: boolean }>();

// The list of todos changes whenever a todo is created or deleted
const invalidator: Invalidator = {
  computeInvalidations: () => [
    {
      queryName: "todos",
      strategy: InvalidationStrategy.INVALIDATE,
      scope: InvalidationScope.EXACT,
    },
  ],
};

const resolvers = {
  Query: {
    todos: () => [...todos.values()],
  },
  Mutation: {
    createTodo(_: unknown, { title }: { title: string }) {
      const tracker = new CascadeTracker();
      tracker.startTransaction();

      const todo = { id: randomUUID(), title, completed: false };
      todos.set(todo.id, todo);
      tracker.trackCreate({ __typename: "Todo", ...todo });

      return new CascadeBuilder(tracker, invalidator).buildResponse(todo);
    },

    deleteTodo(_: unknown, { id }: { id: string }) {
      const tracker = new CascadeTracker();
      tracker.startTransaction();
      const builder = new CascadeBuilder(tracker, invalidator);

      const todo = todos.get(id);
      if (!todo) {
        return builder.buildErrorResponse([notFoundError(`Todo ${id} not found`)]);
      }
      todos.delete(id);
      tracker.trackDelete("Todo", id);

      return builder.buildResponse(todo);
    },
  },
};

const server = new ApolloServer({ typeDefs, resolvers });
await startStandaloneServer(server, { listen: { port: 4000 } });
```

`typeDefs` is the schema from step 2, including the reference types.

## 4. Client

Wrap your app in Apollo's `ApolloProvider` as usual, then use `useCascadeMutation` instead of `useMutation`. It applies each response's cascade to Apollo's cache:

```tsx
import { gql, useQuery } from "@apollo/client";
import { useCascadeMutation } from "@graphql-cascade/apollo";

const TODOS = gql`
  query Todos {
    todos { id title completed }
  }
`;

const CREATE_TODO = gql`
  mutation CreateTodo($title: String!) {
    createTodo(title: $title) {
      success
      errors { message code }
      data { id title completed }
      cascade {
        updated {
          typename
          id
          operation
          entity { id ... on Todo { title completed } }
        }
        deleted { typename id }
        invalidations { queryName strategy scope }
        metadata { timestamp affectedCount }
      }
    }
  }
`;

function TodoList() {
  const { data } = useQuery(TODOS);
  const [createTodo] = useCascadeMutation(CREATE_TODO);

  return (
    <>
      <button onClick={() => createTodo({ variables: { title: "Buy milk" } })}>
        Add
      </button>
      <ul>
        {data?.todos.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </>
  );
}
```

In a real project, generate the `entity { … }` selection instead of writing it: [`@graphql-cascade/codegen`](https://github.com/graphql-cascade/graphql-cascade/tree/main/packages/codegen#cascadeentityfragment) builds a `CascadeEntity` fragment from your queries, and mutations select `entity { ...CascadeEntity }`.

## What Just Happened?

When you click **Add**:

1. The resolver creates the todo, tracks it, and returns it in `cascade.updated`, with an invalidation hint for the `todos` query.
2. `useCascadeMutation` writes the new `Todo` into Apollo's cache and invalidates `todos`.
3. The `todos` query refetches on its next read and shows the new item. No `update` function, no `refetchQueries`.

Deleting works the same way: the todo arrives in `cascade.deleted`, and the client evicts it from the cache.

## Next Steps

- **[Core Concepts](/guide/concepts)**: how cascades are built, limited and applied
- **[Server Setup](/server/)**: Express, NestJS and the Apollo Server plugin
- **[Client Integration](/clients/)**: urql, Relay and React Query
