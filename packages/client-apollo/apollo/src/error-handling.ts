import { ApolloLink, Observable, Operation, NextLink, FetchResult } from '@apollo/client';
import { shouldRetry, calculateRetryDelay, RetryOptions, CascadeError as CoreCascadeError, CascadeErrorCode as CoreCascadeErrorCode } from '@graphql-cascade/client';
import { CascadeError, CascadeErrorCode } from './errors';
import { CascadeErrorCode as CoreErrorCode } from '@graphql-cascade/client';

/**
 * Options for the cascade error handling link.
 */
export interface CascadeErrorLinkOptions extends RetryOptions {
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
  onRetryFailure?: (operation: Operation, error: CascadeError, attempts: number) => void;

  /**
   * Whether to extract cascade errors from GraphQL responses.
   * @default true
   */
  extractCascadeErrors?: boolean;
}

/**
 * Apollo Link that handles cascade errors with retry logic.
 *
 * This link:
 * 1. Extracts cascade errors from GraphQL responses
 * 2. Determines if operations should be retried
 * 3. Implements exponential backoff retry logic
 * 4. Provides callbacks for retry lifecycle events
 */
export class CascadeErrorLink extends ApolloLink {
  private options: Required<Pick<CascadeErrorLinkOptions, 'extractCascadeErrors'>> &
    Omit<CascadeErrorLinkOptions, 'extractCascadeErrors'>;

  constructor(options: CascadeErrorLinkOptions = {}) {
    super();
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      baseDelay: options.baseDelay ?? 1000,
      maxDelay: options.maxDelay ?? 30000,
      exponentialBackoff: options.exponentialBackoff ?? true,
      extractCascadeErrors: options.extractCascadeErrors ?? true,
      ...options
    };
  }

  /**
   * Execute the link with retry logic.
   */
  request(operation: Operation, forward: NextLink): Observable<FetchResult> {
    return new Observable<FetchResult>((observer) => {
      let attempt = 0;
      let subscription: { unsubscribe: () => void } | null = null;

      const execute = () => {
        attempt++;

        subscription = forward(operation).subscribe({
          next: (result) => {
            // Extract cascade errors from the response
            if (this.options.extractCascadeErrors) {
              const cascadeError = extractCascadeError(result);

              if (cascadeError) {
                // Convert to core error for retry logic
                const coreError = toCoreCascadeError(cascadeError);

                // Check if we should retry
                if (shouldRetry(coreError, attempt, this.options)) {
                  this.options.onRetryAttempt?.(operation, attempt, cascadeError);

                  // Calculate delay and retry
                  const delay = calculateRetryDelay(coreError, attempt, this.options);
                  setTimeout(execute, delay);
                  return;
                } else {
                  // No more retries, emit the error
                  this.options.onRetryFailure?.(operation, cascadeError, attempt);
                  observer.error(cascadeError);
                  return;
                }
              }
            }

            // No cascade errors or extraction disabled, pass through
            if (attempt > 1) {
              this.options.onRetrySuccess?.(operation, attempt);
            }
            observer.next(result);
          },

          error: (error) => {
            // Convert Apollo error to CascadeError
            const cascadeError = CascadeError.fromApolloError(error, {
              operation: operation.operationName,
              query: operation.query?.loc?.source.body
            });

            // Convert to core error for retry logic
            const coreError = toCoreCascadeError(cascadeError);

            // Check if we should retry
            if (shouldRetry(coreError, attempt, this.options)) {
              this.options.onRetryAttempt?.(operation, attempt, cascadeError);

              // Calculate delay and retry
              const delay = calculateRetryDelay(coreError, attempt, this.options);
              setTimeout(execute, delay);
              return;
            } else {
              // No more retries, emit the error
              this.options.onRetryFailure?.(operation, cascadeError, attempt);
              observer.error(cascadeError);
              return;
            }
          },

          complete: () => {
            observer.complete();
          }
        });
      };

      // Start the first attempt
      execute();

      // Return unsubscribe function
      return () => {
        subscription?.unsubscribe();
      };
    });
  }
}

