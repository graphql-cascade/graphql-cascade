/**
 * GraphQL Cascade Response Builder
 *
 * Constructs CascadeResponse objects from tracked entity changes.
 */

import { CascadeTracker } from "./tracker";
import {
  CascadeResponse,
  CascadeErrorInfo,
  CascadeBuilderConfig,
  CascadeUpdatedEntity,
  CascadeDeletedEntity,
  CascadeTypeInvalidation,
  InvalidationScope,
  InvalidationStrategy,
  Invalidator,
  QueryInvalidation,
} from "./types";
import type { MetricsCollector } from "./metrics";

type TypedEntry = { typename: string };

/**
 * Remove every entry of `typename` from both lists, adding the number removed
 * to `counts`. The type is then covered by a type invalidation instead.
 */
function collapseType(
  typename: string,
  updated: TypedEntry[],
  deleted: TypedEntry[],
  counts: Map<string, number>,
): void {
  let removed = 0;
  for (const list of [updated, deleted]) {
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].typename === typename) {
        list.splice(i, 1);
        removed++;
      }
    }
  }
  counts.set(typename, (counts.get(typename) ?? 0) + removed);
}

/**
 * The type with the most entries, ties broken by name for stable output.
 */
function largestType(entries: TypedEntry[]): string {
  const counts = new Map<string, number>();
  for (const { typename } of entries) {
    counts.set(typename, (counts.get(typename) ?? 0) + 1);
  }
  return [...counts].sort(
    ([a, countA], [b, countB]) => countB - countA || a.localeCompare(b),
  )[0][0];
}

function toTypeInvalidations(
  counts: Map<string, number>,
): CascadeTypeInvalidation[] {
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([typename, affectedCount]) => ({ typename, affectedCount }));
}

const STRATEGIES = new Set<unknown>(Object.values(InvalidationStrategy));
const SCOPES = new Set<unknown>(Object.values(InvalidationScope));

