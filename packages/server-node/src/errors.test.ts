import { CascadeErrorCode } from './types';
import {
  validationError,
  notFoundError,
  timeoutError,
  rateLimitedError,
  serviceUnavailableError,
  unauthorizedError,
  forbiddenError,
  conflictError,
} from './errors';

describe('CascadeErrorCode', () => {
  it('should include all v1.1 error codes', () => {
    expect(CascadeErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(CascadeErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(CascadeErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(CascadeErrorCode.FORBIDDEN).toBe('FORBIDDEN');
    expect(CascadeErrorCode.CONFLICT).toBe('CONFLICT');
    expect(CascadeErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(CascadeErrorCode.TRANSACTION_FAILED).toBe('TRANSACTION_FAILED');
    expect(CascadeErrorCode.TIMEOUT).toBe('TIMEOUT');
    expect(CascadeErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');
    expect(CascadeErrorCode.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
  });

  it('should maintain backward compatibility with legacy codes', () => {
    expect(CascadeErrorCode.NO_TRANSACTION).toBe('NO_TRANSACTION');
    expect(CascadeErrorCode.TRANSACTION_IN_PROGRESS).toBe('TRANSACTION_IN_PROGRESS');
    expect(CascadeErrorCode.MISSING_ID).toBe('MISSING_ID');
    expect(CascadeErrorCode.SERIALIZATION_ERROR).toBe('SERIALIZATION_ERROR');
  });
});

describe('Convenience Functions', () => {
  describe('validationError', () => {
    it('should create validation error with all fields', () => {
      const error = validationError(
        'Invalid email',
        'email',
        ['input', 'email'],
        { pattern: '^[a-z]+$' }
      );

      expect(error.message).toBe('Invalid email');
      expect(error.code).toBe(CascadeErrorCode.VALIDATION_ERROR);
      expect(error.field).toBe('email');
      expect(error.path).toEqual(['input', 'email']);
      expect(error.extensions).toEqual({ pattern: '^[a-z]+$' });
    });

    it('should create validation error with minimal fields', () => {
      const error = validationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe(CascadeErrorCode.VALIDATION_ERROR);
      expect(error.field).toBeUndefined();
      expect(error.path).toBeUndefined();
      expect(error.extensions).toBeUndefined();
    });
  });

  describe('timeoutError', () => {
    it('should create timeout error with service', () => {
      const error = timeoutError('DB timeout', 5000, 'database');

      expect(error.message).toBe('DB timeout');
      expect(error.code).toBe(CascadeErrorCode.TIMEOUT);
      expect(error.extensions).toEqual({
        timeoutMs: 5000,
        service: 'database',
        retryable: true,
      });
    });

    it('should create timeout error without service', () => {
      const error = timeoutError('Operation timeout', 3000);

      expect(error.extensions).toEqual({
        timeoutMs: 3000,
        service: undefined,
        retryable: true,
      });
    });
  });

  describe('rateLimitedError', () => {
    it('should create rate limited error', () => {
      const error = rateLimitedError('Rate limit exceeded', 45, 100, '1m');

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe(CascadeErrorCode.RATE_LIMITED);
      expect(error.extensions).toEqual({
        retryAfter: 45,
        limit: 100,
        window: '1m',
        remaining: 0,
      });
    });

    it('should merge additional extensions', () => {
      const error = rateLimitedError('Rate limit exceeded', 60, 100, '1m', {
        resetAt: '2023-11-11T10:01:00Z',
      });

      expect(error.extensions?.resetAt).toBe('2023-11-11T10:01:00Z');
    });
  });

  describe('serviceUnavailableError', () => {
    it('should create service unavailable error with retryAfter', () => {
      const error = serviceUnavailableError('Email service down', 'email-provider', 60);

      expect(error.message).toBe('Email service down');
      expect(error.code).toBe(CascadeErrorCode.SERVICE_UNAVAILABLE);
      expect(error.extensions).toEqual({
        service: 'email-provider',
        retryable: true,
        retryAfter: 60,
      });
    });

    it('should create service unavailable error without retryAfter', () => {
      const error = serviceUnavailableError('Payment gateway down', 'payment-gateway');

      expect(error.extensions).toEqual({
        service: 'payment-gateway',
        retryable: true,
        retryAfter: undefined,
      });
    });
  });

  describe('notFoundError', () => {
    it('should create not found error', () => {
      const error = notFoundError('User not found', 'userId', ['updateUser', 'id']);

      expect(error.message).toBe('User not found');
      expect(error.code).toBe(CascadeErrorCode.NOT_FOUND);
      expect(error.field).toBe('userId');
      expect(error.path).toEqual(['updateUser', 'id']);
    });
  });

  describe('unauthorizedError', () => {
    it('should create unauthorized error', () => {
      const error = unauthorizedError('Token expired', { reason: 'token_expired' });

      expect(error.message).toBe('Token expired');
      expect(error.code).toBe(CascadeErrorCode.UNAUTHORIZED);
      expect(error.extensions).toEqual({ reason: 'token_expired' });
    });
  });

  describe('forbiddenError', () => {
    it('should create forbidden error', () => {
      const error = forbiddenError('Insufficient permissions', {
        requiredRole: 'admin',
      });

      expect(error.message).toBe('Insufficient permissions');
      expect(error.code).toBe(CascadeErrorCode.FORBIDDEN);
      expect(error.extensions).toEqual({ requiredRole: 'admin' });
    });
  });

  describe('conflictError', () => {
    it('should create conflict error', () => {
      const error = conflictError('Email already exists', 'email', ['input', 'email'], {
        constraint: 'unique_email',
      });

      expect(error.message).toBe('Email already exists');
      expect(error.code).toBe(CascadeErrorCode.CONFLICT);
      expect(error.field).toBe('email');
      expect(error.path).toEqual(['input', 'email']);
      expect(error.extensions).toEqual({ constraint: 'unique_email' });
    });
  });
});