import type { RecordSourceProxy } from "relay-runtime";

/**
 * Relay-specific types for GraphQL Cascade integration.
 */

/**
 * Store updater function that applies cascade updates to Relay's normalized store.
 */
export type CascadeStoreUpdater = (store: RecordSourceProxy) => void;

/**
 * Maps an object to its Relay record ID. Relay's default is the object's
 * `id`; environments configured with another `getDataID` pass the same one to
 * the cascade updater.
 */
export type GetDataID = (
  value: { [key: string]: any },
  typeName: string,
) => unknown;

/** Options for the cascade store updater. */
export interface CascadeUpdaterOptions {
  /** The environment's getDataID, when it isn't Relay's default */
  getDataID?: GetDataID;
  /**
   * Storage keys of the root record's fields, such as `user(id:"1")`, so
   * hints can unset the root fields of the queries they name. Without them,
   * a hint marks every query stale. `commitCascade` reads them from the store.
   */
  rootFields?: readonly string[];
}

/**
 * Relay cascade environment configuration.
 */
export interface RelayCascadeEnvironmentConfig {
  /** Record IDs, when they aren't Relay's default (the object's `id`) */
  getDataID?: GetDataID;
  /** Enable debug logging */
  debug?: boolean;
}
