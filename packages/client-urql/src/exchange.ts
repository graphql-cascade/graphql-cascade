/**
 * URQL Exchange for GraphQL Cascade.
 *
 * This exchange intercepts GraphQL responses and processes cascade data
 * from the extensions field, applying updates to the cache.
 */

import { pipe, tap } from 'wonka';
import type { Exchange } from '@urql/core';
import {
  CascadeExchangeOptions,
  CascadeUpdates,
  CascadeOperation,
  InvalidationStrategy,
  CascadeApplyResult,
} from './types';

/**
 * Creates a URQL exchange for processing GraphQL Cascade responses.
 *
 * @param options - Configuration options for the exchange
 * @returns URQL exchange function
 *
 * @example
 * ```typescript
 * import { createClient, cacheExchange, fetchExchange } from '@urql/core';
 * import { cascadeExchange } from '@graphql-cascade/urql';
 *
 * const client = createClient({
 *   url: '/graphql',
 *   exchanges: [
 *     cacheExchange,
 *     cascadeExchange({
 *       onCascade: (cascade) => console.log('Cascade received:', cascade),
 *       debug: true,
 *     }),
 *     fetchExchange,
 *   ],
 * });
 * ```
 */
export const cascadeExchange = (options: CascadeExchangeOptions = {}): Exchange => {
  const { onCascade, onCacheUpdate, onCacheDelete, debug, cacheAdapter } = options;

  return ({ forward }) => (ops$) => {
    return pipe(
      forward(ops$),
      tap((result) => {
        // Check for cascade data in extensions
        const cascade = result.extensions?.cascade as CascadeUpdates | undefined;

        if (!cascade) {
          return;
        }

        if (debug) {
          console.log('[Cascade] Received cascade data:', cascade);
        }

        // Invoke callback if provided
        onCascade?.(cascade);

        // Apply updates if cache adapter is provided
        if (cacheAdapter) {
          const applyResult = applyCascadeUpdates(cascade, cacheAdapter, {
            onCacheUpdate,
            onCacheDelete,
            debug,
          });

          if (debug) {
            console.log('[Cascade] Applied updates:', applyResult);
          }
        }
      })
    );
  };
};

/**
 * Apply cascade updates to the cache.
 */
function applyCascadeUpdates(
  cascade: CascadeUpdates,
  cacheAdapter: NonNullable<CascadeExchangeOptions['cacheAdapter']>,
  options: {
    onCacheUpdate?: CascadeExchangeOptions['onCacheUpdate'];
    onCacheDelete?: CascadeExchangeOptions['onCacheDelete'];
    debug?: boolean;
  }
): CascadeApplyResult {
  const result: CascadeApplyResult = {
    updatedCount: 0,
    deletedCount: 0,
    invalidatedCount: 0,
    errors: [],
  };

  // Process updated entities
  for (const update of cascade.updated) {
    try {
      if (update.operation === CascadeOperation.DELETED) {
        cacheAdapter.evict(update.__typename, update.id);
        options.onCacheDelete?.(update.__typename, update.id);
        result.deletedCount++;
      } else {
        cacheAdapter.write(update.__typename, update.id, update.entity);
        options.onCacheUpdate?.(update.__typename, update.id, update.entity);
        result.updatedCount++;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error : new Error(String(error)));
      if (options.debug) {
        console.error('[Cascade] Error applying update:', error);
      }
    }
  }

  // Process deleted entities
  for (const deleted of cascade.deleted) {
    try {
      cacheAdapter.evict(deleted.__typename, deleted.id);
      options.onCacheDelete?.(deleted.__typename, deleted.id);
      result.deletedCount++;
    } catch (error) {
      result.errors.push(error instanceof Error ? error : new Error(String(error)));
      if (options.debug) {
        console.error('[Cascade] Error applying deletion:', error);
      }
    }
  }

  // Process invalidations
  for (const invalidation of cascade.invalidations) {
    try {
      switch (invalidation.strategy) {
        case InvalidationStrategy.INVALIDATE:
          cacheAdapter.invalidate(invalidation);
          break;
        case InvalidationStrategy.REFETCH:
          // Refetch is async, we don't await here
          cacheAdapter.refetch(invalidation).catch((error) => {
            if (options.debug) {
              console.error('[Cascade] Error refetching:', error);
            }
          });
          break;
        case InvalidationStrategy.REMOVE:
          cacheAdapter.remove(invalidation);
          break;
      }
      result.invalidatedCount++;
    } catch (error) {
      result.errors.push(error instanceof Error ? error : new Error(String(error)));
      if (options.debug) {
        console.error('[Cascade] Error applying invalidation:', error);
      }
    }
  }

  return result;
}

/**
 * Extract cascade data from a GraphQL response.
 *
 * @param response - GraphQL response object
 * @returns Cascade updates or null if not present
 */
export function extractCascadeData(response: { extensions?: Record<string, unknown> }): CascadeUpdates | null {
  const cascade = response.extensions?.cascade;
  if (!cascade || typeof cascade !== 'object') {
    return null;
  }
  return cascade as CascadeUpdates;
}

/**
 * Check if a response contains cascade data.
 *
 * @param response - GraphQL response object
 * @returns True if cascade data is present
 */
export function hasCascadeData(response: { extensions?: Record<string, unknown> }): boolean {
  return !!response.extensions?.cascade;
}
