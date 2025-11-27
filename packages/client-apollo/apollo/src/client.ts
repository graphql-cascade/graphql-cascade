import { ApolloClient, InMemoryCache, gql, DocumentNode } from '@apollo/client';
import { CascadeClient, QueryInvalidation, InvalidationStrategy, InvalidationScope } from '@graphql-cascade/client';
import { ApolloCascadeCache } from './cache';

interface TrackedQuery {
  query: DocumentNode;
  variables?: any;
}

/**
 * Apollo Client integration for GraphQL Cascade.
 */
export class ApolloCascadeClient extends CascadeClient {
  private activeQueries: Map<string, TrackedQuery> = new Map();

  constructor(private apollo: ApolloClient<any>) {
    super(
      new ApolloCascadeCache(apollo.cache as InMemoryCache),
      (query, variables) => apollo.query({ query, variables })
    );
  }

  /**
   * Track a query for invalidation support.
   * Call this when making queries to enable PREFIX/PATTERN scope invalidation.
   */
  trackQuery(queryName: string, query: DocumentNode, variables?: any): void {
    this.activeQueries.set(queryName, { query, variables });
  }

  /**
   * Stop tracking a query.
   */
  untrackQuery(queryName: string): void {
    this.activeQueries.delete(queryName);
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
   * Handle invalidation based on strategy.
   */
  async handleInvalidation(invalidation: QueryInvalidation): Promise<void> {
    switch (invalidation.strategy) {
      case InvalidationStrategy.INVALIDATE:
        this.invalidateQueries(invalidation);
        break;
      case InvalidationStrategy.REFETCH:
        await this.refetch(invalidation);
        break;
      case InvalidationStrategy.REMOVE:
        this.removeQueries(invalidation);
        break;
    }
  }

  /**
   * Invalidate (mark stale) queries based on invalidation rules.
   */
  invalidateQueries(invalidation: QueryInvalidation): void {
    const matchingQueries = this.findMatchingQueries(invalidation);

    for (const queryName of matchingQueries) {
      this.apollo.cache.evict({ fieldName: queryName });
    }

    this.apollo.cache.gc();
  }

  /**
   * Remove queries from cache based on invalidation rules.
   */
  removeQueries(invalidation: QueryInvalidation): void {
    const matchingQueries = this.findMatchingQueries(invalidation);

    for (const queryName of matchingQueries) {
      this.apollo.cache.evict({ fieldName: queryName });
    }

    this.apollo.cache.gc();
  }

  /**
   * Refetch queries based on invalidation rules.
   */
  async refetch(invalidation: QueryInvalidation): Promise<void> {
    const matchingQueries = this.findMatchingQueries(invalidation);

    if (invalidation.scope === InvalidationScope.ALL) {
      await this.apollo.refetchQueries({ include: 'active' });
      return;
    }

    if (matchingQueries.length > 0) {
      await this.apollo.refetchQueries({
        include: matchingQueries
      });
    }
  }

  /**
   * Find queries matching an invalidation pattern.
   */
  private findMatchingQueries(invalidation: QueryInvalidation): string[] {
    const matches: string[] = [];

    switch (invalidation.scope) {
      case InvalidationScope.EXACT:
        if (invalidation.queryName) {
          matches.push(invalidation.queryName);
        }
        break;
      case InvalidationScope.PREFIX:
        if (invalidation.queryName) {
          for (const name of this.activeQueries.keys()) {
            if (name.startsWith(invalidation.queryName)) {
              matches.push(name);
            }
          }
        }
        break;
      case InvalidationScope.PATTERN:
        if (invalidation.queryPattern) {
          try {
            const regex = new RegExp(invalidation.queryPattern);
            for (const name of this.activeQueries.keys()) {
              if (regex.test(name)) {
                matches.push(name);
              }
            }
          } catch (e) {
            console.warn(`Invalid regex pattern: ${invalidation.queryPattern}`);
          }
        }
        break;
      case InvalidationScope.ALL:
        matches.push(...this.activeQueries.keys());
        break;
    }

    return matches;
  }

  /**
   * Check if tracked query variables match the invalidation arguments.
   */
  private variablesMatch(tracked?: any, required?: Record<string, any>): boolean {
    if (!required) return true;
    if (!tracked) return false;
    for (const [key, value] of Object.entries(required)) {
      if (tracked[key] !== value) return false;
    }
    return true;
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