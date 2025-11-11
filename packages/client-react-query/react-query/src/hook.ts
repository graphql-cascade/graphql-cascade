import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { DocumentNode } from 'graphql';
import { ReactQueryCascadeClient } from './client';

/**
 * React Hook for GraphQL Cascade mutations with React Query.
 */
export function useCascadeMutation<TData = any, TVariables = any>(
  cascadeClient: ReactQueryCascadeClient,
  mutation: DocumentNode,
  options?: UseMutationOptions<TData, Error, TVariables>
) {
  return useMutation({
    mutationFn: (variables: TVariables) => cascadeClient.mutate<TData>(mutation, variables),
    ...options
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