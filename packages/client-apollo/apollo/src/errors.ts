import { ApolloError } from '@apollo/client';
import { CascadeUpdates, CascadeResponse } from '@graphql-cascade/client';

/**
 * Cascade error codes - aligned with core v1.1 error codes
 */
export enum CascadeErrorCode {
  // Network errors
  NETWORK_ERROR = 'CASCADE_NETWORK_ERROR',
  TIMEOUT_ERROR = 'CASCADE_TIMEOUT_ERROR',

  // Cache errors
  CACHE_WRITE_ERROR = 'CASCADE_CACHE_WRITE_ERROR',
  CACHE_READ_ERROR = 'CASCADE_CACHE_READ_ERROR',
  CACHE_EVICTION_ERROR = 'CASCADE_CACHE_EVICTION_ERROR',
  CACHE_CORRUPTION = 'CASCADE_CACHE_CORRUPTION',

  // Cascade-specific errors
  INVALID_CASCADE_DATA = 'CASCADE_INVALID_DATA',
  MISSING_CASCADE_DATA = 'CASCADE_MISSING_DATA',
  PARTIAL_CASCADE_FAILURE = 'CASCADE_PARTIAL_FAILURE',
  CASCADE_CONFLICT = 'CASCADE_CONFLICT',

  // Optimistic update errors
  OPTIMISTIC_ROLLBACK_FAILED = 'CASCADE_OPTIMISTIC_ROLLBACK_FAILED',
  OPTIMISTIC_CONFLICT = 'CASCADE_OPTIMISTIC_CONFLICT',

  // Subscription errors
  SUBSCRIPTION_ERROR = 'CASCADE_SUBSCRIPTION_ERROR',
  SUBSCRIPTION_RECONNECT_FAILED = 'CASCADE_SUBSCRIPTION_RECONNECT_FAILED',

  // New v1.1 error codes (mapped to existing Apollo codes for compatibility)
  VALIDATION_ERROR = 'CASCADE_INVALID_DATA',
  NOT_FOUND = 'CASCADE_MISSING_DATA',
  UNAUTHORIZED = 'CASCADE_CONFLICT', // Using existing code for auth errors
  FORBIDDEN = 'CASCADE_CONFLICT', // Using existing code for auth errors
  CONFLICT = 'CASCADE_CONFLICT',
  INTERNAL_ERROR = 'CASCADE_UNKNOWN_ERROR',
  TRANSACTION_FAILED = 'CASCADE_PARTIAL_FAILURE',
  TIMEOUT = 'CASCADE_TIMEOUT_ERROR',
  RATE_LIMITED = 'CASCADE_NETWORK_ERROR',
  SERVICE_UNAVAILABLE = 'CASCADE_NETWORK_ERROR',

  // Unknown
  UNKNOWN_ERROR = 'CASCADE_UNKNOWN_ERROR'
}

/**
 * Severity levels for cascade errors
 */
export enum CascadeErrorSeverity {
  /** Informational - logged but no action needed */
  INFO = 'info',
  /** Warning - operation succeeded but with issues */
  WARNING = 'warning',
  /** Error - operation failed but recoverable */
  ERROR = 'error',
  /** Critical - requires immediate attention, may need manual intervention */
  CRITICAL = 'critical'
}

/**
 * Recovery action types
 */
export enum RecoveryAction {
  /** No action needed */
  NONE = 'NONE',
  /** Retry the operation */
  RETRY = 'RETRY',
  /** Refetch affected queries */
  REFETCH = 'REFETCH',
  /** Reset the cache */
  RESET_CACHE = 'RESET_CACHE',
  /** Roll back optimistic updates */
  ROLLBACK = 'ROLLBACK',
  /** Reconnect subscription */
  RECONNECT = 'RECONNECT',
  /** Notify user */
  NOTIFY_USER = 'NOTIFY_USER',
  /** Custom recovery handler */
  CUSTOM = 'CUSTOM'
}

/**
 * Custom cascade error class with enhanced context
 */
export class CascadeError extends Error {
  readonly code: CascadeErrorCode;
  readonly severity: CascadeErrorSeverity;
  readonly recoverable: boolean;
  readonly context: CascadeErrorContext;
  readonly timestamp: string;
  readonly originalError?: Error;

