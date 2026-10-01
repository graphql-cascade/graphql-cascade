/**
 * In-memory CascadeCache for URQLCascadeClient and the cascade exchange.
 */

import { invalidationMatches } from "@graphql-cascade/client";
import { CascadeCache, QueryInvalidation } from "./types";

/**
 * Entity stored in the cache.
 */
interface CacheEntity {
  typename: string;
  id: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

/**
 * Query stored in the cache.
 */
interface CachedQuery {
  name: string;
  args?: Record<string, unknown>;
  data: unknown;
  fetchedAt: number;
  isStale: boolean;
}

/** Where a normalized value refers to an entity */
type EntityRef = { __ref: string };

const isRef = (value: unknown): value is EntityRef =>
  value !== null && typeof value === "object" && "__ref" in value;

/**
 * A normalized in-memory cache: entities are stored once, by type name and
 * id, and query results refer to them, so an entity update shows in every
 * query that holds the entity. Stored entities refer to nested entities as
 * `{ __ref: "Type:id" }`.
 */
export class InMemoryCascadeCache implements CascadeCache {
  private entities: Map<string, CacheEntity> = new Map();
  private queries: Map<string, CachedQuery> = new Map();
  private refetchFn?: (
    queryName: string,
    args?: Record<string, unknown>,
  ) => Promise<void>;

  /**
   * Create a new in-memory cache.
   *
   * @param options - Cache options
   */
  constructor(options?: {
    refetchFn?: (
      queryName: string,
      args?: Record<string, unknown>,
    ) => Promise<void>;
  }) {
    this.refetchFn = options?.refetchFn;
  }

  /**
   * Generate a cache key for an entity.
   */
  private entityKey(typename: string, id: string): string {
    return `${typename}:${id}`;
  }

  /**
   * Generate a cache key for a query.
   */
  private queryKey(name: string, args?: Record<string, unknown>): string {
    if (!args || Object.keys(args).length === 0) {
      return name;
    }
    return `${name}:${JSON.stringify(args)}`;
  }

  /**
   * Write an entity to the cache.
   */
  write(typename: string, id: string, data: Record<string, unknown>): void {
    const key = this.entityKey(typename, id);
    const fields = Object.fromEntries(
      Object.entries(data).map(([field, value]) => [
        field,
        this.normalize(value),
      ]),
    );
    this.entities.set(key, {
      typename,
      id,
      data: {
        ...this.entities.get(key)?.data,
        ...fields,
        __typename: typename,
        id,
      },
      updatedAt: Date.now(),
    });
  }

  /**
   * Read an entity from the cache.
   */
  read(typename: string, id: string): Record<string, unknown> | null {
    const key = this.entityKey(typename, id);
    const entity = this.entities.get(key);
    return entity?.data ?? null;
  }

  /**
   * Evict (remove) an entity from the cache.
   */
  evict(typename: string, id: string): void {
    const key = this.entityKey(typename, id);
    this.entities.delete(key);
  }

  /**
   * Invalidate queries matching the pattern.
   */
  invalidate(invalidation: QueryInvalidation): void {
    const matchingQueries = this.findMatchingQueries(invalidation);
    for (const key of matchingQueries) {
      const query = this.queries.get(key);
      if (query) {
        query.isStale = true;
      }
    }
  }

  /**
   * Refetch queries matching the pattern.
   */
  async refetch(invalidation: QueryInvalidation): Promise<void> {
    if (!this.refetchFn) {
      // If no refetch function, just invalidate
      this.invalidate(invalidation);
      return;
    }

    const matchingQueries = this.findMatchingQueries(invalidation);
    const refetchPromises: Promise<void>[] = [];

    for (const key of matchingQueries) {
      const query = this.queries.get(key);
      if (query) {
        refetchPromises.push(this.refetchFn(query.name, query.args));
      }
    }

    await Promise.all(refetchPromises);
  }

  /**
   * Remove queries from cache.
   */
  remove(invalidation: QueryInvalidation): void {
    const matchingQueries = this.findMatchingQueries(invalidation);
    for (const key of matchingQueries) {
      this.queries.delete(key);
    }
  }

  /**
   * Identify an entity (get cache key).
   */
  identify(entity: Record<string, unknown>): string {
    const typename = entity.__typename as string;
    const id = entity.id as string;
    if (!typename || !id) {
      throw new Error("Entity must have __typename and id fields");
    }
    return this.entityKey(typename, id);
  }

  /**
   * Keys of the stored queries the invalidation hint selects.
   */
  private findMatchingQueries(invalidation: QueryInvalidation): string[] {
    return [...this.queries]
      .filter(([, query]) =>
        invalidationMatches(invalidation, query.name, query.args),
      )
      .map(([key]) => key);
  }

  /**
   * Store a query result.
   */
  storeQuery(
    name: string,
    args: Record<string, unknown> | undefined,
    data: unknown,
  ): void {
    const key = this.queryKey(name, args);
    this.queries.set(key, {
      name,
      args,
      data: this.normalize(data),
      fetchedAt: Date.now(),
      isStale: false,
    });
  }

  /**
   * Get a query result.
   */
  getQuery(
    name: string,
    args?: Record<string, unknown>,
  ): { data: unknown; isStale: boolean } | null {
    const key = this.queryKey(name, args);
    const query = this.queries.get(key);
    if (!query) {
      return null;
    }
    return { data: this.denormalize(query.data), isStale: query.isStale };
  }

  /**
   * Store the entities in `value`, replacing each with a reference.
   */
  private normalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.normalize(item));
    if (value === null || typeof value !== "object" || isRef(value)) {
      return value;
    }
    const object = value as Record<string, unknown>;
    if (
      typeof object.__typename === "string" &&
      (typeof object.id === "string" || typeof object.id === "number")
    ) {
      const id = String(object.id);
      this.write(object.__typename, id, object);
      return { __ref: this.entityKey(object.__typename, id) };
    }
    return Object.fromEntries(
      Object.entries(object).map(([field, nested]) => [
        field,
        this.normalize(nested),
      ]),
    );
  }

  /**
   * Replace references with the entities' current data. References to
   * evicted entities read as null, and drop out of lists; an entity met again
   * inside itself, through a cycle, reads as its type name and id.
   */
  private denormalize(value: unknown, path: string[] = []): unknown {
    if (Array.isArray(value)) {
      return value
        .filter((item) => !isRef(item) || this.entities.has(item.__ref))
        .map((item) => this.denormalize(item, path));
    }
    if (isRef(value)) {
      const entity = this.entities.get(value.__ref);
      if (!entity) return null;
      if (path.includes(value.__ref)) {
        return { __typename: entity.typename, id: entity.id };
      }
      return this.denormalize(entity.data, [...path, value.__ref]);
    }
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value).map(([field, nested]) => [
        field,
        this.denormalize(nested, path),
      ]),
    );
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.entities.clear();
    this.queries.clear();
  }

  /**
   * Get all entities of a specific type.
   */
  getEntitiesByType(typename: string): Record<string, unknown>[] {
    const result: Record<string, unknown>[] = [];
    for (const entity of this.entities.values()) {
      if (entity.typename === typename) {
        result.push(entity.data);
      }
    }
    return result;
  }

  /**
   * Get cache statistics.
   */
  getStats(): {
    entityCount: number;
    queryCount: number;
    staleQueryCount: number;
  } {
    let staleCount = 0;
    for (const query of this.queries.values()) {
      if (query.isStale) {
        staleCount++;
      }
    }
    return {
      entityCount: this.entities.size,
      queryCount: this.queries.size,
      staleQueryCount: staleCount,
    };
  }
}
