import { InMemoryCascadeCache } from './cache';
import { InvalidationScope, InvalidationStrategy } from './types';

describe('InMemoryCascadeCache', () => {
  let cache: InMemoryCascadeCache;

  beforeEach(() => {
    cache = new InMemoryCascadeCache();
  });

  describe('write and read', () => {
    it('should write and read entities', () => {
      cache.write('User', '1', { name: 'John', email: 'john@example.com' });

      const result = cache.read('User', '1');

      expect(result).toEqual({
        __typename: 'User',
        id: '1',
        name: 'John',
        email: 'john@example.com',
      });
    });

    it('should return null for non-existent entities', () => {
      const result = cache.read('User', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should overwrite existing entities', () => {
      cache.write('User', '1', { name: 'John' });
      cache.write('User', '1', { name: 'Jane' });

      const result = cache.read('User', '1');

      expect(result?.name).toBe('Jane');
    });

    it('should store multiple entity types', () => {
      cache.write('User', '1', { name: 'John' });
      cache.write('Post', '1', { title: 'Hello World' });

      expect(cache.read('User', '1')?.name).toBe('John');
      expect(cache.read('Post', '1')?.title).toBe('Hello World');
    });
  });

  describe('evict', () => {
    it('should remove entity from cache', () => {
      cache.write('User', '1', { name: 'John' });

      cache.evict('User', '1');

      expect(cache.read('User', '1')).toBeNull();
    });

    it('should not throw when evicting non-existent entity', () => {
      expect(() => cache.evict('User', 'nonexistent')).not.toThrow();
    });

    it('should only evict specified entity', () => {
      cache.write('User', '1', { name: 'John' });
      cache.write('User', '2', { name: 'Jane' });

      cache.evict('User', '1');

      expect(cache.read('User', '1')).toBeNull();
      expect(cache.read('User', '2')).toBeTruthy();
    });
  });

  describe('identify', () => {
    it('should return entity key', () => {
      const entity = { __typename: 'User', id: '1', name: 'John' };

      const key = cache.identify(entity);

      expect(key).toBe('User:1');
    });

    it('should throw for entity without __typename', () => {
      const entity = { id: '1', name: 'John' };

      expect(() => cache.identify(entity)).toThrow('Entity must have __typename and id fields');
    });

    it('should throw for entity without id', () => {
      const entity = { __typename: 'User', name: 'John' };

      expect(() => cache.identify(entity)).toThrow('Entity must have __typename and id fields');
    });
  });

  describe('storeQuery and getQuery', () => {
    it('should store and retrieve queries', () => {
      const data = [{ id: '1', name: 'John' }];

      cache.storeQuery('getUsers', undefined, data);
      const result = cache.getQuery('getUsers');

      expect(result?.data).toEqual(data);
      expect(result?.isStale).toBe(false);
    });

    it('should store queries with arguments', () => {
      const data = { id: '1', name: 'John' };

      cache.storeQuery('getUser', { id: '1' }, data);
      const result = cache.getQuery('getUser', { id: '1' });

      expect(result?.data).toEqual(data);
    });

    it('should return null for non-existent queries', () => {
      expect(cache.getQuery('nonexistent')).toBeNull();
    });

    it('should differentiate queries by arguments', () => {
      cache.storeQuery('getUser', { id: '1' }, { name: 'John' });
      cache.storeQuery('getUser', { id: '2' }, { name: 'Jane' });

      expect(cache.getQuery('getUser', { id: '1' })?.data).toEqual({ name: 'John' });
      expect(cache.getQuery('getUser', { id: '2' })?.data).toEqual({ name: 'Jane' });
    });
  });

  describe('invalidate', () => {
    beforeEach(() => {
      cache.storeQuery('getUsers', undefined, []);
      cache.storeQuery('getUser', { id: '1' }, {});
      cache.storeQuery('getPosts', undefined, []);
    });

    it('should invalidate exact query', () => {
      cache.invalidate({
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.EXACT,
        queryName: 'getUsers',
      });

      expect(cache.getQuery('getUsers')?.isStale).toBe(true);
      expect(cache.getQuery('getPosts')?.isStale).toBe(false);
    });

    it('should invalidate queries with prefix', () => {
      cache.invalidate({
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.PREFIX,
        queryName: 'get',
      });

      expect(cache.getQuery('getUsers')?.isStale).toBe(true);
      expect(cache.getQuery('getUser', { id: '1' })?.isStale).toBe(true);
      expect(cache.getQuery('getPosts')?.isStale).toBe(true);
    });

    it('should invalidate queries with pattern', () => {
      cache.invalidate({
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.PATTERN,
        queryPattern: 'get*s',
      });

      expect(cache.getQuery('getUsers')?.isStale).toBe(true);
      expect(cache.getQuery('getPosts')?.isStale).toBe(true);
      expect(cache.getQuery('getUser', { id: '1' })?.isStale).toBe(false);
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
    beforeEach(() => {
      cache.storeQuery('getUsers', undefined, []);
      cache.storeQuery('getUser', { id: '1' }, {});
    });

    it('should remove exact query', () => {
      cache.remove({
        strategy: InvalidationStrategy.REMOVE,
        scope: InvalidationScope.EXACT,
        queryName: 'getUsers',
      });

      expect(cache.getQuery('getUsers')).toBeNull();
      expect(cache.getQuery('getUser', { id: '1' })).toBeTruthy();
    });

    it('should remove all queries', () => {
      cache.remove({
        strategy: InvalidationStrategy.REMOVE,
        scope: InvalidationScope.ALL,
      });

      expect(cache.getQuery('getUsers')).toBeNull();
      expect(cache.getQuery('getUser', { id: '1' })).toBeNull();
    });
  });

  describe('refetch', () => {
    it('should call refetch function for matching queries', async () => {
      const refetchFn = jest.fn().mockResolvedValue(undefined);
      cache = new InMemoryCascadeCache({ refetchFn });
      cache.storeQuery('getUsers', undefined, []);

      await cache.refetch({
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT,
        queryName: 'getUsers',
      });

      expect(refetchFn).toHaveBeenCalledWith('getUsers', undefined);
    });

    it('should invalidate if no refetch function provided', async () => {
      cache.storeQuery('getUsers', undefined, []);

      await cache.refetch({
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT,
        queryName: 'getUsers',
      });

      expect(cache.getQuery('getUsers')?.isStale).toBe(true);
    });

    it('should refetch multiple matching queries', async () => {
      const refetchFn = jest.fn().mockResolvedValue(undefined);
      cache = new InMemoryCascadeCache({ refetchFn });
      cache.storeQuery('getUsers', undefined, []);
      cache.storeQuery('getPosts', undefined, []);

      await cache.refetch({
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.ALL,
      });

      expect(refetchFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('clear', () => {
    it('should clear all entities and queries', () => {
      cache.write('User', '1', { name: 'John' });
      cache.storeQuery('getUsers', undefined, []);

      cache.clear();

      expect(cache.read('User', '1')).toBeNull();
      expect(cache.getQuery('getUsers')).toBeNull();
    });
  });

  describe('getEntitiesByType', () => {
    it('should return all entities of a type', () => {
      cache.write('User', '1', { name: 'John' });
      cache.write('User', '2', { name: 'Jane' });
      cache.write('Post', '1', { title: 'Hello' });

      const users = cache.getEntitiesByType('User');

      expect(users).toHaveLength(2);
      expect(users.map(u => u.name)).toContain('John');
      expect(users.map(u => u.name)).toContain('Jane');
    });

    it('should return empty array for unknown type', () => {
      const result = cache.getEntitiesByType('Unknown');

      expect(result).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cache.write('User', '1', { name: 'John' });
      cache.write('User', '2', { name: 'Jane' });
      cache.storeQuery('getUsers', undefined, []);
      cache.storeQuery('getPosts', undefined, []);
      cache.invalidate({
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.EXACT,
        queryName: 'getUsers',
      });

      const stats = cache.getStats();

      expect(stats.entityCount).toBe(2);
      expect(stats.queryCount).toBe(2);
      expect(stats.staleQueryCount).toBe(1);
    });
  });

  describe('patternToRegex', () => {
    it('should convert glob patterns correctly', () => {
      cache.storeQuery('getUsers', undefined, []);
      cache.storeQuery('getUserById', undefined, {});
      cache.storeQuery('getPosts', undefined, []);

      // Test * wildcard
      cache.invalidate({
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.PATTERN,
        queryPattern: 'getUser*',
      });

      expect(cache.getQuery('getUsers')?.isStale).toBe(true);
      expect(cache.getQuery('getUserById')?.isStale).toBe(true);
      expect(cache.getQuery('getPosts')?.isStale).toBe(false);
    });

    it('should escape special regex characters', () => {
      cache.storeQuery('query.with.dots', undefined, []);

      cache.invalidate({
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.PATTERN,
        queryPattern: 'query.with.dots',
      });

      expect(cache.getQuery('query.with.dots')?.isStale).toBe(true);
    });

    it('should reject patterns exceeding maximum length', () => {
      cache.storeQuery('getUsers', undefined, []);

      const longPattern = 'a'.repeat(101); // Exceeds 100 char limit

      expect(() => {
        cache.invalidate({
          strategy: InvalidationStrategy.INVALIDATE,
          scope: InvalidationScope.PATTERN,
          queryPattern: longPattern,
        });
      }).toThrow('Pattern exceeds maximum length of 100 characters');
    });
  });
});
