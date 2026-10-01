import { InMemoryCache, DocumentNode } from "@apollo/client";
import { CascadeClient, toCascadeResponse } from "@graphql-cascade/client";
import { ApolloCascadeCache } from "./cache";
import type { AnyApolloClient } from "./apollo-compat";

/**
 * Apollo Client integration for GraphQL Cascade.
 */
export class ApolloCascadeClient extends CascadeClient {
  constructor(private apollo: AnyApolloClient) {
    super(
      new ApolloCascadeCache(apollo.cache as InMemoryCache, apollo),
      (query, variables) => apollo.query({ query, variables }),
    );
  }

  /**
   * Execute a mutation with automatic cascade application.
   */
  async mutate<T = any>(mutation: DocumentNode, variables?: any): Promise<T> {
    const result = await this.apollo.mutate({
      mutation,
      variables,
    });

    const data = result.data as Record<string, unknown>;
    const fieldResult = data[Object.keys(data)[0]];
    const cascadeResponse = toCascadeResponse<T>(fieldResult);
    if (!cascadeResponse) return fieldResult as T;

    this.applyCascade(cascadeResponse);
    return cascadeResponse.data as T;
  }

  /**
   * Execute a query (no cascade processing needed).
   */
  async query<T = any>(query: DocumentNode, variables?: any): Promise<T> {
    const result = await this.apollo.query({
      query,
      variables,
    });
    return result.data as T;
  }

  /**
   * Get the underlying Apollo Client instance.
   */
  getApolloClient(): AnyApolloClient {
    return this.apollo;
  }
}