function isQueryInvalidation(hint: unknown): hint is QueryInvalidation {
  const { strategy, scope } = (hint ?? {}) as Record<string, unknown>;
  return STRATEGIES.has(strategy) && SCOPES.has(scope);
}

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
    config: CascadeBuilderConfig = {},
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
    errors: CascadeErrorInfo[] = [],
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
        overflow: {},
        metadata: {
          timestamp: new Date().toISOString(),
          depth: 0,
          affectedCount: 0,
          trackingTime: 0,
          truncated: false,
        },
      };
    }

    // Compute invalidations if invalidator provided
    let hintsTruncated = false;
    if (this.invalidator && success) {
      try {
        const invalidations = this.computeInvalidations(
          cascadeData.updated,
          cascadeData.deleted,
          primaryResult,
        );
        hintsTruncated = invalidations.length > this.maxInvalidations;
        cascadeData.invalidations = invalidations.slice(
          0,
          this.maxInvalidations,
        );
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
    const processedCascadeData = this.applySizeLimits(
      cascadeData,
      hintsTruncated,
    );

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
    this.metrics?.histogram("constructionTimeMs", constructionTime);

    return response;
  }

  /**
   * Build an error response.
   */
  buildErrorResponse(
    errors: CascadeErrorInfo[],
    primaryResult: any = null,
  ): CascadeResponse {
    const startTime = Date.now();

    // For errors, we still want to track the transaction if it was started
    let cascadeData: any = {
      updated: [],
      deleted: [],
      invalidations: [],
      typeInvalidations: [],
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
      truncated: false,
      constructionTime,
    };
    cascadeData.invalidations = [];
    cascadeData.typeInvalidations = [];
    delete cascadeData.overflow;

    // Apply metadata filtering based on configuration
    if (!this.includeTimingMetadata) {
      delete (cascadeData.metadata as any).trackingTime;
      delete (cascadeData.metadata as any).constructionTime;
    }
    if (!this.includeTransactionId) {
      delete (cascadeData.metadata as any).transactionId;
    }

    // Record construction time metric
    this.metrics?.histogram("constructionTimeMs", constructionTime);

    return {
      success: false,
      data: primaryResult,
      cascade: cascadeData,
      errors,
    };
  }

  /**
   * Enforce size limits without losing information: whole types are moved
   * from the entity lists into type invalidations, largest first, until the
   * response fits. Types dropped by the tracker are covered the same way.
   */
  private applySizeLimits(cascadeData: any, hintsTruncated: boolean): any {
    const updated: TypedEntry[] = cascadeData.updated ?? [];
    const deleted: TypedEntry[] = cascadeData.deleted ?? [];
    const invalidations = cascadeData.invalidations ?? [];
    const counts = new Map<string, number>(
      Object.entries(cascadeData.overflow ?? {}),
    );

    for (const typename of [...counts.keys()]) {
      collapseType(typename, updated, deleted, counts);
    }

    const maxSizeBytes = this.maxResponseSizeMb * 1024 * 1024;
    const listedBeforeLimits = updated.length + deleted.length;
    for (;;) {
      let offending: TypedEntry[];
      if (updated.length > this.maxUpdatedEntities) {
        offending = updated;
      } else if (deleted.length > this.maxDeletedEntities) {
        offending = deleted;
      } else if (
        updated.length + deleted.length > 0 &&
        this.estimateResponseSize(updated, deleted, invalidations) >
          maxSizeBytes
      ) {
        offending = [...updated, ...deleted];
      } else {
        break;
      }
      collapseType(largestType(offending), updated, deleted, counts);
    }

    const collapsedByLimits =
      listedBeforeLimits - updated.length - deleted.length;
    if (collapsedByLimits > 0) {
      this.metrics?.increment("entitiesTruncated", collapsedByLimits);
    }

    // Dropped query hints: invalidating every changed type covers them.
    if (hintsTruncated) {
      for (const { typename } of [...updated, ...deleted]) {
        counts.set(typename, (counts.get(typename) ?? 0) + 1);
      }
    }

    delete cascadeData.overflow;
    cascadeData.updated = updated;
    cascadeData.deleted = deleted;
    cascadeData.invalidations = invalidations;
    cascadeData.typeInvalidations = toTypeInvalidations(counts);
    cascadeData.metadata.truncated = counts.size > 0;

    return cascadeData;
  }

  /**
   * Ask the invalidator for query hints, dropping (and reporting through
   * `onInvalidationError`) any without a valid strategy and scope, which
   * clients could not apply.
   */
  protected computeInvalidations(
    updated: CascadeUpdatedEntity[],
    deleted: CascadeDeletedEntity[],
    primaryResult: unknown,
  ): QueryInvalidation[] {
    const hints: unknown[] =
      this.invalidator?.computeInvalidations(updated, deleted, primaryResult) ??
      [];
    const valid = hints.filter(isQueryInvalidation);
    const dropped = hints.length - valid.length;
    if (dropped > 0) {
      this.onInvalidationError?.(
        new Error(
          `Dropped ${dropped} invalidation hint(s) without a valid strategy and scope`,
        ),
      );
    }
    return valid;
  }

  /**
   * Estimate the JSON size of the cascade data.
   */
  private estimateResponseSize(
    updated: any[],
    deleted: any[],
    invalidations: any[],
  ): number {
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
    errors: CascadeErrorInfo[] = [],
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
        truncated: false,
        streaming: true,
      },
    };

    // Types already covered by a type invalidation, with their entity counts.
    // Once a list is full, each further type is collapsed as it arrives.
    const counts = new Map<string, number>(
      Object.entries(this.tracker.getOverflow()),
    );
    const cover = (typename: string, list: TypedEntry[], max: number) => {
      if (!counts.has(typename) && list.length < max) return false;
      if (!counts.has(typename)) {
        collapseType(
          typename,
          cascadeData.updated,
          cascadeData.deleted,
          counts,
        );
      }
      counts.set(typename, (counts.get(typename) ?? 0) + 1);
      return true;
    };

    // Stream updated entities
    for (const [entity, operation] of this.tracker.getUpdatedStream()) {
      try {
        const typename = this.getEntityType(entity);
        if (cover(typename, cascadeData.updated, this.maxUpdatedEntities)) {
          continue;
        }
        cascadeData.updated.push({
          typename,
          __typename: typename,
          id: this.getEntityId(entity),
          operation,
          entity: this.entityToDict(entity),
        });
      } catch (e) {
        // Skip problematic entities
        continue;
      }
    }

    // Stream deleted entities
    for (const [typename, entityId] of this.tracker.getDeletedStream()) {
      if (cover(typename, cascadeData.deleted, this.maxDeletedEntities)) {
        continue;
      }
      cascadeData.deleted.push({
        typename,
        __typename: typename,
        id: entityId,
        deletedAt: new Date().toISOString(),
      });
    }

    const covered = [...counts.values()].reduce((a, b) => a + b, 0);
    cascadeData.metadata.affectedCount =
      cascadeData.updated.length + cascadeData.deleted.length + covered;

    // Compute invalidations
    if (this.invalidator && success) {
      const invalidations = this.computeInvalidations(
        cascadeData.updated,
        cascadeData.deleted,
        primaryResult,
      );
      cascadeData.invalidations = invalidations.slice(0, this.maxInvalidations);
      // Dropped query hints: invalidating every changed type covers them.
      if (invalidations.length > this.maxInvalidations) {
        for (const { typename } of [
          ...cascadeData.updated,
          ...cascadeData.deleted,
        ]) {
          counts.set(typename, (counts.get(typename) ?? 0) + 1);
        }
      }
    }

    cascadeData.typeInvalidations = toTypeInvalidations(counts);
    cascadeData.metadata.truncated = counts.size > 0;

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
    this.metrics?.histogram("constructionTimeMs", constructionTime);

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
    if (typeof entity.toDict === "function") {
      return entity.toDict();
    } else if (entity && typeof entity === "object") {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(entity)) {
        if (!key.startsWith("_")) {
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
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    } else if (value instanceof Date) {
      return value.toISOString();
    } else if (Array.isArray(value)) {
      return value.map((item) => this.serializeValue(item));
    } else if (typeof value === "object" && value.constructor === Object) {
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
      return entity.constructor?.name ?? "Unknown";
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
  primaryResult: any = null,
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
  primaryResult: any = null,
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
  primaryResult: any = null,
): CascadeResponse {
  const builder = new StreamingCascadeBuilder(tracker, invalidator);
  return builder.buildStreamingResponse(primaryResult, true);
}
