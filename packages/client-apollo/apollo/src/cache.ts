import { ApolloCache, gql } from '@apollo/client';
import { CascadeCache, QueryInvalidation, InvalidationScope } from '@graphql-cascade/client';

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
  constructor(private cache: ApolloCache<any>) {}

  write(typename: string, id: string, data: any): void {
    const cacheId = this.cache.identify({ __typename: typename, id });
    if (!cacheId) return;

    const fields = Object.keys(data).filter(k => k !== '__typename');
    if (fields.length === 0) return;

    const fragmentName = getUniqueFragmentName(typename);
    const fragmentFields = fields.join('\n          ');

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
        `
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
    switch (invalidation.scope) {
      case 'EXACT':
        if (invalidation.queryName) {
          this.cache.evict({ fieldName: invalidation.queryName });
          this.cache.gc();
        }
        break;
      case 'PREFIX':
      case 'PATTERN':
        console.warn(`Apollo cache does not support ${invalidation.scope} scope invalidation. Only EXACT scope is supported.`);
        break;
      case 'ALL':
        this.cache.gc();
        break;
    }
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    // Apollo's refetchQueries requires access to ApolloClient, not just cache
    // This would need to be implemented in the client class
    throw new Error('Refetch requires ApolloClient instance, use ApolloCascadeClient.refetch instead');
  }

  remove(invalidation: QueryInvalidation): void {
    switch (invalidation.scope) {
      case 'EXACT':
        if (invalidation.queryName) {
          this.cache.evict({ fieldName: invalidation.queryName });
          this.cache.gc();
        }
        break;
      case 'PREFIX':
      case 'PATTERN':
        console.warn(`Apollo cache does not support ${invalidation.scope} scope removal. Only EXACT scope is supported.`);
        break;
      case 'ALL':
        this.cache.gc();
        break;
    }
  }

  identify(entity: any): string {
    return this.cache.identify(entity) || `${entity.__typename}:${entity.id}`;
  }
}