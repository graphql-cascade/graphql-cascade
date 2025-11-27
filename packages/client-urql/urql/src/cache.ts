/**
 * URQL Cache Adapter for GraphQL Cascade.
 *
 * Provides a simple in-memory cache implementation that can be used
 * with the cascade exchange. For production use with URQL's graphcache,
 * consider using the GraphcacheCascadeAdapter instead.
 */

import {
  CascadeCache,
  QueryInvalidation,
  InvalidationScope,
} from './types';

/**
 * Entity stored in the cache.
 */
interface CacheEntity {
  typename: string;
  id: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

/**
 * Query stored in the cache.
 */
interface CachedQuery {
  name: string;
  args?: Record<string, unknown>;
  data: unknown;
  fetchedAt: number;
  isStale: boolean;
}

/**
 * Simple in-memory cache adapter for GraphQL Cascade.
 *
 * This is a basic implementation suitable for testing and simple use cases.
 * For production with URQL graphcache, use GraphcacheCascadeAdapter.
 */
export class InMemoryCascadeCache implements CascadeCache {
  private entities: Map<string, CacheEntity> = new Map();
  private queries: Map<string, CachedQuery> = new Map();
  private refetchFn?: (queryName: string, args?: Record<string, unknown>) => Promise<void>;

  /**
   * Create a new in-memory cache.
   *
   * @param options - Cache options
   */
  constructor(options?: {
    refetchFn?: (queryName: string, args?: Record<string, unknown>) => Promise<void>;
  }) {
    this.refetchFn = options?.refetchFn;
  }

  /**
   * Generate a cache key for an entity.
   */
  private entityKey(typename: string, id: string): string {
    return `${typename}:${id}`;
  }

  /**
   * Generate a cache key for a query.
   */
  private queryKey(name: string, args?: Record<string, unknown>): string {
    if (!args || Object.keys(args).length === 0) {
      return name;
    }
    return `${name}:${JSON.stringify(args)}`;
  }

  /**
   * Write an entity to the cache.
   */
  write(typename: string, id: string, data: Record<string, unknown>): void {
    const key = this.entityKey(typename, id);
    this.entities.set(key, {
      typename,
      id,
      data: { ...data, __typename: typename, id },
      updatedAt: Date.now(),
    });
  }

  /**
   * Read an entity from the cache.
   */
  read(typename: string, id: string): Record<string, unknown> | null {
    const key = this.entityKey(typename, id);
    const entity = this.entities.get(key);
    return entity?.data ?? null;
  }

  /**
   * Evict (remove) an entity from the cache.
   */
  evict(typename: string, id: string): void {
    const key = this.entityKey(typename, id);
    this.entities.delete(key);
  }

  /**
   * Invalidate queries matching the pattern.
   */
  invalidate(invalidation: QueryInvalidation): void {
    const matchingQueries = this.findMatchingQueries(invalidation);
    for (const key of matchingQueries) {
      const query = this.queries.get(key);
      if (query) {
        query.isStale = true;
      }
    }
  }

  /**
   * Refetch queries matching the pattern.
   */
  async refetch(invalidation: QueryInvalidation): Promise<void> {
    if (!this.refetchFn) {
      // If no refetch function, just invalidate
      this.invalidate(invalidation);
      return;
    }

    const matchingQueries = this.findMatchingQueries(invalidation);
    const refetchPromises: Promise<void>[] = [];

    for (const key of matchingQueries) {
      const query = this.queries.get(key);
      if (query) {
        refetchPromises.push(this.refetchFn(query.name, query.args));
      }
    }

    await Promise.all(refetchPromises);
  }

  /**
   * Remove queries from cache.
   */
  remove(invalidation: QueryInvalidation): void {
    const matchingQueries = this.findMatchingQueries(invalidation);
    for (const key of matchingQueries) {
      this.queries.delete(key);
    }
  }

  /**
   * Identify an entity (get cache key).
   */
  identify(entity: Record<string, unknown>): string {
    const typename = entity.__typename as string;
    const id = entity.id as string;
    if (!typename || !id) {
      throw new Error('Entity must have __typename and id fields');
    }
    return this.entityKey(typename, id);
  }

  /**
   * Find queries matching an invalidation pattern.
   */
  private findMatchingQueries(invalidation: QueryInvalidation): string[] {
    const matches: string[] = [];

    switch (invalidation.scope) {
      case InvalidationScope.EXACT:
        const exactKey = this.queryKey(invalidation.queryName ?? '', invalidation.arguments);
        if (this.queries.has(exactKey)) {
          matches.push(exactKey);
        }
        break;

      case InvalidationScope.PREFIX:
        for (const key of this.queries.keys()) {
          if (invalidation.queryName && key.startsWith(invalidation.queryName)) {
            matches.push(key);
          }
        }
        break;

      case InvalidationScope.PATTERN:
        if (invalidation.queryPattern) {
          const pattern = this.patternToRegex(invalidation.queryPattern);
          for (const key of this.queries.keys()) {
            if (pattern.test(key)) {
              matches.push(key);
            }
          }
        }
        break;

      case InvalidationScope.ALL:
        matches.push(...this.queries.keys());
        break;
    }

    return matches;
  }

  /**
   * Maximum length for query patterns to prevent ReDoS attacks.
   */
  private static readonly MAX_PATTERN_LENGTH = 100;

  /**
   * Convert a simple glob pattern to regex.
   * @throws Error if pattern exceeds maximum length
   */
  private patternToRegex(pattern: string): RegExp {
    // Validate pattern length to prevent ReDoS attacks
    if (pattern.length > InMemoryCascadeCache.MAX_PATTERN_LENGTH) {
      throw new Error(`Pattern exceeds maximum length of ${InMemoryCascadeCache.MAX_PATTERN_LENGTH} characters`);
    }

    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Store a query result.
   */
  storeQuery(name: string, args: Record<string, unknown> | undefined, data: unknown): void {
    const key = this.queryKey(name, args);
    this.queries.set(key, {
      name,
      args,
      data,
      fetchedAt: Date.now(),
      isStale: false,
    });
  }

  /**
   * Get a query result.
   */
  getQuery(name: string, args?: Record<string, unknown>): { data: unknown; isStale: boolean } | null {
    const key = this.queryKey(name, args);
    const query = this.queries.get(key);
    if (!query) {
      return null;
    }
    return { data: query.data, isStale: query.isStale };
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.entities.clear();
    this.queries.clear();
  }

  /**
   * Get all entities of a specific type.
   */
  getEntitiesByType(typename: string): Record<string, unknown>[] {
    const result: Record<string, unknown>[] = [];
    for (const entity of this.entities.values()) {
      if (entity.typename === typename) {
        result.push(entity.data);
      }
    }
    return result;
  }

  /**
   * Get cache statistics.
   */
  getStats(): { entityCount: number; queryCount: number; staleQueryCount: number } {
    let staleCount = 0;
    for (const query of this.queries.values()) {
      if (query.isStale) {
        staleCount++;
      }
    }
    return {
      entityCount: this.entities.size,
      queryCount: this.queries.size,
      staleQueryCount: staleCount,
    };
  }
}
