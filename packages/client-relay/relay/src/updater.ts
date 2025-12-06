import { RecordSourceSelectorProxy } from 'relay-runtime';
import {
  CascadeUpdates,
  UpdatedEntity,
  DeletedEntity,
  CascadeOperation,
  QueryInvalidation,
  InvalidationStrategy,
  InvalidationScope
} from '@graphql-cascade/client';
import { CascadeStoreUpdater } from './types';

/**
 * Create a Relay store updater that applies cascade updates to the normalized store.
 *
 * This function handles:
 * - Updated entities: writes new data to the store
 * - Deleted entities: removes records from the store
 * - Invalidations: marks records as stale via invalidateRecord()
 */
export function createCascadeUpdater(cascade: CascadeUpdates): CascadeStoreUpdater {
  return (store: RecordSourceSelectorProxy) => {
    // Apply entity updates
    cascade.updated.forEach(entity => {
      applyEntityUpdate(store, entity);
    });

    // Apply entity deletions
    cascade.deleted.forEach(entity => {
      applyEntityDeletion(store, entity);
    });

    // Apply invalidations
    // Note: Relay doesn't have query-level invalidation like other clients
    // We can invalidate records if the invalidation specifies entities
    cascade.invalidations.forEach(invalidation => {
      applyInvalidation(store, invalidation);
    });
  };
}

/**
 * Apply an entity update to the Relay store.
 */
function applyEntityUpdate(store: RecordSourceSelectorProxy, entity: UpdatedEntity): void {
  const recordId = `${entity.__typename}:${entity.id}`;
  let record = store.get(recordId);

  if (!record) {
    // Create new record if it doesn't exist
    record = store.create(recordId, entity.__typename);
  }

  // Update record fields
  Object.keys(entity.entity).forEach(key => {
    if (key !== '__typename' && key !== 'id') {
      record.setValue(entity.entity[key], key);
    }
  });

  // Handle special cases based on operation type
  switch (entity.operation) {
    case CascadeOperation.CREATED:
      // Ensure the record is marked as created
      record.setValue(true, '__isCreated');
      break;
    case CascadeOperation.UPDATED:
      // Ensure the record is marked as updated
      record.setValue(true, '__isUpdated');
      break;
    case CascadeOperation.DELETED:
      // This shouldn't happen here, but handle gracefully
      console.warn(`Received DELETED operation in updated entities for ${recordId}`);
      break;
  }
}

/**
 * Apply an entity deletion to the Relay store.
 */
function applyEntityDeletion(store: RecordSourceSelectorProxy, entity: DeletedEntity): void {
  const recordId = `${entity.__typename}:${entity.id}`;
  const record = store.get(recordId);

  if (record) {
    // Mark as deleted and set deletion timestamp
    record.setValue(true, '__isDeleted');
    record.setValue(entity.deletedAt, 'deletedAt');

    // Optionally remove from connections
    // This would require additional connection-specific logic
  }
}

/**
 * Apply an invalidation to the Relay store.
 *
 * Note: Relay's invalidation model is entity-based, not query-based.
 * - For INVALIDATE strategy, we can invalidate the root Query record
 * - For REFETCH strategy, the application should handle refetching separately
 * - For REMOVE strategy, we can delete records (similar to eviction)
 */
function applyInvalidation(store: RecordSourceSelectorProxy, invalidation: QueryInvalidation): void {
  // Relay doesn't have direct query invalidation like Apollo or React Query
  // However, we can invalidate the root Query record or specific field records

  switch (invalidation.strategy) {
    case InvalidationStrategy.INVALIDATE:
      // Invalidate the root Query to trigger re-fetches
      if (invalidation.scope === InvalidationScope.ALL) {
        const root = store.getRoot();
        if (root) {
          root.invalidateRecord();
        }
      } else if (invalidation.queryName) {
        // For specific queries, we can mark a sentinel field
        // This is a workaround since Relay doesn't have query-level invalidation
        const root = store.getRoot();
        if (root) {
          root.setValue(Date.now(), `__invalidated_${invalidation.queryName}`);
        }
      }
      break;

    case InvalidationStrategy.REFETCH:
      // Refetch needs to be handled at the application level
      // We can set a marker to indicate refetch is needed
      if (invalidation.queryName) {
        const root = store.getRoot();
        if (root) {
          root.setValue(Date.now(), `__refetch_${invalidation.queryName}`);
        }
      }
      break;

    case InvalidationStrategy.REMOVE:
      // For remove, we can only remove specific records if we know their IDs
      // Query removal isn't directly supported in Relay's normalized store
      break;
  }
}

/**
 * Apply cascade updates directly to a store instance.
 * Useful for immediate updates outside of mutation configs.
 */
export function applyCascadeToStore(
  store: RecordSourceSelectorProxy,
  cascade: CascadeUpdates
): void {
  const updater = createCascadeUpdater(cascade);
  updater(store);
}