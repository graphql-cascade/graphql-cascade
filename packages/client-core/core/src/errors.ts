/**
 * Error handling utilities for GraphQL Cascade client.
 */

import { CascadeError, CascadeErrorCode } from './types';

/**
 * Determines if an error is retryable based on its error code.
 */
export function isRetryableError(error: CascadeError): boolean {
  return ['TIMEOUT', 'SERVICE_UNAVAILABLE', 'RATE_LIMITED'].includes(error.code);
}

/**
 * Extracts retry delay from error extensions if available.
 */
export function getRetryDelay(error: CascadeError): number | undefined {
  return error.extensions?.retryAfter as number | undefined;
}

/**
 * Determines if an error is authentication-related.
 */
export function isAuthError(error: CascadeError): boolean {
  return ['UNAUTHORIZED', 'FORBIDDEN'].includes(error.code);
}

/**
 * Determines if an error is a client-side error (4xx status codes).
 */
export function isClientError(error: CascadeError): boolean {
  return [
    'VALIDATION_ERROR',
    'NOT_FOUND',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'CONFLICT',
  ].includes(error.code);
}

/**
 * Options for retry logic configuration.
 */
export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBackoff?: boolean;
}

/**
 * Calculates the delay before retrying based on error and attempt number.
 */
export function calculateRetryDelay(
  error: CascadeError,
  attemptNumber: number,
  options: RetryOptions = {}
): number {
  const { baseDelay = 1000, maxDelay = 30000, exponentialBackoff = true } = options;

  const retryAfter = getRetryDelay(error);
  if (retryAfter !== undefined) {
    return Math.min(retryAfter * 1000, maxDelay);
  }

  if (exponentialBackoff) {
    const delay = baseDelay * Math.pow(2, attemptNumber - 1);
    return Math.min(delay, maxDelay);
  }

  return baseDelay;
}

/**
 * Determines if an operation should be retried based on error and attempt number.
 */
export function shouldRetry(
  error: CascadeError,
  attemptNumber: number,
  options: RetryOptions = {}
): boolean {
  const { maxRetries = 3 } = options;
  if (attemptNumber >= maxRetries) return false;
  return isRetryableError(error);
}