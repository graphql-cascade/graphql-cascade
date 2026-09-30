import { ApolloCache, ApolloClient, gql } from "@apollo/client";
import { fieldNameFromStoreName } from "@apollo/client/cache";
import { isReference } from "@apollo/client/utilities";
import {
  CascadeCache,
  QueryInvalidation,
  InvalidationScope,
} from "@graphql-cascade/client";

// Counter for generating unique fragment names
let fragmentCounter = 0;

/**
 * Generate a unique fragment name to avoid Apollo's duplicate fragment warnings
 */
function getUniqueFragmentName(typename: string): string {
  return `${typename}_CascadeFrag_${++fragmentCounter}`;
}

/**
 * Match `text` against a glob where `*` matches any run of characters and `?`
 * matches one, in O(pattern × text) time whatever the pattern.
 */
function matchesGlob(pattern: string, text: string): boolean {
  let p = 0;
  let t = 0;
  let starP = -1;
  let starT = 0;
  while (t < text.length) {
    if (p < pattern.length && (pattern[p] === "?" || pattern[p] === text[t])) {
      p++;
      t++;
    } else if (p < pattern.length && pattern[p] === "*") {
      starP = p++;
      starT = t;
    } else if (starP !== -1) {
      p = starP + 1;
      t = ++starT;
    } else {
      return false;
    }
  }
  while (pattern[p] === "*") p++;
  return p === pattern.length;
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
    private cache: ApolloCache<any>,
    private client?: ApolloClient<any>,
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
    const store: Record<string, Record<string, unknown>> = this.cache.extract();

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
 * Evict the root query fields the invalidation's scope selects, with all
 * their arguments. Queries reading an evicted field refetch on their next read.
 */
function evictQueries(
  cache: ApolloCache<any>,
  invalidation: QueryInvalidation,
): void {
  const { queryName, queryPattern } = invalidation;
  let matches: (fieldName: string) => boolean;
  switch (invalidation.scope) {
    case InvalidationScope.EXACT:
      matches = (fieldName) => fieldName === queryName;
      break;
    case InvalidationScope.PREFIX:
      matches = (fieldName) =>
        queryName !== undefined && fieldName.startsWith(queryName);
      break;
    case InvalidationScope.PATTERN:
      matches = (fieldName) =>
        queryPattern !== undefined && matchesGlob(queryPattern, fieldName);
      break;
    case InvalidationScope.ALL:
      matches = () => true;
      break;
  }

  const rootQuery: Record<string, unknown> = cache.extract().ROOT_QUERY ?? {};
  const fieldNames = new Set(
    Object.keys(rootQuery)
      .filter((storeFieldName) => storeFieldName !== "__typename")
      .map(fieldNameFromStoreName),
  );
  for (const fieldName of fieldNames) {
    if (matches(fieldName)) {
      cache.evict({ id: "ROOT_QUERY", fieldName });
    }
  }
  cache.gc();
}
