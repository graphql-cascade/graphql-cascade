import { extractCascadeData, hasCascadeData } from './exchange';
import { InMemoryCascadeCache } from './cache';
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