  constructor(options: CascadeErrorOptions) {
    super(options.message);
    this.name = 'CascadeError';
    this.code = options.code;
    this.severity = options.severity ?? CascadeErrorSeverity.ERROR;
    this.recoverable = options.recoverable ?? true;
    this.context = options.context ?? {};
    this.timestamp = new Date().toISOString();
    this.originalError = options.originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CascadeError);
    }
  }

  /**
   * Create a CascadeError from an Apollo error
   */
  static fromApolloError(error: ApolloError, context?: Partial<CascadeErrorContext>): CascadeError {
    const code = error.networkError
      ? CascadeErrorCode.NETWORK_ERROR
      : CascadeErrorCode.UNKNOWN_ERROR;

    return new CascadeError({
      message: error.message,
      code,
      severity: CascadeErrorSeverity.ERROR,
      recoverable: true,
      context: {
        ...context,
        graphQLErrors: error.graphQLErrors?.map(e => ({
          message: e.message,
          path: e.path,
          extensions: e.extensions
        }))
      },
      originalError: error
    });
  }

  /**
   * Create a CascadeError from any error
   */
  static fromError(error: unknown, code: CascadeErrorCode = CascadeErrorCode.UNKNOWN_ERROR): CascadeError {
    if (error instanceof CascadeError) {
      return error;
    }

    if (error instanceof ApolloError) {
      return CascadeError.fromApolloError(error);
    }

    const message = error instanceof Error ? error.message : String(error);
    const originalError = error instanceof Error ? error : undefined;

    return new CascadeError({
      message,
      code,
      severity: CascadeErrorSeverity.ERROR,
      recoverable: true,
      originalError
    });
  }

  /**
   * Get recommended recovery actions for this error
   */
  getRecoveryActions(): RecoveryAction[] {
    switch (this.code) {
      case CascadeErrorCode.NETWORK_ERROR:
      case CascadeErrorCode.TIMEOUT_ERROR:
        return [RecoveryAction.RETRY, RecoveryAction.NOTIFY_USER];

      case CascadeErrorCode.CACHE_WRITE_ERROR:
      case CascadeErrorCode.CACHE_EVICTION_ERROR:
        return [RecoveryAction.RETRY, RecoveryAction.RESET_CACHE];

      case CascadeErrorCode.CACHE_CORRUPTION:
        return [RecoveryAction.RESET_CACHE, RecoveryAction.REFETCH];

      case CascadeErrorCode.INVALID_CASCADE_DATA:
      case CascadeErrorCode.MISSING_CASCADE_DATA:
        return [RecoveryAction.REFETCH, RecoveryAction.NOTIFY_USER];

      case CascadeErrorCode.PARTIAL_CASCADE_FAILURE:
        return [RecoveryAction.REFETCH];

      case CascadeErrorCode.CASCADE_CONFLICT:
      case CascadeErrorCode.OPTIMISTIC_CONFLICT:
        return [RecoveryAction.ROLLBACK, RecoveryAction.REFETCH];

      case CascadeErrorCode.OPTIMISTIC_ROLLBACK_FAILED:
        return [RecoveryAction.RESET_CACHE, RecoveryAction.REFETCH];

      case CascadeErrorCode.SUBSCRIPTION_ERROR:
      case CascadeErrorCode.SUBSCRIPTION_RECONNECT_FAILED:
        return [RecoveryAction.RECONNECT, RecoveryAction.NOTIFY_USER];

      default:
        return [RecoveryAction.NOTIFY_USER];
    }
  }

  /**
   * Convert to a plain object for logging/serialization
   */
  toJSON(): CascadeErrorJSON {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      recoverable: this.recoverable,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Error context information
 */
export interface CascadeErrorContext {
  typename?: string;
  entityId?: string;
  mutation?: string;
  query?: string;
  cascade?: CascadeUpdates;
  attemptNumber?: number;
  maxAttempts?: number;
  graphQLErrors?: Array<{
    message: string;
    path?: readonly (string | number)[];
    extensions?: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

/**
 * Options for creating a CascadeError
 */
export interface CascadeErrorOptions {
  message: string;
  code: CascadeErrorCode;
  severity?: CascadeErrorSeverity;
  recoverable?: boolean;
  context?: CascadeErrorContext;
  originalError?: Error;
}

/**
 * JSON representation of CascadeError
 */
export interface CascadeErrorJSON {
  name: string;
  message: string;
  code: CascadeErrorCode;
  severity: CascadeErrorSeverity;
  recoverable: boolean;
  context: CascadeErrorContext;
  timestamp: string;
  stack?: string;
}

/**
 * Error recovery handler options
 */
export interface ErrorRecoveryOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Base delay between retries in ms
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Whether to use exponential backoff
   * @default true
   */
  exponentialBackoff?: boolean;

  /**
   * Callback for each recovery attempt
   */
  onRecoveryAttempt?: (attempt: number, error: CascadeError) => void;

  /**
   * Callback when recovery succeeds
   */
  onRecoverySuccess?: (attempts: number) => void;

  /**
   * Callback when recovery fails completely
   */
  onRecoveryFailure?: (error: CascadeError, attempts: number) => void;

  /**
   * Custom recovery handler
   */
  customRecovery?: (error: CascadeError, action: RecoveryAction) => Promise<boolean>;
}

/**
 * Error recovery manager for cascade operations.
 */
export class CascadeErrorRecovery {
  private options: Required<Omit<ErrorRecoveryOptions, 'onRecoveryAttempt' | 'onRecoverySuccess' | 'onRecoveryFailure' | 'customRecovery'>> &
    Pick<ErrorRecoveryOptions, 'onRecoveryAttempt' | 'onRecoverySuccess' | 'onRecoveryFailure' | 'customRecovery'>;

  constructor(options: ErrorRecoveryOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      exponentialBackoff: options.exponentialBackoff ?? true,
      ...options
    };
  }

  /**
   * Execute an operation with automatic error recovery.
   *
   * @param operation - The operation to execute
   * @param errorHandler - Optional custom error handler
   * @returns The operation result
   */
  async withRecovery<T>(
    operation: () => Promise<T>,
    errorHandler?: (error: CascadeError) => void
  ): Promise<T> {
    let lastError: CascadeError | null = null;
    let attempt = 0;

    while (attempt < this.options.maxRetries) {
      attempt++;

      try {
        const result = await operation();
        if (attempt > 1) {
          this.options.onRecoverySuccess?.(attempt);
        }
        return result;

      } catch (err) {
        lastError = CascadeError.fromError(err);
        lastError.context.attemptNumber = attempt;
        lastError.context.maxAttempts = this.options.maxRetries;

        this.options.onRecoveryAttempt?.(attempt, lastError);
        errorHandler?.(lastError);

        // Check if error is recoverable
        if (!lastError.recoverable) {
          break;
        }

        // Get recovery actions
        const actions = lastError.getRecoveryActions();

        // Try recovery actions
        if (actions.includes(RecoveryAction.RETRY) && attempt < this.options.maxRetries) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
          continue;
        }

        // If custom recovery is available, try it
        if (this.options.customRecovery) {
          for (const action of actions) {
            const recovered = await this.options.customRecovery(lastError, action);
            if (recovered) {
              return operation();
            }
          }
        }

        break;
      }
    }

    this.options.onRecoveryFailure?.(lastError!, attempt);
    throw lastError;
  }

  /**
   * Handle a cascade error without retry logic.
   *
   * @param error - The error to handle
   * @returns Recommended recovery actions
   */
  handleError(error: unknown): { cascadeError: CascadeError; actions: RecoveryAction[] } {
    const cascadeError = CascadeError.fromError(error);
    const actions = cascadeError.getRecoveryActions();

    return { cascadeError, actions };
  }

  /**
   * Calculate delay for retry with optional exponential backoff.
   */
  private calculateDelay(attempt: number): number {
    if (this.options.exponentialBackoff) {
      return this.options.retryDelay * Math.pow(2, attempt - 1);
    }
    return this.options.retryDelay;
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Error boundary handler for cascade operations.
 * Collects and manages multiple errors during batch operations.
 */
export class CascadeErrorBoundary {
  private errors: CascadeError[] = [];
  private warningsCount = 0;
  private errorsCount = 0;
  private criticalCount = 0;

  /**
   * Add an error to the boundary.
   */
  addError(error: CascadeError): void {
    this.errors.push(error);

    switch (error.severity) {
      case CascadeErrorSeverity.WARNING:
        this.warningsCount++;
        break;
      case CascadeErrorSeverity.ERROR:
        this.errorsCount++;
        break;
      case CascadeErrorSeverity.CRITICAL:
        this.criticalCount++;
        break;
    }
  }

  /**
   * Check if there are any errors.
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Check if there are any critical errors.
   */
  hasCriticalErrors(): boolean {
    return this.criticalCount > 0;
  }

  /**
   * Get all collected errors.
   */
  getErrors(): CascadeError[] {
    return [...this.errors];
  }

  /**
   * Get error summary.
   */
  getSummary(): ErrorBoundarySummary {
    return {
      total: this.errors.length,
      warnings: this.warningsCount,
      errors: this.errorsCount,
      critical: this.criticalCount,
      recoverable: this.errors.filter(e => e.recoverable).length
    };
  }

  /**
   * Clear all errors.
   */
  clear(): void {
    this.errors = [];
    this.warningsCount = 0;
    this.errorsCount = 0;
    this.criticalCount = 0;
  }

  /**
   * Throw an aggregate error if any errors were collected.
   */
  throwIfErrors(): void {
    if (this.errors.length === 0) return;

    if (this.errors.length === 1) {
      throw this.errors[0];
    }

    const message = `Multiple cascade errors occurred (${this.errors.length} total)`;
    const aggregateError = new CascadeError({
      message,
      code: CascadeErrorCode.PARTIAL_CASCADE_FAILURE,
      severity: this.hasCriticalErrors()
        ? CascadeErrorSeverity.CRITICAL
        : CascadeErrorSeverity.ERROR,
      context: {
        errorCount: this.errors.length,
        errors: this.errors.map(e => e.toJSON())
      }
    });

    throw aggregateError;
  }
}

/**
 * Error boundary summary
 */
export interface ErrorBoundarySummary {
  total: number;
  warnings: number;
  errors: number;
  critical: number;
  recoverable: number;
}

/**
 * Create a pre-configured error recovery handler with common defaults.
 */
export function createDefaultErrorRecovery(
  options?: Partial<ErrorRecoveryOptions>
): CascadeErrorRecovery {
  return new CascadeErrorRecovery({
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
    onRecoveryAttempt: (attempt, error) => {
      console.warn(`[Cascade] Recovery attempt ${attempt}: ${error.message}`);
    },
    onRecoverySuccess: (attempts) => {
      console.info(`[Cascade] Operation succeeded after ${attempts} attempts`);
    },
    onRecoveryFailure: (error, attempts) => {
      console.error(`[Cascade] Operation failed after ${attempts} attempts:`, error.message);
    },
    ...options
  });
}
