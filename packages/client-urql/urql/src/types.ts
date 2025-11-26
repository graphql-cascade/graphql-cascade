/**
 * URQL-specific types for GraphQL Cascade integration.
 */

// Re-export core types for convenience
export {
  CascadeUpdates,
  CascadeMetadata,
  UpdatedEntity,
  DeletedEntity,
  CascadeOperation,
  QueryInvalidation,
  InvalidationStrategy,
  InvalidationScope,
  CascadeCache,
} from '@graphql-cascade/client';

import type {
  CascadeUpdates,
  QueryInvalidation,
  CascadeCache,
} from '@graphql-cascade/client';

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
  cacheAdapter?: CascadeCache;
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
 * Result of applying cascade updates.
 */
export interface CascadeApplyResult {
  updatedCount: number;
  deletedCount: number;
  invalidatedCount: number;
  errors: Error[];
}
