import React from 'react';
import { useMutation, useApolloClient, MutationHookOptions, OperationVariables } from '@apollo/client';
import { DocumentNode } from 'graphql';
import { CascadeResponse, CascadeUpdates, CascadeConflictResolver } from '@graphql-cascade/client';
import { ApolloCascadeClient } from './client';

/**
 * Options for useCascadeMutation hook
 */
export interface UseCascadeMutationOptions<TData, TVariables>
  extends Omit<MutationHookOptions<TData, TVariables>, 'onCompleted' | 'onError' | 'update'> {
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
export type ConflictResolutionStrategy = 'SERVER_WINS' | 'CLIENT_WINS' | 'MERGE' | 'MANUAL';

/**
 * Optimistic response generator function type
 */
export type OptimisticResponseGenerator<TData, TVariables> = (variables: TVariables) => CascadeResponse<TData>;

/**
 * Return type for useCascadeMutation hook
 */
export type UseCascadeMutationResult<TData, TVariables> = [
  (options?: MutationHookOptions<TData, TVariables>) => Promise<CascadeMutationResult<TData>>,
  {
    data?: TData;
    loading: boolean;
    error?: Error;
    called: boolean;
    cascade?: CascadeUpdates;
  }
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
export function useCascadeMutation<TData = any, TVariables extends OperationVariables = OperationVariables>(
  mutation: DocumentNode,
  options: UseCascadeMutationOptions<TData, TVariables> = {}
): UseCascadeMutationResult<TData, TVariables> {
  const apolloClient = useApolloClient();
  const cascadeClient = new ApolloCascadeClient(apolloClient);

  const {
    optimistic = false,
    optimisticCascadeResponse,
    onCompleted,
    onError,
    conflictResolution = 'SERVER_WINS',
    ...apolloOptions
  } = options;

  // State for tracking cascade updates
  const [cascadeResult, setCascadeResult] = React.useState<CascadeUpdates | undefined>();

  // Apollo mutation hook
  const [mutate, { data, loading, error, called }] = useMutation(mutation, {
    ...apolloOptions,
    onCompleted: (apolloData) => {
      try {
        // Extract cascade response from mutation result
        const mutationName = Object.keys(apolloData)[0];
        const cascadeResponse = apolloData[mutationName] as CascadeResponse<TData>;

        if (cascadeResponse.cascade) {
          setCascadeResult(cascadeResponse.cascade);

          // Apply cascade updates to cache
          cascadeClient.applyCascade(cascadeResponse);

          // Call user callback
          if (onCompleted) {
            onCompleted(cascadeResponse.data, cascadeResponse.cascade);
          }
        }
      } catch (err) {
        console.error('Error processing cascade response:', err);
        if (onError) {
          onError(err as Error, {} as TVariables);
        }
      }
    },
    onError: (apolloError, clientOptions) => {
      // Note: Optimistic update rollback is handled in the mutate function
      if (onError) {
        onError(apolloError, clientOptions?.variables as TVariables);
      }
    },
    update: optimistic ? undefined : undefined, // We handle optimistic updates manually
  });

  // Enhanced mutate function with cascade support
  const cascadeMutate = React.useCallback(
    async (mutateOptions?: MutationHookOptions<TData, TVariables>) => {
      const variables = mutateOptions?.variables;

      // Apply optimistic update if enabled
      let rollbackFn: RollbackFunction | undefined;
      if (optimistic && optimisticCascadeResponse && variables) {
        rollbackFn = applyOptimisticUpdate(variables);
      }

      try {
        // Execute the mutation
        const result = await mutate(mutateOptions as any);

        // Extract cascade data
        const mutationName = Object.keys(result.data!)[0];
        const cascadeResponse = result.data![mutationName] as CascadeResponse<TData>;

        // Handle conflicts if optimistic update was applied
        if (optimistic && rollbackFn && cascadeResponse.cascade) {
          const hasConflicts = detectConflicts(cascadeResponse);
          if (hasConflicts) {
            // Resolve conflicts based on strategy
            const resolvedResponse = resolveConflicts(cascadeResponse, conflictResolution);
            // Rollback optimistic and apply resolved response
            rollbackFn();
            cascadeClient.applyCascade(resolvedResponse);
          }
        }

        return {
          data: cascadeResponse.data,
          cascade: cascadeResponse.cascade
        };

      } catch (error) {
        // Rollback on error (if not already done in onError)
        if (rollbackFn) {
          rollbackFn();
        }
        throw error;
      }
    },
    [mutate, optimistic, optimisticCascadeResponse, cascadeClient]
  );

  // Helper function to apply optimistic updates
  const applyOptimisticUpdate = (variables: TVariables): RollbackFunction => {
    if (!optimisticCascadeResponse) {
      throw new Error('optimisticCascadeResponse function is required for optimistic updates');
    }

    const optimisticResponse = optimisticCascadeResponse(variables);

    // Capture current cache state for rollback
    const rollbackInfo = captureRollbackState(optimisticResponse.cascade);

    // Apply optimistic cascade
    cascadeClient.applyCascade(optimisticResponse);

    return () => {
      // Rollback function
      rollbackInfo.forEach(({ __typename, id, previousData }) => {
        if (previousData === null) {
          // Entity was created optimistically, remove it
          cascadeClient.getCache().evict(__typename, id);
        } else {
          // Entity existed, restore previous state
          cascadeClient.getCache().write(__typename, id, previousData);
        }
      });
    };
  };

  // Helper function to capture rollback state
  const captureRollbackState = (cascade: CascadeUpdates): Array<{ __typename: string; id: string; previousData: any }> => {
    const rollbackInfo: Array<{ __typename: string; id: string; previousData: any }> = [];

    cascade.updated.forEach(({ __typename, id }) => {
      const currentData = cascadeClient.getCache().read(__typename, id);
      rollbackInfo.push({ __typename, id, previousData: currentData });
    });

    cascade.deleted.forEach(({ __typename, id }) => {
      const currentData = cascadeClient.getCache().read(__typename, id);
      rollbackInfo.push({ __typename, id, previousData: currentData });
    });

    return rollbackInfo;
  };

  // Helper function to detect conflicts
  const detectConflicts = (serverResponse: CascadeResponse<TData>): boolean => {
    const conflictResolver = new CascadeConflictResolver();

    // Check for conflicts in updated entities
    for (const updated of serverResponse.cascade.updated) {
      const optimisticData = cascadeClient.getCache().read(updated.__typename, updated.id);
      if (optimisticData) {
        const conflict = conflictResolver.detectConflicts(optimisticData, updated.entity);
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
    strategy: ConflictResolutionStrategy
  ): CascadeResponse<TData> => {
    const conflictResolver = new CascadeConflictResolver();
    const resolvedResponse = { ...serverResponse };

    // Resolve conflicts in updated entities
    resolvedResponse.cascade = {
      ...serverResponse.cascade,
      updated: serverResponse.cascade.updated.map(updated => {
        const optimisticData = cascadeClient.getCache().read(updated.__typename, updated.id);
        if (optimisticData) {
          const conflict = conflictResolver.detectConflicts(optimisticData, updated.entity);
          if (conflict.hasConflict) {
            const resolvedEntity = conflictResolver.resolveConflicts(conflict, strategy);
            return {
              ...updated,
              entity: resolvedEntity
            };
          }
        }
        return updated;
      })
    };

    return resolvedResponse;
  };



  return [
    cascadeMutate,
    {
      data,
      loading,
      error,
      called,
      cascade: cascadeResult,
    },
  ];
}