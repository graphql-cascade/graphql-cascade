import { useNuxtApp } from '#app'
import { useMutation, useApolloClient } from '@vue/apollo-composable'
import type { DocumentNode } from '@apollo/client'
import type { MutationOptions, MutationResult } from '@vue/apollo-composable'
import { extractCascadeFromMutationResult, type UnionCascadeConfig } from '@graphql-cascade/apollo'
import { ref, unref } from 'vue'

export interface CascadeMutationOptions<TResult, TVariables> extends MutationOptions<TResult, TVariables> {
  /**
   * Configuration for extracting cascade data from union types
   */
  cascadeConfig?: UnionCascadeConfig

  /**
   * Callback when cascade updates are applied
   */
  onCascade?: (cascade: any) => void
}

/**
 * Enhanced useMutation hook with automatic cascade support
 *
 * @example
 * ```vue
 * <script setup>
 * import { useCascadeMutation } from '#imports'
 * import { CREATE_USER } from './mutations'
 *
 * const { mutate, loading, error } = useCascadeMutation(CREATE_USER, {
 *   cascadeConfig: {
 *     successTypes: ['CreateUserSuccess'],
 *     errorTypes: ['CreateUserError']
 *   }
 * })
 *
 * async function createUser() {
 *   const result = await mutate({ name: 'John' })
 *   if (result.isError) {
 *     console.error('Failed:', result.errors)
 *   } else {
 *     console.log('Created:', result.data)
 *   }
 * }
 * </script>
 * ```
 */
export function useCascadeMutation<TResult = any, TVariables = any>(
  document: DocumentNode,
  options?: CascadeMutationOptions<TResult, TVariables>
) {
  const { cascadeConfig, onCascade, ...mutationOptions } = options || {}

  // Use the standard Vue Apollo useMutation
  const mutation = useMutation<TResult, TVariables>(document, mutationOptions)

  // Create a wrapped mutate function that processes cascade data
  const originalMutate = mutation.mutate
  const cascadeData = ref<any>(null)
  const extractedData = ref<any>(null)
  const isError = ref(false)
  const errors = ref<any[]>([])

  const mutate = async (variables?: TVariables, overrideOptions?: any) => {
    try {
      const result = await originalMutate(variables, overrideOptions)

      if (result?.data) {
        // Extract cascade data from the result
        const extracted = extractCascadeFromMutationResult(result.data, cascadeConfig)

        cascadeData.value = extracted.cascade
        extractedData.value = extracted.data
        isError.value = extracted.isError
        errors.value = extracted.errors || []

        if (extracted.cascade && !extracted.isError) {
          // Call the onCascade callback if provided
          onCascade?.(extracted.cascade)

          if (process.dev) {
            console.log('[useCascadeMutation] Cascade updates:', extracted.cascade)
          }
        }

        return extracted
      }

      return result
    } catch (error) {
      if (process.dev) {
        console.error('[useCascadeMutation] Mutation failed:', error)
      }
      throw error
    }
  }

  return {
    ...mutation,
    mutate,
    cascadeData,
    extractedData,
    isError,
    errors
  }
}

/**
 * Get access to the cascade-enabled Apollo Client
 *
 * @example
 * ```vue
 * <script setup>
 * import { useCascadeClient } from '#imports'
 *
 * const { client, resolveClient } = useCascadeClient()
 *
 * // Use the client directly
 * const result = await client.query({
 *   query: GET_USERS
 * })
 * </script>
 * ```
 */
export function useCascadeClient() {
  const apollo = useApolloClient()

  return {
    client: apollo.client,
    resolveClient: apollo.resolveClient
  }
}
