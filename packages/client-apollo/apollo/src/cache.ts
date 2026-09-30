import { ApolloCache, gql } from "@apollo/client";
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
  constructor(private cache: ApolloCache<any>) {}

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

  read(typename: string, id: string): any | null {
    const cacheId = this.cache.identify({ __typename: typename, id });
    if (!cacheId) return null;

    try {
      const fragmentName = getUniqueFragmentName(typename);
      return this.cache.readFragment({
        id: cacheId,
        fragment: gql`
          fragment ${fragmentName} on ${typename} {
            id
            __typename
          }
        `,
      });
    } catch {
      return null;
    }
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

  async refetch(_invalidation: QueryInvalidation): Promise<void> {
    // Apollo's refetchQueries requires access to ApolloClient, not just cache
    // This would need to be implemented in the client class
    throw new Error(
      "Refetch requires ApolloClient instance, use ApolloCascadeClient.refetch instead",
    );
  }

  remove(invalidation: QueryInvalidation): void {
    this.evictQueries(invalidation);
  }

  identify(entity: any): string {
    return this.cache.identify(entity) || `${entity.__typename}:${entity.id}`;
  }

  /**
   * Evict the root query fields the invalidation's scope selects, with all
   * their arguments. Queries reading an evicted field refetch on their next read.
   */
  private evictQueries(invalidation: QueryInvalidation): void {
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

    const rootQuery: Record<string, unknown> =
      this.cache.extract().ROOT_QUERY ?? {};
    const fieldNames = new Set(
      Object.keys(rootQuery)
        .filter((storeFieldName) => storeFieldName !== "__typename")
        .map(fieldNameFromStoreName),
    );
    for (const fieldName of fieldNames) {
      if (matches(fieldName)) {
        this.cache.evict({ id: "ROOT_QUERY", fieldName });
      }
    }
    this.cache.gc();
  }
}
