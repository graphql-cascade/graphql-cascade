/**
 * URQL Exchange for GraphQL Cascade.
 *
 * This exchange intercepts GraphQL responses and processes cascade data
 * from the extensions field, applying updates to the cache.
 */

import {
  delay,
  filter,
  fromValue,
  makeSubject,
  merge,
  mergeMap,
  pipe,
  takeUntil,
  tap,
} from "wonka";
import { makeOperation, type Exchange, type Operation } from "@urql/core";
import {
  applyTypeInvalidations,
  calculateRetryDelay,
  cascadeEntryTypename,
  createScopedLogger,
  isRetryableError,
  shouldRetry,
  toCascadeResponse,
  RetryOptions,
  CascadeError,
} from "@graphql-cascade/client";
import {
  CascadeExchangeOptions,
  CascadeUpdates,
  CascadeOperation,
  InvalidationStrategy,
  CascadeApplyResult,
} from "./types";

const logger = createScopedLogger("[Cascade:URQL]");

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
export const cascadeExchange = (
  options: CascadeExchangeOptions = {},
): Exchange => {
  const { onCascade, onCacheUpdate, onCacheDelete, debug, cacheAdapter } =
    options;

  return ({ forward }) =>
    (ops$) => {
      return pipe(
        forward(ops$),
        tap((result) => {
          // Check for cascade data in extensions
          const cascade = result.extensions?.cascade as
            | CascadeUpdates
            | undefined;

          if (!cascade) {
            return;
          }

          if (debug) {
            logger.debug("Received cascade data:", cascade);
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
              logger.debug("Applied updates:", applyResult);
            }
          }
        }),
      );
    };
};

/**
 * Apply cascade updates to the cache.
 */
function applyCascadeUpdates(
  cascade: CascadeUpdates,
  cacheAdapter: NonNullable<CascadeExchangeOptions["cacheAdapter"]>,
  options: {
    onCacheUpdate?: CascadeExchangeOptions["onCacheUpdate"];
    onCacheDelete?: CascadeExchangeOptions["onCacheDelete"];
    debug?: boolean;
  },
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
      const typename = cascadeEntryTypename(update);
      if (update.operation === CascadeOperation.DELETED) {
        cacheAdapter.evict(typename, update.id);
        options.onCacheDelete?.(typename, update.id);
        result.deletedCount++;
      } else {
        cacheAdapter.write(typename, update.id, update.entity);
        options.onCacheUpdate?.(typename, update.id, update.entity);
        result.updatedCount++;
      }
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error : new Error(String(error)),
      );
      if (options.debug) {
        logger.error("Error applying update:", error);
      }
    }
  }

  // Process deleted entities
  for (const deleted of cascade.deleted) {
    try {
      const typename = cascadeEntryTypename(deleted);
      cacheAdapter.evict(typename, deleted.id);
      options.onCacheDelete?.(typename, deleted.id);
      result.deletedCount++;
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error : new Error(String(error)),
      );
      if (options.debug) {
        logger.error("Error applying deletion:", error);
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
              logger.error("Error refetching:", error);
            }
          });
          break;
        case InvalidationStrategy.REMOVE:
          cacheAdapter.remove(invalidation);
          break;
      }
      result.invalidatedCount++;
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error : new Error(String(error)),
      );
      if (options.debug) {
        logger.error("Error applying invalidation:", error);
      }
    }
  }

  // Invalidate types whose entities were not listed individually
  try {
    applyTypeInvalidations(cacheAdapter, cascade.typeInvalidations);
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error : new Error(String(error)),
    );
    if (options.debug) {
      logger.error("Error applying type invalidations:", error);
    }
  }

  return result;
}

/** Retry state carried in the context of a retried operation. */
interface CascadeRetryState {
  attempts: number;
  delayMs: number;
}

/**
 * URQL exchange that retries operations failing with retryable cascade
 * errors (`TIMEOUT`, `SERVICE_UNAVAILABLE`, `RATE_LIMITED`), whether they
 * arrive as GraphQL errors or in a failed mutation payload. Delays follow
 * the server's `retryAfter` when it sends one, else exponential backoff.
 *
 * Place it before the exchange that sends requests, such as `fetchExchange`.
 */
export const cascadeErrorExchange = (
  options: CascadeErrorExchangeOptions = {},
): Exchange => {
  const {
    onRetryAttempt,
    onRetrySuccess,
    onRetryFailure,
    extractErrors = extractCascadeErrors,
    ...retryOptions
  } = options;

  return ({ forward }) =>
    (operations$) => {
      const { source: retries$, next: retry } = makeSubject<Operation>();

      const delayedRetries$ = pipe(
        retries$,
        mergeMap((operation) => {
          const { delayMs } = operation.context
            .cascadeRetry as CascadeRetryState;
          const teardown$ = pipe(
            operations$,
            filter((op) => op.kind === "teardown" && op.key === operation.key),
          );
          return pipe(
            fromValue(operation),
            delay(delayMs),
            takeUntil(teardown$),
          );
        }),
      );

      return pipe(
        merge([operations$, delayedRetries$]),
        forward,
        filter((result) => {
          const { operation } = result;
          const attempts =
            ((operation.context.cascadeRetry as CascadeRetryState | undefined)
              ?.attempts ?? 0) + 1;
          const errors = [
            ...(result.error ? extractErrors(result.error) : []),
            ...payloadErrors(result.data),
          ];

          const retryable = errors.find((error) =>
            shouldRetry(error, attempts, retryOptions),
          );
          if (retryable) {
            onRetryAttempt?.(operation, attempts, retryable);
            retry(
              makeOperation(operation.kind, operation, {
                ...operation.context,
                cascadeRetry: {
                  attempts,
                  delayMs: calculateRetryDelay(
                    retryable,
                    attempts,
                    retryOptions,
                  ),
                } satisfies CascadeRetryState,
              }),
            );
            return false;
          }

          if (errors.some(isRetryableError)) {
            onRetryFailure?.(operation, errors, attempts);
          } else if (errors.length === 0 && attempts > 1) {
            onRetrySuccess?.(operation, attempts);
          }
          return true;
        }),
      );
    };
};

/** The errors of the failed mutation payloads in a result's data. */
function payloadErrors(data: unknown): CascadeError[] {
  if (data === null || typeof data !== "object") return [];
  return Object.values(data).flatMap((field) => {
    const response = toCascadeResponse(field);
    return response && !response.success ? (response.errors ?? []) : [];
  });
}

/**
 * Options for the cascade error exchange.
 */
export interface CascadeErrorExchangeOptions extends RetryOptions {
  /**
   * Callback when a retry attempt is made.
   */
  onRetryAttempt?: (
    operation: Operation,
    attempt: number,
    error: CascadeError,
  ) => void;

  /**
   * Callback when retry succeeds.
   */
  onRetrySuccess?: (operation: Operation, attempts: number) => void;

  /**
   * Callback when retry fails completely.
   */
  onRetryFailure?: (
    operation: Operation,
    errors: CascadeError[],
    attempts: number,
  ) => void;

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
          extensions,
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
        code: "INTERNAL_ERROR" as any,
        path: gqlError.path,
        extensions: gqlError.extensions,
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
export function extractCascadeData(response: {
  extensions?: Record<string, unknown>;
}): CascadeUpdates | null {
  const cascade = response.extensions?.cascade;
  if (!cascade || typeof cascade !== "object") {
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
export function hasCascadeData(response: {
  extensions?: Record<string, unknown>;
}): boolean {
  return !!response.extensions?.cascade;
}
