/**
 * Runs the specification's client conformance cases against a Relay store,
 * applying cascades as createCascadeRelayEnvironment does.
 */
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
  commitLocalUpdate,
  type RecordProxy,
  type RecordSourceProxy,
} from "relay-runtime";
import type { CascadeUpdates } from "@graphql-cascade/client";
import {
  CASES,
  runClientCases,
  type ClientHarness,
  type ClientState,
} from "@graphql-cascade/conformance";
import { commitCascade } from "./environment";

type Fields = Record<string, unknown>;
type InvalidationState = ReturnType<Store["lookupInvalidationState"]>;

/** Client cases skipped for a cache of this kind */
const skippedCases = (cache: "normalized" | "document") =>
  CASES.filter(
    (c) =>
      c.category === "client" && c.cache !== undefined && c.cache !== cache,
  ).map((c) => c.id);

const isEntity = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && "id" in value;

/** Write `value` into a record field, as Relay stores query results. */
function writeField(
  store: RecordSourceProxy,
  record: RecordProxy,
  field: string,
  value: unknown,
  args?: Fields,
) {
  const entityRecord = (entity: Fields) => {
    const proxy =
      store.get(entity.id as string) ??
      store.create(entity.id as string, entity.__typename as string);
    for (const [key, nested] of Object.entries(entity)) {
      if (key !== "__typename") writeField(store, proxy, key, nested);
    }
    return proxy;
  };
  if (Array.isArray(value) && value.every(isEntity)) {
    record.setLinkedRecords(value.map(entityRecord), field, args);
  } else if (isEntity(value)) {
    record.setLinkedRecord(entityRecord(value), field, args);
  } else {
    record.setValue(value as never, field, args);
  }
}

/**
 * Read a record field back in the shape of `like`; undefined when the field
 * is missing, which makes a query refetch.
 */
function readField(
  record: RecordProxy,
  field: string,
  like: unknown,
  args?: Fields,
): unknown {
  const readEntity = (proxy: RecordProxy | null | undefined, shape: unknown) =>
    proxy
      ? Object.fromEntries(
          Object.keys((shape ?? {}) as Fields).map((key) => [
            key,
            key === "__typename"
              ? proxy.getType()
              : readField(proxy, key, (shape as Fields)[key]),
          ]),
        )
      : proxy;
  if (Array.isArray(like) && like.every(isEntity)) {
    return record
      .getLinkedRecords(field, args)
      ?.map((proxy, i) => readEntity(proxy, like[i] ?? like[0]));
  }
  if (isEntity(like))
    return readEntity(record.getLinkedRecord(field, args), like);
  return record.getValue(field, args);
}

class RelayHarness implements ClientHarness {
  readonly cache = "normalized";
  private store = new Store(new RecordSource());
  private environment = new Environment({
    network: Network.create(() => Observable.from({ data: {} })),
    store: this.store,
  });
  private queries = new Map<
    string,
    { args?: Fields; result: unknown; seen: InvalidationState }
  >();

  seed({ entities = [], queries = [] }: ClientState) {
    commitLocalUpdate(this.environment, (store) => {
      const root = store.getRoot();
      entities.forEach((entity, i) =>
        writeField(store, root, `__seed${i}`, entity),
      );
      for (const { name, arguments: args, result } of queries) {
        writeField(store, root, name, result, args);
      }
    });
    for (const { name, arguments: args, result } of queries) {
      const ids = ["client:root", ...entityIds(result)];
      this.queries.set(key(name, args), {
        args,
        result,
        seen: this.store.lookupInvalidationState(ids),
      });
    }
  }

  apply(result: Fields) {
    const cascade = (result as { cascade?: CascadeUpdates }).cascade;
    if (cascade) commitCascade(this.environment, cascade);
  }

  entity(_typename: string, id: string) {
    const record = this.store.getSource().get(id);
    return record ? { ...record } : null;
  }

  query(name: string, args?: Fields) {
    const query = this.queries.get(key(name, args));
    if (!query || this.store.checkInvalidationState(query.seen)) {
      return { state: "invalidated" as const };
    }
    let data: unknown;
    commitLocalUpdate(this.environment, (store) => {
      data = readField(store.getRoot(), name, query.result, args);
    });
    return data === undefined
      ? { state: "invalidated" as const }
      : { state: "fresh" as const, data };
  }
}

const key = (name: string, args?: Fields) =>
  `${name}${JSON.stringify(args ?? {})}`;

function entityIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(entityIds);
  return isEntity(value) ? [value.id as string] : [];
}

describe("client conformance", () => {
  it("passes every client case for normalized caches", async () => {
    const results = await runClientCases(() => new RelayHarness());

    expect(
      results.filter((r) => r.status !== "passed").map((r) => r.id),
    ).toEqual(skippedCases("normalized"));
  });
});
