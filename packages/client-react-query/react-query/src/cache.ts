import { QueryClient } from "@tanstack/react-query";
import {
  CascadeCache,
  QueryInvalidation,
  invalidationMatches,
} from "@graphql-cascade/client";

/**
 * React Query cache adapter for GraphQL Cascade.
 *
 * Note: React Query doesn't have normalized cache,
 * so we focus on query invalidation.
 */
export class ReactQueryCascadeCache implements CascadeCache {
  constructor(private queryClient: QueryClient) {}

  write(typename: string, id: string, data: any): void {
    // React Query stores data by query key, not by entity
    // We update all queries that might contain this entity
    this.queryClient.setQueriesData(
      { predicate: (query) => this.queryContainsEntity(query, typename, id) },
      (oldData) => this.updateEntityInData(oldData, typename, id, data),
    );
  }

  /**
   * The entity's fields, gathered from every cached query result holding
   * it; null if none does.
   */
  read(typename: string, id: string): any | null {
    let entity: Record<string, unknown> | null = null;
    const collect = (data: unknown): void => {
      if (Array.isArray(data)) {
        data.forEach(collect);
      } else if (data !== null && typeof data === "object") {
        const object = data as Record<string, unknown>;
        if (object.__typename === typename && object.id === id) {
          entity = { ...entity, ...object };
        }
        Object.values(object).forEach(collect);
      }
    };
    for (const [, data] of this.queryClient.getQueriesData({})) {
      collect(data);
    }
    return entity;
  }

  evict(typename: string, id: string): void {
    // Remove entity from all queries
    this.queryClient.setQueriesData(
      { predicate: (query) => this.queryContainsEntity(query, typename, id) },
      (oldData) => this.removeEntityFromData(oldData, typename, id),
    );
  }

  invalidate(invalidation: QueryInvalidation): void {
    void this.queryClient.invalidateQueries(this.filters(invalidation));
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    await this.queryClient.refetchQueries(this.filters(invalidation));
  }

  remove(invalidation: QueryInvalidation): void {
    this.queryClient.removeQueries(this.filters(invalidation));
  }

  identify(entity: any): string {
    return `${entity.__typename}:${entity.id}`;
  }

  /**
   * Filters selecting the queries an invalidation hint names. Queries are
   * keyed `[queryName, variables?]`.
   */
  private filters(invalidation: QueryInvalidation) {
    return {
      predicate: ({ queryKey }: { queryKey: readonly unknown[] }) => {
        const [queryName, args] = queryKey;
        return (
          typeof queryName === "string" &&
          invalidationMatches(
            invalidation,
            queryName,
            args as Record<string, unknown> | undefined,
          )
        );
      },
    };
  }

  private queryContainsEntity(
    query: any,
    typename: string,
    id: string,
  ): boolean {
    // Check if query data contains this entity
    const data = query.state.data;
    return this.searchForEntity(data, typename, id);
  }

  private searchForEntity(data: any, typename: string, id: string): boolean {
    if (!data) return false;
    if (Array.isArray(data)) {
      return data.some((item) => this.searchForEntity(item, typename, id));
    }
    if (typeof data === "object") {
      if (data.__typename === typename && data.id === id) return true;
      return Object.values(data).some((value) =>
        this.searchForEntity(value, typename, id),
      );
    }
    return false;
  }

  private updateEntityInData(
    data: any,
    typename: string,
    id: string,
    newData: any,
  ): any {
    if (!data) return data;
    if (Array.isArray(data)) {
      return data.map((item) =>
        this.updateEntityInData(item, typename, id, newData),
      );
    }
    if (typeof data === "object") {
      if (data.__typename === typename && data.id === id) {
        return { ...data, ...newData };
      }
      const updated: any = {};
      for (const [key, value] of Object.entries(data)) {
        updated[key] = this.updateEntityInData(value, typename, id, newData);
      }
      return updated;
    }
    return data;
  }

  private removeEntityFromData(data: any, typename: string, id: string): any {
    if (!data) return data;
    if (Array.isArray(data)) {
      return data
        .filter((item) => !(item?.__typename === typename && item?.id === id))
        .map((item) => this.removeEntityFromData(item, typename, id));
    }
    if (typeof data === "object") {
      const updated: any = {};
      for (const [key, value] of Object.entries(data)) {
        updated[key] = this.removeEntityFromData(value, typename, id);
      }
      return updated;
    }
    return data;
  }
}
