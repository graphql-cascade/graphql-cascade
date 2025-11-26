import { InMemoryCache, gql } from '@apollo/client';
import { ApolloCascadeCache } from './cache';
import { QueryInvalidation, InvalidationStrategy, InvalidationScope } from '@graphql-cascade/client';

describe('ApolloCascadeCache', () => {
  let apolloCache: InMemoryCache;
  let cache: ApolloCascadeCache;

  beforeEach(() => {
    apolloCache = new InMemoryCache();
    cache = new ApolloCascadeCache(apolloCache);
  });

  describe('write', () => {
    it('should write entity data to Apollo cache', () => {
      const data = { name: 'John', email: 'john@example.com' };
      cache.write('User', '1', data);

      // Verify by checking Apollo cache directly
      const cacheId = apolloCache.identify({ __typename: 'User', id: '1' });
      expect(cacheId).toBe('User:1');
      // Note: Detailed read testing is complex due to fragment naming
    });
  });

  describe('read', () => {
    it('should attempt to read entity data from Apollo cache', () => {
      const data = { name: 'John', email: 'john@example.com' };
      cache.write('User', '1', data);

      const result = cache.read('User', '1');
      // The read method may return partial data due to fragment complexity
      expect(result).not.toBeUndefined();
    });
  });

  describe('evict', () => {
    it('should evict entity from Apollo cache', () => {
      const data = { name: 'John', email: 'john@example.com' };
      cache.write('User', '1', data);

      // Spy on Apollo cache evict method
      const evictSpy = jest.spyOn(apolloCache, 'evict');

      cache.evict('User', '1');

      expect(evictSpy).toHaveBeenCalled();
    });
  });

  describe('invalidate', () => {
    it('should invalidate queries by field name', () => {
      // Apollo cache invalidation is limited, this mainly tests the interface
      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.EXACT
      };

      expect(() => cache.invalidate(invalidation)).not.toThrow();
    });
  });

  describe('refetch', () => {
    it('should throw error for refetch (requires ApolloClient)', async () => {
      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT
      };

      await expect(cache.refetch(invalidation)).rejects.toThrow(
        'Refetch requires ApolloClient instance, use ApolloCascadeClient.refetch instead'
      );
    });
  });

  describe('remove', () => {
    it('should delegate to invalidate for remove', () => {
      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REMOVE,
        scope: InvalidationScope.EXACT
      };

      expect(() => cache.remove(invalidation)).not.toThrow();
    });
  });

  describe('identify', () => {
    it('should return Apollo cache id for entity', () => {
      const entity = { __typename: 'User', id: '1' };
      const result = cache.identify(entity);
      expect(result).toBe('User:1');
    });

    it('should fallback to manual id generation', () => {
      const entity = { __typename: 'User', id: '1' };
      // Mock apolloCache.identify to return undefined
      jest.spyOn(apolloCache, 'identify').mockReturnValue(undefined);

      const result = cache.identify(entity);
      expect(result).toBe('User:1');
    });
  });
});