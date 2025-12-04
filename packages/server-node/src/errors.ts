/**
 * GraphQL Cascade Error Classes
 *
 * Structured error handling with hints and documentation links.
 */

import type { CascadeErrorInfo } from './types';

/**
 * Standard GraphQL Cascade error codes (v1.1).
 *
 * These codes provide standardized error handling across GraphQL Cascade implementations.
 * All codes align with the GraphQL Cascade specification.
 */
export enum CascadeErrorCode {
  // Input and validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',

  // Authentication and authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Conflict and consistency
  CONFLICT = 'CONFLICT',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',

  // Operational errors (v1.1)
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Fallback
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  // Legacy internal codes (for backward compatibility)
  /** @deprecated Use INTERNAL_ERROR instead */
  NO_TRANSACTION = 'NO_TRANSACTION',
  /** @deprecated Use INTERNAL_ERROR instead */
  TRANSACTION_IN_PROGRESS = 'TRANSACTION_IN_PROGRESS',
  /** @deprecated Use VALIDATION_ERROR instead */
  MISSING_ID = 'MISSING_ID',
  /** @deprecated Use INTERNAL_ERROR instead */
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
}

/**
 * Structured error class for GraphQL Cascade operations.
 *
 * Provides better error messages with actionable hints and documentation links.
 */
export class CascadeError extends Error {
  /** Error code for programmatic handling */
  public readonly code: string;

  /** Actionable hint to help resolve the error */
  public readonly hint?: string;

  /** Path to documentation for this error */
  public readonly docsPath?: string;

  constructor(
    message: string,
    code: string,
    hint?: string,
    docsPath?: string
  ) {
    super(message);
    this.name = 'CascadeError';
    this.code = code;
    this.hint = hint;
    this.docsPath = docsPath;

    // Maintain proper stack trace for where error was thrown (Node.js only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CascadeError);
    }
  }

  /**
   * Format the error message with hint and docs link.
   */
  formatErrorMessage(): string {
    let formatted = `${this.name} [${this.code}]: ${this.message}`;

    if (this.hint) {
      formatted += `\nHint: ${this.hint}`;
    }

    if (this.docsPath) {
      formatted += `\nSee: ${this.docsPath}`;
    }

    return formatted;
  }

  /**
   * Override toString to include formatted message.
   */
  toString(): string {
    return this.formatErrorMessage();
  }
}

/**
 * Helper function to format error messages with hints.
 */
export function formatErrorMessage(
  message: string,
  hint?: string,
  docsPath?: string
): string {
  let formatted = message;

  if (hint) {
    formatted += `\nHint: ${hint}`;
  }

  if (docsPath) {
    formatted += `\nSee: ${docsPath}`;
  }

  return formatted;
}

/**
 * Create a validation error.
 */
export function validationError(
  message: string,
  field?: string,
  path?: string[],
  extensions?: Record<string, any>
): CascadeErrorInfo {
  return {
    message,
    code: CascadeErrorCode.VALIDATION_ERROR,
    field,
    path,
    extensions,
  };
}

/**
 * Create a not found error.
 */
export function notFoundError(
  message: string,
  field?: string,
  path?: string[],
  extensions?: Record<string, any>
): CascadeErrorInfo {
  return {
    message,
    code: CascadeErrorCode.NOT_FOUND,
    field,
    path,
    extensions,
  };
}

/**
 * Create a timeout error.
 */
export function timeoutError(
  message: string,
  timeoutMs: number,
  service?: string,
  extensions?: Record<string, any>
): CascadeErrorInfo {
  return {
    message,
    code: CascadeErrorCode.TIMEOUT,
    extensions: {
      timeoutMs,
      service,
      retryable: true,
      ...extensions,
    },
  };
}

/**
 * Create a rate limited error.
 */
export function rateLimitedError(
  message: string,
  retryAfter: number,
  limit: number,
  window: string,
  extensions?: Record<string, any>
): CascadeErrorInfo {
  return {
    message,
    code: CascadeErrorCode.RATE_LIMITED,
    extensions: {
      retryAfter,
      limit,
      window,
      remaining: 0,
      ...extensions,
    },
  };
}

/**
 * Create a service unavailable error.
 */
export function serviceUnavailableError(
  message: string,
  service: string,
  retryAfter?: number,
  extensions?: Record<string, any>
): CascadeErrorInfo {
  return {
    message,
    code: CascadeErrorCode.SERVICE_UNAVAILABLE,
    extensions: {
      service,
      retryable: true,
      retryAfter,
      ...extensions,
    },
  };
}

/**
 * Create an unauthorized error.
 */
export function unauthorizedError(
  message: string,
  extensions?: Record<string, any>
): CascadeErrorInfo {
  return {
    message,
    code: CascadeErrorCode.UNAUTHORIZED,
    extensions,
  };
}

/**
 * Create a forbidden error.
 */
export function forbiddenError(
  message: string,
  extensions?: Record<string, any>
): CascadeErrorInfo {
  return {
    message,
    code: CascadeErrorCode.FORBIDDEN,
    extensions,
  };
}

/**
 * Create a conflict error.
 */
export function conflictError(
  message: string,
  field?: string,
  path?: string[],
  extensions?: Record<string, any>
): CascadeErrorInfo {
  return {
    message,
    code: CascadeErrorCode.CONFLICT,
    field,
    path,
    extensions,
  };
}