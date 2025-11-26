/**
 * Apollo Server Plugin for GraphQL Cascade
 *
 * Provides an Apollo Server plugin that automatically injects cascade data
 * into GraphQL response extensions.
 */

import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import { CascadeTracker } from '../tracker';
import { CascadeTrackerConfig } from '../types';

/**
 * Configuration options for the Cascade Apollo Server plugin.
 */
export interface CascadePluginOptions extends CascadeTrackerConfig {
  /**
   * The key in the context where the CascadeTracker is stored.
   * @default 'cascadeTracker'
   */
  contextKey?: string;

  /**
   * Whether to automatically inject cascade data into response extensions.
   * @default true
   */
  autoInject?: boolean;
}

/**
 * Creates an Apollo Server plugin for GraphQL Cascade.
 *
 * This plugin automatically injects cascade data into the response extensions
 * when a CascadeTracker is present in the request context.
 *
 * @param options - Configuration options for the plugin
 * @returns Apollo Server plugin instance
 *
 * @example
 * ```typescript
 * import { ApolloServer } from '@apollo/server';
 * import { createCascadePlugin } from '@graphql-cascade/server';
 *
 * const server = new ApolloServer({
 *   typeDefs,
 *   resolvers,
 *   plugins: [
 *     createCascadePlugin({
 *       maxDepth: 5,
 *       excludeTypes: ['InternalType'],
 *     }),
 *   ],
 * });
 * ```
 *
 * @example With context:
 * ```typescript
 * // In your context function
 * const server = new ApolloServer({
 *   // ...
 *   context: async () => ({
 *     cascadeTracker: new CascadeTracker(),
 *   }),
 * });
 *
 * // In your resolvers
 * const resolvers = {
 *   Mutation: {
 *     updateUser: async (parent, args, context) => {
 *       context.cascadeTracker.startTransaction();
 *       // ... your mutation logic
 *       context.cascadeTracker.trackUpdate(updatedUser);
 *       return updatedUser;
 *     },
 *   },
 * };
 * ```
 */
export function createCascadePlugin(options?: CascadePluginOptions): ApolloServerPlugin {
  const contextKey = options?.contextKey ?? 'cascadeTracker';
  const autoInject = options?.autoInject ?? true;

  return {
    async requestDidStart(): Promise<GraphQLRequestListener<any>> {
      return {
        async willSendResponse({ contextValue, response }) {
          // Skip if auto-inject is disabled
          if (!autoInject) {
            return;
          }

          try {
            // Get the cascade tracker from context
            const context = contextValue as any;
            const tracker = context[contextKey] as CascadeTracker;

            if (!tracker || typeof tracker.getCascadeData !== 'function') {
              // No tracker or invalid tracker - skip cascade injection
              return;
            }

            // Check if tracker is in a transaction
            if (!tracker.inTransaction) {
              // No active transaction - skip cascade injection
              return;
            }

            // Get cascade data
            const cascadeData = tracker.getCascadeData();

            // Inject into response extensions
            if (response.body.kind === 'single') {
              if (!response.body.singleResult.extensions) {
                response.body.singleResult.extensions = {};
              }
              response.body.singleResult.extensions.cascade = cascadeData;
            }
          } catch (error) {
            // Log error but don't fail the request
            console.error('Error injecting cascade data:', error);
          }
        },
      };
    },
  };
}
