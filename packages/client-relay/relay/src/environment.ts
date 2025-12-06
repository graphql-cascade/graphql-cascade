import { Environment, Network, Store, RecordSource } from 'relay-runtime';
import { CascadeResponse } from '@graphql-cascade/client';
import { createCascadeUpdater } from './updater';
import { RelayCascadeEnvironmentConfig } from './types';

/**
 * Create a Relay Environment configured for GraphQL Cascade integration.
 *
 * This environment automatically processes cascade responses from mutations
 * and applies the updates to the Relay store.
 */
export function createCascadeRelayEnvironment(
  network: Network,
  store: Store,
  config: RelayCascadeEnvironmentConfig = {}
): Environment {
  // Create a network wrapper that processes cascade responses
  const cascadeNetwork = Network.create((operation: any, variables: any) => {
    return network.execute(operation, variables).map((payload: any) => {
      // Check if this is a mutation response with cascade data
      if (operation.operationKind === 'mutation' && payload.data) {
        const mutationName = Object.keys(payload.data)[0];
        const mutationResult = payload.data[mutationName];

        // Check for cascade data in the response
        if (mutationResult && typeof mutationResult === 'object' && 'cascade' in mutationResult) {
          const cascadeResponse = mutationResult as CascadeResponse;

          if (cascadeResponse.cascade) {
            // Apply cascade updates to the store
            store.commitUpdates((storeProxy: any) => {
              const updater = createCascadeUpdater(cascadeResponse.cascade);
              updater(storeProxy);
            });

            if (config.debug) {
              console.log('Applied cascade updates:', cascadeResponse.cascade);
            }
          }
        }
      }

      return payload;
    });
  });

  return new Environment({
    network: cascadeNetwork,
    store,
  });
}

/**
 * Create a basic Relay Environment with default cascade configuration.
 * Useful for quick setup and testing.
 */
export function createBasicCascadeEnvironment(
  fetchFn: (operation: any, variables: any) => Promise<any>,
  recordSource?: RecordSource
): Environment {
  const network = Network.create(fetchFn);
  const store = new Store(recordSource || new RecordSource());

  return createCascadeRelayEnvironment(network, store);
}