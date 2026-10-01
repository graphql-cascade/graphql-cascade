/**
 * GraphQL Cascade Entity Tracker
 *
 * Tracks entity changes during GraphQL mutations for cascade response construction.
 */

import {
  EntityChange,
  CascadeTrackerConfig,
  GraphQLEntity,
  EntityChangeIterator,
  TrackedEntity,
  CascadeLoggerInterface,
  TrackerCascadeData,
  CascadeMetadata,
  CascadeErrorCode,
} from "./types";
import { CascadeError } from "./errors";
import { silentLogger, createScopedLogger } from "./logger";
import type { MetricsCollector } from "./metrics";

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
      (
        this.tracker as unknown as { trackingStartTime?: number }
      ).trackingStartTime = undefined;
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
/**
 * Thrown when an async `entityFilter` meets a synchronous build, which cannot
 * await it: skipping the filter would bypass an authorization check.
 */
export class AsyncEntityFilterError extends Error {
  constructor() {
    super(
      "entityFilter is async: build the response with buildResponseAsync()",
    );
    this.name = "AsyncEntityFilterError";
  }
}

/**
 * Tracked changes at a point in a transaction; see `CascadeTracker.checkpoint`.
 */
export interface TrackerCheckpoint {
  readonly updatedEntities: ReadonlyMap<string, EntityChange>;
  readonly deletedEntities: ReadonlySet<string>;
  readonly visitedEntities: ReadonlySet<string>;
  readonly maxDepthReached: number;
  readonly entityLimitReached: boolean;
  readonly overflowKeys: ReadonlySet<string>;
  readonly overflowByType: ReadonlyMap<string, number>;
}

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
  private fieldFilter?: (
    typename: string,
    fieldName: string,
    value: unknown,
  ) => boolean;
  private entityFilter?: (
    entity: TrackedEntity,
    context?: unknown,
  ) => boolean | Promise<boolean>;
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
  private overflowKeys: Set<string> = new Set();
  private overflowByType: Map<string, number> = new Map();

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
   * Record the tracked changes so far, to undo later changes with `restore`.
   * Used to drop the changes of a mutation field that fails while others in
   * the same operation succeed.
   */
  checkpoint(): TrackerCheckpoint {
    return {
      updatedEntities: new Map(this.updatedEntities),
      deletedEntities: new Set(this.deletedEntities),
      visitedEntities: new Set(this.visitedEntities),
      maxDepthReached: this.maxDepthReached,
      entityLimitReached: this.entityLimitReached,
      overflowKeys: new Set(this.overflowKeys),
      overflowByType: new Map(this.overflowByType),
    };
  }

  /**
   * Undo every change tracked since `checkpoint` was taken.
   */
  restore(checkpoint: TrackerCheckpoint): void {
    this.updatedEntities = new Map(checkpoint.updatedEntities);
    this.deletedEntities = new Set(checkpoint.deletedEntities);
    this.visitedEntities = new Set(checkpoint.visitedEntities);
    this.maxDepthReached = checkpoint.maxDepthReached;
    this.entityLimitReached = checkpoint.entityLimitReached;
    this.overflowKeys = new Set(checkpoint.overflowKeys);
    this.overflowByType = new Map(checkpoint.overflowByType);
  }

  /**
   * Internal reset with optional failure tracking.
   */
  private resetTransactionStateInternal(recordFailure: boolean): void {
    if (recordFailure && this.inTransaction) {
      this.metrics?.increment("transactionsFailed");
      this.activeTransactionCount = Math.max(
        0,
        this.activeTransactionCount - 1,
      );
      this.metrics?.gauge("activeTransactions", this.activeTransactionCount);
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
    this.overflowKeys.clear();
    this.overflowByType.clear();
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
      this.log = createScopedLogger("[Cascade:Tracker]");
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
        "Transaction already in progress",
        CascadeErrorCode.TRANSACTION_IN_PROGRESS,
        "Call endTransaction() first or create a new CascadeTracker instance",
        "/docs/server/node#transactions",
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
    this.metrics?.increment("transactionsStarted");
    this.activeTransactionCount++;
    this.metrics?.gauge("activeTransactions", this.activeTransactionCount);

    this.log.debug("Transaction started", {
      transactionId: this.transactionId,
    });

    return this.transactionId;
  }

  /**
   * End the current transaction and return its cascade data, applying an
   * async `entityFilter`.
   */
  async endTransactionAsync(): Promise<TrackerCascadeData> {
    this.ensureEndable();
    return this.finish(this.assemble(await this.buildUpdatedAsync()));
  }

  /**
   * End the current transaction and return its cascade data. Throws
   * AsyncEntityFilterError with an async `entityFilter`; use
   * endTransactionAsync() then.
   */
  endTransaction(): TrackerCascadeData {
    this.ensureEndable();
    return this.finish(this.assemble(this.buildUpdated()));
  }

  /**
   * Get cascade data without ending the transaction, applying an async
   * `entityFilter`.
   */
  async getCascadeDataAsync(): Promise<TrackerCascadeData> {
    if (!this.inTransaction) {
      throw new Error("No transaction in progress");
    }
    return this.assemble(await this.buildUpdatedAsync());
  }

  /**
   * Get cascade data without ending the transaction. Throws
   * AsyncEntityFilterError with an async `entityFilter`; use
   * getCascadeDataAsync() then.
   */
  getCascadeData(): TrackerCascadeData {
    if (!this.inTransaction) {
      throw new Error("No transaction in progress");
    }
    return this.assemble(this.buildUpdated());
  }

  /**
   * A tracked change's cascade entry, after the configured filters:
   * `entityFilter`, then `transformEntity`, then serialization with
   * `fieldFilter`. Returns `excluded` when the filter leaves the entity out,
   * and `unserializable` when it cannot be serialized; such an entity must
   * be covered by a type invalidation. Throws AsyncEntityFilterError with an
   * async `entityFilter`.
   */
  prepareUpdated(change: EntityChange): PreparedChange {
    let included: boolean | Promise<boolean>;
    try {
      included =
        this.entityFilter?.(change.entity as TrackedEntity, this.context) ??
        true;
    } catch (error) {
      return this.filterFailed(change, error);
    }
    // An async filter cannot run here. Including the entity would bypass an
    // authorization check, so refuse instead.
    if (included instanceof Promise) {
      included.catch(() => undefined);
      throw new AsyncEntityFilterError();
    }
    return included ? this.serializeChange(change) : { excluded: true };
  }

  /**
   * Entities dropped by the `maxEntities` limit so far, counted by type name.
   */
  getOverflow(): Record<string, number> {
    return Object.fromEntries(this.overflowByType);
  }

  /**
   * Track entity creation.
   * @param entity - Entity with at least an `id` and optionally `__typename`
   */
  trackCreate(entity: TrackedEntity | Record<string, unknown>): void {
    this.ensureTransaction();
    const typename = this.getEntityType(entity);
    const entityId = this.getEntityId(entity);
    this.log.debug("Entity created", {
      typename,
      id: entityId,
      operation: "CREATED",
    });
    this.trackEntity(entity, "CREATED");
  }

  /**
   * Track entity update.
   * @param entity - Entity with at least an `id` and optionally `__typename`
   */
  trackUpdate(
    entity: TrackedEntity | Record<string, unknown>,
    options: { updatedFields?: readonly string[] } = {},
  ): void {
    this.ensureTransaction();
    const typename = this.getEntityType(entity);
    const entityId = this.getEntityId(entity);
    this.log.debug("Entity updated", {
      typename,
      id: entityId,
      operation: "UPDATED",
    });
    this.trackEntity(entity, "UPDATED", options.updatedFields);
  }

  /**
   * Track entity deletion.
   */
  trackDelete(typename: string, entityId: string | number): void {
    this.ensureTransaction();
    this.log.debug("Entity deleted", {
      typename,
      id: entityId,
      operation: "DELETED",
    });

    const key = `${typename}:${entityId}`;
    this.deletedEntities.add(key);

    // Remove from updated if it was there
    this.updatedEntities.delete(key);
    if (this.overflowKeys.delete(key)) {
      this.decrementOverflow(typename);
    }
  }

  /**
   * Internal entity tracking with relationship traversal.
   */
  private trackEntity(
    entity: TrackedEntity | Record<string, unknown>,
    operation: "CREATED" | "UPDATED" | "DELETED",
    updatedFields?: readonly string[],
  ): void {
    const typename = this.getEntityType(entity);

    // Skip excluded types
    if (this.excludeTypes.has(typename)) {
      return;
    }

    // Past the entity limit, only count what is dropped so the response can
    // cover it with a type invalidation instead of losing it.
    if (this.updatedEntities.size >= this.maxEntities) {
      this.entityLimitReached = true;
      this.recordOverflow(entity, typename);
      return;
    }

    const entityId = this.getEntityId(entity);
    const key = `${typename}:${entityId}`;

    // Note: entityFilter is now applied asynchronously in getCascadeData/endTransaction
    // to support async authorization checks. Validation is still done synchronously here.

    // Validate entity if configured (throws on validation failure)
    if (this.validateEntity) {
      this.validateEntity(entity as TrackedEntity);
    }

    // Skip if already visited, keeping every field an update reported. The
    // entry is replaced, not mutated, so checkpoints stay valid.
    if (this.visitedEntities.has(key)) {
      const existing = this.updatedEntities.get(key);
      if (existing?.operation === "UPDATED" && updatedFields) {
        this.updatedEntities.set(key, {
          ...existing,
          updatedFields: [
            ...new Set([...(existing.updatedFields ?? []), ...updatedFields]),
          ],
        });
      }
      return;
    }

    this.visitedEntities.add(key);

    // Store the change
    this.updatedEntities.set(key, {
      entity,
      operation,
      timestamp: Date.now(),
      ...(operation === "UPDATED" &&
        updatedFields && { updatedFields: [...updatedFields] }),
    });

    // Track entity metric
    this.metrics?.increment("entitiesTracked");

    // Traverse relationships if enabled and within depth
    if (this.enableRelationshipTracking && this.currentDepth < this.maxDepth) {
      this.traverseRelationships(entity, operation);
    }
  }

  /**
   * Traverse entity relationships to find cascade effects.
   */
  private traverseRelationships(
    entity: TrackedEntity | Record<string, unknown>,
    operation: "CREATED" | "UPDATED" | "DELETED",
  ): void {
    this.currentDepth += 1;
    this.maxDepthReached = Math.max(this.maxDepthReached, this.currentDepth);

    try {
      const relatedEntities = this.getRelatedEntities(entity);

      // Apply breadth limit per entity
      const limitedRelated = relatedEntities.slice(0, this.maxRelatedPerEntity);

      for (const relatedEntity of limitedRelated) {
        if (relatedEntity != null) {
          // Related entities are typically UPDATED
          this.trackEntity(relatedEntity, "UPDATED");
        }
      }
    } finally {
      this.currentDepth -= 1;
    }
  }

  /**
   * Get related entities for an entity.
   */
  private getRelatedEntities(
    entity: Record<string, unknown>,
  ): (TrackedEntity | Record<string, unknown>)[] {
    const related: (TrackedEntity | Record<string, unknown>)[] = [];

    // Try different methods to get related entities
    if (typeof entity.getRelatedEntities === "function") {
      // Custom method
      related.push(...entity.getRelatedEntities());
    } else if (entity && typeof entity === "object") {
      // Inspect object properties
      for (const [attrName, attrValue] of Object.entries(entity)) {
        if (attrName.startsWith("_")) {
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
    if (obj == null || typeof obj !== "object") {
      return false;
    }

    const record = obj as Record<string, unknown>;

    // An object with a type name and an id is an entity, whether a class
    // instance or a plain object as resolvers and ORMs return them.
    const hasId = record.id !== undefined;
    const hasTypename =
      record.__typename !== undefined || record._typename !== undefined;

    if (obj instanceof Date || Array.isArray(obj)) {
      return false;
    }

    return hasId && hasTypename;
  }

  /**
   * Get the type name of an entity.
   */
  private getEntityType(
    entity: TrackedEntity | Record<string, unknown>,
  ): string {
    if ("__typename" in entity && typeof entity.__typename === "string") {
      return entity.__typename;
    } else if ("_typename" in entity && typeof entity._typename === "string") {
      return entity._typename;
    } else {
      return (
        (entity as { constructor?: { name?: string } }).constructor?.name ??
        "Unknown"
      );
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
        "Ensure your entity has an id field",
        "/docs/server/entity-identification",
      );
    }
  }

  /**
   * Ensure we're in a transaction.
   */
  private ensureTransaction(): void {
    if (!this.inTransaction) {
      throw new CascadeError(
        "No cascade transaction in progress",
        CascadeErrorCode.NO_TRANSACTION,
        "Use CascadeTransaction context manager or call startTransaction()",
        "/docs/server/node#transactions",
      );
    }
  }

  private async prepareUpdatedAsync(
    change: EntityChange,
  ): Promise<PreparedChange> {
    let included: boolean;
    try {
      included =
        (await this.entityFilter?.(
          change.entity as TrackedEntity,
          this.context,
        )) ?? true;
    } catch (error) {
      return this.filterFailed(change, error);
    }
    return included ? this.serializeChange(change) : { excluded: true };
  }

  /** An entity whose filter failed is left out: authorization fails closed. */
  private filterFailed(change: EntityChange, error: unknown): PreparedChange {
    this.log.warn("entityFilter failed; leaving the entity out", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { excluded: true };
  }

  private serializeChange(change: EntityChange): PreparedChange {
    const typename = this.getEntityType(change.entity);
    try {
      const entity = this.transformEntity
        ? this.transformEntity(change.entity as TrackedEntity)
        : change.entity;
      return {
        entry: {
          typename,
          __typename: typename,
          id: this.getEntityId(change.entity),
          operation: change.operation,
          entity: this.entityToDict(entity),
          ...(change.updatedFields && { updatedFields: change.updatedFields }),
        },
      };
    } catch (error) {
      this.onSerializationError?.(change.entity, error as Error);
      return { unserializable: typename };
    }
  }

  private buildUpdated(): BuiltUpdates {
    return collectUpdated(
      [...this.updatedEntities.values()].map((change) =>
        this.prepareUpdated(change),
      ),
    );
  }

  private async buildUpdatedAsync(): Promise<BuiltUpdates> {
    const prepared: PreparedChange[] = [];
    for (const change of this.updatedEntities.values()) {
      prepared.push(await this.prepareUpdatedAsync(change));
    }
    return collectUpdated(prepared);
  }

  /**
   * The cascade data of the current transaction. Entities that could not be
   * serialized are covered by type invalidations, like those past the
   * entity limit.
   */
  private assemble({
    entries,
    unserializable,
  }: BuiltUpdates): TrackerCascadeData {
    const overflow = new Map(this.overflowByType);
    let serializationErrors = 0;
    for (const [typename, count] of unserializable) {
      overflow.set(typename, (overflow.get(typename) ?? 0) + count);
      serializationErrors += count;
    }
    return {
      updated: entries,
      deleted: this.buildDeletedEntities(),
      overflow: Object.fromEntries(overflow),
      metadata: {
        transactionId: this.transactionId,
        timestamp: new Date().toISOString(),
        depth: this.maxDepthReached,
        affectedCount: this.affectedCount(),
        trackingTime: Date.now() - (this.getTrackingStartTime() ?? 0),
        truncated: overflow.size > 0,
        serializationErrors:
          serializationErrors > 0 ? serializationErrors : undefined,
      },
    };
  }

  private ensureEndable(): void {
    if (
      !this.inTransaction &&
      this.updatedEntities.size === 0 &&
      this.deletedEntities.size === 0
    ) {
      throw new CascadeError(
        "No transaction in progress",
        CascadeErrorCode.NO_TRANSACTION,
        "Call startTransaction() before tracking entities",
        "/docs/server/node#transactions",
      );
    }
  }

  /** Record the ended transaction's metrics and reset the tracker. */
  private finish(cascadeData: TrackerCascadeData): TrackerCascadeData {
    const { updated, deleted, metadata } = cascadeData;
    this.metrics?.increment("transactionsCompleted");
    this.metrics?.histogram("trackingTimeMs", metadata.trackingTime);
    this.metrics?.histogram("cascadeSize", updated.length + deleted.length);
    if (this.entityLimitReached) {
      this.metrics?.increment("entitiesTruncated", this.droppedCount());
    }
    this.activeTransactionCount = Math.max(0, this.activeTransactionCount - 1);
    this.metrics?.gauge("activeTransactions", this.activeTransactionCount);
    this.log.debug("Transaction ended", {
      transactionId: this.transactionId,
      updatedCount: updated.length,
      deletedCount: deleted.length,
      trackingTime: metadata.trackingTime,
    });
    this.resetTransactionStateInternal(false);
    return cascadeData;
  }

  /**
   * Build the deleted entities list for cascade response.
   */
  private recordOverflow(
    entity: TrackedEntity | Record<string, unknown>,
    typename: string,
  ): void {
    let key: string | undefined;
    try {
      key = `${typename}:${this.getEntityId(entity)}`;
    } catch {
      key = undefined; // Without an id the entity cannot be deduplicated
    }
    if (key !== undefined) {
      if (
        this.visitedEntities.has(key) ||
        this.deletedEntities.has(key) ||
        this.overflowKeys.has(key)
      ) {
        return;
      }
      this.overflowKeys.add(key);
    }
    this.overflowByType.set(
      typename,
      (this.overflowByType.get(typename) ?? 0) + 1,
    );
  }

  private decrementOverflow(typename: string): void {
    const remaining = (this.overflowByType.get(typename) ?? 0) - 1;
    if (remaining > 0) {
      this.overflowByType.set(typename, remaining);
    } else {
      this.overflowByType.delete(typename);
    }
  }

  private droppedCount(): number {
    let dropped = 0;
    for (const count of this.overflowByType.values()) dropped += count;
    return dropped;
  }

  private affectedCount(): number {
    return (
      this.updatedEntities.size +
      this.deletedEntities.size +
      this.droppedCount()
    );
  }

  private buildDeletedEntities(): TrackerCascadeData["deleted"] {
    const deleted: TrackerCascadeData["deleted"] = [];

    for (const key of this.deletedEntities) {
      const [typename, entityId] = key.split(":");
      deleted.push({
        typename,
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
  private entityToDict(
    entity: TrackedEntity | Record<string, unknown>,
  ): Record<string, unknown> {
    if (
      typeof (entity as { toDict?: () => Record<string, unknown> }).toDict ===
      "function"
    ) {
      const dict = (
        entity as { toDict: () => Record<string, unknown> }
      ).toDict();
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
    } else if (entity && typeof entity === "object") {
      // Basic object serialization
      const result: Record<string, unknown> = {};
      const typename = this.getEntityType(entity);
      for (const [key, value] of Object.entries(entity)) {
        // Skip private properties, but keep GraphQL's __typename
        if (key === "__typename" || !key.startsWith("_")) {
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
        "Ensure entity implements toDict() method or has serializable properties",
        "/docs/server/entity-identification#serialization",
      );
    }
  }

  /**
   * Serialize a value for JSON.
   */
  private serializeValue(value: unknown, seen = new Set<object>()): unknown {
    if (value == null) {
      return null;
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    } else if (value instanceof Date) {
      return value.toISOString();
    } else if (this.isEntity(value)) {
      // Related entities appear as references; they have entries of their own
      return {
        __typename: this.getEntityType(value),
        id: this.getEntityId(value),
      };
    } else if (typeof value === "object") {
      if (seen.has(value)) return null;
      const inner = new Set(seen).add(value);
      if (Array.isArray(value)) {
        return value.map((item) => this.serializeValue(item, inner));
      }
      if (value.constructor === Object) {
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [
            k,
            this.serializeValue(v, inner),
          ]),
        );
      }
    }
    return String(value);
  }

  // Iterator methods for streaming
  *getUpdatedStream(): IterableIterator<
    [TrackedEntity | Record<string, unknown>, string]
  > {
    for (const change of this.updatedEntities.values()) {
      yield [change.entity, change.operation];
    }
  }

  /** The tracked changes, including the fields each update reported. */
  *getUpdatedChanges(): IterableIterator<EntityChange> {
    yield* this.updatedEntities.values();
  }

  *getDeletedStream(): IterableIterator<[string, string]> {
    for (const key of this.deletedEntities) {
      const [typename, entityId] = key.split(":");
      yield [typename, entityId];
    }
  }
}

/**
 * Convenience function to create a cascade transaction context manager.
 */
export function trackCascade(
  config: CascadeTrackerConfig = {},
): CascadeTransaction {
  const tracker = new CascadeTracker(config);
  return new CascadeTransaction(tracker);
}

type UpdatedEntry = TrackerCascadeData["updated"][number];

/** A tracked change after the tracker's filters and serialization */
export type PreparedChange =
  | { entry: UpdatedEntry }
  | { excluded: true }
  | { unserializable: string };

interface BuiltUpdates {
  entries: UpdatedEntry[];
  /** Entities that could not be serialized, counted by type name */
  unserializable: Map<string, number>;
}

function collectUpdated(prepared: Iterable<PreparedChange>): BuiltUpdates {
  const entries: UpdatedEntry[] = [];
  const unserializable = new Map<string, number>();
  for (const change of prepared) {
    if ("entry" in change) {
      entries.push(change.entry);
    } else if ("unserializable" in change) {
      unserializable.set(
        change.unserializable,
        (unserializable.get(change.unserializable) ?? 0) + 1,
      );
    }
  }
  return { entries, unserializable };
}
