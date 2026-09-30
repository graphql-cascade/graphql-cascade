/**
 * Runs cascades against a real Relay store, keyed the way Relay keys records,
 * so a test fails whenever an update misses what queries read.
 */
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
  commitLocalUpdate,
  type RecordSourceProxy,
} from "relay-runtime";
import {
  CascadeOperation,
  type CascadeUpdates,
  type UpdatedEntity,
} from "@graphql-cascade/client";
import { applyCascadeToStore, createCascadeUpdater } from "./updater";
import type { GetDataID } from "./types";

const cascadeOf = (parts: Partial<CascadeUpdates>): CascadeUpdates => ({
  updated: [],
  deleted: [],
  invalidations: [],
  metadata: { timestamp: "2026-01-01T00:00:00Z", depth: 1, affectedCount: 1 },
  ...parts,
});

const updated = (
  typename: string,
  entity: Record<string, unknown> & { id: string },
  operation = CascadeOperation.UPDATED,
): UpdatedEntity => ({ typename, id: entity.id, operation, entity });

/** An environment whose store holds the given records, keyed by data ID. */
function environmentWith(
  records: Record<string, Record<string, unknown>> = {},
  getDataID?: GetDataID,
) {
  const source = Object.fromEntries(
    Object.entries(records).map(([dataID, fields]) => [
      dataID,
      { __id: dataID, ...fields },
    ]),
  );
  return new Environment({
    network: Network.create(() => Observable.from({ data: {} })),
    store: new Store(new RecordSource(source)),
    ...(getDataID && { getDataID }),
  });
}

const alice = { __typename: "User", id: "1", name: "Alice", email: "a@x.io" };

function apply(environment: Environment, cascade: CascadeUpdates) {
  environment.commitUpdate(createCascadeUpdater(cascade));
}

const record = (environment: Environment, dataID: string) =>
  environment.getStore().getSource().get(dataID);

