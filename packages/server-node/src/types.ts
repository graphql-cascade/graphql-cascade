/**
 * GraphQL Cascade TypeScript Type Definitions
 *
 * Core types for GraphQL Cascade server implementation.
 */

/**
 * Represents a change to an entity during a cascade transaction.
 */
export interface EntityChange {
  /** The entity that changed */
  entity: any;
  /** The operation performed: 'CREATED', 'UPDATED', 'DELETED' */
  operation: 'CREATED' | 'UPDATED' | 'DELETED';
  /** Timestamp when the change occurred */
  timestamp: number;
}

/**
 * Metadata for cascade operations.
 */
export interface CascadeMetadata {
  /** Unique transaction identifier */
  transactionId?: string;
  /** ISO timestamp of the cascade operation */
  timestamp: string;
  /** Depth of relationship traversal */
  depth: number;
  /** Total number of affected entities */
  affectedCount: number;
  /** Time spent tracking changes */
  trackingTime: number;
  /** Time spent building the response */
  constructionTime?: number;
  /** Whether the response was truncated due to size limits */
  truncatedUpdated?: boolean;
  /** Whether deleted entities were truncated */
  truncatedDeleted?: boolean;
  /** Whether invalidations were truncated */
  truncatedInvalidations?: boolean;
  /** Whether response was truncated due to size limits */
  truncatedSize?: boolean;
  /** Whether streaming was used */
  streaming?: boolean;
  /** Number of entities that failed serialization */
  serializationErrors?: number;
}

/**
 * An updated entity in the cascade response.
 */
export interface CascadeUpdatedEntity {
  /** GraphQL type name */
  __typename: string;
  /** Entity ID */
  id: string;
  /** Operation performed */
  operation: 'CREATED' | 'UPDATED' | 'DELETED';
  /** The entity data */
  entity: Record<string, any>;
}

/**
 * A deleted entity in the cascade response.
 */
export interface CascadeDeletedEntity {
  /** GraphQL type name */
  __typename: string;
  /** Entity ID */
  id: string;
  /** ISO timestamp when the entity was deleted */
  deletedAt: string;
}

/**
 * An invalidation entry in the cascade response.
 */
export interface CascadeInvalidation {
  /** GraphQL type name */
  __typename: string;
  /** Entity ID or field path */
  id?: string;
  /** Field that was invalidated */
  field?: string;
  /** Reason for invalidation */
  reason: string;
}

/**
 * The cascade data section of a response.
 */
export interface CascadeData {
  /** List of updated entities */
  updated: CascadeUpdatedEntity[];
  /** List of deleted entities */
  deleted: CascadeDeletedEntity[];
  /** List of cache invalidations */
  invalidations: CascadeInvalidation[];
  /** Metadata about the cascade operation */
  metadata: CascadeMetadata;
}

/**
 * Partial cascade data returned by CascadeTracker (without invalidations).
 * Uses Record<string, unknown> since the tracker builds these dynamically.
 * Invalidations are computed later by CascadeBuilder.
 */
export interface TrackerCascadeData {
  /** List of updated entities */
  updated: Array<{
    __typename: string;
    id: string;
    operation: 'CREATED' | 'UPDATED' | 'DELETED';
    entity: Record<string, unknown>;
  }>;
  /** List of deleted entities */
  deleted: Array<{
    __typename: string;
    id: string;
    deletedAt: string;
  }>;
  /** Metadata about the cascade operation */
  metadata: CascadeMetadata;
}

/**
 * GraphQL Cascade response structure.
 */
export interface CascadeResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** The primary result data */
  data?: any;
  /** Cascade data for cache updates */
  cascade: CascadeData;
  /** List of errors (if any) */
  errors: CascadeError[];
}

/**
 * Structured cascade error.
 */
export interface CascadeError {
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** Field that caused the error */
  field?: string;
  /** Path to the error in the GraphQL document */
  path?: string[];
  /** Additional error extensions */
  extensions?: Record<string, any>;
}

/**
 * Logger interface for cascade operations (matches CascadeLogger from logger.ts).
 */
export interface CascadeLoggerInterface {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Metrics collector interface (re-exported from metrics.ts).
 */
export type { MetricsCollector } from './metrics';

/**
 * Configuration options for CascadeTracker.
 */
export interface CascadeTrackerConfig {
  /** Maximum depth for relationship traversal */
  maxDepth?: number;
  /** Types to exclude from tracking */
  excludeTypes?: string[];
  /** Whether to enable relationship tracking */
  enableRelationshipTracking?: boolean;
  /** Maximum total entities to track (prevents memory exhaustion) */
  maxEntities?: number;
  /** Maximum related entities to traverse per entity (breadth limit) */
  maxRelatedPerEntity?: number;
  /** Optional handler called when entity serialization fails */
  onSerializationError?: (entity: unknown, error: Error) => void;
  /** Optional logger for debug output */
  logger?: CascadeLoggerInterface;
  /** Enable debug logging (shorthand for setting logger to console logger) */
  debug?: boolean;
  /** Optional metrics collector for observability */
  metrics?: import('./metrics').MetricsCollector;
  /** Filter which fields are included in entity data */
  fieldFilter?: (typename: string, fieldName: string, value: unknown) => boolean;
  /** Filter which entities are included in the cascade */
  entityFilter?: (typename: string, id: string, entity: Record<string, unknown>) => boolean;
  /** Validate entity before tracking - throw to reject */
  validateEntity?: (typename: string, id: string, entity: Record<string, unknown>) => void;
  /** Transform entity data before including in response */
  transformEntity?: (typename: string, id: string, entity: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Configuration options for CascadeBuilder.
 */
export interface CascadeBuilderConfig {
  /** Maximum response size in MB */
  maxResponseSizeMb?: number;
  /** Maximum number of updated entities */
  maxUpdatedEntities?: number;
  /** Maximum number of deleted entities */
  maxDeletedEntities?: number;
  /** Maximum number of invalidations */
  maxInvalidations?: number;
  /** Optional handler called when invalidation computation fails */
  onInvalidationError?: (error: Error) => void;
}

/**
 * Represents an entity with GraphQL metadata.
 */
export interface GraphQLEntity {
  /** GraphQL type name */
  __typename?: string;
  /** Entity ID */
  id: string | number;
  /** Entity data */
  [key: string]: any;
}

/**
 * Iterator for streaming entity changes.
 */
export interface EntityChangeIterator {
  /** Iterate over updated entities */
  getUpdatedStream(): IterableIterator<[any, string]>;
  /** Iterate over deleted entities */
  getDeletedStream(): IterableIterator<[string, string]>;
}

/**
 * Represents an entity that can be tracked by the cascade tracker.
 */
export interface TrackedEntity {
  /** Entity ID (required) */
  id: string | number;
  /** GraphQL type name (optional, can use __typename or _typename) */
  __typename?: string;
  /** Alternative typename field */
  _typename?: string;
  /** Custom serialization method */
  toDict?: () => Record<string, unknown>;
  /** Custom method to get related entities */
  getRelatedEntities?: () => TrackedEntity[];
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Computes cache invalidations based on entity changes.
 */
export interface Invalidator {
  /**
   * Compute invalidations based on entity changes.
   */
  computeInvalidations(
    updated: CascadeUpdatedEntity[],
    deleted: CascadeDeletedEntity[],
    primaryResult: unknown
  ): CascadeInvalidation[] | null | undefined;
}