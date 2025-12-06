import { URQLCascadeClient, CascadeMutationResult, OptimisticConfig } from './client';
import { InMemoryCascadeCache } from './cache';
import { CascadeUpdates, CascadeOperation, InvalidationStrategy, InvalidationScope } from './types';
import type { Client, OperationResult, CombinedError } from '@urql/core';

// Mock URQL client
const createMockClient = (mockResult: Partial<OperationResult> = {}): Client => {
  const defaultResult: OperationResult = {
    operation: {} as any,
    data: null,
    stale: false,
    hasNext: false,
    ...mockResult,
  };

  return {
    mutation: jest.fn().mockReturnValue({
      toPromise: jest.fn().mockResolvedValue(defaultResult),
    }),
  } as unknown as Client;
};

// Helper to create cascade updates
const createCascadeUpdates = (options: Partial<CascadeUpdates> = {}): CascadeUpdates => ({
  updated: options.updated ?? [],
  deleted: options.deleted ?? [],
  invalidations: options.invalidations ?? [],
  metadata: options.metadata ?? {
    timestamp: new Date().toISOString(),
    depth: 1,
    affectedCount: 0,
  },
});

describe('URQLCascadeClient', () => {
  let mockClient: Client;
  let cache: InMemoryCascadeCache;
  let client: URQLCascadeClient;

  beforeEach(() => {
    mockClient = createMockClient();
    cache = new InMemoryCascadeCache();
    client = new URQLCascadeClient(mockClient, cache);
  });

  describe('constructor', () => {
    it('should create client with default config', () => {
      const config = client.getConfig();

      expect(config.autoApply).toBe(true);
      expect(config.optimistic).toBe(false);
      expect(config.maxDepth).toBe(10);
      expect(config.excludeTypes).toEqual([]);
    });

    it('should merge provided config with defaults', () => {
      const customClient = new URQLCascadeClient(mockClient, cache, {
        autoApply: false,
        excludeTypes: ['AuditLog'],
      });

      const config = customClient.getConfig();

      expect(config.autoApply).toBe(false);
      expect(config.excludeTypes).toEqual(['AuditLog']);
      expect(config.maxDepth).toBe(10); // default
    });
  });

  describe('mutate', () => {
    it('should execute mutation and return result', async () => {
      const mockData = { createUser: { id: '1', name: 'John' } };
      mockClient = createMockClient({ data: mockData });
      client = new URQLCascadeClient(mockClient, cache);

      const result = await client.mutate({} as any, { name: 'John' });

      expect(result.data).toEqual(mockData);
      expect(result.error).toBeUndefined();
    });

    it('should extract and return cascade data', async () => {
      const cascade = createCascadeUpdates({
        updated: [
          { __typename: 'User', id: '1', operation: CascadeOperation.CREATED, entity: { name: 'John' } },
        ],
      });

      const mockData = {
        createUser: {
          success: true,
          data: { id: '1', name: 'John' },
        },
      };

      // Cascade data comes from extensions, not the data response
      mockClient = createMockClient({ data: mockData, extensions: { cascade } });
      client = new URQLCascadeClient(mockClient, cache);

      const result = await client.mutate({} as any, {});

      expect(result.cascade).toEqual(cascade);
    });

    it('should apply cascade updates to cache by default', async () => {
      const cascade = createCascadeUpdates({
        updated: [
          { __typename: 'User', id: '1', operation: CascadeOperation.CREATED, entity: { name: 'John' } },
        ],
      });

      const mockData = {
        createUser: {
          success: true,
          data: { id: '1', name: 'John' },
        },
      };

      // Cascade data comes from extensions, not the data response
      mockClient = createMockClient({ data: mockData, extensions: { cascade } });
      client = new URQLCascadeClient(mockClient, cache);

      await client.mutate({} as any, {});

      const cached = cache.read('User', '1');
      expect(cached).toBeTruthy();
      expect(cached?.name).toBe('John');
    });

    it('should not apply cascade when autoApply is false', async () => {
      const cascade = createCascadeUpdates({
        updated: [
          { __typename: 'User', id: '1', operation: CascadeOperation.CREATED, entity: { name: 'John' } },
        ],
      });

      const mockData = {
        createUser: {
          success: true,
          data: { id: '1', name: 'John' },
          cascade,
        },
      };

      mockClient = createMockClient({ data: mockData });
      client = new URQLCascadeClient(mockClient, cache, { autoApply: false });

      await client.mutate({} as any, {});

      const cached = cache.read('User', '1');
      expect(cached).toBeNull();
    });

    it('should return error from mutation result', async () => {
      const error = new Error('Mutation failed') as CombinedError;
      mockClient = createMockClient({ error, data: null });
      client = new URQLCascadeClient(mockClient, cache);

      const result = await client.mutate({} as any, {});

      expect(result.error).toBe(error);
      expect(result.data).toBeNull();
    });

    it('should handle timeout errors in mutation', async () => {
      const timeoutError = new Error('Request timeout') as CombinedError;
      mockClient = {
        mutation: jest.fn().mockReturnValue({
          toPromise: jest.fn().mockRejectedValue(timeoutError),
        }),
      } as unknown as Client;
      client = new URQLCascadeClient(mockClient, cache);

      await expect(client.mutate({} as any, {})).rejects.toThrow('Request timeout');
    });

    it('should handle network errors in mutation', async () => {
      const networkError = new Error('Network error') as CombinedError;
      mockClient = createMockClient({ error: networkError, data: null });
      client = new URQLCascadeClient(mockClient, cache);

      const result = await client.mutate({} as any, {});

      expect(result.error).toBe(networkError);
      expect(result.data).toBeNull();
      expect(result.cascade).toBeNull();
    });

    it('should handle GraphQL validation errors in mutation', async () => {
      const validationError = new Error('GraphQL validation error') as CombinedError;
      mockClient = createMockClient({ error: validationError, data: null });
      client = new URQLCascadeClient(mockClient, cache);

      const result = await client.mutate({} as any, {});

      expect(result.error).toBe(validationError);
      expect(result.data).toBeNull();
    });
  });

  describe('mutateOptimistic', () => {
    it('should apply optimistic updates before mutation', async () => {
      const optimisticConfig: OptimisticConfig<{ id: string; name: string }, { name: string }> = {
        optimisticResponse: (vars) => ({ id: 'temp-1', name: vars.name }),
        optimisticCascade: (vars, response) => createCascadeUpdates({
          updated: [
            { __typename: 'User', id: response.id, operation: CascadeOperation.CREATED, entity: response },
          ],
        }),
      };

      const serverCascade = createCascadeUpdates({
        updated: [
          { __typename: 'User', id: '1', operation: CascadeOperation.CREATED, entity: { id: '1', name: 'John' } },
        ],
      });

      const mockData = {
        createUser: {
          success: true,
          data: { id: '1', name: 'John' },
          cascade: serverCascade,
        },
      };

      mockClient = createMockClient({ data: mockData });
      client = new URQLCascadeClient(mockClient, cache);

      const result = await client.mutateOptimistic(
        {} as any,
        { name: 'John' },
        optimisticConfig
      );

      expect(result.data).toEqual(mockData);
    });

    it('should rollback optimistic updates on error', async () => {
      // Pre-populate cache
      cache.write('User', '1', { id: '1', name: 'Original' });

      const optimisticConfig: OptimisticConfig<{ id: string; name: string }, { name: string }> = {
        optimisticResponse: (vars) => ({ id: '1', name: vars.name }),
        optimisticCascade: () => createCascadeUpdates({
          updated: [
            { __typename: 'User', id: '1', operation: CascadeOperation.UPDATED, entity: { id: '1', name: 'Optimistic' } },
          ],
        }),
      };

      mockClient = {
        mutation: jest.fn().mockReturnValue({
          toPromise: jest.fn().mockRejectedValue(new Error('Network error')),
        }),
      } as unknown as Client;
      client = new URQLCascadeClient(mockClient, cache);

      await expect(
        client.mutateOptimistic({} as any, { name: 'Optimistic' }, optimisticConfig)
      ).rejects.toThrow('Network error');

      // Should rollback to original
      const cached = cache.read('User', '1');
      expect(cached?.name).toBe('Original');
    });

    it('should evict new entities on rollback', async () => {
      const optimisticConfig: OptimisticConfig<{ id: string; name: string }, { name: string }> = {
        optimisticResponse: (vars) => ({ id: 'new-1', name: vars.name }),
        optimisticCascade: () => createCascadeUpdates({
          updated: [
            { __typename: 'User', id: 'new-1', operation: CascadeOperation.CREATED, entity: { id: 'new-1', name: 'New' } },
          ],
        }),
      };

      mockClient = {
        mutation: jest.fn().mockReturnValue({
          toPromise: jest.fn().mockRejectedValue(new Error('Network error')),
        }),
      } as unknown as Client;
      client = new URQLCascadeClient(mockClient, cache);

      await expect(
        client.mutateOptimistic({} as any, { name: 'New' }, optimisticConfig)
      ).rejects.toThrow('Network error');

      // Should evict the new entity
      const cached = cache.read('User', 'new-1');
      expect(cached).toBeNull();
    });
  });

  describe('applyCascade', () => {
    it('should write updated entities to cache', () => {
      const cascade = createCascadeUpdates({
        updated: [
          { __typename: 'User', id: '1', operation: CascadeOperation.CREATED, entity: { name: 'John' } },
          { __typename: 'User', id: '2', operation: CascadeOperation.UPDATED, entity: { name: 'Jane' } },
        ],
      });

      client.applyCascade(cascade);

      expect(cache.read('User', '1')?.name).toBe('John');
      expect(cache.read('User', '2')?.name).toBe('Jane');
    });

    it('should evict deleted entities from cache', () => {
      cache.write('User', '1', { id: '1', name: 'John' });

      const cascade = createCascadeUpdates({
        deleted: [
          { __typename: 'User', id: '1', deletedAt: new Date().toISOString() },
        ],
      });

      client.applyCascade(cascade);

      expect(cache.read('User', '1')).toBeNull();
    });

    it('should evict entities with DELETED operation in updated array', () => {
      cache.write('User', '1', { id: '1', name: 'John' });

      const cascade = createCascadeUpdates({
        updated: [
          { __typename: 'User', id: '1', operation: CascadeOperation.DELETED, entity: {} },
        ],
      });

      client.applyCascade(cascade);

      expect(cache.read('User', '1')).toBeNull();
    });

    it('should skip excluded types', () => {
      client = new URQLCascadeClient(mockClient, cache, {
        excludeTypes: ['AuditLog'],
      });

      const cascade = createCascadeUpdates({
        updated: [
          { __typename: 'User', id: '1', operation: CascadeOperation.CREATED, entity: { name: 'John' } },
          { __typename: 'AuditLog', id: '1', operation: CascadeOperation.CREATED, entity: { action: 'create' } },
        ],
      });

      client.applyCascade(cascade);

      expect(cache.read('User', '1')).toBeTruthy();
      expect(cache.read('AuditLog', '1')).toBeNull();
    });

    it('should process invalidations with INVALIDATE strategy', () => {
      cache.storeQuery('getUsers', undefined, []);

      const cascade = createCascadeUpdates({
        invalidations: [
          { strategy: InvalidationStrategy.INVALIDATE, scope: InvalidationScope.EXACT, queryName: 'getUsers' },
        ],
      });

      client.applyCascade(cascade);

      const query = cache.getQuery('getUsers');
      expect(query?.isStale).toBe(true);
    });

    it('should process invalidations with REMOVE strategy', () => {
      cache.storeQuery('getUsers', undefined, []);

      const cascade = createCascadeUpdates({
        invalidations: [
          { strategy: InvalidationStrategy.REMOVE, scope: InvalidationScope.EXACT, queryName: 'getUsers' },
        ],
      });

      client.applyCascade(cascade);

      expect(cache.getQuery('getUsers')).toBeNull();
    });
  });

  describe('getClient', () => {
    it('should return the underlying URQL client', () => {
      expect(client.getClient()).toBe(mockClient);
    });
  });

  describe('getCache', () => {
    it('should return the cache adapter', () => {
      expect(client.getCache()).toBe(cache);
    });
  });
});
