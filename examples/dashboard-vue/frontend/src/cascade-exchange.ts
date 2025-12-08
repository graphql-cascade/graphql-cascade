import { Exchange } from '@urql/vue';
import { pipe, map } from 'wonka';

interface CascadeEntity {
  __typename: string;
  id: string;
}

interface CascadeData {
  updated: CascadeEntity[];
  deleted: CascadeEntity[];
  invalidations: string[];
}

interface CascadeResult {
  cascade?: CascadeData;
}

/**
 * Custom URQL exchange that processes cascade data from mutation responses.
 * This exchange intercepts mutation results and handles cache updates based
 * on the cascade information returned by the server.
 */
export const cascadeExchange: Exchange =
  ({ forward, client }) =>
  (ops$) => {
    return pipe(
      forward(ops$),
      map((result) => {
        // Check if result has cascade data
        if (result.data) {
          const data = result.data as Record<string, CascadeResult>;

          // Process each field in the response
          for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === 'object' && 'cascade' in value) {
              const cascade = value.cascade;

              if (cascade) {
                // Process updated entities
                if (cascade.updated && cascade.updated.length > 0) {
                  console.log('[Cascade] Updated entities:', cascade.updated);
                  // In a real implementation, you would update the cache here
                  // client.query() or manually update normalized cache
                }

                // Process deleted entities
                if (cascade.deleted && cascade.deleted.length > 0) {
                  console.log('[Cascade] Deleted entities:', cascade.deleted);
                  // Remove deleted entities from cache
                }

                // Process invalidations
                if (cascade.invalidations && cascade.invalidations.length > 0) {
                  console.log('[Cascade] Invalidated types:', cascade.invalidations);
                  // Invalidate queries that depend on these types
                  // This could trigger refetches for affected queries
                }
              }
            }
          }
        }

        return result;
      })
    );
  };
