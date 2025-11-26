import { RecordSourceSelectorProxy, MutationConfig, SelectorStoreUpdater } from 'relay-runtime';
import { CascadeResponse, CascadeUpdates, UpdatedEntity, DeletedEntity } from '@graphql-cascade/client';

/**
 * Relay-specific types for GraphQL Cascade integration.
 */

/**
 * Store updater function that applies cascade updates to Relay's normalized store.
 */
export type CascadeStoreUpdater = (store: RecordSourceSelectorProxy) => void;

/**
 * Configuration for generating Relay mutation configs from cascade responses.
 */
export interface CascadeMutationConfig {
  /** The cascade response to generate configs for */
  cascade: CascadeResponse;
  /** Optional mutation config overrides */
  config?: Partial<MutationConfig>;
}

/**
 * Result of generating mutation configs from cascade data.
 */
export interface GeneratedMutationConfigs {
  /** Mutation configs to apply the cascade updates */
  configs: MutationConfig[];
  /** Store updater for immediate application */
  updater?: CascadeStoreUpdater;
}

/**
 * Optimistic response generator for Relay mutations.
 */
export interface OptimisticResponseGenerator {
  /**
   * Generate optimistic response data for a mutation.
   */
  generate<TVariables = any>(
    mutationName: string,
    variables: TVariables,
    optimisticData?: any
  ): any;
}

/**
 * Connection update operations for Relay connections.
 */
export enum ConnectionOperation {
  PREPEND = 'PREPEND',
  APPEND = 'APPEND',
  REMOVE = 'REMOVE',
  REPLACE = 'REPLACE'
}

/**
 * Configuration for updating Relay connections.
 */
export interface ConnectionUpdate {
  /** Connection key (e.g., 'User_todos') */
  connectionKey: string;
  /** Operation to perform */
  operation: ConnectionOperation;
  /** Edges to add/remove */
  edges?: any[];
  /** Node IDs to remove */
  nodeIds?: string[];
  /** Parent record ID */
  parentId?: string;
}

/**
 * Relay cascade environment configuration.
 */
export interface RelayCascadeEnvironmentConfig {
  /** Custom store updater factory */
  createUpdater?: (cascade: CascadeUpdates) => CascadeStoreUpdater;
  /** Custom optimistic response generator */
  optimisticGenerator?: OptimisticResponseGenerator;
  /** Connection update handlers */
  connectionHandlers?: Record<string, (updates: ConnectionUpdate[]) => void>;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Relay cascade client interface.
 */
export interface RelayCascadeClient {
  /**
   * Create a store updater for applying cascade updates.
   */
  createCascadeUpdater(cascade: CascadeUpdates): CascadeStoreUpdater;

  /**
   * Generate mutation configs for cascade updates.
   */
  generateMutationConfigs(cascade: CascadeResponse): GeneratedMutationConfigs;

  /**
   * Generate optimistic response for a mutation.
   */
  generateOptimisticResponse<TVariables = any>(
    mutationName: string,
    variables: TVariables,
    optimisticData?: any
  ): any;

  /**
   * Update connections based on cascade changes.
   */
  updateConnections(updates: ConnectionUpdate[]): void;

  /**
   * Apply cascade updates directly to a store.
   */
  applyCascadeToStore(store: RecordSourceSelectorProxy, cascade: CascadeUpdates): void;
}