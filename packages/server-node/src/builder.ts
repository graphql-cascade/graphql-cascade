/**
 * GraphQL Cascade Response Builder
 *
 * Constructs CascadeResponse objects from tracked entity changes.
 */

import { CascadeTracker } from './tracker';
import {
  CascadeResponse,
  CascadeErrorInfo,
  CascadeBuilderConfig,
  CascadeUpdatedEntity,
  CascadeDeletedEntity,
  CascadeInvalidation,
  Invalidator,
} from './types';
import type { MetricsCollector } from './metrics';

/**
 * Builds GraphQL Cascade responses from tracked changes.
 *
 * Handles response construction, validation, and optimization.
 */
export class CascadeBuilder {
  protected tracker: CascadeTracker;
  protected invalidator?: Invalidator;
  protected maxResponseSizeMb: number;
  protected maxUpdatedEntities: number;
  protected maxDeletedEntities: number;
  protected maxInvalidations: number;
  protected onInvalidationError?: (error: Error) => void;
  protected metrics?: MetricsCollector;
  protected includeTimingMetadata: boolean;
  protected includeTransactionId: boolean;

  constructor(
    tracker: CascadeTracker,
    invalidator?: Invalidator,
    config: CascadeBuilderConfig = {}
  ) {
    this.tracker = tracker;
    this.invalidator = invalidator;
    this.maxResponseSizeMb = config.maxResponseSizeMb ?? 5.0;
    this.maxUpdatedEntities = config.maxUpdatedEntities ?? 500;
    this.maxDeletedEntities = config.maxDeletedEntities ?? 100;
    this.maxInvalidations = config.maxInvalidations ?? 50;
    this.onInvalidationError = config.onInvalidationError;
    this.metrics = config.metrics;
    this.includeTimingMetadata = config.includeTimingMetadata ?? true;
    this.includeTransactionId = config.includeTransactionId ?? true;
  }

  /**
   * Build a complete CascadeResponse.
   */
  buildResponse<T = unknown>(
    primaryResult: T | null = null,
    success: boolean = true,
    errors: CascadeErrorInfo[] = []
  ): CascadeResponse {
    const startTime = Date.now();

    // Get cascade data from tracker
    let cascadeData: any;
    try {
      cascadeData = this.tracker.getCascadeData();
      this.tracker.endTransaction();
    } catch (e) {
      // If tracker has no transaction, return empty cascade data
      cascadeData = {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: {
          timestamp: new Date().toISOString(),
          depth: 0,
          affectedCount: 0,
          trackingTime: 0,
        },
      };
    }

    // Compute invalidations if invalidator provided
    if (this.invalidator && success) {
      try {
        const invalidations = this.invalidator.computeInvalidations(
          cascadeData.updated,
          cascadeData.deleted,
          primaryResult
        );
        cascadeData.invalidations = invalidations?.slice(0, this.maxInvalidations) ?? [];
      } catch (e) {
        if (this.onInvalidationError) {
          this.onInvalidationError(e as Error);
        }
        cascadeData.invalidations = [];
      }
    } else {
      cascadeData.invalidations = [];
    }

    // Apply size limits
    const processedCascadeData = this.applySizeLimits(cascadeData);

    // Build response
    const response: CascadeResponse = {
      success,
      data: primaryResult,
      cascade: processedCascadeData,
      errors,
    };

    // Add construction time to metadata
    const constructionTime = Date.now() - startTime;
    if (response.cascade.metadata) {
      response.cascade.metadata.constructionTime = constructionTime;
    }

    // Apply metadata filtering based on configuration
    if (response.cascade.metadata) {
      if (!this.includeTimingMetadata) {
        delete (response.cascade.metadata as any).trackingTime;
        delete (response.cascade.metadata as any).constructionTime;
      }
      if (!this.includeTransactionId) {
        delete (response.cascade.metadata as any).transactionId;
      }
    }

    // Record construction time metric
    this.metrics?.histogram('constructionTimeMs', constructionTime);

    return response;
  }

