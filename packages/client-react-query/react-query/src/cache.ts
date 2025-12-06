import { QueryClient } from '@tanstack/react-query';
import { CascadeCache, QueryInvalidation, InvalidationScope } from '@graphql-cascade/client';

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
      { predicate: query => this.queryContainsEntity(query, typename, id) },
      oldData => this.updateEntityInData(oldData, typename, id, data)
    );
  }

  read(_typename: string, _id: string): any | null {
    // Can't directly read entities from React Query
    return null;
  }

  evict(typename: string, id: string): void {
    // Remove entity from all queries
    this.queryClient.setQueriesData(
      { predicate: query => this.queryContainsEntity(query, typename, id) },
      oldData => this.removeEntityFromData(oldData, typename, id)
    );
  }

  invalidate(invalidation: QueryInvalidation): void {
    const queryKey = this.invalidationToQueryKey(invalidation);
    this.queryClient.invalidateQueries(queryKey);
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    const queryKey = this.invalidationToQueryKey(invalidation);
    await this.queryClient.refetchQueries(queryKey);
  }

  remove(invalidation: QueryInvalidation): void {
    const queryKey = this.invalidationToQueryKey(invalidation);
    this.queryClient.removeQueries(queryKey);
  }

  identify(entity: any): string {
    return `${entity.__typename}:${entity.id}`;
  }

  private invalidationToQueryKey(invalidation: QueryInvalidation): any {
    if (invalidation.scope === InvalidationScope.EXACT) {
      return [invalidation.queryName, invalidation.arguments];
    } else if (invalidation.scope === InvalidationScope.PREFIX) {
      return { queryKey: [invalidation.queryName] };
    } else if (invalidation.scope === InvalidationScope.PATTERN) {
      return { predicate: (query: any) => this.matchesPattern(query, invalidation) };
    } else {
      return { predicate: () => true }; // Invalidate all
    }
  }

  private matchesPattern(query: any, invalidation: QueryInvalidation): boolean {
    if (!invalidation.queryPattern) return false;
    const queryKey = query.queryKey;
    if (!Array.isArray(queryKey) || queryKey.length === 0) return false;

    const queryName = queryKey[0];
    // Simple glob matching for patterns like "list*", "get*"
    if (invalidation.queryPattern.endsWith('*')) {
      const prefix = invalidation.queryPattern.slice(0, -1);
      return queryName.startsWith(prefix);
    }

    return queryName === invalidation.queryPattern;
  }

  private queryContainsEntity(query: any, typename: string, id: string): boolean {
    // Check if query data contains this entity
    const data = query.state.data;
    return this.searchForEntity(data, typename, id);
  }

  private searchForEntity(data: any, typename: string, id: string): boolean {
    if (!data) return false;
    if (Array.isArray(data)) {
      return data.some(item => this.searchForEntity(item, typename, id));
    }
    if (typeof data === 'object') {
      if (data.__typename === typename && data.id === id) return true;
      return Object.values(data).some(value => this.searchForEntity(value, typename, id));
    }
    return false;
  }

  private updateEntityInData(data: any, typename: string, id: string, newData: any): any {
    if (!data) return data;
    if (Array.isArray(data)) {
      return data.map(item => this.updateEntityInData(item, typename, id, newData));
    }
    if (typeof data === 'object') {
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
        .filter(item => !(item?.__typename === typename && item?.id === id))
        .map(item => this.removeEntityFromData(item, typename, id));
    }
    if (typeof data === 'object') {
      const updated: any = {};
      for (const [key, value] of Object.entries(data)) {
        updated[key] = this.removeEntityFromData(value, typename, id);
      }
      return updated;
    }
    return data;
  }
}