import { ApolloClient, InMemoryCache } from '@apollo/client';
import { ApolloCascadeClient } from './client';
import { QueryInvalidation, InvalidationStrategy, InvalidationScope } from '@graphql-cascade/client';

describe('ApolloCascadeClient', () => {
  let apolloClient: ApolloClient<any>;
  let client: ApolloCascadeClient;

  beforeEach(() => {
    apolloClient = new ApolloClient({
      cache: new InMemoryCache(),
      // Mock link for testing
      link: {
        request: jest.fn(),
        split: jest.fn(),
        concat: jest.fn(),
        setOnError: jest.fn()
      } as any
    });
    client = new ApolloCascadeClient(apolloClient);
  });

  describe('mutate', () => {
    it('should execute mutation and apply cascade', async () => {
      const mockResult = {
        data: {
          createUser: {
            success: true,
            data: { __typename: 'User', id: '1', name: 'John' },
            cascade: {
              updated: [],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: '2024-01-01', depth: 1, affectedCount: 1 }
            }
          }
        }
      };

      jest.spyOn(apolloClient, 'mutate').mockResolvedValue(mockResult);

      const result = await client.mutate({} as any, { name: 'John' });

      expect(apolloClient.mutate).toHaveBeenCalled();
      expect(result).toEqual({ __typename: 'User', id: '1', name: 'John' });
    });
  });

  describe('query', () => {
    it('should execute query and return data', async () => {
      const mockResult = {
        data: { users: [{ id: '1', name: 'John' }] }
      };

      jest.spyOn(apolloClient, 'query').mockResolvedValue({
        ...mockResult,
        loading: false,
        networkStatus: 7 // NetworkStatus.ready
      } as any);

      const result = await client.query({} as any);

      expect(apolloClient.query).toHaveBeenCalled();
      expect(result).toEqual({ users: [{ id: '1', name: 'John' }] });
    });
  });

  describe('trackQuery and untrackQuery', () => {
    it('should track a query', () => {
      const query = {} as any;
      client.trackQuery('getUsers', query, { limit: 10 });
      // Tracking is internal, we test via invalidation
      expect(client.getApolloClient()).toBe(apolloClient);
    });

    it('should untrack a query', () => {
      const query = {} as any;
      client.trackQuery('getUsers', query);
      client.untrackQuery('getUsers');
      // Untracking is internal, we test via invalidation
      expect(client.getApolloClient()).toBe(apolloClient);
    });
  });

  describe('refetch', () => {
    it('should refetch exact query', async () => {
      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT
      };

      jest.spyOn(apolloClient, 'refetchQueries').mockResolvedValue([]);

      await client.refetch(invalidation);

      expect(apolloClient.refetchQueries).toHaveBeenCalledWith({
        include: ['getUsers']
      });
    });

    it('should refetch all active queries for ALL scope', async () => {
      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.ALL
      };

      jest.spyOn(apolloClient, 'refetchQueries').mockResolvedValue([]);

      await client.refetch(invalidation);

      expect(apolloClient.refetchQueries).toHaveBeenCalledWith({
        include: 'active'
      });
    });

    it('should refetch queries matching PREFIX scope', async () => {
      const query = {} as any;
      client.trackQuery('getUsersList', query);
      client.trackQuery('getUsersDetails', query);
      client.trackQuery('getOrders', query);

      jest.spyOn(apolloClient, 'refetchQueries').mockResolvedValue([]);

      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.PREFIX
      };

      await client.refetch(invalidation);

      expect(apolloClient.refetchQueries).toHaveBeenCalledWith({
        include: ['getUsersList', 'getUsersDetails']
      });
    });

    it('should refetch queries matching PATTERN scope', async () => {
      const query = {} as any;
      client.trackQuery('getUsers', query);
      client.trackQuery('listUsers', query);
      client.trackQuery('getOrders', query);

      jest.spyOn(apolloClient, 'refetchQueries').mockResolvedValue([]);

      const invalidation: QueryInvalidation = {
        queryPattern: '.*Users.*',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.PATTERN
      };

      await client.refetch(invalidation);

      expect(apolloClient.refetchQueries).toHaveBeenCalledWith({
        include: ['getUsers', 'listUsers']
      });
    });
  });

  describe('invalidateQueries', () => {
    it('should evict queries by field name for EXACT scope', () => {
      const evictSpy = jest.spyOn(apolloClient.cache, 'evict');
      const gcSpy = jest.spyOn(apolloClient.cache, 'gc');

      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.EXACT
      };

      client.invalidateQueries(invalidation);

      expect(evictSpy).toHaveBeenCalledWith({ fieldName: 'getUsers' });
      expect(gcSpy).toHaveBeenCalled();
    });

    it('should evict queries matching PREFIX scope from tracked queries', () => {
      const query = {} as any;
      client.trackQuery('getUsersList', query);
      client.trackQuery('getUsersDetails', query);
      client.trackQuery('getOrders', query);

      const evictSpy = jest.spyOn(apolloClient.cache, 'evict');

      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.PREFIX
      };

      client.invalidateQueries(invalidation);

      expect(evictSpy).toHaveBeenCalledWith({ fieldName: 'getUsersList' });
      expect(evictSpy).toHaveBeenCalledWith({ fieldName: 'getUsersDetails' });
      expect(evictSpy).not.toHaveBeenCalledWith({ fieldName: 'getOrders' });
    });
  });

  describe('removeQueries', () => {
    it('should evict queries by field name for EXACT scope', () => {
      const evictSpy = jest.spyOn(apolloClient.cache, 'evict');
      const gcSpy = jest.spyOn(apolloClient.cache, 'gc');

      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REMOVE,
        scope: InvalidationScope.EXACT
      };

      client.removeQueries(invalidation);

      expect(evictSpy).toHaveBeenCalledWith({ fieldName: 'getUsers' });
      expect(gcSpy).toHaveBeenCalled();
    });
  });

  describe('handleInvalidation', () => {
    it('should call invalidateQueries for INVALIDATE strategy', async () => {
      const invalidateQueriesSpy = jest.spyOn(client, 'invalidateQueries');

      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.EXACT
      };

      await client.handleInvalidation(invalidation);

      expect(invalidateQueriesSpy).toHaveBeenCalledWith(invalidation);
    });

    it('should call refetch for REFETCH strategy', async () => {
      jest.spyOn(apolloClient, 'refetchQueries').mockResolvedValue([]);

      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT
      };

      await client.handleInvalidation(invalidation);

      expect(apolloClient.refetchQueries).toHaveBeenCalled();
    });

    it('should call removeQueries for REMOVE strategy', async () => {
      const removeQueriesSpy = jest.spyOn(client, 'removeQueries');

      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REMOVE,
        scope: InvalidationScope.EXACT
      };

      await client.handleInvalidation(invalidation);

      expect(removeQueriesSpy).toHaveBeenCalledWith(invalidation);
    });
  });

  describe('getApolloClient', () => {
    it('should return the underlying Apollo Client', () => {
      expect(client.getApolloClient()).toBe(apolloClient);
    });
  });
});