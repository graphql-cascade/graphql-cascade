import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
  type GraphQLResponse,
  type RequestParameters,
} from "relay-runtime";
import { CascadeOperation, type CascadeUpdates } from "@graphql-cascade/client";
import {
  createBasicCascadeEnvironment,
  createCascadeRelayEnvironment,
  commitCascade,
} from "./environment";

const renamed: CascadeUpdates = {
  updated: [
    {
      typename: "User",
      id: "1",
      operation: CascadeOperation.UPDATED,
      entity: { id: "1", name: "New" },
    },
  ],
  deleted: [],
  invalidations: [],
  metadata: { timestamp: "2026-01-01T00:00:00Z", depth: 1, affectedCount: 1 },
};

const mutation = { operationKind: "mutation" } as RequestParameters;
const query = { operationKind: "query" } as RequestParameters;

function storeWithUser(dataID = "1") {
  return new Store(
    new RecordSource({
      [dataID]: { __id: dataID, __typename: "User", id: "1", name: "Old" },
    }),
  );
}

async function respond(
  request: RequestParameters,
  payload: GraphQLResponse,
  options: {
    dataID?: string;
    getDataID?: (v: any, t: string) => unknown;
    debug?: boolean;
  } = {},
) {
  const store = storeWithUser(options.dataID);
  const environment = createCascadeRelayEnvironment(
    Network.create(
      () => Observable.from(payload),
      () => Observable.from(payload),
    ),
    store,
    { getDataID: options.getDataID, debug: options.debug },
  );
  const result = await environment
    .getNetwork()
    .execute(request, {}, {})
    .toPromise();
  return { result, record: store.getSource().get(options.dataID ?? "1") };
}

describe("createCascadeRelayEnvironment", () => {
  it("applies a mutation's cascade to the store and passes the payload on", async () => {
    const payload = {
      data: { renameUser: { data: { id: "1" }, cascade: renamed } },
    };

    const { result, record } = await respond(mutation, payload);

    expect(record).toMatchObject({ name: "New" });
    expect(result).toBe(payload);
  });

  it("ignores queries, even if they carry a cascade field", async () => {
    const { record } = await respond(query, {
      data: { user: { cascade: renamed } },
    });

    expect(record).toMatchObject({ name: "Old" });
  });

  it("ignores mutations without a cascade", async () => {
    const { record } = await respond(mutation, {
      data: { renameUser: { data: { id: "1" } } },
    });

    expect(record).toMatchObject({ name: "Old" });
  });

  it("ignores mutations that returned null", async () => {
    const { record } = await respond(mutation, { data: { renameUser: null } });

    expect(record).toMatchObject({ name: "Old" });
  });

  it("ignores subscriptions", async () => {
    const subscription = { operationKind: "subscription" } as RequestParameters;

    const { record } = await respond(subscription, {
      data: { userChanged: { cascade: renamed } },
    });

    expect(record).toMatchObject({ name: "Old" });
  });

  it("applies every mutation field's cascade, in field order", async () => {
    const renamedAgain: CascadeUpdates = {
      ...renamed,
      updated: [{ ...renamed.updated[0], entity: { id: "1", name: "Newer" } }],
    };

    const { record } = await respond(mutation, {
      data: { first: { cascade: renamed }, second: { cascade: renamedAgain } },
    });

    expect(record).toMatchObject({ name: "Newer" });
  });

  it("passes the response on when a cascade cannot be applied", async () => {
    const error = jest.spyOn(console, "error").mockImplementation();
    const payload = {
      data: { renameUser: { cascade: { ...renamed, updated: "not a list" } } },
    };

    const { result, record } = await respond(mutation, payload as any);

    expect(result).toBe(payload);
    expect(record).toMatchObject({ name: "Old" });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("uses a custom getDataID for the store and the cascade", async () => {
    const getDataID = (value: any, typeName: string) =>
      `${typeName}:${value.id}`;

    const { record } = await respond(
      mutation,
      { data: { renameUser: { cascade: renamed } } },
      { dataID: "User:1", getDataID },
    );

    expect(record).toMatchObject({ name: "New" });
  });

  it("logs applied cascades when debug is enabled", async () => {
    const log = jest.spyOn(console, "log").mockImplementation();

    await respond(
      mutation,
      { data: { renameUser: { cascade: renamed } } },
      { debug: true },
    );

    expect(log).toHaveBeenCalledWith("Applied cascade updates:", renamed);
    log.mockRestore();
  });
});

describe("createBasicCascadeEnvironment", () => {
  it("builds a working environment from a fetch function", async () => {
    const source = new RecordSource({
      "1": { __id: "1", __typename: "User", id: "1", name: "Old" },
    });
    const environment = createBasicCascadeEnvironment(
      async () => ({ data: { renameUser: { cascade: renamed } } }),
      source,
    );

    await environment.getNetwork().execute(mutation, {}, {}).toPromise();

    expect(source.get("1")).toMatchObject({ name: "New" });
  });
});

describe("commitCascade with partial selections", () => {
  it("applies a cascade whose mutation selected only updated", () => {
    const environment = new Environment({
      network: Network.create(() => Observable.from({ data: {} })),
      store: new Store(new RecordSource()),
    });

    commitCascade(environment, {
      updated: [
        {
          typename: "User",
          id: "u1",
          operation: CascadeOperation.UPDATED,
          entity: { __typename: "User", id: "u1", name: "Ada" },
        },
      ],
    } as never);

    expect(environment.getStore().getSource().get("u1")).toMatchObject({
      name: "Ada",
    });
  });
});
