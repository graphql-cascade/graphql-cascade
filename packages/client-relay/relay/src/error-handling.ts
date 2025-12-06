/**
 * Error handling utilities for Relay network layer with GraphQL Cascade support.
 */

import { Observable } from 'relay-runtime';
import {
  CascadeError,
  CascadeErrorCode,
  shouldRetry,
  calculateRetryDelay,
  RetryOptions
} from '@graphql-cascade/client';

/**
 * Relay network error structure.
 */
export interface RelayNetworkError {
  name: string;
  message: string;
  stack?: string;
  source?: {
    errors?: Array<{
      message: string;
      locations?: Array<{ line: number; column: number }>;
      path?: string[];
      extensions?: Record<string, unknown>;
    }>;
    extensions?: Record<string, unknown>;
  };
}

/**
 * Extracts cascade errors from a Relay network error.
 */
export function extractCascadeErrors(error: RelayNetworkError): CascadeError[] {
  const cascadeErrors: CascadeError[] = [];

  // Check for GraphQL errors in the response
  if (error.source?.errors) {
    for (const gqlError of error.source.errors) {
      // Look for cascade-specific error codes in extensions
      const extensions = gqlError.extensions || {};
      const errorCode = extensions.code as string;

      if (errorCode) {
        cascadeErrors.push({
          message: gqlError.message,
          code: errorCode as any, // Will be validated by CascadeErrorCode enum
          path: gqlError.path,
          extensions
        });
      }
    }
  }

  // If no cascade errors found, create a generic one from the main error
  if (cascadeErrors.length === 0) {
    cascadeErrors.push({
      message: error.message,
      code: CascadeErrorCode.INTERNAL_ERROR,
      extensions: error.source?.extensions
    });
  }

  return cascadeErrors;
}

/**
 * Determines if a Relay network error contains retryable cascade errors.
 */
export function isRetryableRelayError(error: RelayNetworkError, attemptNumber: number, options?: RetryOptions): boolean {
  const cascadeErrors = extractCascadeErrors(error);
  return cascadeErrors.some(cascadeError => shouldRetry(cascadeError, attemptNumber, options));
}

/**
 * Calculates retry delay for a Relay network error.
 */
export function getRelayRetryDelay(
  error: RelayNetworkError,
  attemptNumber: number,
  options: RetryOptions = {}
): number {
  const cascadeErrors = extractCascadeErrors(error);
  // Use the first retryable error for delay calculation
  const retryableError = cascadeErrors.find(err => shouldRetry(err, attemptNumber));

  if (retryableError) {
    return calculateRetryDelay(retryableError, attemptNumber, options);
  }

  return 0;
}

/**
 * Options for Relay retry network wrapper.
 */
export interface RelayRetryOptions extends RetryOptions {
  /** Function to determine if an error should trigger a retry */
  shouldRetryFn?: (error: RelayNetworkError, attemptNumber: number, options?: RelayRetryOptions) => boolean;
  /** Function to calculate retry delay */
  calculateDelayFn?: (error: RelayNetworkError, attemptNumber: number, options?: RelayRetryOptions) => number;
  /** Callback fired before each retry attempt */
  onRetry?: (error: RelayNetworkError, attemptNumber: number) => void;
}

/**
 * Wraps a Relay network function with retry logic for cascade errors.
 */
export function withCascadeRetry<T extends any[], R>(
  networkFn: (...args: T) => Observable<R>,
  options: RelayRetryOptions = {}
): (...args: T) => Observable<R> {
  const {
    maxRetries = 3,
    shouldRetryFn = isRetryableRelayError,
    calculateDelayFn = getRelayRetryDelay,
    onRetry
  } = options;

  return (...args: T): Observable<R> => {
    return Observable.create((sink: any) => {
      let attemptNumber = 0;
      let timeoutId: NodeJS.Timeout | null = null;

      const executeAttempt = () => {
        attemptNumber++;

        const subscription = networkFn(...args).subscribe({
          next: (value: R) => {
            sink.next(value);
          },
          error: (error: RelayNetworkError) => {
            const shouldRetryAttempt = shouldRetryFn(error, attemptNumber);

            if (shouldRetryAttempt && attemptNumber < maxRetries) {
              const delay = calculateDelayFn(error, attemptNumber);

              if (onRetry) {
                onRetry(error, attemptNumber);
              }

              timeoutId = setTimeout(() => {
                executeAttempt();
              }, delay);
            } else {
              sink.error(error);
            }
          },
          complete: () => {
            sink.complete();
          }
        });

        return () => {
          subscription.unsubscribe();
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        };
      };

      executeAttempt();
    });
  };
}

/**
 * Creates a Relay network function with cascade error handling and retry logic.
 */
export function createCascadeNetwork<T extends any[], R>(
  baseNetworkFn: (...args: T) => Observable<R>,
  options: RelayRetryOptions = {}
): (...args: T) => Observable<R> {
  return withCascadeRetry(baseNetworkFn, options);
}