import { CascadeClient } from './client';
import {
  CascadeCache,
  CascadeResponse,
  CascadeOperation,
  InvalidationStrategy,
  InvalidationScope,
  QueryInvalidation
} from './types';

/**
 * Mock cache for testing - tracks all operations performed on it
 */
class MockCache implements CascadeCache {
  public written: Array<{ typename: string; id: string; data: any }> = [];
  public evicted: Array<{ typename: string; id: string }> = [];
  public invalidated: QueryInvalidation[] = [];
  public refetched: QueryInvalidation[] = [];
  public removed: QueryInvalidation[] = [];

  write(typename: string, id: string, data: any): void {
    this.written.push({ typename, id, data });
  }

  read(typename: string, id: string): any | null {
    const found = this.written.find(w => w.typename === typename && w.id === id);
    return found?.data || null;
  }

  evict(typename: string, id: string): void {
    this.evicted.push({ typename, id });
  }

  invalidate(invalidation: QueryInvalidation): void {
    this.invalidated.push(invalidation);
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    this.refetched.push(invalidation);
  }

  remove(invalidation: QueryInvalidation): void {
    this.removed.push(invalidation);
  }

  identify(entity: any): string {
    return `${entity.__typename}:${entity.id}`;
  }
}

describe('CascadeClient', () => {
  let cache: MockCache;
  let mockExecutor: jest.Mock;
  let client: CascadeClient;

  beforeEach(() => {
    cache = new MockCache();
    mockExecutor = jest.fn();
    client = new CascadeClient(cache, mockExecutor);
  });

  describe('applyCascade', () => {
    it('should write primary data to cache when data has __typename and id', () => {
      const response: CascadeResponse = {
        success: true,
        data: { __typename: 'User', id: '1', name: 'John' },
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01', depth: 1, affectedCount: 1 }
        }
      };

      client.applyCascade(response);

      expect(cache.written).toHaveLength(1);
      expect(cache.written[0]).toEqual({
        typename: 'User',
        id: '1',
        data: { __typename: 'User', id: '1', name: 'John' }
      });
    });

    it('should write updated entities to cache', () => {
      const response: CascadeResponse = {
        success: true,
        data: null,
        cascade: {
          updated: [
            { __typename: 'User', id: '1', operation: CascadeOperation.UPDATED, entity: { name: 'John' } },
            { __typename: 'Post', id: '2', operation: CascadeOperation.CREATED, entity: { title: 'Hello' } }
          ],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01', depth: 1, affectedCount: 2 }
        }
      };

      client.applyCascade(response);

      expect(cache.written).toHaveLength(2);
      expect(cache.written[0]).toEqual({ typename: 'User', id: '1', data: { name: 'John' } });
      expect(cache.written[1]).toEqual({ typename: 'Post', id: '2', data: { title: 'Hello' } });
    });

    it('should evict deleted entities from cache', () => {
      const response: CascadeResponse = {
        success: true,
        data: null,
        cascade: {
          updated: [],
          deleted: [
            { __typename: 'User', id: '1', deletedAt: '2024-01-01' },
            { __typename: 'Post', id: '2', deletedAt: '2024-01-01' }
          ],
          invalidations: [],
          metadata: { timestamp: '2024-01-01', depth: 1, affectedCount: 2 }
        }
      };

      client.applyCascade(response);

      expect(cache.evicted).toHaveLength(2);
      expect(cache.evicted[0]).toEqual({ typename: 'User', id: '1' });
      expect(cache.evicted[1]).toEqual({ typename: 'Post', id: '2' });
    });

    it('should call invalidate for INVALIDATE strategy', () => {
      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.EXACT
      };

      const response: CascadeResponse = {
        success: true,
        data: null,
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [invalidation],
          metadata: { timestamp: '2024-01-01', depth: 1, affectedCount: 0 }
        }
      };

      client.applyCascade(response);

      expect(cache.invalidated).toHaveLength(1);
      expect(cache.invalidated[0]).toEqual(invalidation);
    });

    it('should call refetch for REFETCH strategy', () => {
      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.ALL
      };

      const response: CascadeResponse = {
        success: true,
        data: null,
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [invalidation],
          metadata: { timestamp: '2024-01-01', depth: 1, affectedCount: 0 }
        }
      };

      client.applyCascade(response);

      expect(cache.refetched).toHaveLength(1);
    });

    it('should call remove for REMOVE strategy', () => {
      const invalidation: QueryInvalidation = {
        queryName: 'getUsers',
        strategy: InvalidationStrategy.REMOVE,
        scope: InvalidationScope.PREFIX
      };

      const response: CascadeResponse = {
        success: true,
        data: null,
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [invalidation],
          metadata: { timestamp: '2024-01-01', depth: 1, affectedCount: 0 }
        }
      };

      client.applyCascade(response);

      expect(cache.removed).toHaveLength(1);
    });
  });

  describe('mutate', () => {
    it('should execute mutation, apply cascade, and return data', async () => {
      const cascadeResponse: CascadeResponse = {
        success: true,
        data: { __typename: 'User', id: '1', name: 'John' },
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01', depth: 1, affectedCount: 1 }
        }
      };

      mockExecutor.mockResolvedValue({
        data: { createUser: cascadeResponse }
      });

      const result = await client.mutate({} as any, { name: 'John' });

      expect(mockExecutor).toHaveBeenCalled();
      expect(result).toEqual({ __typename: 'User', id: '1', name: 'John' });
      expect(cache.written).toHaveLength(1);
    });
  });

  describe('query', () => {
    it('should execute query and return data without cascade processing', async () => {
      mockExecutor.mockResolvedValue({
        data: { users: [{ id: '1', name: 'John' }] }
      });

      const result = await client.query({} as any);

      expect(result).toEqual({ users: [{ id: '1', name: 'John' }] });
      expect(cache.written).toHaveLength(0);
    });
  });

  describe('getCache', () => {
    it('should return the cache instance', () => {
      expect(client.getCache()).toBe(cache);
    });
  });
});