import {
  CascadeOperation,
  CascadeErrorCode,
  InvalidationStrategy,
  InvalidationScope
} from './types';

describe('CascadeOperation enum', () => {
  it('should have CREATED, UPDATED, DELETED values', () => {
    expect(CascadeOperation.CREATED).toBe('CREATED');
    expect(CascadeOperation.UPDATED).toBe('UPDATED');
    expect(CascadeOperation.DELETED).toBe('DELETED');
  });
});

describe('CascadeErrorCode enum', () => {
  it('should have standard error codes', () => {
    expect(CascadeErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(CascadeErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(CascadeErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(CascadeErrorCode.FORBIDDEN).toBe('FORBIDDEN');
    expect(CascadeErrorCode.CONFLICT).toBe('CONFLICT');
    expect(CascadeErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(CascadeErrorCode.TRANSACTION_FAILED).toBe('TRANSACTION_FAILED');
  });
});

describe('InvalidationStrategy enum', () => {
  it('should have INVALIDATE, REFETCH, REMOVE values', () => {
    expect(InvalidationStrategy.INVALIDATE).toBe('INVALIDATE');
    expect(InvalidationStrategy.REFETCH).toBe('REFETCH');
    expect(InvalidationStrategy.REMOVE).toBe('REMOVE');
  });
});

describe('InvalidationScope enum', () => {
  it('should have EXACT, PREFIX, PATTERN, ALL values', () => {
    expect(InvalidationScope.EXACT).toBe('EXACT');
    expect(InvalidationScope.PREFIX).toBe('PREFIX');
    expect(InvalidationScope.PATTERN).toBe('PATTERN');
    expect(InvalidationScope.ALL).toBe('ALL');
  });
});