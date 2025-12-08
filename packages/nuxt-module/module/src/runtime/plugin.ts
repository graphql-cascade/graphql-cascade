import { defineNuxtPlugin } from '#app'
import { ApolloLink } from '@apollo/client'
import { useApolloClient } from '@vue/apollo-composable'
import { extractCascadeFromUnion, extractCascadeFromMutationResult } from '@graphql-cascade/apollo'

/**
 * Create an Apollo Link that processes GraphQL Cascade responses
 */
function createCascadeLink() {
  return new ApolloLink((operation, forward) => {
    return forward(operation).map(response => {
      // Check if this is a mutation with cascade data
      if (operation.query.definitions.some(
        def => def.kind === 'OperationDefinition' && def.operation === 'mutation'
      )) {
        try {
          // Extract cascade data from the response
          const extracted = extractCascadeFromMutationResult(response.data)

          if (extracted.cascade && !extracted.isError) {
            // TODO: Apply cascade updates to cache
            // This will be implemented when we have access to the cascade client
            if (process.dev) {
              console.log('[GraphQL Cascade] Cascade data detected:', extracted.cascade)
            }
          }
        } catch (error) {
          if (process.dev) {
            console.warn('[GraphQL Cascade] Error processing cascade:', error)
          }
        }
      }

      return response
    })
  })
}

export default defineNuxtPlugin({
  name: 'graphql-cascade',
  enforce: 'post', // Run after other plugins
  setup() {
    // In a Nuxt app, we need to wait for the Apollo Client to be available
    // This plugin provides the cascade link that can be manually added to the Apollo Client

    return {
      provide: {
        cascadeLink: createCascadeLink()
      }
    }
  }
})

declare module '#app' {
  interface NuxtApp {
    $cascadeLink: ApolloLink
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $cascadeLink: ApolloLink
  }
}
