/**
 * URQL Cascade Client.
 *
 * Provides a high-level client for executing GraphQL mutations
 * with automatic cascade processing.
 */

import type { Client, OperationResult, TypedDocumentNode } from "@urql/core";
import type { DocumentNode } from "graphql";
import {
  CascadeCache,
  CascadeUpdates,
  URQLCascadeConfig,
  CascadeOperation,
  InvalidationStrategy,
} from "./types";
import {
  applyTypeInvalidations,
  cascadeEntryTypename,
  normalizeCascade,
  toCascadeResponse,
} from "@graphql-cascade/client";
import { extractCascadeData } from "./exchange";

/**
 * Mutation result with cascade data.
 */
export interface CascadeMutationResult<T> {
  data: T | null;
  error?: Error;
  /**
   * The cascade of the first mutation field (every field's cascade is
   * applied), or `extensions.cascade` when no payload carries one.
   */
  cascade: CascadeUpdates | null;
}

/**
 * Optimistic update configuration.
 */
export interface OptimisticConfig<T, V> {
  /**
   * Generate optimistic response data.
   */
  optimisticResponse: (variables: V) => T;

  /**
   * Generate optimistic cascade updates.
   */
  optimisticCascade?: (variables: V, response: T) => CascadeUpdates;
}

/**
 * URQL client wrapper for GraphQL Cascade.
 *
 * Provides methods for executing mutations with automatic cascade
 * processing and cache updates.
 *
 * @example
 * ```typescript
 * import { createClient } from '@urql/core';
 * import { URQLCascadeClient, InMemoryCascadeCache } from '@graphql-cascade/urql';
 *
 * const urqlClient = createClient({ url: '/graphql' });
 * const cache = new InMemoryCascadeCache();
 * const cascadeClient = new URQLCascadeClient(urqlClient, cache);
 *
 * // Execute a mutation with cascade
 * const result = await cascadeClient.mutate(CREATE_TODO_MUTATION, { title: 'New Todo' });
 * console.log('Created:', result.data);
 * console.log('Cascade:', result.cascade);
 * ```
 */
export class URQLCascadeClient {
  private client: Client;
  private cache: CascadeCache;
  private config: Required<URQLCascadeConfig>;

  constructor(
    client: Client,
    cache: CascadeCache,
    config: URQLCascadeConfig = {},
  ) {
    this.client = client;
    this.cache = cache;
    this.config = {
      autoApply: config.autoApply ?? true,
      excludeTypes: config.excludeTypes ?? [],
    };
  }

  /**
   * Execute a GraphQL mutation and process cascade updates.
   *
   * @param mutation - GraphQL mutation document
   * @param variables - Mutation variables
   * @returns Mutation result with cascade data
   */
  async mutate<
    T = unknown,
    V extends Record<string, unknown> = Record<string, unknown>,
  >(
    mutation: DocumentNode | TypedDocumentNode<T, V>,
    variables?: V,
  ): Promise<CascadeMutationResult<T>> {
    const result = await this.client
      .mutation(mutation, variables ?? ({} as V))
      .toPromise();

    return this.processMutationResult<T>(result);
  }

  /**
   * Execute a mutation with optimistic updates.
   *
   * @param mutation - GraphQL mutation document
   * @param variables - Mutation variables
   * @param optimistic - Optimistic update configuration
   * @returns Mutation result with cascade data
   */
  async mutateOptimistic<
    T = unknown,
    V extends Record<string, unknown> = Record<string, unknown>,
  >(
    mutation: DocumentNode | TypedDocumentNode<T, V>,
    variables: V,
    optimistic: OptimisticConfig<T, V>,
  ): Promise<CascadeMutationResult<T>> {
    // Apply optimistic updates
    const optimisticResponse = optimistic.optimisticResponse(variables);
    const optimisticCascade = optimistic.optimisticCascade?.(
      variables,
      optimisticResponse,
    );

    // Capture rollback data BEFORE applying optimistic updates
    const rollbackData = this.captureRollbackData(optimisticCascade);

    if (optimisticCascade && this.config.autoApply) {
      this.applyCascade(optimisticCascade);
    }

    let result: CascadeMutationResult<T>;
    try {
      result = await this.mutate<T, V>(mutation, variables);
    } catch (error) {
      if (rollbackData) {
        this.rollback(rollbackData);
      }
      throw error;
    }

    // urql resolves failed operations, and failure payloads commit nothing:
    // either way the optimistic changes go. On success, the server's cascade
    // has replaced them.
    if (rollbackData && !succeeded(result)) {
      this.rollback(rollbackData);
    }
    return result;
  }

