import { QueryClient } from '@tanstack/react-query';
import { DocumentNode } from 'graphql';
import { CascadeClient } from '@graphql-cascade/client';
import { ReactQueryCascadeCache } from './cache';

/**
 * React Query integration for GraphQL Cascade.
 */
export class ReactQueryCascadeClient extends CascadeClient {
  constructor(
    queryClient: QueryClient,
    executor: (query: DocumentNode, variables: any) => Promise<any>
  ) {
    super(new ReactQueryCascadeCache(queryClient), executor);
  }

  /**
   * Get the underlying QueryClient instance.
   */
  getQueryClient(): QueryClient {
    return (this.cache as ReactQueryCascadeCache)['queryClient'];
  }
}