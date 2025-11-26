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
 * Configuration options for CascadeTracker.
 */
export interface CascadeTrackerConfig {
  /** Maximum depth for relationship traversal */
  maxDepth?: number;
  /** Types to exclude from tracking */
  excludeTypes?: string[];
  /** Whether to enable relationship tracking */
  enableRelationshipTracking?: boolean;
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