  /**
   * Process a mutation result and extract cascade data.
   */
  private processMutationResult<T>(
    result: OperationResult,
  ): CascadeMutationResult<T> {
    // Each mutation field's payload carries its own cascade (spec REQ-012),
    // including CascadePayload | CascadeFailure unions. extensions.cascade is
    // the fallback transport, ignored when payloads carry cascades (REQ-040).
    const payloadCascades = Object.values(
      (result.data ?? {}) as Record<string, unknown>,
    )
      .map((field) => toCascadeResponse(field)?.cascade)
      .filter((cascade): cascade is CascadeUpdates => cascade !== undefined);
    const extensionCascade = extractCascadeData(result);
    const cascades =
      payloadCascades.length > 0
        ? payloadCascades
        : extensionCascade
          ? [extensionCascade]
          : [];

    if (this.config.autoApply) {
      cascades.forEach((cascade) => this.applyCascade(cascade));
    }

    return {
      data: result.data as T | null,
      error: result.error,
      cascade: cascades[0] ?? null,
    };
  }

  /**
   * Apply cascade updates to the cache.
   */
  applyCascade(selected: CascadeUpdates): void {
    const cascade = normalizeCascade(selected);
    // Process updated entities
    for (const update of cascade.updated) {
      const typename = cascadeEntryTypename(update);
      // Skip excluded types
      if (this.config.excludeTypes.includes(typename)) {
        continue;
      }

      if (update.operation === CascadeOperation.DELETED) {
        this.cache.evict(typename, update.id);
      } else {
        this.cache.write(typename, update.id, update.entity);
      }
    }

    // Process deleted entities
    for (const deleted of cascade.deleted) {
      const typename = cascadeEntryTypename(deleted);
      if (this.config.excludeTypes.includes(typename)) {
        continue;
      }
      this.cache.evict(typename, deleted.id);
    }

    // Process invalidations
    for (const invalidation of cascade.invalidations) {
      switch (invalidation.strategy) {
        case InvalidationStrategy.INVALIDATE:
          this.cache.invalidate(invalidation);
          break;
        case InvalidationStrategy.REFETCH:
          this.cache.refetch(invalidation).catch(console.error);
          break;
        case InvalidationStrategy.REMOVE:
          this.cache.remove(invalidation);
          break;
      }
    }

    // Invalidate types whose entities were not listed individually
    applyTypeInvalidations(
      this.cache,
      cascade.typeInvalidations?.filter(
        ({ typename }) => !this.config.excludeTypes.includes(typename),
      ),
    );
  }

  /**
   * Capture data needed for rollback.
   */
  private captureRollbackData(
    cascade: CascadeUpdates | undefined,
  ): Map<string, Record<string, unknown> | null> | null {
    if (!cascade) return null;

    const rollback = new Map<string, Record<string, unknown> | null>();

    for (const update of cascade.updated) {
      const typename = cascadeEntryTypename(update);
      const key = `${typename}:${update.id}`;
      const existing = this.cache.read(typename, update.id);
      rollback.set(key, existing);
    }

    return rollback;
  }

  /**
   * Rollback optimistic updates.
   */
  private rollback(
    rollbackData: Map<string, Record<string, unknown> | null>,
  ): void {
    for (const [key, data] of rollbackData) {
      const [typename, id] = key.split(":");
      if (data) {
        this.cache.write(typename, id, data);
      } else {
        this.cache.evict(typename, id);
      }
    }
  }

  /**
   * Get the underlying URQL client.
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Get the cache adapter.
   */
  getCache(): CascadeCache {
    return this.cache;
  }

  /**
   * Get the current configuration.
   */
  getConfig(): Required<URQLCascadeConfig> {
    return { ...this.config };
  }
}

/** Whether a mutation completed without error and every payload succeeded. */
function succeeded(result: CascadeMutationResult<unknown>): boolean {
  return (
    result.error === undefined &&
    Object.values((result.data ?? {}) as Record<string, unknown>).every(
      (field) => toCascadeResponse(field)?.success !== false,
    )
  );
}
