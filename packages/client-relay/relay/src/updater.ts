import type { RecordProxy, RecordSourceProxy } from "relay-runtime";
import {
  CascadeUpdates,
  UpdatedEntity,
  QueryInvalidation,
  InvalidationStrategy,
  InvalidationScope,
  cascadeEntryTypename,
} from "@graphql-cascade/client";
import type {
  CascadeStoreUpdater,
  CascadeUpdaterOptions,
  GetDataID,
} from "./types";

/**
 * Create a Relay store updater that applies cascade updates to the normalized store.
 *
 * This function handles:
 * - Updated entities: writes new data to the store
 * - Deleted entities: removes records from the store
 * - Invalidations: marks records as stale via invalidateRecord()
 * - Type invalidations: marks the whole store stale via invalidateStore()
 */
export function createCascadeUpdater(
  cascade: CascadeUpdates,
  options: CascadeUpdaterOptions = {},
): CascadeStoreUpdater {
  const getDataID = options.getDataID ?? defaultGetDataID;
  return (store: RecordSourceProxy) => {
    // Apply entity updates
    cascade.updated.forEach((entity) => {
      applyEntityUpdate(store, entity, getDataID);
    });

    // Apply entity deletions
    cascade.deleted.forEach((entity) => {
      store.delete(
        getDataID({ id: entity.id }, cascadeEntryTypename(entity)) as string,
      );
    });

    // Apply invalidations
    // Note: Relay doesn't have query-level invalidation like other clients
    // We can invalidate records if the invalidation specifies entities
    cascade.invalidations.forEach((invalidation) => {
      applyInvalidation(store, invalidation);
    });

    // Relay cannot enumerate records by type, so a type invalidation marks
    // every query stale; each refetches on its next read.
    if (cascade.typeInvalidations?.length) {
      // Every Relay store proxy has invalidateStore at runtime; the type
      // definitions only declare it on the selector proxy.
      (
        store as RecordSourceProxy & { invalidateStore(): void }
      ).invalidateStore();
    }
  };
}

/**
 * Relay's default record ID: the object's `id`. Environments configured with
 * a different `getDataID` pass the same function in the updater options.
 */
const defaultGetDataID: GetDataID = (value) => value.id;

type Primitive = string | number | boolean | null;

const isPrimitive = (value: unknown): value is Primitive =>
  value === null || ["string", "number", "boolean"].includes(typeof value);

const isReference = (
  value: unknown,
): value is { id: string; __typename: string } =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  "__typename" in value;

/**
 * Write one entity field. Relay stores scalars with setValue and entities as
 * links to their own records; other nested objects have no record ID and are
 * left to the next query that selects them.
 */
function writeField(
  store: RecordSourceProxy,
  record: RecordProxy,
  key: string,
  value: unknown,
  getDataID: GetDataID,
): void {
  const link = (ref: { id: string; __typename: string }) => {
    const dataID = getDataID(ref, ref.__typename) as string;
    return store.get(dataID) ?? store.create(dataID, ref.__typename);
  };
  if (
    isPrimitive(value) ||
    (Array.isArray(value) && value.every(isPrimitive))
  ) {
    record.setValue(value as Primitive | Primitive[], key);
  } else if (isReference(value)) {
    record.setLinkedRecord(link(value), key);
  } else if (Array.isArray(value) && value.every(isReference)) {
    record.setLinkedRecords(value.map(link), key);
  }
}

/**
 * Apply an entity update to the Relay store.
 */
function applyEntityUpdate(
  store: RecordSourceProxy,
  entry: UpdatedEntity,
  getDataID: GetDataID,
): void {
  const typename = cascadeEntryTypename(entry);
  const dataID = getDataID(
    { ...entry.entity, id: entry.id },
    typename,
  ) as string;
  const record = store.get(dataID) ?? store.create(dataID, typename);

  record.setValue(entry.id, "id");
  for (const [key, value] of Object.entries(entry.entity)) {
    if (key !== "__typename" && key !== "id") {
      writeField(store, record, key, value, getDataID);
    }
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
function applyInvalidation(
  store: RecordSourceProxy,
  invalidation: QueryInvalidation,
): void {
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
  store: RecordSourceProxy,
  cascade: CascadeUpdates,
  options: CascadeUpdaterOptions = {},
): void {
  createCascadeUpdater(cascade, options)(store);
}
