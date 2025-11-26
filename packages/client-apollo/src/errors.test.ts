import { ApolloError } from '@apollo/client';
import { GraphQLError } from 'graphql';
import {
  CascadeError,
  CascadeErrorCode,
  CascadeErrorSeverity,
  RecoveryAction,
  CascadeErrorRecovery,
  CascadeErrorBoundary,
  createDefaultErrorRecovery
} from './errors';

describe('CascadeError', () => {
  describe('constructor', () => {
    it('should create error with required properties', () => {
      const error = new CascadeError({
        message: 'Test error',
        code: CascadeErrorCode.CACHE_WRITE_ERROR
      });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(CascadeErrorCode.CACHE_WRITE_ERROR);
      expect(error.severity).toBe(CascadeErrorSeverity.ERROR);
      expect(error.recoverable).toBe(true);
      expect(error.timestamp).toBeDefined();
    });

    it('should create error with all options', () => {
      const originalError = new Error('Original');
      const error = new CascadeError({
        message: 'Test error',
        code: CascadeErrorCode.CACHE_CORRUPTION,
        severity: CascadeErrorSeverity.CRITICAL,
        recoverable: false,
        context: { typename: 'User', entityId: '1' },
        originalError
      });

      expect(error.severity).toBe(CascadeErrorSeverity.CRITICAL);
      expect(error.recoverable).toBe(false);
      expect(error.context.typename).toBe('User');
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('fromApolloError', () => {
    it('should convert network error', () => {
      const apolloError = new ApolloError({
        networkError: new Error('Network failed'),
        graphQLErrors: []
      });

      const cascadeError = CascadeError.fromApolloError(apolloError);

      expect(cascadeError.code).toBe(CascadeErrorCode.NETWORK_ERROR);
      expect(cascadeError.originalError).toBe(apolloError);
    });

    it('should convert GraphQL error', () => {
      const apolloError = new ApolloError({
        graphQLErrors: [
          new GraphQLError('Field error', {
            path: ['user', 'name'],
            extensions: { code: 'VALIDATION_ERROR' }
          })
        ]
      });

      const cascadeError = CascadeError.fromApolloError(apolloError, {
        mutation: 'updateUser'
      });

      expect(cascadeError.code).toBe(CascadeErrorCode.UNKNOWN_ERROR);
      expect(cascadeError.context.mutation).toBe('updateUser');
      expect(cascadeError.context.graphQLErrors).toBeDefined();
    });
  });

  describe('fromError', () => {
    it('should return same CascadeError instance', () => {
      const original = new CascadeError({
        message: 'Original',
        code: CascadeErrorCode.CACHE_READ_ERROR
      });

      const result = CascadeError.fromError(original);

      expect(result).toBe(original);
    });

    it('should convert generic Error', () => {
      const error = new Error('Generic error');

      const cascadeError = CascadeError.fromError(error);

      expect(cascadeError.message).toBe('Generic error');
      expect(cascadeError.code).toBe(CascadeErrorCode.UNKNOWN_ERROR);
    });

    it('should convert string error', () => {
      const cascadeError = CascadeError.fromError('String error');

      expect(cascadeError.message).toBe('String error');
    });

    it('should use provided error code', () => {
      const error = new Error('Test');

      const cascadeError = CascadeError.fromError(error, CascadeErrorCode.TIMEOUT_ERROR);

      expect(cascadeError.code).toBe(CascadeErrorCode.TIMEOUT_ERROR);
    });
  });

  describe('getRecoveryActions', () => {
    it('should return RETRY for network errors', () => {
      const error = new CascadeError({
        message: 'Network error',
        code: CascadeErrorCode.NETWORK_ERROR
      });

      const actions = error.getRecoveryActions();

      expect(actions).toContain(RecoveryAction.RETRY);
      expect(actions).toContain(RecoveryAction.NOTIFY_USER);
    });

    it('should return RESET_CACHE for cache corruption', () => {
      const error = new CascadeError({
        message: 'Cache corrupted',
        code: CascadeErrorCode.CACHE_CORRUPTION
      });

      const actions = error.getRecoveryActions();

      expect(actions).toContain(RecoveryAction.RESET_CACHE);
      expect(actions).toContain(RecoveryAction.REFETCH);
    });

    it('should return ROLLBACK for conflicts', () => {
      const error = new CascadeError({
        message: 'Conflict',
        code: CascadeErrorCode.CASCADE_CONFLICT
      });

      const actions = error.getRecoveryActions();

      expect(actions).toContain(RecoveryAction.ROLLBACK);
      expect(actions).toContain(RecoveryAction.REFETCH);
    });

    it('should return RECONNECT for subscription errors', () => {
      const error = new CascadeError({
        message: 'Subscription failed',
        code: CascadeErrorCode.SUBSCRIPTION_ERROR
      });

      const actions = error.getRecoveryActions();

      expect(actions).toContain(RecoveryAction.RECONNECT);
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new CascadeError({
        message: 'Test',
        code: CascadeErrorCode.INVALID_CASCADE_DATA,
        context: { typename: 'User' }
      });

      const json = error.toJSON();

      expect(json.name).toBe('CascadeError');
      expect(json.message).toBe('Test');
      expect(json.code).toBe(CascadeErrorCode.INVALID_CASCADE_DATA);
      expect(json.context.typename).toBe('User');
      expect(json.timestamp).toBeDefined();
    });
  });
});

describe('CascadeErrorRecovery', () => {
  describe('withRecovery', () => {
    it('should execute operation successfully', async () => {
      const recovery = new CascadeErrorRecovery();
      const result = await recovery.withRecovery(async () => 'success');

      expect(result).toBe('success');
    });

    it('should retry on failure with network error', async () => {
      const recovery = new CascadeErrorRecovery({ maxRetries: 3, retryDelay: 10 });
      let attempts = 0;

      const result = await recovery.withRecovery(async () => {
        attempts++;
        if (attempts < 2) {
          // Throw a network error which supports RETRY
          throw new CascadeError({
            message: 'Temporary failure',
            code: CascadeErrorCode.NETWORK_ERROR
          });
        }
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should fail after max retries with network error', async () => {
      const recovery = new CascadeErrorRecovery({ maxRetries: 2, retryDelay: 10 });
      let attempts = 0;

      await expect(
        recovery.withRecovery(async () => {
          attempts++;
          throw new CascadeError({
            message: 'Persistent failure',
            code: CascadeErrorCode.NETWORK_ERROR
          });
        })
      ).rejects.toThrow();

      expect(attempts).toBe(2);
    });

    it('should call recovery callbacks', async () => {
      const onAttempt = jest.fn();
      const onSuccess = jest.fn();
      const recovery = new CascadeErrorRecovery({
        maxRetries: 3,
        retryDelay: 10,
        onRecoveryAttempt: onAttempt,
        onRecoverySuccess: onSuccess
      });

      let attempts = 0;
      await recovery.withRecovery(async () => {
        attempts++;
        if (attempts < 2) throw new CascadeError({
          message: 'Fail',
          code: CascadeErrorCode.NETWORK_ERROR
        });
        return 'success';
      });

      expect(onAttempt).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(2);
    });

    it('should call failure callback on exhausted retries', async () => {
      const onFailure = jest.fn();
      const recovery = new CascadeErrorRecovery({
        maxRetries: 2,
        retryDelay: 10,
        onRecoveryFailure: onFailure
      });

      try {
        await recovery.withRecovery(async () => {
          throw new CascadeError({
            message: 'Always fails',
            code: CascadeErrorCode.NETWORK_ERROR
          });
        });
      } catch {
        // Expected
      }

      expect(onFailure).toHaveBeenCalled();
    });

    it('should not retry non-recoverable errors', async () => {
      const recovery = new CascadeErrorRecovery({ maxRetries: 3, retryDelay: 10 });
      let attempts = 0;

      const nonRecoverable = new CascadeError({
        message: 'Non-recoverable',
        code: CascadeErrorCode.CACHE_CORRUPTION,
        recoverable: false
      });

      await expect(
        recovery.withRecovery(async () => {
          attempts++;
          throw nonRecoverable;
        })
      ).rejects.toThrow();

      expect(attempts).toBe(1);
    });

    it('should use exponential backoff', async () => {
      const recovery = new CascadeErrorRecovery({
        maxRetries: 3,
        retryDelay: 50,
        exponentialBackoff: true
      });

      const startTime = Date.now();
      let attempts = 0;

      await recovery.withRecovery(async () => {
        attempts++;
        if (attempts < 3) throw new CascadeError({
          message: 'Fail',
          code: CascadeErrorCode.NETWORK_ERROR
        });
        return 'success';
      });

      const elapsed = Date.now() - startTime;
      // First retry: 50ms, Second retry: 100ms = 150ms total (with some margin)
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });

  describe('handleError', () => {
    it('should return cascade error and actions', () => {
      const recovery = new CascadeErrorRecovery();
      const { cascadeError, actions } = recovery.handleError(new Error('Test'));

      expect(cascadeError).toBeInstanceOf(CascadeError);
      expect(actions.length).toBeGreaterThan(0);
    });
  });
});

describe('CascadeErrorBoundary', () => {
  describe('addError', () => {
    it('should collect errors', () => {
      const boundary = new CascadeErrorBoundary();

      boundary.addError(new CascadeError({
        message: 'Error 1',
        code: CascadeErrorCode.CACHE_WRITE_ERROR
      }));

      boundary.addError(new CascadeError({
        message: 'Error 2',
        code: CascadeErrorCode.CACHE_READ_ERROR
      }));

      expect(boundary.hasErrors()).toBe(true);
      expect(boundary.getErrors()).toHaveLength(2);
    });

    it('should track severity counts', () => {
      const boundary = new CascadeErrorBoundary();

      boundary.addError(new CascadeError({
        message: 'Warning',
        code: CascadeErrorCode.MISSING_CASCADE_DATA,
        severity: CascadeErrorSeverity.WARNING
      }));

      boundary.addError(new CascadeError({
        message: 'Critical',
        code: CascadeErrorCode.CACHE_CORRUPTION,
        severity: CascadeErrorSeverity.CRITICAL
      }));

      const summary = boundary.getSummary();

      expect(summary.warnings).toBe(1);
      expect(summary.critical).toBe(1);
    });
  });

  describe('hasCriticalErrors', () => {
    it('should detect critical errors', () => {
      const boundary = new CascadeErrorBoundary();

      expect(boundary.hasCriticalErrors()).toBe(false);

      boundary.addError(new CascadeError({
        message: 'Critical',
        code: CascadeErrorCode.CACHE_CORRUPTION,
        severity: CascadeErrorSeverity.CRITICAL
      }));

      expect(boundary.hasCriticalErrors()).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should return accurate summary', () => {
      const boundary = new CascadeErrorBoundary();

      boundary.addError(new CascadeError({
        message: 'E1',
        code: CascadeErrorCode.CACHE_WRITE_ERROR,
        recoverable: true
      }));

      boundary.addError(new CascadeError({
        message: 'E2',
        code: CascadeErrorCode.CACHE_CORRUPTION,
        recoverable: false
      }));

      const summary = boundary.getSummary();

      expect(summary.total).toBe(2);
      expect(summary.recoverable).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all errors', () => {
      const boundary = new CascadeErrorBoundary();

      boundary.addError(new CascadeError({
        message: 'Error',
        code: CascadeErrorCode.CACHE_WRITE_ERROR
      }));

      expect(boundary.hasErrors()).toBe(true);

      boundary.clear();

      expect(boundary.hasErrors()).toBe(false);
      expect(boundary.getSummary().total).toBe(0);
    });
  });

  describe('throwIfErrors', () => {
    it('should not throw if no errors', () => {
      const boundary = new CascadeErrorBoundary();

      expect(() => boundary.throwIfErrors()).not.toThrow();
    });

    it('should throw single error directly', () => {
      const boundary = new CascadeErrorBoundary();
      const error = new CascadeError({
        message: 'Single error',
        code: CascadeErrorCode.CACHE_WRITE_ERROR
      });

      boundary.addError(error);

      expect(() => boundary.throwIfErrors()).toThrow(error);
    });

    it('should throw aggregate error for multiple errors', () => {
      const boundary = new CascadeErrorBoundary();

      boundary.addError(new CascadeError({
        message: 'E1',
        code: CascadeErrorCode.CACHE_WRITE_ERROR
      }));

      boundary.addError(new CascadeError({
        message: 'E2',
        code: CascadeErrorCode.CACHE_READ_ERROR
      }));

      expect(() => boundary.throwIfErrors()).toThrow('Multiple cascade errors');
    });
  });
});

describe('createDefaultErrorRecovery', () => {
  it('should create recovery with default options', () => {
    const recovery = createDefaultErrorRecovery();

    expect(recovery).toBeInstanceOf(CascadeErrorRecovery);
  });

  it('should accept custom options', () => {
    const recovery = createDefaultErrorRecovery({
      maxRetries: 5,
      retryDelay: 500
    });

    expect(recovery).toBeInstanceOf(CascadeErrorRecovery);
  });
});
