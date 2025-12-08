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
npm install @graphql-cascade/nuxt @graphql-cascade/apollo

# pnpm
pnpm add @graphql-cascade/nuxt @graphql-cascade/apollo

# yarn
yarn add @graphql-cascade/nuxt @graphql-cascade/apollo
```

## Setup

Add the module to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: ['@graphql-cascade/nuxt'],

  // Optional configuration
  graphqlCascade: {
    enabled: true,
    debug: false,
    autoImports: true
  }
})
```

## Usage

### With Existing Apollo Client Plugin

If you already have an Apollo Client plugin (like PrintOptim), you can use the cascade composable:

```vue
<script setup lang="ts">
import { gql } from '@apollo/client'

// Auto-imported from the module
const { mutate, loading, error, extractedData, isError, errors } = useCascadeMutation(
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
            updated { __typename id operation entity }
            deleted { __typename id }
            invalidations { queryName strategy scope }
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
      successTypes: ['CreatePrintServerSuccess'],
      errorTypes: ['CreatePrintServerError']
    },
    onCascade: (cascade) => {
      console.log('Cascade updates applied:', cascade)
    }
  }
)

async function createServer() {
  const result = await mutate({
    hostname: 'printer.example.com'
  })

  if (result.isError) {
    console.error('Failed to create server:', result.errors)
  } else {
    console.log('Server created:', result.data)
  }
}
</script>

<template>
  <div>
    <button @click="createServer" :disabled="loading">
      Create Server
    </button>
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

### Manual Apollo Client Setup

If you're setting up Apollo Client from scratch, add the cascade link to your link chain:

```typescript
// plugins/1.apollo.client.ts
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client'
import { SetContextLink } from '@apollo/client/link/context'
import { ErrorLink } from '@apollo/client/link/error'
import { DefaultApolloClient } from '@vue/apollo-composable'

export default defineNuxtPlugin(({ vueApp, $cascadeLink }) => {
  const httpLink = new HttpLink({
    uri: 'https://api.example.com/graphql'
  })

  const authLink = new SetContextLink(async (_, { headers }) => {
    const token = await getAuthToken()
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : ''
      }
    }
  })

  const errorLink = new ErrorLink(({ graphQLErrors, networkError }) => {
    // Handle errors
  })

  const apolloClient = new ApolloClient({
    link: authLink
      .concat(errorLink)
      .concat($cascadeLink)  // Add cascade link here
      .concat(httpLink),
    cache: new InMemoryCache()
  })

  vueApp.provide(DefaultApolloClient, apolloClient)
})
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
        updated { __typename id operation entity }
        deleted { __typename id }
      }
    }
  }
`)

async function updateUser() {
  await mutate({
    id: '123',
    input: { name: 'John Doe' }
  })

  // Cascade data is automatically extracted and available
  console.log('Cascade:', cascadeData.value)
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
  enabled?: boolean

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean

  /**
   * Auto-import cascade composables
   * @default true
   */
  autoImports?: boolean
}
```

### Cascade Config

When using `useCascadeMutation`, you can provide a `cascadeConfig`:

```typescript
interface UnionCascadeConfig {
  /**
   * Union type names that contain cascade data (e.g., "CreateUserSuccess")
   */
  successTypes?: string[]

  /**
   * Union type names that indicate errors (e.g., "CreateUserError")
   */
  errorTypes?: string[]

  /**
   * Field name containing the actual data in success responses
   * Default: auto-detected from first non-cascade field
   */
  dataField?: string

  /**
   * Whether to throw an error if cascade data is not found
   * @default false
   */
  throwOnMissing?: boolean
}
```

## Composables

### `useCascadeMutation(document, options)`

Enhanced mutation hook with automatic cascade processing.

**Returns:**
- `mutate(variables)` - Execute the mutation
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

## Examples

### PrintOptim Integration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@graphql-cascade/nuxt'],
  graphqlCascade: {
    debug: process.env.NODE_ENV === 'development'
  }
})
```

```vue
<!-- pages/print-servers/create.vue -->
<script setup lang="ts">
import { CREATE_PRINT_SERVER_MUTATION } from '@/gql/printServers'

const hostname = ref('')

const { mutate, loading, isError, errors, extractedData } = useCascadeMutation(
  CREATE_PRINT_SERVER_MUTATION,
  {
    cascadeConfig: {
      successTypes: ['CreatePrintServerSuccess'],
      errorTypes: ['CreatePrintServerError']
    }
  }
)

async function submit() {
  const result = await mutate({ hostname: hostname.value })

  if (!result.isError) {
    navigateTo('/print-servers')
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
import type { ModuleOptions } from '@graphql-cascade/nuxt'

const config: ModuleOptions = {
  enabled: true,
  debug: false,
  autoImports: true
}
```

## Requirements

- Nuxt 3.0+ or Nuxt 4.0+
- Vue 3.0+
- Apollo Client 3.0+ or 4.0+
- @vue/apollo-composable 4.0+

## License

MIT

## Related

- [@graphql-cascade/apollo](../client-apollo) - Apollo Client integration
- [GraphQL Cascade](../../) - Main repository
