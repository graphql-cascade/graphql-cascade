/**
 * GraphQL Cascade Entity Tracker
 *
 * Tracks entity changes during GraphQL mutations for cascade response construction.
 */

import { EntityChange, CascadeTrackerConfig, GraphQLEntity, EntityChangeIterator, TrackedEntity, CascadeLoggerInterface, TrackerCascadeData, CascadeMetadata, CascadeErrorCode } from './types';
import { CascadeError } from './errors';
import { silentLogger, createScopedLogger } from './logger';
import type { MetricsCollector } from './metrics';

/**
 * Context manager for cascade transaction tracking.
 */
export class CascadeTransaction {
  private tracker: CascadeTracker;

  constructor(tracker: CascadeTracker) {
    this.tracker = tracker;
  }

  /**
   * Start the transaction.
   */
  enter(): string {
    return this.tracker.startTransaction();
  }

  /**
   * End the transaction.
   */
  exit(excType?: unknown, excValue?: unknown, excTb?: unknown): void {
    if (excType === undefined || excType === null) {
      // Normal exit - mark as not in transaction but keep data
      this.tracker.inTransaction = false;
      this.tracker.transactionId = undefined;
      this.tracker.transactionStartTime = undefined;
      (this.tracker as unknown as { trackingStartTime?: number }).trackingStartTime = undefined;
    } else {
      // Exception occurred - reset state
      this.tracker.resetTransactionState();
    }
  }
}

/**
 * Tracks entity changes during GraphQL mutations.
 *
 * Supports multiple tracking strategies:
 * - ORM hooks (preferred)
 * - Database triggers
 * - Manual tracking
 */
export class CascadeTracker implements EntityChangeIterator {
  private maxDepth: number;
  private excludeTypes: Set<string>;
  private enableRelationshipTracking: boolean;
  private maxEntities: number;
  private maxRelatedPerEntity: number;
  private onSerializationError?: (entity: unknown, error: Error) => void;
  private log: CascadeLoggerInterface;
  private metrics?: MetricsCollector;
  private activeTransactionCount: number = 0;

  // Security filters
  private fieldFilter?: (typename: string, fieldName: string, value: unknown) => boolean;
  private entityFilter?: (entity: TrackedEntity, context?: unknown) => boolean | Promise<boolean>;
  private validateEntity?: (entity: TrackedEntity) => void;
  private transformEntity?: (entity: TrackedEntity) => TrackedEntity;
  private context?: unknown;

  // Transaction state
  public inTransaction: boolean = false;
  public transactionStartTime?: number;
  public transactionId?: string;

  // Change tracking
  private updatedEntities: Map<string, EntityChange> = new Map();
  private deletedEntities: Set<string> = new Set();
  private visitedEntities: Set<string> = new Set();
  public currentDepth: number = 0;
  private maxDepthReached: number = 0;
  private entityLimitReached: boolean = false;
  private serializationErrorCount: number = 0;

  // Performance tracking
  private trackingStartTime?: number;

  /**
   * Get the tracking start time.
   */
  getTrackingStartTime(): number | undefined {
    return this.trackingStartTime;
  }

  /**
   * Reset transaction state (public for builder access).
   * This is called on error/abort and records a failed transaction.
   */
  resetTransactionState(): void {
    this.resetTransactionStateInternal(true);
  }

  /**
   * Internal reset with optional failure tracking.
   */
  private resetTransactionStateInternal(recordFailure: boolean): void {
    if (recordFailure && this.inTransaction) {
      this.metrics?.increment('transactionsFailed');
      this.activeTransactionCount = Math.max(0, this.activeTransactionCount - 1);
      this.metrics?.gauge('activeTransactions', this.activeTransactionCount);
    }
    this.inTransaction = false;
    this.transactionStartTime = undefined;
    this.transactionId = undefined;
    this.trackingStartTime = undefined;
    this.updatedEntities.clear();
    this.deletedEntities.clear();
    this.visitedEntities.clear();
    this.currentDepth = 0;
    this.maxDepthReached = 0;
    this.entityLimitReached = false;
    this.serializationErrorCount = 0;
  }

