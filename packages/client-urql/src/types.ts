/**
 * URQL-specific types for GraphQL Cascade integration.
 */

/**
 * Cascade response metadata.
 */
export interface CascadeMetadata {
  timestamp: string;
  transactionId?: string;
  depth: number;
  affectedCount: number;
}

/**
 * Type of cascade operation.
 */
export enum CascadeOperation {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED'
}

/**
 * An entity that was updated in the cascade.
 */
export interface UpdatedEntity {
  __typename: string;
  id: string;
  operation: CascadeOperation;
  entity: Record<string, unknown>;
}

/**
 * An entity that was deleted in the cascade.
 */
export interface DeletedEntity {
  __typename: string;
  id: string;
  deletedAt: string;
}

/**
 * Strategy for cache invalidation.
 */
export enum InvalidationStrategy {
  INVALIDATE = 'INVALIDATE',
  REFETCH = 'REFETCH',
  REMOVE = 'REMOVE'
}

/**
 * Scope of cache invalidation.
 */
export enum InvalidationScope {
  EXACT = 'EXACT',
  PREFIX = 'PREFIX',
  PATTERN = 'PATTERN',
  ALL = 'ALL'
}

/**
 * Instructions for cache invalidation after a mutation.
 */
export interface QueryInvalidation {
  queryName?: string;
  queryHash?: string;
  arguments?: Record<string, unknown>;
  queryPattern?: string;
  strategy: InvalidationStrategy;
  scope: InvalidationScope;
}

/**
 * The cascade of updates triggered by a mutation.
 */
export interface CascadeUpdates {
  updated: UpdatedEntity[];
  deleted: DeletedEntity[];
  invalidations: QueryInvalidation[];
  metadata: CascadeMetadata;
}

/**
 * Options for the cascade exchange.
 */
export interface CascadeExchangeOptions {
  /**
   * Callback invoked when cascade data is received.
   */
  onCascade?: (cascade: CascadeUpdates) => void;

  /**
   * Callback invoked when cascade updates are applied to cache.
   */
  onCacheUpdate?: (typename: string, id: string, data: unknown) => void;

  /**
   * Callback invoked when an entity is deleted.
   */
  onCacheDelete?: (typename: string, id: string) => void;

  /**
   * Enable debug logging.
   */
  debug?: boolean;

  /**
   * Custom cache adapter for applying updates.
   */
  cacheAdapter?: CascadeCacheAdapter;
}

/**
 * Configuration for URQL cascade client.
 */
export interface URQLCascadeConfig {
  /**
   * Whether to automatically apply cascade updates to cache.
   * @default true
   */
  autoApply?: boolean;

  /**
   * Whether to enable optimistic updates.
   * @default false
   */
  optimistic?: boolean;

  /**
   * Maximum depth for cascade traversal.
   * @default 10
   */
  maxDepth?: number;

  /**
   * Types to exclude from cascade processing.
   */
  excludeTypes?: string[];
}

/**
 * Cache adapter interface for applying cascade updates.
 */
export interface CascadeCacheAdapter {
  /**
   * Write an entity to the cache.
   */
  write(typename: string, id: string, data: Record<string, unknown>): void;

  /**
   * Read an entity from the cache.
   */
  read(typename: string, id: string): Record<string, unknown> | null;

  /**
   * Evict (remove) an entity from the cache.
   */
  evict(typename: string, id: string): void;

  /**
   * Invalidate queries matching the pattern.
   */
  invalidate(invalidation: QueryInvalidation): void;

  /**
   * Refetch queries matching the pattern.
   */
  refetch(invalidation: QueryInvalidation): Promise<void>;

  /**
   * Remove queries from cache.
   */
  remove(invalidation: QueryInvalidation): void;

  /**
   * Identify an entity (get cache key).
   */
  identify(entity: Record<string, unknown>): string;
}

/**
 * Result of applying cascade updates.
 */
export interface CascadeApplyResult {
  updatedCount: number;
  deletedCount: number;
  invalidatedCount: number;
  errors: Error[];
}
