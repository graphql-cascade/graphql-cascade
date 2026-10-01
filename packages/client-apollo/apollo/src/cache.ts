import { gql } from "@apollo/client/core";
import { fieldNameFromStoreName } from "@apollo/client/cache";
import { isReference } from "@apollo/client/utilities";
import {
  CascadeCache,
  QueryInvalidation,
  invalidationMatches,
} from "@graphql-cascade/client";
import type { AnyApolloCache, AnyApolloClient } from "./apollo-compat";

// Counter for generating unique fragment names
let fragmentCounter = 0;

/**
 * Generate a unique fragment name to avoid Apollo's duplicate fragment warnings
 */
function getUniqueFragmentName(typename: string): string {
  return `${typename}_CascadeFrag_${++fragmentCounter}`;
}

/**
 * Apollo Client cache adapter implementing the CascadeCache interface.
 * Handles entity-level cache operations for cascade updates.
 */
export class ApolloCascadeCache implements CascadeCache {
  /**
   * @param cache - The cache cascades are applied to
   * @param client - The client whose queries `REFETCH` hints refetch; without
   *   one, `REFETCH` hints evict like `INVALIDATE`, and queries refetch on
   *   their next read
   */
  constructor(
    private cache: AnyApolloCache,
    private client?: AnyApolloClient,
  ) {}

  write(typename: string, id: string, data: any): void {
    const cacheId = this.cache.identify({ __typename: typename, id });
    if (!cacheId) return;

    const fields = Object.keys(data).filter((k) => k !== "__typename");
    if (fields.length === 0) return;

    const fragmentName = getUniqueFragmentName(typename);
    const fragmentFields = fields.join("\n          ");

    this.cache.writeFragment({
      id: cacheId,
      fragment: gql`
        fragment ${fragmentName} on ${typename} {
          ${fragmentFields}
        }
      `,
      data: { ...data, __typename: typename },
    });
  }

  /**
   * The entity's stored fields, including optimistic writes, with nested
   * entities as references; null if the entity is not cached.
   */
  read(typename: string, id: string): any | null {
    const cacheId = this.cache.identify({ __typename: typename, id });
    if (!cacheId) return null;
    const stored = (this.cache.extract(true) as Record<string, unknown>)[
      cacheId
    ];
    return stored ? { ...stored } : null;
  }

  evict(typename: string, id: string): void {
    const cacheId = this.cache.identify({ __typename: typename, id });
    if (cacheId) {
      this.cache.evict({ id: cacheId });
      this.cache.gc();
    }
  }

  invalidate(invalidation: QueryInvalidation): void {
    this.evictQueries(invalidation);
  }

  /**
   * Evict every entity of `typename`, plus every field that references one or
   * holds an empty list (which may be missing new entities of the type).
   * Queries reading an evicted field refetch on their next read.
   */
  invalidateType(typename: string): void {
    const store = this.cache.extract() as Record<
      string,
      Record<string, unknown>
    >;

    const mayContainType = (value: unknown): boolean => {
      if (Array.isArray(value)) {
        return value.length === 0 || value.some(mayContainType);
      }
      if (isReference(value)) {
        return store[value.__ref]?.__typename === typename;
      }
      if (value !== null && typeof value === "object") {
        return (
          (value as { __typename?: unknown }).__typename === typename ||
          Object.values(value).some(mayContainType)
        );
      }
      return false;
    };

    for (const [id, object] of Object.entries(store)) {
      if (object.__typename === typename) {
        this.cache.evict({ id });
        continue;
      }
      for (const [storeFieldName, value] of Object.entries(object)) {
        if (storeFieldName !== "__typename" && mayContainType(value)) {
          this.cache.evict({
            id,
            fieldName: fieldNameFromStoreName(storeFieldName),
          });
        }
      }
    }
    this.cache.gc();
  }

  /**
   * Evict the root query fields the invalidation selects, and refetch the
   * active queries that read them.
   */
  async refetch(invalidation: QueryInvalidation): Promise<void> {
    if (!this.client) {
      this.evictQueries(invalidation);
      return;
    }
    await this.client.refetchQueries({
      updateCache: (cache) => evictQueries(cache, invalidation),
    });
  }

  remove(invalidation: QueryInvalidation): void {
    this.evictQueries(invalidation);
  }

  identify(entity: any): string {
    return this.cache.identify(entity) || `${entity.__typename}:${entity.id}`;
  }

  private evictQueries(invalidation: QueryInvalidation): void {
    evictQueries(this.cache, invalidation);
  }
}

/**
 * Evict the root query fields the invalidation's scope selects. Queries
 * reading an evicted field refetch on their next read.
 */
function evictQueries(
  cache: AnyApolloCache,
  invalidation: QueryInvalidation,
): void {
  cache.modify({
    id: "ROOT_QUERY",
    fields: (value, { fieldName, storeFieldName, DELETE }) =>
      fieldName !== "__typename" &&
      selectsField(invalidation, fieldName, storeFieldName)
        ? DELETE
        : value,
  });
  cache.gc();
}

/**
 * Whether the hint selects a root field stored as `storeFieldName`, such as
 * `getUser({"id":"1"})`. A field whose arguments cannot be read is selected
 * by name alone: invalidating too much is safe, too little is not.
 */
function selectsField(
  invalidation: QueryInvalidation,
  fieldName: string,
  storeFieldName: string,
): boolean {
  const args = storeFieldArguments(fieldName, storeFieldName);
  return args === undefined
    ? invalidationMatches({ ...invalidation, arguments: undefined }, fieldName)
    : invalidationMatches(invalidation, fieldName, args);
}

/**
 * The arguments encoded in a store field name, `{}` for a field without
 * any, or undefined when a custom key hides them.
 */
function storeFieldArguments(
  fieldName: string,
  storeFieldName: string,
): Record<string, unknown> | undefined {
  const suffix = storeFieldName.slice(fieldName.length);
  if (suffix === "") return {};
  const json =
    suffix.startsWith("(") && suffix.endsWith(")")
      ? suffix.slice(1, -1)
      : suffix.startsWith(":")
        ? suffix.slice(1)
        : undefined;
  if (json === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
