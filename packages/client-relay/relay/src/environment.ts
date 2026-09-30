import {
  Environment,
  Network,
  RecordSource,
  Store,
  type GraphQLResponse,
  type INetwork,
} from "relay-runtime";
import type { CascadeResponse } from "@graphql-cascade/client";
import { createCascadeUpdater } from "./updater";
import { RelayCascadeEnvironmentConfig } from "./types";

/**
 * Create a Relay Environment configured for GraphQL Cascade integration.
 *
 * This environment automatically processes cascade responses from mutations
 * and applies the updates to the Relay store.
 */
export function createCascadeRelayEnvironment(
  network: INetwork,
  store: Store,
  config: RelayCascadeEnvironmentConfig = {},
): Environment {
  // The network applies each mutation's cascades through the environment,
  // which exists once the network is built; responses only arrive after that.
  // Wrapping `execute` keeps every operation kind, subscriptions included.
  let environment: Environment | undefined;
  const cascadeNetwork: INetwork = {
    execute: (request, variables, cacheConfig, uploadables) =>
      network
        .execute(request, variables, cacheConfig, uploadables)
        .map((payload) => {
          if (request.operationKind === "mutation" && environment) {
            applyMutationCascades(environment, payload, config);
          }
          return payload;
        }),
  };

  environment = new Environment({
    network: cascadeNetwork,
    store,
    ...(config.getDataID && { getDataID: config.getDataID }),
  });
  return environment;
}

/**
 * Apply the cascade of each mutation field, in field order (spec REQ-012).
 * A cascade that cannot be applied is logged, not thrown: the server has
 * committed the mutation, so its response still reaches the application.
 */
function applyMutationCascades(
  environment: Environment,
  payload: GraphQLResponse,
  config: RelayCascadeEnvironmentConfig,
): void {
  if (!("data" in payload) || !payload.data) return;
  for (const result of Object.values(payload.data)) {
    const cascade = (result as Partial<CascadeResponse> | null)?.cascade;
    if (!cascade) continue;
    try {
      environment.commitUpdate(
        createCascadeUpdater(cascade, { getDataID: config.getDataID }),
      );
      if (config.debug) {
        console.log("Applied cascade updates:", cascade);
      }
    } catch (error) {
      console.error("Failed to apply cascade updates:", error);
    }
  }
}

/**
 * Create a basic Relay Environment with default cascade configuration.
 * Useful for quick setup and testing.
 */
export function createBasicCascadeEnvironment(
  fetchFn: (operation: any, variables: any) => Promise<any>,
  recordSource?: RecordSource,
): Environment {
  const network = Network.create(fetchFn);
  const store = new Store(recordSource || new RecordSource());

  return createCascadeRelayEnvironment(network, store);
}