  /**
   * Build an error response.
   */
  buildErrorResponse(errors: CascadeErrorInfo[], primaryResult: any = null): CascadeResponse {
    const startTime = Date.now();

    // For errors, we still want to track the transaction if it was started
    let cascadeData: any = {
      updated: [],
      deleted: [],
      invalidations: [],
      metadata: {},
    };

    if (this.tracker.inTransaction) {
      try {
        cascadeData = this.tracker.endTransaction();
      } catch (e) {
        // If transaction ending fails, use empty cascade
      }
    }

    // Minimal metadata for error responses
    const constructionTime = Date.now() - startTime;
    cascadeData.metadata = {
      timestamp: new Date().toISOString(),
      depth: 0,
      affectedCount: 0,
      constructionTime,
    };

    // Apply metadata filtering based on configuration
    if (!this.includeTimingMetadata) {
      delete (cascadeData.metadata as any).trackingTime;
      delete (cascadeData.metadata as any).constructionTime;
    }
    if (!this.includeTransactionId) {
      delete (cascadeData.metadata as any).transactionId;
    }

    // Record construction time metric
    this.metrics?.histogram('constructionTimeMs', constructionTime);

    return {
      success: false,
      data: primaryResult,
      cascade: cascadeData,
      errors,
    };
  }

  /**
   * Apply size limits to cascade data.
   */
  private applySizeLimits(cascadeData: any): any {
    const updated = cascadeData.updated || [];
    const deleted = cascadeData.deleted || [];
    const invalidations = cascadeData.invalidations || [];

    // Apply entity limits
    let truncatedUpdated = false;
    let truncatedDeleted = false;
    let truncatedInvalidations = false;

    if (updated.length > this.maxUpdatedEntities) {
      updated.splice(this.maxUpdatedEntities);
      truncatedUpdated = true;
    }

    if (deleted.length > this.maxDeletedEntities) {
      deleted.splice(this.maxDeletedEntities);
      truncatedDeleted = true;
    }

    if (invalidations.length > this.maxInvalidations) {
      invalidations.splice(this.maxInvalidations);
      truncatedInvalidations = true;
    }

    // Check response size
    const responseSize = this.estimateResponseSize(updated, deleted, invalidations);

    if (responseSize > this.maxResponseSizeMb * 1024 * 1024) {
      // Truncate further if needed
      const totalEntities = updated.length + deleted.length;
      if (totalEntities > 100) {
        // Keep only first 50 of each type
        updated.splice(50);
        deleted.splice(50);
        cascadeData.metadata.truncatedSize = true;
      }
    }

    cascadeData.updated = updated;
    cascadeData.deleted = deleted;
    cascadeData.invalidations = invalidations;

    // Update metadata
    if (truncatedUpdated) cascadeData.metadata.truncatedUpdated = true;
    if (truncatedDeleted) cascadeData.metadata.truncatedDeleted = true;
    if (truncatedInvalidations) cascadeData.metadata.truncatedInvalidations = true;

    return cascadeData;
  }

  /**
   * Estimate the JSON size of the cascade data.
   */
  private estimateResponseSize(updated: any[], deleted: any[], invalidations: any[]): number {
    // Rough estimation: assume average 1KB per entity/invalidation
    const entitySize = (updated.length + deleted.length) * 1024;
    const invalidationSize = invalidations.length * 512;
    const metadataSize = 1024;

    return entitySize + invalidationSize + metadataSize;
  }
}

/**
 * Builds cascade responses using streaming to handle large datasets.
 */
