/**
 * GraphQL Cascade client types and interfaces.
 */

/**
 * GraphQL Cascade response structure.
 */
export interface CascadeResponse<T = unknown> {
  success: boolean;
  errors?: CascadeError[];
  data: T;
  cascade: CascadeUpdates;
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
 * Metadata about a cascade operation.
 */
export interface CascadeMetadata {
  timestamp: string;
  transactionId?: string;
  depth: number;
  affectedCount: number;
}

/**
 * An entity that was updated in the cascade.
 */
export interface UpdatedEntity<T = Record<string, unknown>> {
  __typename: string;
  id: string;
  operation: CascadeOperation;
  entity: T;
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
 * Type of cascade operation.
 */
export enum CascadeOperation {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED'
}

/**
 * Error in a cascade mutation.
 */
export interface CascadeError {
  message: string;
  code: CascadeErrorCode;
  field?: string;
  path?: string[];
  extensions?: Record<string, unknown>;
}

/**
 * Standard error codes for Cascade mutations.
 */
export enum CascadeErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
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
 * Generic cache interface for GraphQL Cascade.
 * Implement this interface to integrate with any cache system.
 */
export interface CascadeCache<T = Record<string, unknown>> {
  /**
   * Write an entity to the cache.
   */
  write(typename: string, id: string, data: T): void;

  /**
   * Read an entity from the cache.
   */
  read(typename: string, id: string): T | null;

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
  identify(entity: T): string;
}

/**
 * Conflict detection result.
 */
export interface ConflictDetection {
  hasConflict: boolean;
  conflictType?: 'VERSION_MISMATCH' | 'TIMESTAMP_MISMATCH' | 'FIELD_CONFLICT';
  localEntity?: Record<string, unknown>;
  serverEntity?: Record<string, unknown>;
  conflictingFields?: string[];
}