import { useMutation, useApolloClient, useQuery } from "@vue/apollo-composable";
import type {
  UseMutationOptions,
  UseQueryOptions,
} from "@vue/apollo-composable";
import type {
  ApolloClient,
  DocumentNode,
  MutationOptions,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client/core";
import {
  ApolloCascadeCache,
  ApolloCascadeClient,
  extractCascadeFromMutationResult,
  type UnionCascadeConfig,
  type UnionCascadeResult,
} from "@graphql-cascade/apollo";
import type { CascadeUpdates } from "@graphql-cascade/client";
import { ref, computed, type Ref } from "vue";

/**
 * The client type `@graphql-cascade/apollo` applies cascades with. It is
 * typed against the Apollo Client it was installed with, which can be a
 * later major than this package's; it only uses what both share.
 */
type CascadeApolloClient = ConstructorParameters<typeof ApolloCascadeClient>[0];

/**
 * Extract the cascade from a mutation result and, unless the result is an
 * error, apply it to the client's cache.
 */
function applyMutationCascade<T>(
  client: ApolloClient<unknown>,
  data: unknown,
  config?: UnionCascadeConfig,
): UnionCascadeResult<T> {
  const extracted = extractCascadeFromMutationResult<T>(data, config);
  if (extracted.cascade && !extracted.isError) {
    new ApolloCascadeClient(
      client as unknown as CascadeApolloClient,
    ).applyCascade({
      success: true,
      data: extracted.data,
      cascade: extracted.cascade,
    });
  }
  return extracted;
}

export interface CascadeMutationOptions<
  TResult,
  TVariables extends OperationVariables,
> extends UseMutationOptions<TResult, TVariables> {
  /**
   * Configuration for extracting cascade data from union types
   */
  cascadeConfig?: UnionCascadeConfig;

  /**
   * Callback when cascade updates are applied
   */
  onCascade?: (cascade: CascadeUpdates) => void;
}

/**
 * Enhanced useMutation hook that applies the cascade of every successful
 * mutation to the Apollo cache
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
export function useCascadeMutation<
  TResult = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  document: DocumentNode | TypedDocumentNode<TResult, TVariables>,
  options: CascadeMutationOptions<TResult, TVariables> = {},
) {
  const { cascadeConfig, onCascade, ...mutationOptions } = options;
  const mutation = useMutation<TResult, TVariables>(document, mutationOptions);
  const { resolveClient } = useApolloClient();

  const cascadeData = ref<CascadeUpdates | null>(null);
  const extractedData = ref<any>(null);
  const isError = ref(false);
  const errors = ref<any[]>([]);

  const mutate = async (
    variables?: TVariables | null,
    overrideOptions?: Parameters<typeof mutation.mutate>[1],
  ) => {
    const result = await mutation.mutate(variables, overrideOptions);
    if (!result?.data) return result;

    const extracted = applyMutationCascade(
      resolveClient(overrideOptions?.clientId ?? mutationOptions.clientId),
      result.data,
      cascadeConfig,
    );

    cascadeData.value = extracted.cascade;
    extractedData.value = extracted.data;
    isError.value = extracted.isError;
    errors.value = extracted.errors || [];

    if (extracted.cascade && !extracted.isError) {
      onCascade?.(extracted.cascade);
    }

    return extracted;
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
 * useQuery for queries that cascades invalidate: when a cascade evicts the
 * fields a query reads, the query refetches them
 *
 * @example
 * ```vue
 * <script setup>
 * const { result, loading, error, refetch } = useCascadeQuery(
 *   GET_USERS_QUERY,
 *   { limit: 10 },
 * )
 * </script>
 * ```
 */
export function useCascadeQuery<
  TResult = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  document: DocumentNode | TypedDocumentNode<TResult, TVariables>,
  variables?: TVariables | Ref<TVariables>,
  options?: UseQueryOptions<TResult, TVariables>,
) {
  return useQuery<TResult, TVariables>(
    document,
    variables as TVariables,
    options as UseQueryOptions<TResult, TVariables>,
  );
}

/**
 * Batch multiple mutations, applying the cascade of each
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
              const extracted = applyMutationCascade(
                apollo.client,
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

let optimisticLayerCount = 0;

/**
 * Optimistic updates, each in its own Apollo optimistic layer, that the
 * mutation removes when it settles
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
 *   // Execute the mutation (reverted if it fails)
 *   await mutate(UPDATE_USER_MUTATION, {
 *     variables: { id, name }
 *   })
 * }
 * </script>
 * ```
 */
export function useCascadeOptimistic() {
  const apollo = useApolloClient();
  const optimisticUpdates = ref<Array<{ layerId: string; data: any }>>([]);

  const optimisticUpdate = (data: {
    __typename: string;
    id: string;
    [key: string]: any;
  }) => {
    const layerId = `cascade-nuxt-optimistic-${++optimisticLayerCount}`;
    apollo.client.cache.recordOptimisticTransaction((layer) => {
      new ApolloCascadeCache(
        layer as unknown as ConstructorParameters<typeof ApolloCascadeCache>[0],
      ).write(data.__typename, data.id, data);
    }, layerId);
    optimisticUpdates.value.push({ layerId, data });
  };

  const clearOptimisticUpdates = () => {
    for (const { layerId } of optimisticUpdates.value) {
      apollo.client.cache.removeOptimistic(layerId);
    }
    optimisticUpdates.value = [];
  };

  const mutate = async (
    mutation: DocumentNode,
    options: Omit<MutationOptions, "mutation"> & {
      cascadeConfig?: UnionCascadeConfig;
    } = {},
  ) => {
    const { cascadeConfig, ...mutationOptions } = options;
    try {
      const result = await apollo.client.mutate({
        ...mutationOptions,
        mutation,
      });
      if (result.data) {
        applyMutationCascade(apollo.client, result.data, cascadeConfig);
      }
      return result;
    } finally {
      clearOptimisticUpdates();
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
export function useCascadeUnionQuery<
  TResult = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  document: DocumentNode | TypedDocumentNode<TResult, TVariables>,
  variables?: TVariables | Ref<TVariables>,
  options?: UseQueryOptions<TResult, TVariables> & {
    unionConfig?: UnionCascadeConfig;
  },
) {
  const { unionConfig, ...queryOptions } = options || {};
  const query = useCascadeQuery<TResult, TVariables>(
    document,
    variables,
    queryOptions as UseQueryOptions<TResult, TVariables>,
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
