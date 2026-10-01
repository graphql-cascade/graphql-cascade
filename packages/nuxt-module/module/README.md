# @graphql-cascade/nuxt

> Nuxt module for GraphQL Cascade - Zero-config integration for automatic cache invalidation

## Features

- 🚀 **Zero-config integration** with Nuxt 3/4
- 🔄 **Automatic cascade processing** for mutations
- 🎯 **Union type support** for error handling patterns
- 🧩 **Vue Composition API** helpers (`useCascadeMutation`)
- 📦 **Auto-imports** for composables
- 🎨 **TypeScript** support out of the box
- ⚡ **Works with existing Apollo Client** setup

## Installation

```bash
# npm
npm install @graphql-cascade/nuxt @graphql-cascade/apollo @apollo/client@3 @vue/apollo-composable graphql

# pnpm
pnpm add @graphql-cascade/nuxt @graphql-cascade/apollo @apollo/client@3 @vue/apollo-composable graphql

# yarn
yarn add @graphql-cascade/nuxt @graphql-cascade/apollo @apollo/client@3 @vue/apollo-composable graphql
```

## Setup

Add the module to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: ["@graphql-cascade/nuxt"],

  // Optional configuration
  graphqlCascade: {
    enabled: true,
    debug: false,
    autoImports: true,
  },
});
```

## Usage

### With Existing Apollo Client Plugin

If you already have an Apollo Client plugin (like PrintOptim), you can use the cascade composable:

```vue
<script setup lang="ts">
import { gql } from "@apollo/client";

// Auto-imported from the module
const { mutate, loading, error, extractedData, isError, errors } =
  useCascadeMutation(
    gql`
      mutation CreatePrintServer($hostname: Hostname!) {
        createPrintServer(input: { hostname: $hostname }) {
          ... on CreatePrintServerSuccess {
            printServer {
              id
              hostname
              nTotalAllocations
            }
            cascade {
              updated {
                typename
                id
                operation
                entity
              }
              deleted {
                typename
                id
              }
              invalidations {
                queryName
                strategy
                scope
              }
            }
          }
          ... on CreatePrintServerError {
            errors {
              identifier
              message
            }
          }
        }
      }
    `,
    {
      cascadeConfig: {
        successTypes: ["CreatePrintServerSuccess"],
        errorTypes: ["CreatePrintServerError"],
      },
      onCascade: (cascade) => {
        console.log("Cascade updates applied:", cascade);
      },
    },
  );

async function createServer() {
  const result = await mutate({
    hostname: "printer.example.com",
  });

  if (result.isError) {
    console.error("Failed to create server:", result.errors);
  } else {
    console.log("Server created:", result.data);
  }
}
</script>

<template>
  <div>
    <button @click="createServer" :disabled="loading">Create Server</button>
    <div v-if="error">{{ error.message }}</div>
    <div v-if="isError">
      <p v-for="err in errors" :key="err.message">{{ err.message }}</p>
    </div>
    <div v-if="extractedData">
      Success! Created: {{ extractedData.hostname }}
    </div>
  </div>
</template>
```

### Providing the Apollo Client

The composables use the Apollo Client that `@vue/apollo-composable` provides. If your app does not provide one yet, add a plugin:

```typescript
// plugins/apollo.ts
import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client/core";
import { DefaultApolloClient } from "@vue/apollo-composable";

export default defineNuxtPlugin(({ vueApp }) => {
  const apolloClient = new ApolloClient({
    link: new HttpLink({ uri: "https://api.example.com/graphql" }),
    cache: new InMemoryCache(),
  });

  vueApp.provide(DefaultApolloClient, apolloClient);
});
```

### Non-Union Type Mutations

For mutations that don't use union types:

```vue
<script setup lang="ts">
const { mutate, cascadeData } = useCascadeMutation(gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      success
      data {
        id
        name
        email
      }
      cascade {
        updated {
          typename
          id
          operation
          entity
        }
        deleted {
          typename
          id
        }
      }
    }
  }
`);

async function updateUser() {
  await mutate({
    id: "123",
    input: { name: "John Doe" },
  });

  // The cascade is applied to the Apollo cache, and available
  console.log("Cascade:", cascadeData.value);
}
</script>
```

## Configuration

### Module Options

```typescript
interface ModuleOptions {
  /**
   * Enable GraphQL Cascade integration
   * @default true
   */
  enabled?: boolean;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Auto-import cascade composables
   * @default true
   */
  autoImports?: boolean;
}
```

### Cascade Config

When using `useCascadeMutation`, you can provide a `cascadeConfig`:

```typescript
interface UnionCascadeConfig {
  /**
   * Union type names that contain cascade data (e.g., "CreateUserSuccess")
   */
  successTypes?: string[];

  /**
   * Union type names that indicate errors (e.g., "CreateUserError")
   */
  errorTypes?: string[];

  /**
   * Field name containing the actual data in success responses
   * Default: auto-detected from first non-cascade field
   */
  dataField?: string;

  /**
   * Whether to throw an error if cascade data is not found
   * @default false
   */
  throwOnMissing?: boolean;
}
```

## Composables

### `useCascadeMutation(document, options)`

`useMutation` that applies the cascade of every successful mutation to the Apollo cache: it writes the updated entities, evicts the deleted ones and applies the invalidations, so queries reading invalidated fields refetch.

**Returns:**

