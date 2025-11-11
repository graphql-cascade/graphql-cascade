import { ApolloClient, InMemoryCache, gql, DocumentNode } from '@apollo/client';
import { CascadeCache, QueryInvalidation, InvalidationStrategy, InvalidationScope } from '@graphql-cascade/client';

/**
 * Apollo Client cache adapter for GraphQL Cascade.
 */
export class ApolloCascadeCache implements CascadeCache {
  constructor(private cache: InMemoryCache) {}

  write(typename: string, id: string, data: any): void {
    const cacheId = this.cache.identify({ __typename: typename, id });

    // Write using cache.writeFragment
    this.cache.writeFragment({
      id: cacheId,
      fragment: gql`
        fragment _ on ${typename} {
          ${Object.keys(data).join('\n')}
        }
      `,
      data
    });
  }

  read(typename: string, id: string): any | null {
    const cacheId = this.cache.identify({ __typename: typename, id });
    return this.cache.readFragment({
      id: cacheId,
      fragment: gql`fragment _ on ${typename} { id }`
    });
  }

  evict(typename: string, id: string): void {
    const cacheId = this.cache.identify({ __typename: typename, id });
    this.cache.evict({ id: cacheId });
    this.cache.gc(); // Garbage collect
  }

  invalidate(invalidation: QueryInvalidation): void {
    // Apollo doesn't have direct invalidation API
    // Use evict with broadcast: false
    if (invalidation.queryName) {
      this.cache.evict({ fieldName: invalidation.queryName });
    }
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    // Apollo's refetchQueries requires access to ApolloClient, not just cache
    // This would need to be implemented in the client class
    throw new Error('Refetch requires ApolloClient instance, use ApolloCascadeClient.refetch instead');
  }

  remove(invalidation: QueryInvalidation): void {
    this.invalidate(invalidation);
  }

  identify(entity: any): string {
    return this.cache.identify(entity) || `${entity.__typename}:${entity.id}`;
  }
}