/**
 * Convert Apollo CascadeError to core CascadeError for retry logic.
 */
function toCoreCascadeError(apolloError: CascadeError): CoreCascadeError {
  return {
    message: apolloError.message,
    code: mapToCoreErrorCode(apolloError.code),
    extensions: {
      severity: apolloError.severity,
      recoverable: apolloError.recoverable,
      context: apolloError.context,
      timestamp: apolloError.timestamp
    }
  };
}

/**
 * Map Apollo CascadeErrorCode to core CascadeErrorCode.
 */
function mapToCoreErrorCode(code: CascadeErrorCode): CoreCascadeErrorCode {
  switch (code) {
    case CascadeErrorCode.NETWORK_ERROR:
      return CoreCascadeErrorCode.SERVICE_UNAVAILABLE;
    case CascadeErrorCode.TIMEOUT_ERROR:
      return CoreCascadeErrorCode.TIMEOUT;
    case CascadeErrorCode.INVALID_CASCADE_DATA:
      return CoreCascadeErrorCode.VALIDATION_ERROR;
    case CascadeErrorCode.MISSING_CASCADE_DATA:
      return CoreCascadeErrorCode.NOT_FOUND;
    case CascadeErrorCode.CASCADE_CONFLICT:
      return CoreCascadeErrorCode.CONFLICT;
    case CascadeErrorCode.PARTIAL_CASCADE_FAILURE:
      return CoreCascadeErrorCode.TRANSACTION_FAILED;
    default:
      return CoreCascadeErrorCode.INTERNAL_ERROR;
  }
}

/**
 * Map error codes from various sources to core CascadeErrorCode.
 */
function mapErrorCodeToCore(code?: string): CoreCascadeErrorCode {
  if (!code) return CoreCascadeErrorCode.INTERNAL_ERROR;

  // Direct mapping for new v1.1 error codes
  switch (code.toUpperCase()) {
    case 'VALIDATION_ERROR':
      return CoreCascadeErrorCode.VALIDATION_ERROR;
    case 'NOT_FOUND':
      return CoreCascadeErrorCode.NOT_FOUND;
    case 'UNAUTHORIZED':
      return CoreCascadeErrorCode.UNAUTHORIZED;
    case 'FORBIDDEN':
      return CoreCascadeErrorCode.FORBIDDEN;
    case 'CONFLICT':
      return CoreCascadeErrorCode.CONFLICT;
    case 'INTERNAL_ERROR':
      return CoreCascadeErrorCode.INTERNAL_ERROR;
    case 'TRANSACTION_FAILED':
      return CoreCascadeErrorCode.TRANSACTION_FAILED;
    case 'TIMEOUT':
      return CoreCascadeErrorCode.TIMEOUT;
    case 'RATE_LIMITED':
      return CoreCascadeErrorCode.RATE_LIMITED;
    case 'SERVICE_UNAVAILABLE':
      return CoreCascadeErrorCode.SERVICE_UNAVAILABLE;
    default:
      return CoreCascadeErrorCode.INTERNAL_ERROR;
  }
}

/**
 * Extract cascade error from a GraphQL response.
 *
 * Looks for cascade errors in the response extensions or errors array.
 */
