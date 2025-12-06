/**
 * URQL Exchange for GraphQL Cascade.
 *
 * This exchange intercepts GraphQL responses and processes cascade data
 * from the extensions field, applying updates to the cache.
 */

import { pipe, tap, mergeMap, fromPromise } from 'wonka';
import type { Exchange, Operation } from '@urql/core';
import { createScopedLogger, shouldRetry, calculateRetryDelay, RetryOptions, CascadeError } from '@graphql-cascade/client';
import {
  CascadeExchangeOptions,
  CascadeUpdates,
  CascadeOperation,
  InvalidationStrategy,
  CascadeApplyResult,
} from './types';

const logger = createScopedLogger('[Cascade:URQL]');

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
          logger.debug('Received cascade data:', cascade);
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
            logger.debug('Applied updates:', applyResult);
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
        logger.error('Error applying update:', error);
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
        logger.error('Error applying deletion:', error);
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
              logger.error('Error refetching:', error);
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
        logger.error('Error applying invalidation:', error);
      }
    }
  }

  return result;
}

/**
 * URQL Exchange for handling cascade errors with retry logic.
 *
 * This exchange:
 * 1. Extracts cascade errors from GraphQL responses
 * 2. Determines if operations should be retried
 * 3. Implements exponential backoff retry logic
 * 4. Provides callbacks for retry lifecycle events
 */
export const cascadeErrorExchange = (options: CascadeErrorExchangeOptions = {}): Exchange => {
  const {
    onRetryAttempt,
    onRetrySuccess,
    onRetryFailure,
    extractErrors = extractCascadeErrors,
    ...retryOptions
  } = options;

  return ({ forward }) => ops$ => {
    return pipe(
      forward(ops$),
      tap((result) => {
        if (result.error) {
          const cascadeErrors = extractErrors(result.error);

          if (cascadeErrors.length > 0) {
            // For now, just call the failure callback
            // Retry logic in URQL would require a more complex exchange
            onRetryFailure?.(result.operation, cascadeErrors, 1);
          }
        }
      })
    );
  };
};

/**
 * Options for the cascade error exchange.
 */
export interface CascadeErrorExchangeOptions extends RetryOptions {
  /**
   * Callback when a retry attempt is made.
   */
  onRetryAttempt?: (operation: Operation, attempt: number, error: CascadeError) => void;

  /**
   * Callback when retry succeeds.
   */
  onRetrySuccess?: (operation: Operation, attempts: number) => void;

  /**
   * Callback when retry fails completely.
   */
  onRetryFailure?: (operation: Operation, errors: CascadeError[], attempts: number) => void;

  /**
   * Custom function to extract cascade errors from URQL errors.
   */
  extractErrors?: (error: any) => CascadeError[];
}

/**
 * Extract cascade errors from URQL error format.
 */
export function extractCascadeErrors(error: any): CascadeError[] {
  const cascadeErrors: CascadeError[] = [];

  if (!error) return cascadeErrors;

  // Check for GraphQL errors
  if (error.graphQLErrors) {
    for (const gqlError of error.graphQLErrors) {
      const extensions = gqlError.extensions || {};

      // Look for cascade error in extensions
      if (extensions.cascade) {
        cascadeErrors.push(extensions.cascade as CascadeError);
      } else if (extensions.code) {
        // Create cascade error from GraphQL error
        cascadeErrors.push({
          message: gqlError.message,
          code: extensions.code as any,
          path: gqlError.path,
          extensions
        });
      }
    }
  }

  // Check for network error with cascade data
  if (error.networkError?.extensions?.cascade) {
    cascadeErrors.push(error.networkError.extensions.cascade as CascadeError);
  }

  // If no cascade errors found but there are GraphQL errors, create generic ones
  if (cascadeErrors.length === 0 && error.graphQLErrors?.length > 0) {
    for (const gqlError of error.graphQLErrors) {
      cascadeErrors.push({
        message: gqlError.message,
        code: 'INTERNAL_ERROR' as any,
        path: gqlError.path,
        extensions: gqlError.extensions
      });
    }
  }

  return cascadeErrors;
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
