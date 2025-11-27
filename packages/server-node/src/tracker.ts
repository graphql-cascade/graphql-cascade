/**
 * GraphQL Cascade Entity Tracker
 *
 * Tracks entity changes during GraphQL mutations for cascade response construction.
 */

import { EntityChange, CascadeTrackerConfig, GraphQLEntity, EntityChangeIterator } from './types';

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
  exit(excType?: any, excValue?: any, excTb?: any): void {
    if (excType === undefined || excType === null) {
      // Normal exit - mark as not in transaction but keep data
      this.tracker.inTransaction = false;
      this.tracker.transactionId = undefined;
      this.tracker.transactionStartTime = undefined;
      (this.tracker as any).trackingStartTime = undefined;
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
   */
  resetTransactionState(): void {
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
  }

  constructor(config: CascadeTrackerConfig = {}) {
    this.maxDepth = config.maxDepth ?? 3;
    this.excludeTypes = new Set(config.excludeTypes ?? []);
    this.enableRelationshipTracking = config.enableRelationshipTracking ?? true;
    this.maxEntities = config.maxEntities ?? 1000;
    this.maxRelatedPerEntity = config.maxRelatedPerEntity ?? 100;
  }

  /**
   * Start a new cascade transaction.
   */
  startTransaction(): string {
    if (this.inTransaction) {
      throw new Error('Transaction already in progress');
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

    return this.transactionId;
  }

  /**
   * End the current transaction and return cascade data.
   */
  endTransaction(): Record<string, any> {
    if (!this.inTransaction && this.updatedEntities.size === 0 && this.deletedEntities.size === 0) {
      throw new Error('No transaction in progress');
    }

    const trackingTime = Date.now() - (this.getTrackingStartTime() ?? 0);
    const wasLimitReached = this.entityLimitReached;

    const cascadeData = {
      updated: this.buildUpdatedEntities(),
      deleted: this.buildDeletedEntities(),
      metadata: {
        transactionId: this.transactionId,
        timestamp: new Date().toISOString(),
        depth: this.maxDepthReached,
        affectedCount: this.updatedEntities.size + this.deletedEntities.size,
        trackingTime,
        truncatedUpdated: wasLimitReached,
      },
    };

    // Reset state
    this.resetTransactionState();

    return cascadeData;
  }



  /**
   * Get cascade data without ending the transaction.
   */
  getCascadeData(): Record<string, any> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }

    const trackingTime = Date.now() - (this.getTrackingStartTime() ?? 0);

    return {
      updated: this.buildUpdatedEntities(),
      deleted: this.buildDeletedEntities(),
      metadata: {
        transactionId: this.transactionId,
        timestamp: new Date().toISOString(),
        depth: this.maxDepthReached,
        affectedCount: this.updatedEntities.size + this.deletedEntities.size,
        trackingTime,
        truncatedUpdated: this.entityLimitReached,
      },
    };
  }

  /**
   * Track entity creation.
   */
  trackCreate(entity: any): void {
    this.ensureTransaction();
    this.trackEntity(entity, 'CREATED');
  }

  /**
   * Track entity update.
   */
  trackUpdate(entity: any): void {
    this.ensureTransaction();
    this.trackEntity(entity, 'UPDATED');
  }

  /**
   * Track entity deletion.
   */
  trackDelete(typename: string, entityId: string | number): void {
    this.ensureTransaction();

    const key = `${typename}:${entityId}`;
    this.deletedEntities.add(key);

    // Remove from updated if it was there
    this.updatedEntities.delete(key);
  }

  /**
   * Internal entity tracking with relationship traversal.
   */
  private trackEntity(entity: any, operation: 'CREATED' | 'UPDATED' | 'DELETED'): void {
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

    // Traverse relationships if enabled and within depth
    if (this.enableRelationshipTracking && this.currentDepth < this.maxDepth) {
      this.traverseRelationships(entity, operation);
    }
  }

  /**
   * Traverse entity relationships to find cascade effects.
   */
  private traverseRelationships(entity: any, operation: 'CREATED' | 'UPDATED' | 'DELETED'): void {
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
  private getRelatedEntities(entity: any): any[] {
    const related: any[] = [];

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
  private isEntity(obj: any): boolean {
    if (obj == null || typeof obj !== 'object') {
      return false;
    }

    // Check for entity characteristics
    const hasId = obj.id !== undefined;
    const hasTypename = obj.__typename !== undefined || obj._typename !== undefined;

    // Exclude basic types and collections
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' ||
        obj instanceof Date || Array.isArray(obj) || obj.constructor === Object) {
      return false;
    }

    return hasId && hasTypename;
  }

  /**
   * Get the type name of an entity.
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
   * Get the ID of an entity.
   */
  private getEntityId(entity: any): string {
    if (entity.id !== undefined) {
      return String(entity.id);
    } else {
      throw new Error(`Entity ${entity} has no 'id' attribute`);
    }
  }

  /**
   * Ensure we're in a transaction.
   */
  private ensureTransaction(): void {
    if (!this.inTransaction) {
      throw new Error(
        'No cascade transaction in progress. Use CascadeTransaction context manager.'
      );
    }
  }

  /**
   * Build the updated entities list for cascade response.
   */
  private buildUpdatedEntities(): Record<string, any>[] {
    const updated: Record<string, any>[] = [];

    for (const change of this.updatedEntities.values()) {
      try {
        const entityDict = this.entityToDict(change.entity);
        updated.push({
          __typename: this.getEntityType(change.entity),
          id: this.getEntityId(change.entity),
          operation: change.operation,
          entity: entityDict,
        });
      } catch (e) {
        // Log error but continue
        console.error(`Error serializing entity: ${e}`);
        continue;
      }
    }

    return updated;
  }

  /**
   * Build the deleted entities list for cascade response.
   */
  private buildDeletedEntities(): Record<string, any>[] {
    const deleted: Record<string, any>[] = [];

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
  private entityToDict(entity: any): Record<string, any> {
    if (typeof entity.toDict === 'function') {
      return entity.toDict();
    } else if (entity && typeof entity === 'object') {
      // Basic object serialization
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(entity)) {
        if (!key.startsWith('_')) { // Skip private properties
          result[key] = this.serializeValue(value);
        }
      }
      return result;
    } else {
      throw new Error(`Cannot serialize entity ${entity}`);
    }
  }

  /**
   * Serialize a value for JSON.
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
  *getUpdatedStream(): IterableIterator<[any, string]> {
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