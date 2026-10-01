import type { ServerCase } from "./cases";
import { httpTarget, runServerCases, type ServerTarget } from "./server-runner";

const META = { timestamp: "t", depth: 1, affectedCount: 1, truncated: false };
const cascade = (fields: Record<string, unknown> = {}) => ({
  updated: [],
  deleted: [],
  invalidations: [],
  typeInvalidations: [],
  metadata: META,
  ...fields,
});
const ada = (name = "Ada Lovelace") => ({
  typename: "User",
  id: "u1",
  operation: "UPDATED",
  entity: { __typename: "User", id: "u1", name, email: "ada@example.com" },
});

const renameCase: ServerCase = {
  id: "TC-S-900",
  name: "Rename",
  description: "Renaming a user lists the user as UPDATED.",
  category: "server",
  requirement: "REQ-002",
  level: "basic",
  input: {
    state: { users: [{ id: "u1", name: "Ada", email: "ada@example.com" }] },
    operation: "mutation { updateUser { success } }",
  },
  expected: {
    fields: {
      updateUser: {
        success: true,
        cascade: {
          updated: [
            {
              typename: "User",
              id: "u1",
              operation: "UPDATED",
              entity: { name: "Ada Lovelace" },
            },
          ],
          absent: [{ typename: "Post" }],
        },
      },
    },
  },
};

/** A target answering every operation with `data`, recording setups. */
function answering(
  data: Record<string, unknown>,
  extra: Partial<ServerTarget> = {},
) {
  const setups: unknown[] = [];
  const target: ServerTarget = {
    setup: (state, limits) => {
      setups.push({ state, limits });
    },
    execute: () => ({ data }),
    ...extra,
  };
  return { target, setups };
}

const run = (target: ServerTarget, cases: ServerCase[] = [renameCase]) =>
  runServerCases(target, { cases });

describe("runServerCases", () => {
  it("passes a response that meets the case", async () => {
    const { target, setups } = answering({
      updateUser: { success: true, cascade: cascade({ updated: [ada()] }) },
    });

    const [result] = await run(target);

    expect(result).toMatchObject({
      id: "TC-S-900",
      status: "passed",
      failures: [],
    });
    expect(setups).toEqual([
      { state: renameCase.input.state, limits: undefined },
    ]);
  });

  it("reports missing entries, wrong values and forbidden entries", async () => {
    const { target } = answering({
      updateUser: {
        success: false,
        cascade: cascade({
          updated: [
            ada("Ada"),
            { typename: "Post", id: "p1", operation: "UPDATED", entity: {} },
          ],
        }),
      },
    });

    const [result] = await run(target);

    expect(result.status).toBe("failed");
    expect(result.failures).toEqual([
      "updateUser.success: expected true, got false",
      'updateUser.cascade.updated: no entry matches {"typename":"User","id":"u1","operation":"UPDATED","entity":{"name":"Ada Lovelace"}}',
      "updateUser.cascade: Post:p1 must not appear",
    ]);
  });

  it("checks the requirements every cascade meets", async () => {
    const { target } = answering({
      updateUser: {
        success: true,
        cascade: {
          updated: [ada(), ada()],
          deleted: [{ typename: "User", id: "u1", deletedAt: "t" }],
          invalidations: [],
          metadata: { ...META, truncated: true },
        },
      },
    });

    const [result] = await run(target);

    expect(result.failures).toEqual([
      "updateUser.cascade: missing typeInvalidations (REQ-010)",
      "updateUser.cascade: User:u1 appears more than once in updated (REQ-005)",
      "updateUser.cascade: User:u1 is in both updated and deleted (REQ-003)",
      "updateUser.cascade: metadata.truncated is true without typeInvalidations (REQ-050)",
    ]);
  });

  it("requires noChanges cascades to be empty", async () => {
    const failing: ServerCase = {
      ...renameCase,
      expected: {
        fields: {
          updateUser: {
            success: false,
            errors: [{ code: "NOT_FOUND" }],
            cascade: { noChanges: true },
          },
        },
      },
    };
    const { target } = answering({
      updateUser: {
        success: false,
        errors: [{ code: "NOT_FOUND", message: "No user" }],
        cascade: cascade({ updated: [ada()] }),
      },
    });

    const [result] = await run(target, [failing]);

    expect(result.failures).toEqual([
      "updateUser.cascade: expected no changes, got 1 updated, 0 deleted, 0 typeInvalidations (REQ-020)",
    ]);
  });

  it("reports GraphQL errors and missing fields", async () => {
    const target: ServerTarget = {
      setup: () => {},
      execute: () => ({ errors: [{ message: "Cannot query field" }] }),
    };

    const [result] = await run(target);

    expect(result.failures).toEqual([
      "GraphQL error: Cannot query field",
      "updateUser: missing from the response",
    ]);
  });

  it("skips cases needing a capability the target lacks", async () => {
    const transportCase: ServerCase = {
      ...renameCase,
      category: "transport",
      requires: ["extensions"],
      expected: {
        extensions: { cascade: { updated: [{ typename: "User", id: "u1" }] } },
      },
    };
    const { target } = answering({ updateUser: { success: true } });

    expect((await run(target, [transportCase]))[0].status).toBe("skipped");

    const withExtensions: ServerTarget = {
      ...target,
      capabilities: ["extensions"],
      execute: () => ({
        data: { updateUser: { success: true } },
        extensions: { cascade: cascade({ updated: [ada()] }) },
      }),
    };
    expect((await run(withExtensions, [transportCase]))[0].status).toBe(
      "passed",
    );
  });

  it("passes the case's limits to setup", async () => {
    const limited: ServerCase = {
      ...renameCase,
      input: { ...renameCase.input, limits: { maxUpdatedEntities: 2 } },
    };
    const { target, setups } = answering({
      updateUser: { success: true, cascade: cascade({ updated: [ada()] }) },
    });

    await run(target, [limited]);

    expect(setups).toEqual([
      { state: renameCase.input.state, limits: { maxUpdatedEntities: 2 } },
    ]);
  });
});

describe("httpTarget", () => {
  it("posts operations to the endpoint and returns the GraphQL response", async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    const setup = jest.fn();
    const target = httpTarget("http://localhost:4000/graphql", {
      setup,
      headers: { authorization: "Bearer t" },
      fetch: (async (url: string, init: RequestInit) => {
        requests.push({ url, init });
        return new Response(JSON.stringify({ data: { ok: true } }));
      }) as typeof fetch,
    });

    await target.setup({ users: [] });
    const response = await target.execute("mutation { ok }", { a: 1 });

    expect(setup).toHaveBeenCalledWith({ users: [] });
    expect(response).toEqual({ data: { ok: true } });
    expect(requests).toEqual([
      {
        url: "http://localhost:4000/graphql",
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer t",
          },
          body: JSON.stringify({
            query: "mutation { ok }",
            variables: { a: 1 },
          }),
        },
      },
    ]);
  });
});
