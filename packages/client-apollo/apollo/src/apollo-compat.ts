/**
 * Types and helpers that hold for Apollo Client 3 and 4.
 */
import { ApolloClient, ApolloLink } from "@apollo/client";
import * as ApolloErrors from "@apollo/client/errors";
import type { GraphQLFormattedError } from "graphql";

/** An ApolloClient, whatever its cache shape */
export type AnyApolloClient = InstanceType<typeof ApolloClient>;

/** The cache an ApolloClient holds */
export type AnyApolloCache = AnyApolloClient["cache"];

/** The function a link calls to run the rest of the chain */
export type ForwardFunction = NonNullable<Parameters<ApolloLink["request"]>[1]>;

/** Apollo Client 4's error classes, by name */
const APOLLO_ERRORS = new Set([
  "CombinedGraphQLErrors",
  "CombinedProtocolErrors",
  "LinkError",
  "LocalStateError",
  "ServerError",
  "ServerParseError",
  "UnconventionalError",
]);

/**
 * Whether `error` is an error Apollo Client raised: an ApolloError in
 * Apollo Client 3, one of its error classes in 4.
 */
export function isApolloError(error: unknown): error is Error {
  if (!(error instanceof Error)) return false;
  return (
    ("graphQLErrors" in error && "networkError" in error) ||
    APOLLO_ERRORS.has(error.name)
  );
}

/** The GraphQL errors an Apollo error carries */
export function graphQLErrorsOf(
  error: unknown,
): readonly GraphQLFormattedError[] {
  if (error === null || typeof error !== "object") return [];
  const fields = error as {
    graphQLErrors?: unknown;
    errors?: unknown;
    name?: unknown;
  };
  if (Array.isArray(fields.graphQLErrors)) return fields.graphQLErrors;
  if (fields.name === "CombinedGraphQLErrors" && Array.isArray(fields.errors)) {
    return fields.errors;
  }
  return [];
}

/**
 * Whether an Apollo error comes from the network or transport rather than
 * from the GraphQL response.
 */
export function isNetworkError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  if ("networkError" in error) {
    return (error as { networkError: unknown }).networkError != null;
  }
  const name = (error as { name?: unknown }).name;
  return (
    name === "ServerError" ||
    name === "ServerParseError" ||
    name === "LinkError"
  );
}

/**
 * The error Apollo Client raises for a result's GraphQL errors:
 * CombinedGraphQLErrors in Apollo Client 4, ApolloError in 3.
 */
export function graphQLResultError(
  errors: readonly GraphQLFormattedError[],
): Error {
  const classes = ApolloErrors as unknown as Record<
    string,
    (new (arg: unknown) => Error) | undefined
  >;
  if (classes.CombinedGraphQLErrors) {
    return new classes.CombinedGraphQLErrors({ errors });
  }
  if (classes.ApolloError) {
    return new classes.ApolloError({ graphQLErrors: errors });
  }
  return new Error(errors.map((error) => error.message).join("\n"));
}