describe("createCascadeUpdater", () => {
  describe("updated entities", () => {
    it("updates the record queries read, keyed by id", () => {
      const environment = environmentWith({ "1": alice });

      apply(
        environment,
        cascadeOf({ updated: [updated("User", { id: "1", name: "Alicia" })] }),
      );

      expect(record(environment, "1")).toMatchObject({
        name: "Alicia",
        email: "a@x.io",
      });
      expect(record(environment, "User:1")).toBeUndefined();
    });

    it("creates records for new entities", () => {
      const environment = environmentWith();

      apply(
        environment,
        cascadeOf({
          updated: [
            updated(
              "Post",
              { id: "7", title: "Hello" },
              CascadeOperation.CREATED,
            ),
          ],
        }),
      );

      expect(record(environment, "7")).toMatchObject({
        __typename: "Post",
        id: "7",
        title: "Hello",
      });
    });

    it("applies several entities in one cascade", () => {
      const environment = environmentWith({ "1": alice });

      apply(
        environment,
        cascadeOf({
          updated: [
            updated("User", { id: "1", name: "Alicia" }),
            updated(
              "Post",
              { id: "7", title: "Hello" },
              CascadeOperation.CREATED,
            ),
          ],
        }),
      );

      expect(record(environment, "1")).toMatchObject({ name: "Alicia" });
      expect(record(environment, "7")).toMatchObject({ title: "Hello" });
    });

    it("stores scalars, lists of scalars and nulls as values", () => {
      const environment = environmentWith({ "1": alice });

      apply(
        environment,
        cascadeOf({
          updated: [
            updated("User", {
              id: "1",
              tags: ["a", "b"],
              email: null,
              age: 36,
            }),
          ],
        }),
      );

      expect(record(environment, "1")).toMatchObject({
        tags: ["a", "b"],
        email: null,
        age: 36,
      });
    });

    it("links nested entities to their own records", () => {
      const environment = environmentWith({ "1": alice });

      apply(
        environment,
        cascadeOf({
          updated: [
            updated(
              "Post",
              {
                id: "7",
                author: { __typename: "User", id: "1" },
                reviewers: [{ __typename: "User", id: "2" }],
              },
              CascadeOperation.CREATED,
            ),
          ],
        }),
      );

      expect(record(environment, "7")).toMatchObject({
        author: { __ref: "1" },
        reviewers: { __refs: ["2"] },
      });
      expect(record(environment, "2")).toMatchObject({ __typename: "User" });
    });

    it("keeps the entry's typename and id over the entity's own fields", () => {
      const environment = environmentWith();

      apply(
        environment,
        cascadeOf({
          updated: [
            {
              typename: "User",
              id: "1",
              operation: CascadeOperation.UPDATED,
              entity: { __typename: "Wrong", id: "1", name: "Alice" },
            },
          ],
        }),
      );

      expect(record(environment, "1")).toMatchObject({
        __typename: "User",
        id: "1",
        name: "Alice",
      });
    });

    it("applies entries from pre-1.3 servers, which only send __typename", () => {
      const environment = environmentWith({ "1": alice });
      const legacy = {
        __typename: "User",
        id: "1",
        operation: CascadeOperation.UPDATED,
        entity: { id: "1", name: "Alicia" },
      } as unknown as UpdatedEntity;

      apply(environment, cascadeOf({ updated: [legacy] }));

      expect(record(environment, "1")).toMatchObject({ name: "Alicia" });
    });

    it("follows the environment's custom getDataID", () => {
      const getDataID: GetDataID = (value, typeName) =>
        `${typeName}:${value.id}`;
      const environment = environmentWith({ "User:1": alice }, getDataID);

      environment.commitUpdate(
        createCascadeUpdater(
          cascadeOf({
            updated: [updated("User", { id: "1", name: "Alicia" })],
          }),
          { getDataID },
        ),
      );

      expect(record(environment, "User:1")).toMatchObject({ name: "Alicia" });
    });
  });

  describe("deleted entities", () => {
    it("deletes their records", () => {
      const environment = environmentWith({ "1": alice });

      apply(
        environment,
        cascadeOf({
          deleted: [{ typename: "User", id: "1", deletedAt: "2026-01-01" }],
        }),
      );

      expect(record(environment, "1")).toBeNull();
    });

    it("ignores entities the store does not hold", () => {
      const environment = environmentWith({ "1": alice });

      apply(
        environment,
        cascadeOf({
          deleted: [{ typename: "User", id: "9", deletedAt: "2026-01-01" }],
        }),
      );

      expect(record(environment, "1")).toMatchObject({ name: "Alice" });
    });
  });

  describe("type invalidations", () => {
    function invalidatesStore(cascade: CascadeUpdates): boolean {
      let invalidated = false;
      environmentWith({ "1": alice }).commitUpdate(
        (store: RecordSourceProxy) => {
          const proxy = store as RecordSourceProxy & {
            invalidateStore(): void;
          };
          const original = proxy.invalidateStore.bind(proxy);
          proxy.invalidateStore = () => {
            invalidated = true;
            original();
          };
          createCascadeUpdater(cascade)(proxy);
        },
      );
      return invalidated;
    }

    it("invalidates the whole store, since Relay cannot target records by type", () => {
      expect(
        invalidatesStore(
          cascadeOf({ typeInvalidations: [{ typename: "Post" }] }),
        ),
      ).toBe(true);
    });

    it("leaves the store alone when there are none", () => {
      expect(invalidatesStore(cascadeOf({}))).toBe(false);
    });
  });
});

describe("applyCascadeToStore", () => {
  it("applies a cascade inside a local update", () => {
    const environment = environmentWith({ "1": alice });

    commitLocalUpdate(environment, (store) => {
      applyCascadeToStore(
        store,
        cascadeOf({ updated: [updated("User", { id: "1", name: "Alicia" })] }),
      );
    });

    expect(record(environment, "1")).toMatchObject({ name: "Alicia" });
  });
});
