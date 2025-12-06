import { ApolloClient, InMemoryCache, NormalizedCacheObject } from '@apollo/client';
import { CascadeUpdates, CascadeResponse } from '@graphql-cascade/client';

/**
 * Storage interface for cache persistence
 */
export interface CascadePersistenceStorage {
  /**
   * Get an item from storage
   */
  getItem(key: string): Promise<string | null> | string | null;

  /**
   * Set an item in storage
   */
  setItem(key: string, value: string): Promise<void> | void;

  /**
   * Remove an item from storage
   */
  removeItem(key: string): Promise<void> | void;
}

/**
 * Cache persistence options
 */
export interface CachePersistenceOptions {
  /**
   * Storage implementation (localStorage, AsyncStorage, etc.)
   */
  storage: CascadePersistenceStorage;

  /**
   * Key prefix for stored cache data
   * @default 'cascade_cache'
   */
  key?: string;

  /**
   * Whether to persist immediately on cache changes
   * @default false
   */
  persistOnChange?: boolean;

  /**
   * Debounce time in ms for persist operations
   * @default 1000
   */
  debounceMs?: number;

  /**
   * Maximum cache age in ms before considering it stale
   * @default 86400000 (24 hours)
   */
  maxAge?: number;

  /**
   * Serialize function for cache data
   */
  serialize?: (data: NormalizedCacheObject) => string;

  /**
   * Deserialize function for cache data
   */
  deserialize?: (data: string) => NormalizedCacheObject;

  /**
   * Filter function to decide which entities to persist
   */
  filter?: (typename: string, id: string, data: unknown) => boolean;

  /**
   * Callback when persistence fails
   */
  onError?: (error: Error, operation: 'save' | 'restore') => void;

  /**
   * Callback when persistence succeeds
   */
  onPersist?: (data: PersistedCacheData) => void;

  /**
   * Callback when cache is restored
   */
  onRestore?: (data: PersistedCacheData) => void;
}

/**
 * Persisted cache data structure
 */
export interface PersistedCacheData {
  cache: NormalizedCacheObject;
  metadata: CacheMetadata;
}

/**
 * Cache metadata for persistence
 */
export interface CacheMetadata {
  version: string;
  timestamp: number;
  entityCount: number;
  lastCascadeTimestamp?: string;
}

/**
 * Cascade history entry for tracking changes
 */
export interface CascadeHistoryEntry {
  timestamp: string;
  cascade: CascadeUpdates;
  applied: boolean;
}

/**
 * Cache persistence manager for Apollo + Cascade.
 * Handles saving and restoring cache state with cascade history tracking.
 */
export class CascadeCachePersistence {
  private options: Required<Omit<CachePersistenceOptions, 'onError' | 'onPersist' | 'onRestore' | 'filter'>> &
    Pick<CachePersistenceOptions, 'onError' | 'onPersist' | 'onRestore' | 'filter'>;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private cascadeHistory: CascadeHistoryEntry[] = [];
  private isRestoring = false;

  constructor(
    private apolloClient: ApolloClient<NormalizedCacheObject>,
    options: CachePersistenceOptions
  ) {
    this.options = {
      key: 'cascade_cache',
      persistOnChange: false,
      debounceMs: 1000,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      serialize: JSON.stringify,
      deserialize: JSON.parse,
      ...options
    };
  }

  /**
   * Persist the current cache state to storage.
   */
  async persist(): Promise<void> {
    try {
      const cache = this.apolloClient.cache as InMemoryCache;
      const cacheData = cache.extract();

      // Apply filter if provided
      const filteredData = this.options.filter
        ? this.filterCacheData(cacheData)
        : cacheData;

      const metadata: CacheMetadata = {
        version: '1.0',
        timestamp: Date.now(),
        entityCount: Object.keys(filteredData).length,
        lastCascadeTimestamp: this.cascadeHistory.length > 0
          ? this.cascadeHistory[this.cascadeHistory.length - 1].timestamp
          : undefined
      };

      const persistedData: PersistedCacheData = {
        cache: filteredData,
        metadata
      };

      const serialized = this.options.serialize(persistedData as unknown as NormalizedCacheObject);

      await Promise.resolve(this.options.storage.setItem(this.options.key, serialized));

      // Persist cascade history separately
      await this.persistCascadeHistory();

      this.options.onPersist?.(persistedData);

    } catch (error) {
      this.options.onError?.(error as Error, 'save');
    }
  }

  /**
   * Restore cache state from storage.
   *
   * @returns Whether restoration was successful
   */
  async restore(): Promise<boolean> {
    if (this.isRestoring) return false;

    this.isRestoring = true;

    try {
      const serialized = await Promise.resolve(
        this.options.storage.getItem(this.options.key)
      );

      if (!serialized) {
        this.isRestoring = false;
        return false;
      }

      const persistedData = this.options.deserialize(serialized) as unknown as PersistedCacheData;

      // Check if cache is stale
      if (this.isCacheStale(persistedData.metadata)) {
        await this.clear();
        this.isRestoring = false;
        return false;
      }

      // Restore Apollo cache
      const cache = this.apolloClient.cache as InMemoryCache;
      cache.restore(persistedData.cache);

      // Restore cascade history
      await this.restoreCascadeHistory();

      this.options.onRestore?.(persistedData);

      this.isRestoring = false;
      return true;

    } catch (error) {
      this.options.onError?.(error as Error, 'restore');
      this.isRestoring = false;
      return false;
    }
  }

