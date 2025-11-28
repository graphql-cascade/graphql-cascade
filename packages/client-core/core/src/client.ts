import { DocumentNode } from 'graphql';
import {
  CascadeCache,
  CascadeResponse,
  CascadeUpdates,
  QueryInvalidation,
  InvalidationStrategy
} from './types';

/**
 * Generic GraphQL Cascade client.
 */
export class CascadeClient {
  constructor(
    protected cache: CascadeCache,
    protected executor: (query: DocumentNode, variables: any) => Promise<any>
  ) {}

  /**
   * Apply a cascade response to the cache.
   */
  applyCascade<T = unknown>(response: CascadeResponse<T>): void {
    const { data, cascade } = response;

    // 1. Write primary result
    if (data && typeof data === 'object' && '__typename' in data && 'id' in data) {
      const typename = (data as Record<string, unknown>).__typename as string;
      const id = (data as Record<string, unknown>).id as string;
      this.cache.write(typename, id, data as Record<string, unknown>);
    }

    // 2. Apply all updates
    cascade.updated.forEach(({ __typename, id, entity }) => {
      this.cache.write(__typename, id, entity);
    });

    // 3. Handle deletions
    cascade.deleted.forEach(({ __typename, id }) => {
      this.cache.evict(__typename, id);
    });

    // 4. Process invalidations
    cascade.invalidations.forEach(invalidation => {
      switch (invalidation.strategy) {
        case InvalidationStrategy.INVALIDATE:
          this.cache.invalidate(invalidation);
          break;
        case InvalidationStrategy.REFETCH:
          this.cache.refetch(invalidation);
          break;
        case InvalidationStrategy.REMOVE:
          this.cache.remove(invalidation);
          break;
      }
    });
  }

  /**
   * Execute a mutation and apply the cascade automatically.
   */
  async mutate<T = any>(
    mutation: DocumentNode,
    variables?: any
  ): Promise<T> {
    const result = await this.executor(mutation, variables);

    // Extract the mutation result (first field in data)
    const mutationName = Object.keys(result.data)[0];
    const cascadeResponse = result.data[mutationName] as CascadeResponse<T>;

    // Apply cascade
    this.applyCascade(cascadeResponse);

    // Return the primary data
    return cascadeResponse.data;
  }

  /**
   * Execute a query (no cascade processing needed).
   */
  async query<T = any>(
    query: DocumentNode,
    variables?: any
  ): Promise<T> {
    const result = await this.executor(query, variables);
    return result.data;
  }

  /**
   * Get the underlying cache instance.
   */
  getCache(): CascadeCache {
    return this.cache;
  }
}