export class StreamingCascadeBuilder extends CascadeBuilder {
  /**
   * Build response using streaming to avoid loading all entities in memory.
   */
  buildStreamingResponse(
    primaryResult: any = null,
    success: boolean = true,
    errors: CascadeErrorInfo[] = []
  ): CascadeResponse {
    const startTime = Date.now();

    // For streaming, we process entities on-demand
    const cascadeData: any = {
      updated: [] as any[],
      deleted: [] as any[],
      invalidations: [] as any[],
      metadata: {
        timestamp: new Date().toISOString(),
        depth: this.tracker.currentDepth,
        affectedCount: 0,
        trackingTime: 0,
        streaming: true,
      },
    };

    // Stream updated entities
    let updatedCount = 0;
    for (const [entity, operation] of this.tracker.getUpdatedStream()) {
      if (updatedCount >= this.maxUpdatedEntities) {
        cascadeData.metadata.truncatedUpdated = true;
        break;
      }

      try {
        const entityDict = this.entityToDict(entity);
        cascadeData.updated.push({
          __typename: this.getEntityType(entity),
          id: this.getEntityId(entity),
          operation,
          entity: entityDict,
        });
        updatedCount++;
      } catch (e) {
        // Skip problematic entities
        continue;
      }
    }

    // Stream deleted entities
    let deletedCount = 0;
    for (const [typename, entityId] of this.tracker.getDeletedStream()) {
      if (deletedCount >= this.maxDeletedEntities) {
        cascadeData.metadata.truncatedDeleted = true;
        break;
      }

      cascadeData.deleted.push({
        __typename: typename,
        id: entityId,
        deletedAt: new Date().toISOString(),
      });
      deletedCount++;
    }

    cascadeData.metadata.affectedCount = updatedCount + deletedCount;

    // Compute invalidations
    if (this.invalidator && success) {
      const invalidations = this.invalidator.computeInvalidations(
        cascadeData.updated,
        cascadeData.deleted,
        primaryResult
      );
      cascadeData.invalidations = invalidations?.slice(0, this.maxInvalidations) ?? [];
    }

    // Add construction time to metadata
    const constructionTime = Date.now() - startTime;
    cascadeData.metadata.constructionTime = constructionTime;

    // Apply metadata filtering based on configuration
    if (!this.includeTimingMetadata) {
      delete (cascadeData.metadata as any).trackingTime;
      delete (cascadeData.metadata as any).constructionTime;
    }
    if (!this.includeTransactionId) {
      delete (cascadeData.metadata as any).transactionId;
    }

    // Record construction time metric
    this.metrics?.histogram('constructionTimeMs', constructionTime);

    return {
      success,
      data: primaryResult,
      cascade: cascadeData,
      errors,
    };
  }

  /**
   * Convert entity to dictionary (streaming version).
   */
  private entityToDict(entity: any): Record<string, any> {
    if (typeof entity.toDict === 'function') {
      return entity.toDict();
    } else if (entity && typeof entity === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(entity)) {
        if (!key.startsWith('_')) {
          result[key] = this.serializeValue(value);
        }
      }
      return result;
    } else {
      throw new Error(`Cannot serialize entity ${entity}`);
    }
  }

  /**
   * Serialize a value for JSON (streaming version).
   */
  private serializeValue(value: any): any {
    if (value == null) {
      return null;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    } else if (value instanceof Date) {
      return value.toISOString();
    } else if (Array.isArray(value)) {
      return value.map(item => this.serializeValue(item));
    } else if (typeof value === 'object' && value.constructor === Object) {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.serializeValue(v);
      }
      return result;
    } else {
      return String(value);
    }
  }

  /**
   * Get entity type name.
   */
  private getEntityType(entity: any): string {
    if (entity.__typename) {
      return entity.__typename;
    } else if (entity._typename) {
      return entity._typename;
    } else {
      return entity.constructor?.name ?? 'Unknown';
    }
  }

  /**
   * Get entity ID.
   */
  private getEntityId(entity: any): string {
    if (entity.id !== undefined) {
      return String(entity.id);
    } else {
      throw new Error(`Entity ${entity} has no 'id' attribute`);
    }
  }
}

/**
 * Convenience functions for building cascade responses.
 */

/**
 * Build a successful cascade response.
 */
export function buildSuccessResponse(
  tracker: CascadeTracker,
  invalidator?: any,
  primaryResult: any = null
): CascadeResponse {
  const builder = new CascadeBuilder(tracker, invalidator);
  return builder.buildResponse(primaryResult, true);
}

/**
 * Build an error cascade response.
 */
export function buildErrorResponse(
  tracker: CascadeTracker,
  errors: CascadeErrorInfo[],
  primaryResult: any = null
): CascadeResponse {
  const builder = new CascadeBuilder(tracker);
  return builder.buildErrorResponse(errors, primaryResult);
}

/**
 * Build a successful streaming cascade response.
 */
export function buildStreamingSuccessResponse(
  tracker: CascadeTracker,
  invalidator?: any,
  primaryResult: any = null
): CascadeResponse {
  const builder = new StreamingCascadeBuilder(tracker, invalidator);
  return builder.buildStreamingResponse(primaryResult, true);
}