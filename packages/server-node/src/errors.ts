/**
 * GraphQL Cascade Error Classes
 *
 * Structured error handling with hints and documentation links.
 */

/**
 * Error codes for cascade operations.
 */
export enum CascadeErrorCode {
  NO_TRANSACTION = 'NO_TRANSACTION',
  TRANSACTION_IN_PROGRESS = 'TRANSACTION_IN_PROGRESS',
  MISSING_ID = 'MISSING_ID',
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