  /**
   * Clear persisted cache data.
   */
  async clear(): Promise<void> {
    try {
      await Promise.resolve(this.options.storage.removeItem(this.options.key));
      await Promise.resolve(this.options.storage.removeItem(`${this.options.key}_history`));
      this.cascadeHistory = [];
    } catch (error) {
      this.options.onError?.(error as Error, 'save');
    }
  }

  /**
   * Schedule a debounced persist operation.
   */
  schedulePersist(): void {
    if (!this.options.persistOnChange) return;

    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(() => {
      this.persist();
      this.persistTimer = null;
    }, this.options.debounceMs);
  }

  /**
   * Record a cascade update for history tracking.
   *
   * @param cascade - The cascade updates to record
   */
  recordCascade(cascade: CascadeUpdates): void {
    // Use the cascade's metadata timestamp if available, otherwise use current time
    const timestamp = cascade.metadata?.timestamp || new Date().toISOString();
    this.cascadeHistory.push({
      timestamp,
      cascade,
      applied: true
    });

    // Keep history bounded (last 100 entries)
    if (this.cascadeHistory.length > 100) {
      this.cascadeHistory = this.cascadeHistory.slice(-100);
    }

    this.schedulePersist();
  }

  /**
   * Get cascade history for replay or debugging.
   */
  getCascadeHistory(): CascadeHistoryEntry[] {
    return [...this.cascadeHistory];
  }

  /**
   * Replay cascade history from a specific timestamp.
   *
   * @param fromTimestamp - ISO timestamp to replay from
   * @param applyCascade - Function to apply cascade updates
   */
  async replayCascadeHistory(
    fromTimestamp: string,
    applyCascade: (cascade: CascadeUpdates) => void
  ): Promise<number> {
    const fromTime = new Date(fromTimestamp).getTime();

    const toReplay = this.cascadeHistory.filter(entry => {
      const entryTime = new Date(entry.timestamp).getTime();
      return entryTime >= fromTime;
    });

    for (const entry of toReplay) {
      applyCascade(entry.cascade);
    }

    return toReplay.length;
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    const cache = this.apolloClient.cache as InMemoryCache;
    const cacheData = cache.extract();

    const typeCounts: Record<string, number> = {};
    let totalEntities = 0;

    for (const key of Object.keys(cacheData)) {
      if (key === 'ROOT_QUERY' || key === 'ROOT_MUTATION' || key === 'ROOT_SUBSCRIPTION') {
        continue;
      }

      totalEntities++;

      const entity = cacheData[key];
      if (entity && typeof entity === 'object' && '__typename' in entity) {
        const typename = (entity as { __typename: string }).__typename;
        typeCounts[typename] = (typeCounts[typename] || 0) + 1;
      }
    }

    return {
      totalEntities,
      typeCounts,
      cascadeHistoryLength: this.cascadeHistory.length,
      lastPersistTime: null // Would need to track this
    };
  }

  /**
   * Check if persisted cache is stale.
   */
  private isCacheStale(metadata: CacheMetadata): boolean {
    const age = Date.now() - metadata.timestamp;
    return age > this.options.maxAge;
  }

  /**
   * Filter cache data based on provided filter function.
   */
  private filterCacheData(data: NormalizedCacheObject): NormalizedCacheObject {
    if (!this.options.filter) return data;

    const filtered: NormalizedCacheObject = {};

    for (const [key, value] of Object.entries(data)) {
      // Always keep ROOT_ entries
      if (key.startsWith('ROOT_')) {
        filtered[key] = value;
        continue;
      }

      // Parse typename:id from key
      const colonIndex = key.indexOf(':');
      if (colonIndex === -1) {
        filtered[key] = value;
        continue;
      }

      const typename = key.slice(0, colonIndex);
      const id = key.slice(colonIndex + 1);

      if (this.options.filter(typename, id, value)) {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * Persist cascade history to storage.
   */
  private async persistCascadeHistory(): Promise<void> {
    const historyKey = `${this.options.key}_history`;
    const serialized = JSON.stringify(this.cascadeHistory);
    await Promise.resolve(this.options.storage.setItem(historyKey, serialized));
  }

  /**
   * Restore cascade history from storage.
   */
  private async restoreCascadeHistory(): Promise<void> {
    const historyKey = `${this.options.key}_history`;
    const serialized = await Promise.resolve(this.options.storage.getItem(historyKey));

    if (serialized) {
      try {
        this.cascadeHistory = JSON.parse(serialized);
      } catch {
        this.cascadeHistory = [];
      }
    }
  }
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntities: number;
  typeCounts: Record<string, number>;
  cascadeHistoryLength: number;
  lastPersistTime: number | null;
}

/**
 * Create a localStorage-based persistence storage.
 * Note: This function should only be called in browser environments.
 */
export function createLocalStoragePersistence(): CascadePersistenceStorage {
  // Check if we're in a browser environment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
  const storage = win?.localStorage || win?.window?.localStorage;

  if (!storage) {
    throw new Error('localStorage is not available. Use createInMemoryPersistence for non-browser environments.');
  }

  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key)
  };
}

/**
 * Create an in-memory persistence storage (useful for testing).
 */
export function createInMemoryPersistence(): CascadePersistenceStorage {
  const store = new Map<string, string>();

  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, value); },
    removeItem: (key) => { store.delete(key); }
  };
}

/**
 * Hook to integrate persistence with cascade client.
 * Call this after each cascade application.
 *
 * @param persistence - The persistence manager
 * @param response - The cascade response that was applied
 */
export function onCascadeApplied(
  persistence: CascadeCachePersistence,
  response: CascadeResponse
): void {
  persistence.recordCascade(response.cascade);
}
