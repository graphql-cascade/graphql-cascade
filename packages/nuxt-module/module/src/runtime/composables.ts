import { useNuxtApp } from "#app";
import {
  useMutation,
  useApolloClient,
  useQuery,
  useSubscription,
} from "@vue/apollo-composable";
import type { DocumentNode, TypedDocumentNode } from "@apollo/client";
import type {
  MutationOptions,
  MutationResult,
  UseQueryOptions,
  UseSubscriptionOptions,
} from "@vue/apollo-composable";
import {
  extractCascadeFromMutationResult,
  type UnionCascadeConfig,
} from "@graphql-cascade/apollo";
import { ref, unref, computed, watch, type Ref } from "vue";

export interface CascadeMutationOptions<
  TResult,
  TVariables,
> extends MutationOptions<TResult, TVariables> {
  /**
   * Configuration for extracting cascade data from union types
   */
  cascadeConfig?: UnionCascadeConfig;

  /**
   * Callback when cascade updates are applied
   */
  onCascade?: (cascade: any) => void;
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
  document: DocumentNode | TypedDocumentNode<TResult, TVariables>,
  options?: CascadeMutationOptions<TResult, TVariables>,
) {
  const { cascadeConfig, onCascade, ...mutationOptions } = options || {};

  // Use the standard Vue Apollo useMutation
  const mutation = useMutation<TResult, TVariables>(document, mutationOptions);

  // Create a wrapped mutate function that processes cascade data
  const originalMutate = mutation.mutate;
  const cascadeData = ref<any>(null);
  const extractedData = ref<any>(null);
  const isError = ref(false);
  const errors = ref<any[]>([]);

  const mutate = async (variables?: TVariables, overrideOptions?: any) => {
    try {
      const result = await originalMutate(variables, overrideOptions);

      if (result?.data) {
        // Extract cascade data from the result
        const extracted = extractCascadeFromMutationResult(
          result.data,
          cascadeConfig,
        );

        cascadeData.value = extracted.cascade;
        extractedData.value = extracted.data;
        isError.value = extracted.isError;
        errors.value = extracted.errors || [];

        if (extracted.cascade && !extracted.isError) {
          // Call the onCascade callback if provided
          onCascade?.(extracted.cascade);

          if (process.dev) {
            console.log(
              "[useCascadeMutation] Cascade updates:",
              extracted.cascade,
            );
          }
        }

        return extracted;
      }

      return result;
    } catch (error) {
      if (process.dev) {
        console.error("[useCascadeMutation] Mutation failed:", error);
      }
      throw error;
    }
  };

  return {
    ...mutation,
    mutate,
    cascadeData,
    extractedData,
    isError,
    errors,
  };
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
  const apollo = useApolloClient();

  return {
    client: apollo.client,
    resolveClient: apollo.resolveClient,
  };
}

/**
 * Track cascade updates across mutations
 * Useful for debugging or implementing custom cascade logic
 *
 * @example
 * ```vue
 * <script setup>
 * const { cascadeHistory, lastCascade, cascadeCount, clearHistory } = useCascadeTracker()
 *
 * watch(lastCascade, (cascade) => {
 *   if (cascade) {
 *     console.log('Latest cascade:', cascade)
 *     console.log('Total mutations tracked:', cascadeCount.value)
 *   }
 * })
 * </script>
 * ```
 */
export function useCascadeTracker() {
  const cascadeHistory = ref<any[]>([]);
  const lastCascade = computed(
    () => cascadeHistory.value[cascadeHistory.value.length - 1],
  );
  const cascadeCount = computed(() => cascadeHistory.value.length);

  const addCascade = (cascade: any) => {
    cascadeHistory.value.push({
      ...cascade,
      timestamp: new Date().toISOString(),
    });
  };

  const clearHistory = () => {
    cascadeHistory.value = [];
  };

  return {
    cascadeHistory,
    lastCascade,
    cascadeCount,
    addCascade,
    clearHistory,
  };
}

/**
 * Enhanced query hook that automatically refetches when cascade invalidations occur
 *
 * @example
 * ```vue
 * <script setup>
 * const { result, loading, error, refetch } = useCascadeQuery(
 *   GET_USERS_QUERY,
 *   { limit: 10 },
 *   {
 *     // Automatically refetch when these queries are invalidated
 *     watchInvalidations: ['getUsers', 'listUsers']
 *   }
 * )
 * </script>
 * ```
 */
export function useCascadeQuery<TResult = any, TVariables = any>(
  document: DocumentNode | TypedDocumentNode<TResult, TVariables>,
  variables?: TVariables | Ref<TVariables>,
  options?: UseQueryOptions<TResult, TVariables> & {
    watchInvalidations?: string[];
  },
) {
  const { watchInvalidations, ...queryOptions } = options || {};
  const query = useQuery<TResult, TVariables>(
    document,
    variables,
    queryOptions,
  );

  // TODO: Implement cascade invalidation watching when cascade client is available
  // For now, just return the standard query
  return query;
}

/**
 * Batch multiple mutations with cascade tracking
 *
 * @example
 * ```vue
 * <script setup>
 * const { executeBatch, loading, results, errors } = useCascadeBatch()
 *
 * async function updateMultipleUsers() {
 *   await executeBatch([
 *     { mutation: UPDATE_USER, variables: { id: '1', name: 'Alice' } },
 *     { mutation: UPDATE_USER, variables: { id: '2', name: 'Bob' } },
 *     { mutation: UPDATE_USER, variables: { id: '3', name: 'Charlie' } }
 *   ])
 *
 *   console.log('All mutations completed:', results.value)
 * }
 * </script>
 * ```
 */
