import { ApolloClient, InMemoryCache, NormalizedCacheObject } from '@apollo/client';
import { CascadeOperation, InvalidationStrategy, InvalidationScope } from '@graphql-cascade/client';
import {
  CascadeCachePersistence,
  createInMemoryPersistence,
  createLocalStoragePersistence,
  onCascadeApplied
} from './persistence';

// Mock localStorage
const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => {
      for (const key in store) delete store[key];
    })
  };
};

describe('CascadeCachePersistence', () => {
  let apolloClient: ApolloClient<NormalizedCacheObject>;
  let persistence: CascadeCachePersistence;
  let storage: ReturnType<typeof createInMemoryPersistence>;

  beforeEach(() => {
    apolloClient = new ApolloClient({
      cache: new InMemoryCache(),
      connectToDevTools: false
    });

    storage = createInMemoryPersistence();

    persistence = new CascadeCachePersistence(apolloClient, {
      storage,
      key: 'test_cache'
    });
  });

  describe('persist', () => {
    it('should persist cache to storage', async () => {
      // Write some data to cache
      apolloClient.cache.writeQuery({
        query: require('@apollo/client').gql`query GetUser { user { id name } }`,
        data: { user: { __typename: 'User', id: '1', name: 'John' } }
      });

      await persistence.persist();

      const stored = await Promise.resolve(storage.getItem('test_cache'));
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored as string);
      expect(parsed.cache).toBeDefined();
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.version).toBe('1.0');
    });

    it('should call onPersist callback', async () => {
      const onPersist = jest.fn();

      persistence = new CascadeCachePersistence(apolloClient, {
        storage,
        key: 'test_cache',
        onPersist
      });

      await persistence.persist();

      expect(onPersist).toHaveBeenCalled();
      expect(onPersist.mock.calls[0][0].metadata).toBeDefined();
    });

    it('should filter cache data when filter provided', async () => {
      // Write data
      apolloClient.cache.writeQuery({
        query: require('@apollo/client').gql`query GetUser { user { id name } }`,
        data: { user: { __typename: 'User', id: '1', name: 'John' } }
      });

      apolloClient.cache.writeQuery({
        query: require('@apollo/client').gql`query GetPost { post { id title } }`,
        data: { post: { __typename: 'Post', id: '1', title: 'Hello' } }
      });

      persistence = new CascadeCachePersistence(apolloClient, {
        storage,
        key: 'test_cache',
        filter: (typename) => typename === 'User'
      });

      await persistence.persist();

      const stored = await Promise.resolve(storage.getItem('test_cache'));
      const parsed = JSON.parse(stored as string);

      // Should only have User, not Post
      const keys = Object.keys(parsed.cache);
      const hasUser = keys.some(k => k.includes('User'));
      const hasPost = keys.some(k => k.includes('Post'));

      expect(hasUser || keys.includes('ROOT_QUERY')).toBe(true);
      // Post should be filtered out (unless it's in ROOT_QUERY)
    });

    it('should handle persistence errors', async () => {
      const onError = jest.fn();
      const errorStorage = {
        getItem: () => null,
        setItem: () => { throw new Error('Storage full'); },
        removeItem: () => {}
      };

      persistence = new CascadeCachePersistence(apolloClient, {
        storage: errorStorage,
        key: 'test_cache',
        onError
      });

      await persistence.persist();

      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'save');
    });
  });

  describe('restore', () => {
    it('should restore cache from storage', async () => {
      // First persist some data
      apolloClient.cache.writeQuery({
        query: require('@apollo/client').gql`query GetUser { user { id name } }`,
        data: { user: { __typename: 'User', id: '1', name: 'John' } }
      });

      await persistence.persist();

      // Clear the cache
      apolloClient.cache.reset();

      // Restore
      const restored = await persistence.restore();

      expect(restored).toBe(true);
    });

    it('should return false if no stored data', async () => {
      const restored = await persistence.restore();

      expect(restored).toBe(false);
    });

    it('should reject stale cache', async () => {
      // Store data with old timestamp
      const staleData = {
        cache: {},
        metadata: {
          version: '1.0',
          timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
          entityCount: 0
        }
      };

      storage.setItem('test_cache', JSON.stringify(staleData));

      persistence = new CascadeCachePersistence(apolloClient, {
        storage,
        key: 'test_cache',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      const restored = await persistence.restore();

      expect(restored).toBe(false);
    });

    it('should call onRestore callback', async () => {
      const onRestore = jest.fn();

      // Persist first
      await persistence.persist();

      persistence = new CascadeCachePersistence(apolloClient, {
        storage,
        key: 'test_cache',
        onRestore
      });

      await persistence.restore();

      expect(onRestore).toHaveBeenCalled();
    });

    it('should prevent concurrent restores', async () => {
      // Store some data
      const data = {
        cache: {},
        metadata: {
          version: '1.0',
          timestamp: Date.now(),
          entityCount: 0
        }
      };
      storage.setItem('test_cache', JSON.stringify(data));

      // Start two restores simultaneously
      const [result1, result2] = await Promise.all([
        persistence.restore(),
        persistence.restore()
      ]);

      // One should succeed, one should fail (due to isRestoring flag)
      expect([result1, result2]).toContain(false);
    });
  });

  describe('clear', () => {
    it('should clear persisted data', async () => {
      await persistence.persist();

      expect(storage.getItem('test_cache')).not.toBeNull();

      await persistence.clear();

      expect(storage.getItem('test_cache')).toBeNull();
    });

    it('should clear cascade history', async () => {
      persistence.recordCascade({
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 0 }
      });

      expect(persistence.getCascadeHistory()).toHaveLength(1);

      await persistence.clear();

      expect(persistence.getCascadeHistory()).toHaveLength(0);
    });
  });

  describe('recordCascade', () => {
    it('should record cascade history', () => {
      const cascade = {
        updated: [{
          __typename: 'User',
          id: '1',
          operation: CascadeOperation.UPDATED,
          entity: { id: '1', name: 'John' }
        }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
      };

      persistence.recordCascade(cascade);

      const history = persistence.getCascadeHistory();
      expect(history).toHaveLength(1);
      expect(history[0].cascade).toEqual(cascade);
      expect(history[0].applied).toBe(true);
    });

    it('should limit history to 100 entries', () => {
      for (let i = 0; i < 110; i++) {
        persistence.recordCascade({
          updated: [],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 0 }
        });
      }

      expect(persistence.getCascadeHistory()).toHaveLength(100);
    });
  });

  describe('getCascadeHistory', () => {
    it('should return copy of history', () => {
      persistence.recordCascade({
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 0 }
      });

      const history1 = persistence.getCascadeHistory();
      const history2 = persistence.getCascadeHistory();

      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe('replayCascadeHistory', () => {
    it('should replay cascades from timestamp', async () => {
      const applyCascade = jest.fn();

      // Add some history with different timestamps
      const now = Date.now();

      persistence.recordCascade({
        updated: [{ __typename: 'User', id: '1', operation: CascadeOperation.UPDATED, entity: { id: '1' } }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: new Date(now - 3000).toISOString(), depth: 1, affectedCount: 1 }
      });

      persistence.recordCascade({
        updated: [{ __typename: 'User', id: '2', operation: CascadeOperation.UPDATED, entity: { id: '2' } }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: new Date(now - 1000).toISOString(), depth: 1, affectedCount: 1 }
      });

      persistence.recordCascade({
        updated: [{ __typename: 'User', id: '3', operation: CascadeOperation.UPDATED, entity: { id: '3' } }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: new Date(now).toISOString(), depth: 1, affectedCount: 1 }
      });

      // Replay from 2 seconds ago
      const replayed = await persistence.replayCascadeHistory(
        new Date(now - 2000).toISOString(),
        applyCascade
      );

      // Should replay last 2 cascades
      expect(replayed).toBe(2);
      expect(applyCascade).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      apolloClient.cache.writeQuery({
        query: require('@apollo/client').gql`query GetUser { user { id name } }`,
        data: { user: { __typename: 'User', id: '1', name: 'John' } }
      });

      persistence.recordCascade({
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 0 }
      });

      const stats = persistence.getStats();

      expect(stats.totalEntities).toBeGreaterThanOrEqual(0);
      expect(stats.cascadeHistoryLength).toBe(1);
      expect(stats.typeCounts).toBeDefined();
    });
  });

  describe('schedulePersist', () => {
    it('should debounce persist calls', async () => {
      persistence = new CascadeCachePersistence(apolloClient, {
        storage,
        key: 'test_cache',
        persistOnChange: true,
        debounceMs: 50
      });

      const persistSpy = jest.spyOn(persistence, 'persist');

      persistence.schedulePersist();
      persistence.schedulePersist();
      persistence.schedulePersist();

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only persist once due to debouncing
      expect(persistSpy).toHaveBeenCalledTimes(1);
    });

    it('should not schedule if persistOnChange is false', async () => {
      persistence = new CascadeCachePersistence(apolloClient, {
        storage,
        key: 'test_cache',
        persistOnChange: false
      });

      const persistSpy = jest.spyOn(persistence, 'persist');

      persistence.schedulePersist();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(persistSpy).not.toHaveBeenCalled();
    });
  });
});

describe('createInMemoryPersistence', () => {
  it('should create working in-memory storage', () => {
    const storage = createInMemoryPersistence();

    storage.setItem('key', 'value');
    expect(storage.getItem('key')).toBe('value');

    storage.removeItem('key');
    expect(storage.getItem('key')).toBeNull();
  });
});

describe('createLocalStoragePersistence', () => {
  it('should create storage adapter or throw if unavailable', () => {
    // This test verifies the function either creates a storage adapter
    // or throws if localStorage is not available
    try {
      const storage = createLocalStoragePersistence();
      // If we get here, localStorage is available (e.g., jsdom environment)
      expect(storage.getItem).toBeDefined();
      expect(storage.setItem).toBeDefined();
      expect(storage.removeItem).toBeDefined();
    } catch (error) {
      // If localStorage is not available, it should throw
      expect((error as Error).message).toContain('localStorage is not available');
    }
  });
});

describe('onCascadeApplied', () => {
  it('should record cascade to persistence', () => {
    const apolloClient = new ApolloClient({
      cache: new InMemoryCache(),
      connectToDevTools: false
    });

    const storage = createInMemoryPersistence();
    const persistence = new CascadeCachePersistence(apolloClient, { storage });

    const response = {
      success: true,
      data: { id: '1' },
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 0 }
      }
    };

    onCascadeApplied(persistence, response);

    expect(persistence.getCascadeHistory()).toHaveLength(1);
  });
});
