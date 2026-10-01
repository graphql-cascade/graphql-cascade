import React from "react";
import { OperationVariables } from "@apollo/client";
import { useApolloClient, useMutation } from "@apollo/client/react";
import type { DocumentNode, GraphQLFormattedError } from "graphql";
import {
  CascadeClient,
  CascadeResponse,
  CascadeUpdates,
  CascadeConflictResolver,
  cascadeEntryTypename,
  toCascadeResponse,
} from "@graphql-cascade/client";
import { graphQLResultError } from "./apollo-compat";
import { ApolloCascadeCache } from "./cache";
import { ApolloCascadeClient } from "./client";

/** useMutation's options, in Apollo Client 3 and 4 */
type MutationHookOptions<
  TData,
  TVariables extends OperationVariables,
> = NonNullable<Parameters<typeof useMutation<TData, TVariables>>[1]>;

let optimisticLayerCount = 0;

const noQueries = () =>
  Promise.reject(new Error("Optimistic cascades do not run queries"));

/**
 * Options for useCascadeMutation hook
 */
export interface UseCascadeMutationOptions<
  TData,
  TVariables extends OperationVariables = OperationVariables,
> extends Omit<
  MutationHookOptions<TData, TVariables>,
  "onCompleted" | "onError" | "update"
> {
  /**
   * Whether to enable optimistic updates
   */
  optimistic?: boolean;

  /**
   * Function to generate optimistic cascade response
   */
  optimisticCascadeResponse?: OptimisticResponseGenerator<TData, TVariables>;

  /**
   * Callback when mutation completes successfully
   */
  onCompleted?: (data: TData, cascade: CascadeUpdates) => void;

  /**
   * Callback when mutation fails
   */
  onError?: (error: Error, variables: TVariables) => void;

  /**
   * Conflict resolution strategy
   */
  conflictResolution?: ConflictResolutionStrategy;
}

/**
 * Conflict resolution strategies for optimistic updates
 */
export type ConflictResolutionStrategy =
  | "SERVER_WINS"
  | "CLIENT_WINS"
  | "MERGE"
  | "MANUAL";

/**
 * Optimistic response generator function type
 */
export type OptimisticResponseGenerator<TData, TVariables> = (
  variables: TVariables,
) => CascadeResponse<TData>;

/**
 * Return type for useCascadeMutation hook
 */
export type UseCascadeMutationResult<
  TData,
  TVariables extends OperationVariables = OperationVariables,
> = [
  (
    options?: MutationHookOptions<TData, TVariables>,
  ) => Promise<CascadeMutationResult<TData>>,
  {
    data?: TData;
    loading: boolean;
    error?: Error;
    called: boolean;
    cascade?: CascadeUpdates;
  },
];

/**
 * Result of a cascade mutation
 */
export interface CascadeMutationResult<TData> {
  data: TData;
  cascade: CascadeUpdates;
}

/**
 * Rollback function type for optimistic updates
 */
export type RollbackFunction = () => void;

/**
 * React hook that wraps Apollo's useMutation with GraphQL Cascade optimistic updates.
 *
 * @param mutation - The GraphQL mutation document
 * @param options - Hook options including optimistic update configuration
 * @returns Tuple of [mutate function, result object]
 */