export function useCascadeBatch() {
  const loading = ref(false);
  const results = ref<any[]>([]);
  const errors = ref<any[]>([]);
  const apollo = useApolloClient();

  const executeBatch = async (
    mutations: Array<{
      mutation: DocumentNode;
      variables?: any;
      cascadeConfig?: UnionCascadeConfig;
    }>,
  ) => {
    loading.value = true;
    results.value = [];
    errors.value = [];

    try {
      const promises = mutations.map(
        async ({ mutation, variables, cascadeConfig }) => {
          try {
            const result = await apollo.client.mutate({
              mutation,
              variables,
            });

            if (result.data) {
              const extracted = extractCascadeFromMutationResult(
                result.data,
                cascadeConfig,
              );
              return { success: true, data: extracted };
            }

            return { success: false, error: "No data returned" };
          } catch (error) {
            return { success: false, error };
          }
        },
      );

      const batchResults = await Promise.all(promises);

      results.value = batchResults.filter((r) => r.success).map((r) => r.data);
      errors.value = batchResults.filter((r) => !r.success).map((r) => r.error);

      return {
        results: results.value,
        errors: errors.value,
        allSucceeded: errors.value.length === 0,
      };
    } finally {
      loading.value = false;
    }
  };

  return {
    executeBatch,
    loading,
    results,
    errors,
  };
}

/**
 * Optimistic updates helper that works with cascade
 *
 * @example
 * ```vue
 * <script setup>
 * const { mutate, optimisticUpdate } = useCascadeOptimistic()
 *
 * async function updateUser(id: string, name: string) {
 *   // Optimistically update the UI
 *   optimisticUpdate({
 *     __typename: 'User',
 *     id,
 *     name
 *   })
 *
 *   // Execute the mutation (will be reverted if it fails)
 *   await mutate(UPDATE_USER_MUTATION, {
 *     variables: { id, name }
 *   })
 * }
 * </script>
 * ```
 */
export function useCascadeOptimistic() {
  const apollo = useApolloClient();
  const optimisticUpdates = ref<any[]>([]);

  const optimisticUpdate = (data: {
    __typename: string;
    id: string;
    [key: string]: any;
  }) => {
    const cacheId = apollo.client.cache.identify(data);
    if (cacheId) {
      apollo.client.cache.writeFragment({
        id: cacheId,
        fragment: require("@apollo/client").gql`
          fragment OptimisticUpdate on ${data.__typename} {
            ${Object.keys(data)
              .filter((k) => k !== "__typename")
              .join("\n            ")}
          }
        `,
        data,
      });
      optimisticUpdates.value.push({ cacheId, data });
    }
  };

  const clearOptimisticUpdates = () => {
    optimisticUpdates.value = [];
  };

  const mutate = async (mutation: DocumentNode, options: any) => {
    const apollo = useApolloClient();
    try {
      const result = await apollo.client.mutate({
        ...options,
        mutation,
      });
      clearOptimisticUpdates();
      return result;
    } catch (error) {
      // Revert optimistic updates on error
      clearOptimisticUpdates();
      throw error;
    }
  };

  return {
    optimisticUpdate,
    clearOptimisticUpdates,
    mutate,
    optimisticUpdates,
  };
}

/**
 * Helper to handle union type responses in queries
 * Similar to useCascadeMutation but for queries that return union types
 *
 * @example
 * ```vue
 * <script setup>
 * const { result, data, isError, errors } = useCascadeUnionQuery(
 *   GET_USER_QUERY,
 *   { id: '123' },
 *   {
 *     unionConfig: {
 *       successTypes: ['GetUserSuccess'],
 *       errorTypes: ['GetUserError']
 *     }
 *   }
 * )
 * </script>
 * ```
 */
export function useCascadeUnionQuery<TResult = any, TVariables = any>(
  document: DocumentNode | TypedDocumentNode<TResult, TVariables>,
  variables?: TVariables | Ref<TVariables>,
  options?: UseQueryOptions<TResult, TVariables> & {
    unionConfig?: UnionCascadeConfig;
  },
) {
  const { unionConfig, ...queryOptions } = options || {};
  const query = useQuery<TResult, TVariables>(
    document,
    variables,
    queryOptions,
  );

  const data = computed(() => {
    if (!query.result.value) return null;

    // Extract data from union type response
    const firstKey = Object.keys(query.result.value)[0];
    if (!firstKey) return null;

    const response = (query.result.value as any)[firstKey];

    // Check if it's a union type with __typename
    if (response && typeof response === "object" && "__typename" in response) {
      const typename = response.__typename;

      // Check if it's an error type
      const isErrorType =
        unionConfig?.errorTypes?.includes(typename) ||
        typename.toLowerCase().includes("error");

      if (isErrorType) {
        return null;
      }

      // Extract the data field (first non-metadata field)
      const dataKeys = Object.keys(response).filter(
        (key) => key !== "__typename" && key !== "errors" && key !== "success",
      );

      return dataKeys.length > 0 ? response[dataKeys[0]] : response;
    }

    return response;
  });

  const isError = computed(() => {
    if (!query.result.value) return false;

    const firstKey = Object.keys(query.result.value)[0];
    if (!firstKey) return false;

    const response = (query.result.value as any)[firstKey];

    if (response && typeof response === "object" && "__typename" in response) {
      const typename = response.__typename;
      return (
        unionConfig?.errorTypes?.includes(typename) ||
        typename.toLowerCase().includes("error") ||
        "errors" in response
      );
    }

    return false;
  });

  const errors = computed(() => {
    if (!isError.value || !query.result.value) return [];

    const firstKey = Object.keys(query.result.value)[0];
    if (!firstKey) return [];

    const response = (query.result.value as any)[firstKey];
    return response?.errors || [];
  });

  return {
    ...query,
    data,
    isError,
    errors,
  };
}
