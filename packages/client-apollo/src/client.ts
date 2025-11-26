import { ApolloClient, InMemoryCache, gql, DocumentNode } from '@apollo/client';
import { CascadeClient, QueryInvalidation, InvalidationStrategy, InvalidationScope } from '@graphql-cascade/client';
import { ApolloCascadeCache } from './cache';

/**
 * Apollo Client integration for GraphQL Cascade.
 */
export class ApolloCascadeClient extends CascadeClient {
  constructor(private apollo: ApolloClient<any>) {
    super(
      new ApolloCascadeCache(apollo.cache as InMemoryCache),
      (query, variables) => apollo.query({ query, variables })
    );
  }

  /**
   * Execute a mutation with automatic cascade application.
   */
  async mutate<T = any>(
    mutation: DocumentNode,
    variables?: any
  ): Promise<T> {
    const result = await this.apollo.mutate({
      mutation,
      variables
    });

    const mutationName = Object.keys(result.data!)[0];
    const cascadeResponse = result.data![mutationName];

    this.applyCascade(cascadeResponse);

    return cascadeResponse.data;
  }

  /**
   * Execute a query (no cascade processing needed).
   */
  async query<T = any>(
    query: DocumentNode,
    variables?: any
  ): Promise<T> {
    const result = await this.apollo.query({
      query,
      variables
    });
    return result.data;
  }

  /**
   * Refetch queries based on invalidation rules.
   */
  async refetch(invalidation: QueryInvalidation): Promise<void> {
    const queriesToRefetch: string[] = [];

    if (invalidation.scope === InvalidationScope.EXACT && invalidation.queryName) {
      queriesToRefetch.push(invalidation.queryName);
    } else if (invalidation.scope === InvalidationScope.PREFIX && invalidation.queryName) {
      // Apollo doesn't support prefix matching directly
      // This would need custom logic to find matching queries
      console.warn('Prefix invalidation not fully supported in Apollo integration');
    } else if (invalidation.scope === InvalidationScope.ALL) {
      // Refetch all active queries
      await this.apollo.refetchQueries({ include: 'active' });
      return;
    }

    if (queriesToRefetch.length > 0) {
      await this.apollo.refetchQueries({
        include: queriesToRefetch
      });
    }
  }

  /**
   * Get the underlying Apollo Client instance.
   */
  getApolloClient(): ApolloClient<any> {
    return this.apollo;
  }
}

// Usage example (would be in a separate example file)
export const exampleUsage = () => {
  const client = new ApolloClient({
    uri: 'http://localhost:4000/graphql',
    cache: new InMemoryCache()
  });

  const cascade = new ApolloCascadeClient(client);

  // Example mutation
  const updatedUser = cascade.mutate(
    gql`
      mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
        updateUser(id: $id, input: $input) {
          success
          errors { message code }
          data { id name email }
          cascade {
            updated { __typename id operation entity }
            deleted { __typename id }
            invalidations { queryName strategy scope }
            metadata { timestamp affectedCount }
          }
        }
      }
    `,
    { id: '123', input: { name: 'New Name' } }
  );
};