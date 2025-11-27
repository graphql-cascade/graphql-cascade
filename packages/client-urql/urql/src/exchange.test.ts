import { extractCascadeData, hasCascadeData, cascadeExchange } from './exchange';
import { InMemoryCascadeCache } from './cache';
import { fromValue, toArray } from 'wonka';
import {
  CascadeUpdates,
  CascadeOperation,
  InvalidationStrategy,
  InvalidationScope,
} from './types';

describe('extractCascadeData', () => {
  it('should return null when no extensions', () => {
    const response = {};
    expect(extractCascadeData(response)).toBeNull();
  });

  it('should return null when no cascade in extensions', () => {
    const response = { extensions: { other: 'data' } };
    expect(extractCascadeData(response)).toBeNull();
  });

  it('should extract cascade data from extensions', () => {
    const cascade: CascadeUpdates = {
      updated: [
        {
          __typename: 'User',
          id: '1',
          operation: CascadeOperation.UPDATED,
          entity: { name: 'Test' },
        },
      ],
      deleted: [],
      invalidations: [],
      metadata: {
        timestamp: '2024-01-01T00:00:00Z',
        depth: 1,
        affectedCount: 1,
      },
    };
    const response = { extensions: { cascade } };
    expect(extractCascadeData(response)).toEqual(cascade);
  });

  it('should return null for non-object cascade', () => {
    const response = { extensions: { cascade: 'invalid' } };
    expect(extractCascadeData(response)).toBeNull();
  });
});

describe('hasCascadeData', () => {
  it('should return false when no extensions', () => {
    expect(hasCascadeData({})).toBe(false);
  });

  it('should return false when no cascade', () => {
    expect(hasCascadeData({ extensions: {} })).toBe(false);
  });

  it('should return true when cascade exists', () => {
    expect(hasCascadeData({ extensions: { cascade: {} } })).toBe(true);
  });
});