  constructor(config: CascadeTrackerConfig = {}) {
    this.maxDepth = config.maxDepth ?? 3;
    this.excludeTypes = new Set(config.excludeTypes ?? []);
    this.enableRelationshipTracking = config.enableRelationshipTracking ?? true;
    this.maxEntities = config.maxEntities ?? 1000;
    this.maxRelatedPerEntity = config.maxRelatedPerEntity ?? 100;
    this.onSerializationError = config.onSerializationError;
    this.metrics = config.metrics;

    // Initialize security filters
    this.fieldFilter = config.fieldFilter;
    this.entityFilter = config.entityFilter;
    this.validateEntity = config.validateEntity;
    this.transformEntity = config.transformEntity;

    // Initialize logger: use provided logger, create debug logger if debug=true, or use silent logger
    if (config.logger) {
      this.log = config.logger;
    } else if (config.debug) {
      this.log = createScopedLogger('[Cascade:Tracker]');
    } else {
      this.log = silentLogger;
    }
  }

  /**
   * Set context for entity filtering (e.g., current user, request info).
   */
  setContext(context: unknown): void {
    this.context = context;
  }

  /**
   * Start a new cascade transaction.
   */
  startTransaction(): string {
    if (this.inTransaction) {
      throw new CascadeError(
        'Transaction already in progress',
        CascadeErrorCode.TRANSACTION_IN_PROGRESS,
        'Call endTransaction() first or create a new CascadeTracker instance',
        '/docs/server/node#transactions'
      );
    }

    this.inTransaction = true;
    this.transactionStartTime = Date.now();
    this.transactionId = `cascade_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.trackingStartTime = Date.now();

    // Reset tracking state
    this.updatedEntities.clear();
    this.deletedEntities.clear();
    this.visitedEntities.clear();
    this.currentDepth = 0;

    // Metrics instrumentation
    this.metrics?.increment('transactionsStarted');
    this.activeTransactionCount++;
    this.metrics?.gauge('activeTransactions', this.activeTransactionCount);

    this.log.debug('Transaction started', { transactionId: this.transactionId });

    return this.transactionId;
  }

  /**
   * End the current transaction and return cascade data (async version with entity filtering support).
   */
  async endTransactionAsync(): Promise<TrackerCascadeData> {
    if (!this.inTransaction && this.updatedEntities.size === 0 && this.deletedEntities.size === 0) {
      throw new CascadeError(
        'No transaction in progress',
        CascadeErrorCode.NO_TRANSACTION,
        'Call startTransaction() before tracking entities',
        '/docs/server/node#transactions'
      );
    }

    const trackingTime = Date.now() - (this.getTrackingStartTime() ?? 0);
    const wasLimitReached = this.entityLimitReached;
    const updatedEntities = await this.buildUpdatedEntitiesAsync();
    const deletedEntities = this.buildDeletedEntities();
    const errorCount = this.serializationErrorCount;
    const cascadeSize = updatedEntities.length + deletedEntities.length;

    const metadata: CascadeMetadata = {
      transactionId: this.transactionId,
      timestamp: new Date().toISOString(),
      depth: this.maxDepthReached,
      affectedCount: this.updatedEntities.size + this.deletedEntities.size,
      trackingTime,
      truncatedUpdated: wasLimitReached,
      serializationErrors: errorCount > 0 ? errorCount : undefined,
    };

    const cascadeData = {
      updated: updatedEntities,
      deleted: deletedEntities,
      metadata,
    };

    // Metrics instrumentation for successful completion
    this.metrics?.increment('transactionsCompleted');
    this.metrics?.histogram('trackingTimeMs', trackingTime);
    this.metrics?.histogram('cascadeSize', cascadeSize);
    if (wasLimitReached) {
      this.metrics?.increment('entitiesTruncated');
    }
    this.activeTransactionCount = Math.max(0, this.activeTransactionCount - 1);
    this.metrics?.gauge('activeTransactions', this.activeTransactionCount);

    this.log.debug('Transaction ended', {
      transactionId: this.transactionId,
      updatedCount: updatedEntities.length,
      deletedCount: deletedEntities.length,
      trackingTime,
    });

    // Reset state (without triggering failed metrics)
    this.resetTransactionStateInternal(false);

    return cascadeData;
  }

  /**
   * End the current transaction and return cascade data (synchronous version).
   * Note: If using async entityFilter, use endTransactionAsync() instead.
   */
  endTransaction(): TrackerCascadeData {
    if (!this.inTransaction && this.updatedEntities.size === 0 && this.deletedEntities.size === 0) {
      throw new CascadeError(
        'No transaction in progress',
        CascadeErrorCode.NO_TRANSACTION,
        'Call startTransaction() before tracking entities',
        '/docs/server/node#transactions'
      );
    }

    const trackingTime = Date.now() - (this.getTrackingStartTime() ?? 0);
    const wasLimitReached = this.entityLimitReached;
    const updatedEntities = this.buildUpdatedEntities();
    const deletedEntities = this.buildDeletedEntities();
    const errorCount = this.serializationErrorCount;
    const cascadeSize = updatedEntities.length + deletedEntities.length;

    const metadata: CascadeMetadata = {
      transactionId: this.transactionId,
      timestamp: new Date().toISOString(),
      depth: this.maxDepthReached,
      affectedCount: this.updatedEntities.size + this.deletedEntities.size,
      trackingTime,
      truncatedUpdated: wasLimitReached,
      serializationErrors: errorCount > 0 ? errorCount : undefined,
    };

    const cascadeData = {
      updated: updatedEntities,
      deleted: deletedEntities,
      metadata,
    };

    // Metrics instrumentation for successful completion
    this.metrics?.increment('transactionsCompleted');
    this.metrics?.histogram('trackingTimeMs', trackingTime);
    this.metrics?.histogram('cascadeSize', cascadeSize);
    if (wasLimitReached) {
      this.metrics?.increment('entitiesTruncated');
    }
    this.activeTransactionCount = Math.max(0, this.activeTransactionCount - 1);
    this.metrics?.gauge('activeTransactions', this.activeTransactionCount);

    this.log.debug('Transaction ended', {
      transactionId: this.transactionId,
      updatedCount: updatedEntities.length,
      deletedCount: deletedEntities.length,
      trackingTime,
    });

    // Reset state (without triggering failed metrics)
    this.resetTransactionStateInternal(false);

    return cascadeData;
  }



  /**
   * Get cascade data without ending the transaction (async version with entity filtering support).
   */
  async getCascadeDataAsync(): Promise<TrackerCascadeData> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }

    const trackingTime = Date.now() - (this.getTrackingStartTime() ?? 0);
    const updatedEntities = await this.buildUpdatedEntitiesAsync();
    const deletedEntities = this.buildDeletedEntities();

    const metadata: CascadeMetadata = {
      transactionId: this.transactionId,
      timestamp: new Date().toISOString(),
      depth: this.maxDepthReached,
      affectedCount: this.updatedEntities.size + this.deletedEntities.size,
      trackingTime,
      truncatedUpdated: this.entityLimitReached,
      serializationErrors: this.serializationErrorCount > 0 ? this.serializationErrorCount : undefined,
    };

    return {
      updated: updatedEntities,
      deleted: deletedEntities,
      metadata,
    };
  }

  /**
   * Get cascade data without ending the transaction (synchronous version).
   * Note: If using async entityFilter, use getCascadeDataAsync() instead.
   */
  getCascadeData(): TrackerCascadeData {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }

    const trackingTime = Date.now() - (this.getTrackingStartTime() ?? 0);
    const updatedEntities = this.buildUpdatedEntities();
    const deletedEntities = this.buildDeletedEntities();

    const metadata: CascadeMetadata = {
      transactionId: this.transactionId,
      timestamp: new Date().toISOString(),
      depth: this.maxDepthReached,
      affectedCount: this.updatedEntities.size + this.deletedEntities.size,
      trackingTime,
      truncatedUpdated: this.entityLimitReached,
      serializationErrors: this.serializationErrorCount > 0 ? this.serializationErrorCount : undefined,
    };

    return {
      updated: updatedEntities,
      deleted: deletedEntities,
      metadata,
    };
  }

  /**
   * Track entity creation.
   * @param entity - Entity with at least an `id` and optionally `__typename`
   */
  trackCreate(entity: TrackedEntity | Record<string, unknown>): void {
    this.ensureTransaction();
    const typename = this.getEntityType(entity);
    const entityId = this.getEntityId(entity);
    this.log.debug('Entity created', { typename, id: entityId, operation: 'CREATED' });
    this.trackEntity(entity, 'CREATED');
  }

  /**
   * Track entity update.
   * @param entity - Entity with at least an `id` and optionally `__typename`
   */
  trackUpdate(entity: TrackedEntity | Record<string, unknown>): void {
    this.ensureTransaction();
    const typename = this.getEntityType(entity);
    const entityId = this.getEntityId(entity);
    this.log.debug('Entity updated', { typename, id: entityId, operation: 'UPDATED' });
    this.trackEntity(entity, 'UPDATED');
  }

  /**
   * Track entity deletion.
   */
  trackDelete(typename: string, entityId: string | number): void {
    this.ensureTransaction();
    this.log.debug('Entity deleted', { typename, id: entityId, operation: 'DELETED' });

    const key = `${typename}:${entityId}`;
    this.deletedEntities.add(key);

    // Remove from updated if it was there
    this.updatedEntities.delete(key);
  }

  /**
   * Internal entity tracking with relationship traversal.
   */
  private trackEntity(entity: TrackedEntity | Record<string, unknown>, operation: 'CREATED' | 'UPDATED' | 'DELETED'): void {
    // Check entity limit to prevent memory exhaustion
    if (this.updatedEntities.size >= this.maxEntities) {
      this.entityLimitReached = true;
      return;
    }

    const typename = this.getEntityType(entity);
    const entityId = this.getEntityId(entity);
    const key = `${typename}:${entityId}`;

    // Skip excluded types
    if (this.excludeTypes.has(typename)) {
      return;
    }

    // Note: entityFilter is now applied asynchronously in getCascadeData/endTransaction
    // to support async authorization checks. Validation is still done synchronously here.

    // Validate entity if configured (throws on validation failure)
    if (this.validateEntity) {
      this.validateEntity(entity as TrackedEntity);
    }

    // Skip if already visited
    if (this.visitedEntities.has(key)) {
      return;
    }

    this.visitedEntities.add(key);

    // Store the change
    this.updatedEntities.set(key, {
      entity,
      operation,
      timestamp: Date.now(),
    });

    // Track entity metric
    this.metrics?.increment('entitiesTracked');

    // Traverse relationships if enabled and within depth
    if (this.enableRelationshipTracking && this.currentDepth < this.maxDepth) {
      this.traverseRelationships(entity, operation);
    }
  }

  /**
   * Traverse entity relationships to find cascade effects.
   */
  private traverseRelationships(entity: TrackedEntity | Record<string, unknown>, operation: 'CREATED' | 'UPDATED' | 'DELETED'): void {
    // Stop if entity limit already reached
    if (this.entityLimitReached) {
      return;
    }

    this.currentDepth += 1;
    this.maxDepthReached = Math.max(this.maxDepthReached, this.currentDepth);

    try {
      const relatedEntities = this.getRelatedEntities(entity);

      // Apply breadth limit per entity
      const limitedRelated = relatedEntities.slice(0, this.maxRelatedPerEntity);

      for (const relatedEntity of limitedRelated) {
        if (relatedEntity != null && !this.entityLimitReached) {
          // Related entities are typically UPDATED
          this.trackEntity(relatedEntity, 'UPDATED');
        }
      }
    } finally {
      this.currentDepth -= 1;
    }
  }

  /**
   * Get related entities for an entity.
   */
  private getRelatedEntities(entity: Record<string, unknown>): (TrackedEntity | Record<string, unknown>)[] {
    const related: (TrackedEntity | Record<string, unknown>)[] = [];

    // Try different methods to get related entities
    if (typeof entity.getRelatedEntities === 'function') {
      // Custom method
      related.push(...entity.getRelatedEntities());
    } else if (entity && typeof entity === 'object') {
      // Inspect object properties
      for (const [attrName, attrValue] of Object.entries(entity)) {
        if (attrName.startsWith('_')) {
          continue; // Skip private properties
        }

        if (this.isEntity(attrValue)) {
          related.push(attrValue);
        } else if (Array.isArray(attrValue)) {
          // Handle collections
          for (const item of attrValue) {
            if (this.isEntity(item)) {
              related.push(item);
            }
          }
        }
      }
    }

    return related;
  }

  /**
   * Check if an object is a domain entity.
   */
  private isEntity(obj: unknown): obj is TrackedEntity {
    if (obj == null || typeof obj !== 'object') {
      return false;
    }

    const record = obj as Record<string, unknown>;

    // Check for entity characteristics
    const hasId = record.id !== undefined;
    const hasTypename = record.__typename !== undefined || record._typename !== undefined;

    // Exclude basic types and collections
    if (obj instanceof Date || Array.isArray(obj) || obj.constructor === Object) {
      return false;
    }

    return hasId && hasTypename;
  }

  /**
   * Get the type name of an entity.
   */
  private getEntityType(entity: TrackedEntity | Record<string, unknown>): string {
    if ('__typename' in entity && typeof entity.__typename === 'string') {
      return entity.__typename;
    } else if ('_typename' in entity && typeof entity._typename === 'string') {
      return entity._typename;
    } else {
      return (entity as { constructor?: { name?: string } }).constructor?.name ?? 'Unknown';
    }
  }

  /**
   * Get the ID of an entity.
   */
  private getEntityId(entity: TrackedEntity | Record<string, unknown>): string {
    if (entity.id !== undefined) {
      return String(entity.id);
    } else {
      throw new CascadeError(
        `Entity has no 'id' attribute`,
        CascadeErrorCode.MISSING_ID,
        'Ensure your entity has an id field',
        '/docs/server/entity-identification'
      );
    }
  }

  /**
   * Ensure we're in a transaction.
   */
  private ensureTransaction(): void {
    if (!this.inTransaction) {
      throw new CascadeError(
        'No cascade transaction in progress',
        CascadeErrorCode.NO_TRANSACTION,
        'Use CascadeTransaction context manager or call startTransaction()',
        '/docs/server/node#transactions'
      );
    }
  }

  /**
   * Build the updated entities list for cascade response (async version with entity filtering).
   */
  private async buildUpdatedEntitiesAsync(): Promise<TrackerCascadeData['updated']> {
    const updated: TrackerCascadeData['updated'] = [];

    for (const change of this.updatedEntities.values()) {
      try {
        let entity = change.entity;
        const typename = this.getEntityType(entity);
        const entityId = this.getEntityId(entity);

        // Apply entity filter if configured (supports async)
        if (this.entityFilter) {
          const shouldInclude = await this.entityFilter(entity as TrackedEntity, this.context);
          if (!shouldInclude) {
            continue;
          }
        }

        // Apply transform if configured
        if (this.transformEntity) {
          entity = this.transformEntity(entity as TrackedEntity);
        }

        const entityDict = this.entityToDict(entity);
        updated.push({
          __typename: typename,
          id: entityId,
          operation: change.operation,
          entity: entityDict,
        });
      } catch (e) {
        this.serializationErrorCount++;
        if (this.onSerializationError) {
          this.onSerializationError(change.entity, e as Error);
        }
        continue;
      }
    }

    return updated;
  }

  /**
   * Build the updated entities list for cascade response (synchronous version for backward compatibility).
   */
  private buildUpdatedEntities(): TrackerCascadeData['updated'] {
    const updated: TrackerCascadeData['updated'] = [];

    for (const change of this.updatedEntities.values()) {
      try {
        let entity = change.entity;
        const typename = this.getEntityType(entity);
        const entityId = this.getEntityId(entity);

        // Apply entity filter if configured (sync only)
        if (this.entityFilter) {
          const result = this.entityFilter(entity as TrackedEntity, this.context);
          // If it's a Promise, we can't handle it here - skip entity filtering in sync mode
          if (result instanceof Promise) {
            this.log.warn('Async entityFilter detected in sync mode - filter not applied. Use getCascadeDataAsync() instead.');
          } else if (!result) {
            continue;
          }
        }

        // Apply transform if configured
        if (this.transformEntity) {
          entity = this.transformEntity(entity as TrackedEntity);
        }

        const entityDict = this.entityToDict(entity);
        updated.push({
          __typename: typename,
          id: entityId,
          operation: change.operation,
          entity: entityDict,
        });
      } catch (e) {
        this.serializationErrorCount++;
        if (this.onSerializationError) {
          this.onSerializationError(change.entity, e as Error);
        }
        continue;
      }
    }

    return updated;
  }

  /**
   * Build the deleted entities list for cascade response.
   */
  private buildDeletedEntities(): TrackerCascadeData['deleted'] {
    const deleted: TrackerCascadeData['deleted'] = [];

    for (const key of this.deletedEntities) {
      const [typename, entityId] = key.split(':');
      deleted.push({
        __typename: typename,
        id: entityId,
        deletedAt: new Date().toISOString(),
      });
    }

    return deleted;
  }

  /**
   * Convert entity to dictionary.
   */
  private entityToDict(entity: TrackedEntity | Record<string, unknown>): Record<string, unknown> {
    if (typeof (entity as { toDict?: () => Record<string, unknown> }).toDict === 'function') {
      const dict = (entity as { toDict: () => Record<string, unknown> }).toDict();
      // Apply field filter to toDict result if configured
      if (this.fieldFilter) {
        const typename = this.getEntityType(entity);
        const filtered: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(dict)) {
          if (this.fieldFilter(typename, key, value)) {
            filtered[key] = value;
          }
        }
        return filtered;
      }
      return dict;
    } else if (entity && typeof entity === 'object') {
      // Basic object serialization
      const result: Record<string, unknown> = {};
      const typename = this.getEntityType(entity);
      for (const [key, value] of Object.entries(entity)) {
        if (!key.startsWith('_')) { // Skip private properties
          // Apply field filter if configured
          if (this.fieldFilter && !this.fieldFilter(typename, key, value)) {
            continue;
          }
          result[key] = this.serializeValue(value);
        }
      }
      return result;
    } else {
      throw new CascadeError(
        `Cannot serialize entity`,
        CascadeErrorCode.SERIALIZATION_ERROR,
        'Ensure entity implements toDict() method or has serializable properties',
        '/docs/server/entity-identification#serialization'
      );
    }
  }

  /**
   * Serialize a value for JSON.
   */
  private serializeValue(value: unknown): unknown {
    if (value == null) {
      return null;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    } else if (value instanceof Date) {
      return value.toISOString();
    } else if (Array.isArray(value)) {
      return value.map(item => this.serializeValue(item));
    } else if (typeof value === 'object' && value !== null && value.constructor === Object) {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = this.serializeValue(v);
      }
      return result;
    } else if (this.isEntity(value)) {
      // For related entities, just include reference
      return {
        __typename: this.getEntityType(value),
        id: this.getEntityId(value),
      };
    } else {
      // Convert to string as fallback
      return String(value);
    }
  }

  // Iterator methods for streaming
  *getUpdatedStream(): IterableIterator<[TrackedEntity | Record<string, unknown>, string]> {
    for (const change of this.updatedEntities.values()) {
      yield [change.entity, change.operation];
    }
  }

  *getDeletedStream(): IterableIterator<[string, string]> {
    for (const key of this.deletedEntities) {
      const [typename, entityId] = key.split(':');
      yield [typename, entityId];
    }
  }
}

/**
 * Convenience function to create a cascade transaction context manager.
 */
export function trackCascade(config: CascadeTrackerConfig = {}): CascadeTransaction {
  const tracker = new CascadeTracker(config);
  return new CascadeTransaction(tracker);
}