/**
 * GraphQL Cascade React Query Client Configuration
 *
 * This file sets up the React Query client with GraphQL Cascade integration.
 * Cascade automatically handles cache updates when mutations occur.
 */

import { QueryClient } from '@tanstack/react-query';
import { ReactQueryCascadeClient } from '@graphql-cascade/client-react-query';
import { DocumentNode, print } from 'graphql';

// Create React Query client with sensible defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// GraphQL endpoint (in a real app, this would come from env variables)
const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

/**
 * GraphQL executor function that makes the actual HTTP requests
 * and processes cascade data from the response extensions.
 */
async function graphqlExecutor(query: DocumentNode, variables?: Record<string, any>): Promise<any> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: print(query),
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(result.errors[0].message);
  }

  return result;
}

// Create the Cascade client that wraps React Query
export const cascadeClient = new ReactQueryCascadeClient(queryClient, graphqlExecutor);

/**
 * Helper function to make GraphQL requests with automatic cascade processing.
 *
 * This is the key integration point - it extracts cascade data from the response
 * and applies it to the React Query cache automatically.
 */
export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(result.errors[0].message);
  }

  // The magic: Process cascade data if present in response extensions
  if (result.extensions?.cascade) {
    // Cascade automatically:
    // 1. Updates cached entities
    // 2. Removes deleted entities
    // 3. Invalidates affected queries
    cascadeClient.applyCascade(result.extensions.cascade);
  }

  return result.data;
}
