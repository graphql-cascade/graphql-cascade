import { RecordSourceSelectorProxy } from 'relay-runtime';
import { CascadeUpdates, UpdatedEntity, DeletedEntity, CascadeOperation } from '@graphql-cascade/client';
import { CascadeStoreUpdater } from './types';

/**
 * Create a Relay store updater that applies cascade updates to the normalized store.
 *
 * This function handles:
 * - Updated entities: writes new data to the store
 * - Deleted entities: removes records from the store
 * - Invalidations: handled through Relay's query invalidation mechanisms
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

    // Note: Invalidations are typically handled at the query level in Relay
    // through refetch strategies rather than direct store manipulation
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