/**
 * Apollo Server Plugin for GraphQL Cascade
 *
 * Provides an Apollo Server plugin that automatically injects cascade data
 * into GraphQL response extensions.
 */

import { ApolloServerPlugin, GraphQLRequestListener } from "@apollo/server";
import { CascadeBuilder } from "../builder";
import { CascadeTracker } from "../tracker";
import { CascadeBuilderConfig, Invalidator } from "../types";

/**
 * Configuration options for the Cascade Apollo Server plugin.
 */
export interface CascadePluginOptions extends CascadeBuilderConfig {
  /**
   * Computes the invalidation hints of each operation's cascade.
   */
  invalidator?: Invalidator;

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

  /**
   * Optional handler called when cascade injection fails.
   * If not provided, errors are silently ignored.
   */
  onInjectionError?: (error: Error) => void;
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
/** A Cascade payload whose `success` is false reports a failed mutation. */
function isFailedPayload(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as { success?: unknown }).success === false
  );
}

export function createCascadePlugin(
  options?: CascadePluginOptions,
): ApolloServerPlugin {
  const contextKey = options?.contextKey ?? "cascadeTracker";
  const autoInject = options?.autoInject ?? true;
  const onInjectionError = options?.onInjectionError;

  return {
    async requestDidStart(): Promise<GraphQLRequestListener<any>> {
      return {
        // A mutation field that fails contributes no changes (spec REQ-040):
        // undo whatever it tracked. Mutation fields run serially, so each
        // root field's checkpoint covers exactly its own changes.
        async executionDidStart({ operation }) {
          if (operation.operation !== "mutation") return;
          return {
            willResolveField({ contextValue, info }) {
              if (info.path.prev !== undefined) return;
              const tracker = (contextValue as any)[contextKey] as
                | CascadeTracker
                | undefined;
              if (typeof tracker?.checkpoint !== "function") return;
              const checkpoint = tracker.checkpoint();
              return (error, result) => {
                if (error || isFailedPayload(result)) {
                  tracker.restore(checkpoint);
                }
              };
            },
          };
        },

        async willSendResponse({ contextValue, response }) {
          // Skip if auto-inject is disabled
          if (!autoInject) {
            return;
          }

          try {
            // Get the cascade tracker from context
            const context = contextValue as any;
            const tracker = context[contextKey] as CascadeTracker;

            if (!tracker || typeof tracker.getCascadeData !== "function") {
              // No tracker or invalid tracker - skip cascade injection
              return;
            }

            // Check if tracker is in a transaction
            if (!tracker.inTransaction) {
              // No active transaction - skip cascade injection
              return;
            }

            // Build the operation's cascade: size limits, type
            // invalidations for entities past the tracker's limit, hints
            const { cascade: cascadeData } = await new CascadeBuilder(
              tracker,
              options?.invalidator,
              options,
            ).buildResponseAsync(null);

            // Inject into response extensions
            if (response.body.kind === "single") {
              if (!response.body.singleResult.extensions) {
                response.body.singleResult.extensions = {};
              }
              response.body.singleResult.extensions.cascade = cascadeData;
            }
          } catch (error) {
            // Call error handler but don't fail the request
            if (onInjectionError) {
              onInjectionError(error as Error);
            }
          }
        },
      };
    },
  };
}