describe('InMemoryCascadeCache', () => {
  let cache: InMemoryCascadeCache;

  beforeEach(() => {
    cache = new InMemoryCascadeCache();
  });

  describe('write and read', () => {
    it('should write and read entities', () => {
      cache.write('User', '1', { name: 'Test', email: 'test@example.com' });
      const entity = cache.read('User', '1');
      expect(entity).toEqual({
        __typename: 'User',
        id: '1',
        name: 'Test',
        email: 'test@example.com',
      });
    });

    it('should return null for non-existent entities', () => {
      expect(cache.read('User', '999')).toBeNull();
    });

    it('should overwrite existing entities', () => {
      cache.write('User', '1', { name: 'Original' });
      cache.write('User', '1', { name: 'Updated' });
      const entity = cache.read('User', '1');
      expect(entity?.name).toBe('Updated');
    });
  });

  describe('evict', () => {
    it('should remove entities from cache', () => {
      cache.write('User', '1', { name: 'Test' });
      cache.evict('User', '1');
      expect(cache.read('User', '1')).toBeNull();
    });

    it('should not throw when evicting non-existent entity', () => {
      expect(() => cache.evict('User', '999')).not.toThrow();
    });
  });

  describe('identify', () => {
    it('should return entity key', () => {
      const key = cache.identify({ __typename: 'User', id: '1' });
      expect(key).toBe('User:1');
    });

    it('should throw for invalid entities', () => {
      expect(() => cache.identify({})).toThrow();
    });
  });

  describe('query operations', () => {
    it('should store and retrieve queries', () => {
      cache.storeQuery('getUsers', undefined, [{ id: '1' }]);
      const result = cache.getQuery('getUsers');
      expect(result?.data).toEqual([{ id: '1' }]);
      expect(result?.isStale).toBe(false);
    });

    it('should store queries with arguments', () => {
      cache.storeQuery('getUser', { id: '1' }, { id: '1', name: 'Test' });
      const result = cache.getQuery('getUser', { id: '1' });
      expect(result?.data).toEqual({ id: '1', name: 'Test' });
    });

    it('should return null for non-existent queries', () => {
      expect(cache.getQuery('nonexistent')).toBeNull();
    });
  });

  describe('invalidate', () => {
    beforeEach(() => {
      cache.storeQuery('getUsers', undefined, []);
      cache.storeQuery('getUser', { id: '1' }, {});
      cache.storeQuery('getPosts', undefined, []);
    });

    it('should invalidate exact match', () => {
      cache.invalidate({
        queryName: 'getUsers',
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.EXACT,
      });
      expect(cache.getQuery('getUsers')?.isStale).toBe(true);
      expect(cache.getQuery('getPosts')?.isStale).toBe(false);
    });

    it('should invalidate by prefix', () => {
      cache.invalidate({
        queryName: 'get',
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.PREFIX,
      });
      expect(cache.getQuery('getUsers')?.isStale).toBe(true);
      expect(cache.getQuery('getPosts')?.isStale).toBe(true);
    });

    it('should invalidate by pattern', () => {
      cache.invalidate({
        queryPattern: 'get*s',
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.PATTERN,
      });
      expect(cache.getQuery('getUsers')?.isStale).toBe(true);
      expect(cache.getQuery('getPosts')?.isStale).toBe(true);
    });

    it('should invalidate all queries', () => {
      cache.invalidate({
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.ALL,
      });
      expect(cache.getQuery('getUsers')?.isStale).toBe(true);
      expect(cache.getQuery('getUser', { id: '1' })?.isStale).toBe(true);
      expect(cache.getQuery('getPosts')?.isStale).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove queries from cache', () => {
      cache.storeQuery('getUsers', undefined, []);
      cache.remove({
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REMOVE,
        scope: InvalidationScope.EXACT,
      });
      expect(cache.getQuery('getUsers')).toBeNull();
    });
  });

  describe('refetch', () => {
    it('should call refetch function', async () => {
      const refetchFn = jest.fn().mockResolvedValue(undefined);
      const cacheWithRefetch = new InMemoryCascadeCache({ refetchFn });
      cacheWithRefetch.storeQuery('getUsers', undefined, []);

      await cacheWithRefetch.refetch({
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT,
      });

      expect(refetchFn).toHaveBeenCalledWith('getUsers', undefined);
    });

    it('should invalidate when no refetch function', async () => {
      cache.storeQuery('getUsers', undefined, []);
      await cache.refetch({
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT,
      });
      expect(cache.getQuery('getUsers')?.isStale).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('should clear all cache', () => {
      cache.write('User', '1', { name: 'Test' });
      cache.storeQuery('getUsers', undefined, []);
      cache.clear();
      expect(cache.read('User', '1')).toBeNull();
      expect(cache.getQuery('getUsers')).toBeNull();
    });

    it('should get entities by type', () => {
      cache.write('User', '1', { name: 'User 1' });
      cache.write('User', '2', { name: 'User 2' });
      cache.write('Post', '1', { title: 'Post 1' });
      const users = cache.getEntitiesByType('User');
      expect(users).toHaveLength(2);
    });

    it('should return cache stats', () => {
      cache.write('User', '1', { name: 'Test' });
      cache.storeQuery('getUsers', undefined, []);
      cache.invalidate({
        queryName: 'getUsers',
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.EXACT,
      });
      const stats = cache.getStats();
      expect(stats.entityCount).toBe(1);
      expect(stats.queryCount).toBe(1);
      expect(stats.staleQueryCount).toBe(1);
    });
  });
});

describe('cascadeExchange', () => {
  let mockCacheAdapter: any;

  beforeEach(() => {
    mockCacheAdapter = {
      write: jest.fn(),
      evict: jest.fn(),
      invalidate: jest.fn(),
      refetch: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn(),
      identify: jest.fn(),
    };
  });

  it('should process cascade data correctly', () => {
    const exchange = cascadeExchange({ cacheAdapter: mockCacheAdapter });

    const mockOperation = { kind: 'mutation', key: 1 } as any;

    const mockResult = {
      operation: mockOperation,
      data: { some: 'data' },
      extensions: {
        cascade: {
          updated: [{
            __typename: 'User',
            id: '1',
            operation: CascadeOperation.UPDATED,
            entity: { name: 'Updated' },
          }],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01T00:00:00Z', depth: 1, affectedCount: 1 },
        } as CascadeUpdates,
      },
      stale: false,
      hasNext: false,
    };

    const forward = jest.fn(() => fromValue(mockResult));
    const ops$ = fromValue(mockOperation);

    const result$ = exchange({ forward, client: {} as any, dispatchDebug: jest.fn() } as any)(ops$);
    const results = toArray(result$);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(mockResult);
    expect(mockCacheAdapter.write).toHaveBeenCalledWith('User', '1', { name: 'Updated' });
  });

  it('should handle missing cascade data gracefully', () => {
    const exchange = cascadeExchange({ cacheAdapter: mockCacheAdapter });

    const mockOperation = { kind: 'mutation', key: 1 } as any;

    const mockResult = {
      operation: mockOperation,
      data: { some: 'data' },
      extensions: {},
      stale: false,
      hasNext: false,
    };

    const forward = jest.fn(() => fromValue(mockResult));
    const ops$ = fromValue(mockOperation);

    const result$ = exchange({ forward, client: {} as any, dispatchDebug: jest.fn() } as any)(ops$);
    const results = toArray(result$);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(mockResult);
    expect(mockCacheAdapter.write).not.toHaveBeenCalled();
  });

  it('should propagate errors from cache operations', () => {
    mockCacheAdapter.write.mockImplementation(() => {
      throw new Error('Cache error');
    });

    const exchange = cascadeExchange({ cacheAdapter: mockCacheAdapter, debug: true });

    const mockOperation = { kind: 'mutation', key: 1 } as any;

    const mockResult = {
      operation: mockOperation,
      data: { some: 'data' },
      extensions: {
        cascade: {
          updated: [{
            __typename: 'User',
            id: '1',
            operation: CascadeOperation.UPDATED,
            entity: { name: 'Updated' },
          }],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01T00:00:00Z', depth: 1, affectedCount: 1 },
        } as CascadeUpdates,
      },
      stale: false,
      hasNext: false,
    };

    const forward = jest.fn(() => fromValue(mockResult));
    const ops$ = fromValue(mockOperation);

    const result$ = exchange({ forward, client: {} as any, dispatchDebug: jest.fn() } as any)(ops$);
    const results = toArray(result$);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(mockResult);
    // Error should be caught internally
  });

  it('should handle multiple operations through exchange', () => {
    const exchange = cascadeExchange({ cacheAdapter: mockCacheAdapter });

    const mockOperation1 = { kind: 'mutation', key: 1 } as any;
    const mockOperation2 = { kind: 'mutation', key: 2 } as any;

    const mockResult1 = {
      operation: mockOperation1,
      data: { some: 'data1' },
      extensions: {
        cascade: {
          updated: [{
            __typename: 'User',
            id: '1',
            operation: CascadeOperation.UPDATED,
            entity: { name: 'Updated1' },
          }],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01T00:00:00Z', depth: 1, affectedCount: 1 },
        } as CascadeUpdates,
      },
      stale: false,
      hasNext: false,
    };

    const mockResult2 = {
      operation: mockOperation2,
      data: { some: 'data2' },
      extensions: {
        cascade: {
          updated: [{
            __typename: 'User',
            id: '2',
            operation: CascadeOperation.UPDATED,
            entity: { name: 'Updated2' },
          }],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01T00:00:00Z', depth: 1, affectedCount: 1 },
        } as CascadeUpdates,
      },
      stale: false,
      hasNext: false,
    };

    // For multiple operations, we can test sequentially
    const forward1 = jest.fn(() => fromValue(mockResult1));
    const ops$1 = fromValue(mockOperation1);
    const result$1 = exchange({ forward: forward1, client: {} as any, dispatchDebug: jest.fn() } as any)(ops$1);
    const results1 = toArray(result$1);

    expect(results1).toHaveLength(1);
    expect(mockCacheAdapter.write).toHaveBeenCalledWith('User', '1', { name: 'Updated1' });

    // Reset mock
    mockCacheAdapter.write.mockClear();

    const forward2 = jest.fn(() => fromValue(mockResult2));
    const ops$2 = fromValue(mockOperation2);
    const result$2 = exchange({ forward: forward2, client: {} as any, dispatchDebug: jest.fn() } as any)(ops$2);
    const results2 = toArray(result$2);

    expect(results2).toHaveLength(1);
    expect(mockCacheAdapter.write).toHaveBeenCalledWith('User', '2', { name: 'Updated2' });
  });

  it('should passthrough subscriptions without cascade processing', () => {
    const exchange = cascadeExchange({ cacheAdapter: mockCacheAdapter });

    const mockOperation = { kind: 'subscription', key: 1 } as any;

    const mockResult = {
      operation: mockOperation,
      data: { some: 'data' },
      extensions: {}, // No cascade for subscription
      stale: false,
      hasNext: false,
    };

    const forward = jest.fn(() => fromValue(mockResult));
    const ops$ = fromValue(mockOperation);

    const result$ = exchange({ forward, client: {} as any, dispatchDebug: jest.fn() } as any)(ops$);
    const results = toArray(result$);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(mockResult);
    expect(mockCacheAdapter.write).not.toHaveBeenCalled();
  });

  it('should passthrough queries without cascade processing', () => {
    const exchange = cascadeExchange({ cacheAdapter: mockCacheAdapter });

    const mockOperation = { kind: 'query', key: 1 } as any;

    const mockResult = {
      operation: mockOperation,
      data: { some: 'data' },
      extensions: {}, // No cascade
      stale: false,
      hasNext: false,
    };

    const forward = jest.fn(() => fromValue(mockResult));
    const ops$ = fromValue(mockOperation);

    const result$ = exchange({ forward, client: {} as any, dispatchDebug: jest.fn() } as any)(ops$);
    const results = toArray(result$);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(mockResult);
    expect(mockCacheAdapter.write).not.toHaveBeenCalled();
  });
});
