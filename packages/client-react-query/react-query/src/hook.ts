import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { DocumentNode } from 'graphql';
import { ReactQueryCascadeClient } from './client';
import { shouldRetry, calculateRetryDelay, RetryOptions, CascadeError } from '@graphql-cascade/client';

/**
 * React Hook for GraphQL Cascade mutations with React Query.
 */
export function useCascadeMutation<TData = any, TVariables = any>(
  cascadeClient: ReactQueryCascadeClient,
  mutation: DocumentNode,
  options?: UseCascadeMutationOptions<TData, TVariables>
) {
  const { retryOptions, onRetryAttempt, ...mutationOptions } = options || {};

  return useMutation({
    mutationFn: (variables: TVariables) => cascadeClient.mutate<TData>(mutation, variables),
    retry: (failureCount: number, error: any) => {
      const cascadeError = extractCascadeError(error);
      if (!cascadeError) return false;

      const shouldRetryOp = shouldRetry(cascadeError, failureCount + 1, retryOptions);

      if (shouldRetryOp && onRetryAttempt) {
        onRetryAttempt(cascadeError, failureCount + 1);
      }

      return shouldRetryOp;
    },
    retryDelay: (attemptNumber: number, error: any) => {
      const cascadeError = extractCascadeError(error);
      if (!cascadeError) return 1000;

      return calculateRetryDelay(cascadeError, attemptNumber, retryOptions);
    },
    onSuccess: mutationOptions.onSuccess,
    onError: mutationOptions.onError,
    ...mutationOptions
  });
}

/**
 * React Hook for optimistic GraphQL Cascade mutations.
 */
export function useOptimisticCascadeMutation<TData = any, TVariables = any>(
  cascadeClient: ReactQueryCascadeClient,
  mutation: DocumentNode,
  getOptimisticResponse: (variables: TVariables) => any,
  options?: UseMutationOptions<TData, Error, TVariables>
) {
  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const optimisticResponse = getOptimisticResponse(variables);
      return cascadeClient.mutateOptimistic<TData>(mutation, variables, optimisticResponse);
    },
    ...options
  });
}

/**
 * Options for the cascade mutation hook with error handling.
 */
export interface UseCascadeMutationOptions<TData = any, TVariables = any> extends UseMutationOptions<TData, Error, TVariables> {
  /**
   * Retry options for handling cascade errors.
   */
  retryOptions?: RetryOptions;

  /**
   * Callback when a retry attempt is made.
   */
  onRetryAttempt?: (error: CascadeError, attemptNumber: number) => void;

  /**
   * Callback when retry succeeds.
   */
  onRetrySuccess?: (data: TData, attempts: number) => void;

  /**
   * Callback when retry fails completely.
   */
  onRetryFailure?: (error: CascadeError, attempts: number) => void;
}

/**
 * Extract cascade error from various error formats.
 */
function extractCascadeError(error: any): CascadeError | null {
  if (!error) return null;

  // Check if it's already a cascade error
  if (error.code && typeof error.code === 'string') {
    return error as CascadeError;
  }

  // Check for cascade error in GraphQL extensions
  if (error.graphQLErrors) {
    for (const gqlError of error.graphQLErrors) {
      if (gqlError.extensions?.cascade) {
        return gqlError.extensions.cascade as CascadeError;
      }
    }
  }

  // Check for cascade error in network error
  if (error.networkError?.extensions?.cascade) {
    return error.networkError.extensions.cascade as CascadeError;
  }

  return null;
}