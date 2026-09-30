import { DocumentNode } from "graphql";
import {
  CascadeCache,
  CascadeError,
  CascadeResponse,
  CascadeUpdates,
  InvalidationScope,
  InvalidationStrategy,
  TypeInvalidation,
} from "./types";
import { logger } from "./logger";

/**
 * Type name of a `cascade.updated` or `cascade.deleted` entry. Reads
 * `typename`, falling back to the `__typename` that servers before
 * specification 1.3.0 send instead.
 */
export function cascadeEntryTypename(entry: {
  typename?: string;
  __typename?: string;
}): string {
  const typename = entry.typename ?? entry.__typename;
  if (typename === undefined) {
    throw new TypeError("Cascade entry has neither typename nor __typename");
  }
  return typename;
}

/**
 * Normalize a mutation field's result to a CascadeResponse, whichever form
 * the server uses:
 * - a 1.x CascadeResponse (`success`, `errors`, `data`, `cascade`);
 * - a CascadePayload (`data`, `cascade`, `warnings`), a success whose
 *   warnings mark a partial success;
 * - a CascadeFailure (`errors`, no cascade): nothing was committed, so the
 *   response carries an empty cascade.
 * Returns undefined for a result that is not a cascade result.
 */
export function toCascadeResponse<T = unknown>(
  result: unknown,
): CascadeResponse<T | null> | undefined {
  if (typeof result !== "object" || result === null) return undefined;
  const fields = result as Record<string, unknown>;
  if (typeof fields.cascade === "object" && fields.cascade !== null) {
    return {
      success: (fields.success as boolean | undefined) ?? true,
      errors: (fields.errors ?? fields.warnings ?? []) as CascadeError[],
      data: (fields.data ?? null) as T | null,
      cascade: fields.cascade as CascadeUpdates,
    };
  }
  if (Array.isArray(fields.errors)) {
    return {
      success: false,
      errors: fields.errors as CascadeError[],
      data: null,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        typeInvalidations: [],
        metadata: {
          timestamp: new Date().toISOString(),
          depth: 0,
          affectedCount: 0,
        },
      },
    };
  }
  return undefined;
}

/**
 * Apply type invalidations to a cache. Uses the cache's `invalidateType`
 * when available; otherwise invalidates every query once, which is always
 * correct, only less precise.
 */
export function applyTypeInvalidations(
  cache: CascadeCache,
  typeInvalidations: TypeInvalidation[] = [],
): void {
  if (typeInvalidations.length === 0) return;
  if (cache.invalidateType) {
    for (const { typename } of typeInvalidations) {
      cache.invalidateType(typename);
    }
    return;
  }
  cache.invalidate({
    strategy: InvalidationStrategy.INVALIDATE,
    scope: InvalidationScope.ALL,
  });
}

/**
 * Generic GraphQL Cascade client.
 */
export class CascadeClient {
  constructor(
    protected cache: CascadeCache,
    protected executor: (query: DocumentNode, variables: any) => Promise<any>,
  ) {}

  /**
   * Apply a cascade response to the cache.
   */
  applyCascade<T = unknown>(response: CascadeResponse<T>): void {
    const { data, cascade } = response;

    // 1. Write primary result
    if (
      data &&
      typeof data === "object" &&
      "__typename" in data &&
      "id" in data
    ) {
      const typename = (data as Record<string, unknown>).__typename as string;
      const id = (data as Record<string, unknown>).id as string;
      this.cache.write(typename, id, data as Record<string, unknown>);
    }

    // 2. Apply all updates
    cascade.updated.forEach((entry) => {
      this.cache.write(cascadeEntryTypename(entry), entry.id, entry.entity);
    });

    // 3. Handle deletions
    cascade.deleted.forEach((entry) => {
      this.cache.evict(cascadeEntryTypename(entry), entry.id);
    });

    // 4. Process invalidations
    cascade.invalidations.forEach((invalidation) => {
      switch (invalidation.strategy) {
        case InvalidationStrategy.INVALIDATE:
          this.cache.invalidate(invalidation);
          break;
        case InvalidationStrategy.REFETCH:
          this.cache.refetch(invalidation).catch((error: unknown) => {
            logger.error(
              `Refetching ${invalidation.queryName ?? invalidation.queryPattern ?? "queries"} failed:`,
              error,
            );
          });
          break;
        case InvalidationStrategy.REMOVE:
          this.cache.remove(invalidation);
          break;
      }
    });

    // 5. Invalidate types whose entities were not listed individually
    applyTypeInvalidations(this.cache, cascade.typeInvalidations);
  }

  /**
   * Execute a mutation and apply the cascade automatically.
   */
  async mutate<T = any>(mutation: DocumentNode, variables?: any): Promise<T> {
    const result = await this.executor(mutation, variables);

    // The mutation result is the first field in data
    const mutationName = Object.keys(result.data)[0];
    const fieldResult = result.data[mutationName];
    const cascadeResponse = toCascadeResponse<T>(fieldResult);
    if (!cascadeResponse) return fieldResult as T;

    this.applyCascade(cascadeResponse);
    return cascadeResponse.data as T;
  }

  /**
   * Execute a query (no cascade processing needed).
   */
  async query<T = any>(query: DocumentNode, variables?: any): Promise<T> {
    const result = await this.executor(query, variables);
    return result.data;
  }

  /**
   * Get the underlying cache instance.
   */
  getCache(): CascadeCache {
    return this.cache;
  }
}
