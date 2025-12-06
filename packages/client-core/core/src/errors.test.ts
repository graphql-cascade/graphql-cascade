/**
 * Tests for error handling utilities.
 */

import {
  isRetryableError,
  getRetryDelay,
  isAuthError,
  isClientError,
  calculateRetryDelay,
  shouldRetry
} from './errors';
import { CascadeErrorCode } from './types';

describe('Error Classification', () => {
  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      expect(isRetryableError({ code: CascadeErrorCode.TIMEOUT, message: 'timeout' })).toBe(true);
      expect(isRetryableError({ code: CascadeErrorCode.SERVICE_UNAVAILABLE, message: 'unavailable' })).toBe(true);
      expect(isRetryableError({ code: CascadeErrorCode.RATE_LIMITED, message: 'limited' })).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(isRetryableError({ code: CascadeErrorCode.VALIDATION_ERROR, message: 'invalid' })).toBe(false);
      expect(isRetryableError({ code: CascadeErrorCode.NOT_FOUND, message: 'not found' })).toBe(false);
      expect(isRetryableError({ code: CascadeErrorCode.INTERNAL_ERROR, message: 'internal' })).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should extract retry delay from extensions', () => {
      const error = {
        code: CascadeErrorCode.RATE_LIMITED,
        message: 'limited',
        extensions: { retryAfter: 60 }
      };
      expect(getRetryDelay(error)).toBe(60);
    });

    it('should return undefined when no retry delay', () => {
      const error = {
        code: CascadeErrorCode.TIMEOUT,
        message: 'timeout'
      };
      expect(getRetryDelay(error)).toBeUndefined();
    });
  });

  describe('isAuthError', () => {
    it('should identify authentication errors', () => {
      expect(isAuthError({ code: CascadeErrorCode.UNAUTHORIZED, message: 'unauthorized' })).toBe(true);
      expect(isAuthError({ code: CascadeErrorCode.FORBIDDEN, message: 'forbidden' })).toBe(true);
    });

    it('should identify non-authentication errors', () => {
      expect(isAuthError({ code: CascadeErrorCode.VALIDATION_ERROR, message: 'invalid' })).toBe(false);
      expect(isAuthError({ code: CascadeErrorCode.NOT_FOUND, message: 'not found' })).toBe(false);
    });
  });

  describe('isClientError', () => {
    it('should identify client errors', () => {
      expect(isClientError({ code: CascadeErrorCode.VALIDATION_ERROR, message: 'invalid' })).toBe(true);
      expect(isClientError({ code: CascadeErrorCode.NOT_FOUND, message: 'not found' })).toBe(true);
      expect(isClientError({ code: CascadeErrorCode.UNAUTHORIZED, message: 'unauthorized' })).toBe(true);
      expect(isClientError({ code: CascadeErrorCode.FORBIDDEN, message: 'forbidden' })).toBe(true);
      expect(isClientError({ code: CascadeErrorCode.CONFLICT, message: 'conflict' })).toBe(true);
    });

    it('should identify server errors', () => {
      expect(isClientError({ code: CascadeErrorCode.INTERNAL_ERROR, message: 'internal' })).toBe(false);
      expect(isClientError({ code: CascadeErrorCode.TIMEOUT, message: 'timeout' })).toBe(false);
      expect(isClientError({ code: CascadeErrorCode.SERVICE_UNAVAILABLE, message: 'unavailable' })).toBe(false);
    });
  });
});

describe('Retry Logic', () => {
  describe('calculateRetryDelay', () => {
    it('should use retryAfter from error extensions', () => {
      const error = {
        code: CascadeErrorCode.RATE_LIMITED,
        message: 'limited',
        extensions: { retryAfter: 60 }
      };
      expect(calculateRetryDelay(error, 1)).toBe(30000); // capped at maxDelay (30 seconds)
    });

    it('should cap retryAfter at maxDelay', () => {
      const error = {
        code: CascadeErrorCode.RATE_LIMITED,
        message: 'limited',
        extensions: { retryAfter: 1000 } // 1000 seconds
      };
      expect(calculateRetryDelay(error, 1, { maxDelay: 30000 })).toBe(30000);
    });

    it('should use exponential backoff by default', () => {
      const error = { code: CascadeErrorCode.TIMEOUT, message: 'timeout' };
      expect(calculateRetryDelay(error, 1)).toBe(1000); // baseDelay
      expect(calculateRetryDelay(error, 2)).toBe(2000); // baseDelay * 2^1
      expect(calculateRetryDelay(error, 3)).toBe(4000); // baseDelay * 2^2
    });

    it('should cap exponential backoff at maxDelay', () => {
      const error = { code: CascadeErrorCode.TIMEOUT, message: 'timeout' };
      expect(calculateRetryDelay(error, 10, { baseDelay: 1000, maxDelay: 5000 })).toBe(5000);
    });

    it('should use fixed delay when exponentialBackoff is false', () => {
      const error = { code: CascadeErrorCode.TIMEOUT, message: 'timeout' };
      expect(calculateRetryDelay(error, 1, { exponentialBackoff: false })).toBe(1000);
      expect(calculateRetryDelay(error, 2, { exponentialBackoff: false })).toBe(1000);
      expect(calculateRetryDelay(error, 3, { exponentialBackoff: false })).toBe(1000);
    });

    it('should respect custom baseDelay', () => {
      const error = { code: CascadeErrorCode.TIMEOUT, message: 'timeout' };
      expect(calculateRetryDelay(error, 1, { baseDelay: 500 })).toBe(500);
      expect(calculateRetryDelay(error, 2, { baseDelay: 500 })).toBe(1000);
    });
  });

  describe('shouldRetry', () => {
    it('should not retry when maxRetries exceeded', () => {
      const error = { code: CascadeErrorCode.TIMEOUT, message: 'timeout' };
      expect(shouldRetry(error, 3, { maxRetries: 3 })).toBe(false);
      expect(shouldRetry(error, 4, { maxRetries: 3 })).toBe(false);
    });

    it('should retry retryable errors within limit', () => {
      const error = { code: CascadeErrorCode.TIMEOUT, message: 'timeout' };
      expect(shouldRetry(error, 1, { maxRetries: 3 })).toBe(true);
      expect(shouldRetry(error, 2, { maxRetries: 3 })).toBe(true);
    });

    it('should not retry non-retryable errors', () => {
      const error = { code: CascadeErrorCode.VALIDATION_ERROR, message: 'invalid' };
      expect(shouldRetry(error, 1, { maxRetries: 3 })).toBe(false);
    });

    it('should use default maxRetries of 3', () => {
      const error = { code: CascadeErrorCode.TIMEOUT, message: 'timeout' };
      expect(shouldRetry(error, 1)).toBe(true);
      expect(shouldRetry(error, 2)).toBe(true);
      expect(shouldRetry(error, 3)).toBe(false);
    });
  });
});