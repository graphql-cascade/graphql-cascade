import type { RecordProxy, RecordSourceProxy } from "relay-runtime";
import {
  CascadeUpdates,
  QueryInvalidation,
  UpdatedEntity,
  cascadeEntryTypename,
  invalidationMatches,
  normalizeCascade,
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
 * - Invalidations: unsets the root fields of the queries hints select, so
 *   those queries refetch on their next read; without `rootFields`, marks
 *   every query stale via the root record
 * - Type invalidations: marks the whole store stale via invalidateStore()
 */
export function createCascadeUpdater(
  selected: CascadeUpdates,
  options: CascadeUpdaterOptions = {},
): CascadeStoreUpdater {
  const getDataID = options.getDataID ?? defaultGetDataID;
  const cascade = normalizeCascade(selected);
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

    if (cascade.invalidations.length > 0) {
      applyInvalidations(store, cascade.invalidations, options.rootFields);
    }

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
 * Unset the root fields the hints select, so the queries reading them miss
 * and refetch on their next read. Without the root fields, no query can be
 * singled out, so every query is marked stale: always correct, only less
 * precise.
 */
function applyInvalidations(
  store: RecordSourceProxy,
  invalidations: QueryInvalidation[],
  rootFields: readonly string[] | undefined,
): void {
  const root = store.getRoot();
  if (rootFields === undefined) {
    root.invalidateRecord();
    return;
  }
  for (const storageKey of rootFields) {
    const field = parseStorageKey(storageKey);
    if (
      field &&
      invalidations.some((hint) =>
        invalidationMatches(hint, field.name, field.args),
      )
    ) {
      root.setValue(undefined as never, field.name, field.args);
    }
  }
}

/**
 * A field's name and arguments from its Relay storage key, such as
 * `user(id:"1")`; null for Relay's own keys.
 */
function parseStorageKey(
  storageKey: string,
): { name: string; args?: Record<string, unknown> } | null {
  if (storageKey.startsWith("__")) return null;
  const open = storageKey.indexOf("(");
  if (open === -1) return { name: storageKey };
  const args: Record<string, unknown> = {};
  const body = storageKey.slice(open + 1, -1);
  let depth = 0;
  let inString = false;
  let start = 0;
  for (let i = 0; i <= body.length; i++) {
    const char = body[i];
    if (inString) {
      if (char === "\\") i++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "{" || char === "[") {
      depth++;
    } else if (char === "}" || char === "]") {
      depth--;
    } else if ((char === "," && depth === 0) || i === body.length) {
      const argument = body.slice(start, i);
      const colon = argument.indexOf(":");
      args[argument.slice(0, colon)] = JSON.parse(argument.slice(colon + 1));
      start = i + 1;
    }
  }
  return { name: storageKey.slice(0, open), args };
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