- `mutate(variables)` - Execute the mutation and apply its cascade
- `loading` - Loading state
- `error` - Error state
- `cascadeData` - Extracted cascade updates
- `extractedData` - Extracted data payload
- `isError` - Whether the mutation returned an error union type
- `errors` - Array of errors from error union types

### `useCascadeClient()`

Get access to the Apollo Client with cascade support.

**Returns:**

- `client` - The Apollo Client instance
- `resolveClient()` - Resolve the client (for multi-client setups)

### `useCascadeTracker()`

Track cascade updates across mutations for debugging and analytics.

**Returns:**

- `cascadeHistory` - Array of all cascade updates
- `lastCascade` - Most recent cascade update
- `cascadeCount` - Total number of cascades tracked
- `addCascade(cascade)` - Manually add a cascade to history
- `clearHistory()` - Clear the cascade history

**Example:**

```vue
<script setup>
const { cascadeHistory, lastCascade, cascadeCount } = useCascadeTracker();

watch(lastCascade, (cascade) => {
  console.log("Cascade update:", cascade);
  console.log("Total cascades:", cascadeCount.value);
});
</script>
```

### `useCascadeQuery(document, variables, options)`

`useQuery` for queries that cascades invalidate: when a cascade evicts fields the query reads, the query refetches them.

**Returns:**
Same as `useQuery` from `@vue/apollo-composable`

### `useCascadeBatch()`

Execute multiple mutations in parallel, applying the cascade of each.

**Returns:**

- `executeBatch(mutations)` - Execute array of mutations
- `loading` - Loading state
- `results` - Array of successful results
- `errors` - Array of errors

**Example:**

```vue
<script setup>
const { executeBatch, loading, results } = useCascadeBatch();

async function updateMultiple() {
  const result = await executeBatch([
    { mutation: UPDATE_USER, variables: { id: "1", name: "Alice" } },
    { mutation: UPDATE_USER, variables: { id: "2", name: "Bob" } },
  ]);

  if (result.allSucceeded) {
    console.log("All updates completed!");
  }
}
</script>
```

### `useCascadeOptimistic()`

Optimistic updates, each written to its own Apollo optimistic layer.

**Returns:**

- `optimisticUpdate(data)` - Write an entity to an optimistic layer
- `clearOptimisticUpdates()` - Remove every optimistic layer
- `mutate(mutation, options)` - Execute the mutation, apply its cascade and remove the optimistic layers when it settles, so a failed mutation reverts them
- `optimisticUpdates` - Array of current optimistic updates

**Example:**

```vue
<script setup>
const { optimisticUpdate, mutate } = useCascadeOptimistic();

async function updateUser(id, name) {
  // Optimistically update UI
  optimisticUpdate({ __typename: "User", id, name });

  // Execute mutation (UI reverts if it fails)
  await mutate(UPDATE_USER_MUTATION, {
    variables: { id, name },
  });
}
</script>
```

### `useCascadeUnionQuery(document, variables, options)`

Enhanced query hook for handling union type responses (like error handling patterns).

**Returns:**

- Same as `useQuery` plus:
- `data` - Extracted data from union response
- `isError` - Whether the response is an error type
- `errors` - Array of errors from error union types

**Options:**

- `unionConfig` - Configuration for union type handling (same as `useCascadeMutation`)

**Example:**

```vue
<script setup>
const { data, isError, errors, loading } = useCascadeUnionQuery(
  GET_USER_QUERY,
  { id: "123" },
  {
    unionConfig: {
      successTypes: ["GetUserSuccess"],
      errorTypes: ["GetUserError"],
    },
  },
);
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else-if="isError">
    <p v-for="error in errors">{{ error.message }}</p>
  </div>
  <div v-else>{{ data }}</div>
</template>
```

## Examples

### PrintOptim Integration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@graphql-cascade/nuxt"],
  graphqlCascade: {
    debug: process.env.NODE_ENV === "development",
  },
});
```

```vue
<!-- pages/print-servers/create.vue -->
<script setup lang="ts">
import { CREATE_PRINT_SERVER_MUTATION } from "@/gql/printServers";

const hostname = ref("");

const { mutate, loading, isError, errors, extractedData } = useCascadeMutation(
  CREATE_PRINT_SERVER_MUTATION,
  {
    cascadeConfig: {
      successTypes: ["CreatePrintServerSuccess"],
      errorTypes: ["CreatePrintServerError"],
    },
  },
);

async function submit() {
  const result = await mutate({ hostname: hostname.value });

  if (!result.isError) {
    navigateTo("/print-servers");
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <input v-model="hostname" placeholder="printer.example.com" />
    <button :disabled="loading">Create Server</button>

    <div v-if="isError" class="errors">
      <p v-for="error in errors" :key="error.message">
        {{ error.message }}
      </p>
    </div>
  </form>
</template>
```

## TypeScript Support

The module provides full TypeScript support with auto-completion:

```typescript
import type { ModuleOptions } from "@graphql-cascade/nuxt";

const config: ModuleOptions = {
  enabled: true,
  debug: false,
  autoImports: true,
};
```

## Requirements

- Node.js 22+
- Nuxt 3 or 4
- Apollo Client 3 (3.4.13+): `@vue/apollo-composable` 4 does not support Apollo Client 4
- @vue/apollo-composable 4

## License

MIT

## Related

- [@graphql-cascade/apollo](../../client-apollo/apollo) - Apollo Client integration
- [GraphQL Cascade](../../) - Main repository
