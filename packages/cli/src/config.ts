/**
 * Shape of `cascade.config.ts`, written by `cascade init` and checked by
 * `cascade doctor`.
 */
export interface CascadeConfig {
  /** GraphQL client the project uses */
  client: "apollo" | "react-query" | "relay" | "urql";
  /** Path to the project's GraphQL schema */
  schema: string;
}