export function useCascadeMutation<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  mutation: DocumentNode,
  options: UseCascadeMutationOptions<TData, TVariables> = {},
): UseCascadeMutationResult<TData, TVariables> {
  const apolloClient = useApolloClient();
  const cascadeClient = new ApolloCascadeClient(apolloClient);

  const {
    optimistic = false,
    optimisticCascadeResponse,
    onCompleted,
    onError,
    conflictResolution = "SERVER_WINS",
    ...apolloOptions
  } = options;

  // State for tracking cascade updates
  const [cascadeResult, setCascadeResult] = React.useState<
    CascadeUpdates | undefined
  >();

  // Apollo mutation hook
  // Apollo's option and result types differ between Apollo Client 3 and 4;
  // this call only relies on what both share.
  const [mutate, { data, loading, error, called }] = useMutation(mutation, {
    ...apolloOptions,
    onCompleted: (
      apolloData: Record<string, unknown>,
      clientOptions?: { variables?: unknown },
    ) => {
      try {
        // Extract cascade response from mutation result
        const mutationName = Object.keys(apolloData)[0];
        const cascadeResponse = toCascadeResponse<TData>(
          apolloData[mutationName],
        ) as CascadeResponse<TData> | undefined;

        if (cascadeResponse) {
          setCascadeResult(cascadeResponse.cascade);

          // Apply cascade updates to cache
          cascadeClient.applyCascade(cascadeResponse);

          // Call user callback
          if (onCompleted) {
            onCompleted(cascadeResponse.data, cascadeResponse.cascade);
          }
        } else {
          // Malformed response - no cascade data
          throw new Error("Cascade response missing cascade data");
        }
      } catch (err) {
        console.error("Error processing cascade response:", err);
        if (onError) {
          onError(err as Error, clientOptions?.variables as TVariables);
        }
      }
    },
    onError: (apolloError: Error, clientOptions?: { variables?: unknown }) => {
      // Note: Optimistic update rollback is handled in the mutate function
      if (onError) {
        onError(apolloError, clientOptions?.variables as TVariables);
      }
    },
  } as never);

  // Enhanced mutate function with cascade support
  const cascadeMutate = React.useCallback(
    async (mutateOptions?: MutationHookOptions<TData, TVariables>) => {
      const variables = mutateOptions?.variables;

      // Validate optimistic update configuration
      if (optimistic && !optimisticCascadeResponse) {
        throw new Error(
          "optimisticCascadeResponse function is required for optimistic updates",
        );
      }

      // Apply optimistic update if enabled
      let rollbackFn: RollbackFunction | undefined;
      if (optimistic && optimisticCascadeResponse && variables) {
        rollbackFn = applyOptimisticUpdate(variables as TVariables);
      }

      try {
        // Execute the mutation
        const result = await mutate(mutateOptions as any);
        // With onError set, Apollo resolves failed mutations instead of
        // rejecting them; surface the error to the caller.
        // Apollo Client 4 reports an `error`; 3 reports `errors`, which with
        // onError set is the error itself.
        const failed = result as {
          data?: unknown;
          error?: unknown;
          errors?: readonly GraphQLFormattedError[] | Error;
        };
        if (!failed.data) {
          const reported = failed.error ?? failed.errors;
          throw reported instanceof Error
            ? reported
            : graphQLResultError(
                (reported as readonly GraphQLFormattedError[] | undefined) ??
                  [],
              );
        }

        // Extract cascade data
        const resultData = failed.data as Record<string, unknown>;
        const mutationName = Object.keys(resultData)[0];
        if (mutationName === undefined) {
          throw new Error("Mutation response contains no mutation field");
        }
        const cascadeResponse = toCascadeResponse<TData>(
          resultData[mutationName],
        ) as CascadeResponse<TData> | undefined;

        // Compare the optimistic view with the server's, while it is visible
        if (rollbackFn && cascadeResponse && detectConflicts(cascadeResponse)) {
          cascadeClient.applyCascade(
            resolveConflicts(cascadeResponse, conflictResolution),
          );
        }

        // A result without a cascade was already reported through onError
        return {
          data: cascadeResponse?.data as TData,
          cascade: cascadeResponse?.cascade as CascadeUpdates,
        };
      } finally {
        // The server's cascade is already in the cache, or the mutation
        // failed; either way the optimistic layer goes.
        rollbackFn?.();
      }
    },
    [mutate, optimistic, optimisticCascadeResponse, cascadeClient],
  );

  // Apply the optimistic cascade in its own layer of Apollo's cache, so
  // removing the layer restores exactly what was there before.
  const applyOptimisticUpdate = (variables: TVariables): RollbackFunction => {
    if (!optimisticCascadeResponse) {
      throw new Error(
        "optimisticCascadeResponse function is required for optimistic updates",
      );
    }

    const optimisticResponse = optimisticCascadeResponse(variables);
    const layerId = `cascade-optimistic-${++optimisticLayerCount}`;
    apolloClient.cache.recordOptimisticTransaction((layer) => {
      new CascadeClient(new ApolloCascadeCache(layer), noQueries).applyCascade(
        optimisticResponse,
      );
    }, layerId);

    return () => apolloClient.cache.removeOptimistic(layerId);
  };

  // Helper function to detect conflicts
  const detectConflicts = (serverResponse: CascadeResponse<TData>): boolean => {
    const conflictResolver = new CascadeConflictResolver();

    // Check for conflicts in updated entities
    for (const updated of serverResponse.cascade.updated) {
      const optimisticData = cascadeClient
        .getCache()
        .read(cascadeEntryTypename(updated), updated.id);
      if (optimisticData) {
        const conflict = conflictResolver.detectConflicts(
          optimisticData,
          updated.entity,
        );
        if (conflict.hasConflict) {
          return true;
        }
      }
    }

    return false;
  };

  // Helper function to resolve conflicts
  const resolveConflicts = (
    serverResponse: CascadeResponse<TData>,
    strategy: ConflictResolutionStrategy,
  ): CascadeResponse<TData> => {
    const conflictResolver = new CascadeConflictResolver();
    const resolvedResponse = { ...serverResponse };

    // Resolve conflicts in updated entities
    resolvedResponse.cascade = {
      ...serverResponse.cascade,
      updated: serverResponse.cascade.updated.map((updated) => {
        const optimisticData = cascadeClient
          .getCache()
          .read(cascadeEntryTypename(updated), updated.id);
        if (optimisticData) {
          const conflict = conflictResolver.detectConflicts(
            optimisticData,
            updated.entity,
          );
          if (conflict.hasConflict) {
            const resolvedEntity = conflictResolver.resolveConflicts(
              conflict,
              strategy,
            );
            return {
              ...updated,
              entity: resolvedEntity,
            };
          }
        }
        return updated;
      }),
    };

    return resolvedResponse;
  };

  return [
    cascadeMutate,
    {
      data: data as TData | undefined,
      loading,
      error,
      called,
      cascade: cascadeResult,
    },
  ];
}
