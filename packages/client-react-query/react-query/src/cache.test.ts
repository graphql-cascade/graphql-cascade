import { QueryClient } from '@tanstack/react-query';
import { ReactQueryCascadeCache } from './cache';
import { QueryInvalidation, InvalidationStrategy, InvalidationScope } from '@graphql-cascade/client';

describe('ReactQueryCascadeCache', () => {
  let queryClient: QueryClient;
  let cache: ReactQueryCascadeCache;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    cache = new ReactQueryCascadeCache(queryClient);
  });

  describe('write', () => {
    it('should update entity in query data', () => {
      // Set up initial query data
      queryClient.setQueryData(['users'], [
        { __typename: 'User', id: '1', name: 'John' },
        { __typename: 'User', id: '2', name: 'Jane' }
      ]);

      // Update user 1
      cache.write('User', '1', { name: 'John Updated' });

      const updatedData = queryClient.getQueryData(['users']);
      expect(updatedData).toEqual([
        { __typename: 'User', id: '1', name: 'John Updated' },
        { __typename: 'User', id: '2', name: 'Jane' }
      ]);
    });
  });

  describe('read', () => {
    it('should return null (React Query does not support entity reading)', () => {
      const result = cache.read('User', '1');
      expect(result).toBeNull();
    });
  });

  describe('evict', () => {
    it('should remove entity from query data', () => {
      // Set up initial query data
      queryClient.setQueryData(['users'], [
        { __typename: 'User', id: '1', name: 'John' },
        { __typename: 'User', id: '2', name: 'Jane' }
      ]);

      // Evict user 1
      cache.evict('User', '1');

      const updatedData = queryClient.getQueryData(['users']);
      expect(updatedData).toEqual([
        { __typename: 'User', id: '2', name: 'Jane' }
      ]);
    });
  });

  describe('invalidate', () => {
    it('should invalidate exact query', () => {
      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        arguments: { id: '1' },
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.EXACT
      };

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      cache.invalidate(invalidation);

      expect(invalidateSpy).toHaveBeenCalledWith(['getUsers', { id: '1' }]);
    });

    it('should invalidate queries with prefix', () => {
      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.PREFIX
      };

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      cache.invalidate(invalidation);

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['getUsers'] });
    });
  });

  describe('refetch', () => {
    it('should refetch queries', async () => {
      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT
      };

      const refetchSpy = jest.spyOn(queryClient, 'refetchQueries').mockResolvedValue(Promise.resolve());

      await cache.refetch(invalidation);

      expect(refetchSpy).toHaveBeenCalledWith(['getUsers', undefined]);
    });
  });

  describe('remove', () => {
    it('should remove queries', () => {
      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REMOVE,
        scope: InvalidationScope.EXACT
      };

      const removeSpy = jest.spyOn(queryClient, 'removeQueries');

      cache.remove(invalidation);

      expect(removeSpy).toHaveBeenCalledWith(['getUsers', undefined]);
    });
  });

  describe('identify', () => {
    it('should return entity identifier', () => {
      const entity = { __typename: 'User', id: '1' };
      const result = cache.identify(entity);
      expect(result).toBe('User:1');
    });
  });
});