export function extractCascadeError(result: FetchResult): CascadeError | null {
  // Check for cascade errors in extensions
  const extensions = result.extensions as any;
  if (extensions?.cascade?.errors?.length > 0) {
    const cascadeErrors = extensions.cascade.errors as any[];
    const primaryError = cascadeErrors[0];

    return new CascadeError({
      message: primaryError.message || 'Cascade operation failed',
      code: mapErrorCode(primaryError.code),
      severity: primaryError.severity || 'error',
      recoverable: primaryError.recoverable !== false,
      context: {
        cascade: extensions.cascade,
        graphQLErrors: cascadeErrors
      }
    });
  }

  // Check for GraphQL errors that might be cascade-related
  if (result.errors && result.errors.length > 0) {
    for (const gqlError of result.errors) {
      const extensions = gqlError.extensions as any;

      // Look for cascade-specific error codes in extensions
      if (extensions?.cascade) {
        return new CascadeError({
          message: gqlError.message,
          code: mapErrorCode(extensions.code),
          severity: extensions.severity || 'error',
          recoverable: extensions.recoverable !== false,
          context: {
            cascade: extensions.cascade,
            graphQLErrors: [{
              message: gqlError.message,
              path: gqlError.path,
              extensions
            }]
          },
          originalError: gqlError as any
        });
      }
    }
  }

  return null;
}

/**
 * Map error codes from various sources to CascadeErrorCode.
 */
function mapErrorCode(code?: string): CascadeErrorCode {
  if (!code) return CascadeErrorCode.UNKNOWN_ERROR;

  // Direct mapping for v1.1 error codes
  switch (code.toUpperCase()) {
    case 'VALIDATION_ERROR':
      return CascadeErrorCode.VALIDATION_ERROR;
    case 'NOT_FOUND':
      return CascadeErrorCode.NOT_FOUND;
    case 'UNAUTHORIZED':
      return CascadeErrorCode.UNAUTHORIZED;
    case 'FORBIDDEN':
      return CascadeErrorCode.FORBIDDEN;
    case 'CONFLICT':
      return CascadeErrorCode.CONFLICT;
    case 'INTERNAL_ERROR':
      return CascadeErrorCode.INTERNAL_ERROR;
    case 'TRANSACTION_FAILED':
      return CascadeErrorCode.TRANSACTION_FAILED;
    case 'TIMEOUT':
      return CascadeErrorCode.TIMEOUT;
    case 'RATE_LIMITED':
      return CascadeErrorCode.RATE_LIMITED;
    case 'SERVICE_UNAVAILABLE':
      return CascadeErrorCode.SERVICE_UNAVAILABLE;
    // Legacy mappings for backward compatibility
    case 'CASCADE_INVALID_DATA':
      return CascadeErrorCode.INVALID_CASCADE_DATA;
    case 'CASCADE_MISSING_DATA':
      return CascadeErrorCode.MISSING_CASCADE_DATA;
    case 'CASCADE_TIMEOUT_ERROR':
      return CascadeErrorCode.TIMEOUT_ERROR;
    case 'CASCADE_NETWORK_ERROR':
      return CascadeErrorCode.NETWORK_ERROR;
    case 'CASCADE_CONFLICT':
      return CascadeErrorCode.CASCADE_CONFLICT;
    case 'CASCADE_PARTIAL_FAILURE':
      return CascadeErrorCode.PARTIAL_CASCADE_FAILURE;
    default:
      return CascadeErrorCode.UNKNOWN_ERROR;
  }
}

/**
 * Create a pre-configured cascade error handling link.
 */
export function createCascadeErrorLink(options?: CascadeErrorLinkOptions): ApolloLink {
  return new CascadeErrorLink(options);
}

/**
 * Create a cascade error handling link with default retry configuration.
 */
export function createDefaultCascadeErrorLink(): ApolloLink {
  return new CascadeErrorLink({
    maxRetries: 3,
    baseDelay: 1000,
    exponentialBackoff: true,
    onRetryAttempt: (operation, attempt, error) => {
      console.warn(`[Cascade] Retry attempt ${attempt} for ${operation.operationName}: ${error.message}`);
    },
    onRetrySuccess: (operation, attempts) => {
      console.info(`[Cascade] Operation ${operation.operationName} succeeded after ${attempts} attempts`);
    },
    onRetryFailure: (operation, error, attempts) => {
      console.error(`[Cascade] Operation ${operation.operationName} failed after ${attempts} attempts:`, error.message);
    }
  });
}