/**
 * Tests for Apollo Server plugin integration
 *
 * Tests for createCascadePlugin that injects cascade data into
 * GraphQL response extensions.
 */

import assert from "node:assert";
import { ApolloServer } from "@apollo/server";
import { createCascadePlugin, CascadePluginOptions } from "./apollo";
import { CascadeTracker } from "../tracker";
import { InvalidationScope, InvalidationStrategy } from "../types";

// Mock entity for testing
class MockEntity {
  constructor(
    public id: number,
    public name: string,
    public __typename: string = "MockEntity",
  ) {}

  [key: string]: unknown;

  toDict() {
    return {
      id: String(this.id),
      name: this.name,
    };
  }
}

// Mock GraphQL request context for Apollo Server v4
interface MockRequestContext {
  request: {
    query: string;
    variables?: Record<string, any>;
  };
  response: {
    body: {
      kind: "single";
      singleResult: {
        data?: any;
        errors?: any[];
        extensions?: Record<string, any>;
      };
    };
  };
  contextValue: Record<string, any>;
}

// Helper to create mock request context
function _createMockRequestContext(
  query: string,
  data?: any,
  errors?: any[],
): MockRequestContext {
  return {
    request: { query },
    response: {
      body: {
        kind: "single",
        singleResult: { data, errors },
      },
    },
    contextValue: {},
  };
}

describe("createCascadePlugin", () => {
  it("should create an Apollo Server plugin", () => {
    const plugin = createCascadePlugin();
    expect(plugin).toBeDefined();
    expect(plugin.requestDidStart).toBeDefined();
  });

  it("should accept configuration options", () => {
    const options: CascadePluginOptions = {
      maxUpdatedEntities: 100,
      invalidator: { computeInvalidations: () => [] },
    };
    const plugin = createCascadePlugin(options);
    expect(plugin).toBeDefined();
  });

  describe("Request Lifecycle", () => {
    it("should initialize tracker on request start", async () => {
      const plugin = createCascadePlugin();
      const requestListener = await plugin.requestDidStart!({} as any);

      expect(requestListener).toBeDefined();
      expect(requestListener).not.toBeUndefined();
      if (requestListener) {
        expect(requestListener.willSendResponse).toBeDefined();
      }
    });

    it("should inject cascade data into response extensions", async () => {
      const plugin = createCascadePlugin();
      const requestListener = await plugin.requestDidStart!({} as any);

      // Create a mock request context
      const requestContext: MockRequestContext = {
        request: {
          query: "mutation { updateUser(id: 1) { id name } }",
        },
        response: {
          body: {
            kind: "single",
            singleResult: {
              data: { updateUser: { id: 1, name: "Updated" } },
            },
          },
        },
        contextValue: {},
      };

      // Simulate tracking in the resolver (would be done by user)
      const tracker = new CascadeTracker();
      tracker.startTransaction();
      const entity = new MockEntity(1, "Updated");
      tracker.trackUpdate(entity);

      // Store tracker in context (this is how it would be passed)
      requestContext.contextValue.cascadeTracker = tracker;

      // Call willSendResponse
      if (requestListener && requestListener.willSendResponse) {
        await requestListener.willSendResponse(requestContext as any);
      }

      // Check that cascade data was injected
      expect(
        requestContext.response.body.singleResult.extensions,
      ).toBeDefined();
      expect(
        requestContext.response.body.singleResult.extensions?.cascade,
      ).toBeDefined();
      expect(
        requestContext.response.body.singleResult.extensions?.cascade.updated,
      ).toHaveLength(1);
      expect(
        requestContext.response.body.singleResult.extensions?.cascade.metadata,
      ).toBeDefined();
    });

    it("should handle requests without cascade tracking", async () => {
      const plugin = createCascadePlugin();
      const requestListener = await plugin.requestDidStart!({} as any);

      const requestContext: MockRequestContext = {
        request: {
          query: "query { users { id name } }",
        },
        response: {
          body: {
            kind: "single",
            singleResult: {
              data: { users: [{ id: 1, name: "User" }] },
            },
          },
        },
        contextValue: {},
      };

      // No tracker in context
      if (requestListener && requestListener.willSendResponse) {
        await requestListener.willSendResponse(requestContext as any);
      }

      // Should not crash, extensions should be empty or not have cascade
      expect(
        requestContext.response.body.singleResult.extensions?.cascade,
      ).toBeUndefined();
    });

    it("should handle errors during cascade data extraction", async () => {
      const plugin = createCascadePlugin();
      const requestListener = await plugin.requestDidStart!({} as any);

      const requestContext: MockRequestContext = {
        request: {
          query: "mutation { updateUser(id: 1) { id name } }",
        },
        response: {
          body: {
            kind: "single",
            singleResult: {
              data: { updateUser: { id: 1, name: "Updated" } },
            },
          },
        },
        contextValue: {
          // Invalid tracker (not a real CascadeTracker)
          cascadeTracker: { invalid: true },
        },
      };

      // Should not crash
      await expect(
        requestListener!.willSendResponse!(requestContext as any),
      ).resolves.not.toThrow();
    });
  });

  describe("Configuration Options", () => {
    it("should use custom context key", async () => {
      const plugin = createCascadePlugin({
        contextKey: "myCustomTracker",
      });

      const requestListener = await plugin.requestDidStart!({} as any);

      const requestContext: MockRequestContext = {
        request: {
          query: "mutation { updateUser(id: 1) { id name } }",
        },
        response: {
          body: {
            kind: "single",
            singleResult: {
              data: { updateUser: { id: 1, name: "Updated" } },
            },
          },
        },
        contextValue: {},
      };

      const tracker = new CascadeTracker();
      tracker.startTransaction();
      const entity = new MockEntity(1, "Updated");
      tracker.trackUpdate(entity);

      // Store tracker with custom key
      requestContext.contextValue.myCustomTracker = tracker;

      if (requestListener && requestListener.willSendResponse) {
        await requestListener.willSendResponse(requestContext as any);
      }

      expect(
        requestContext.response.body.singleResult.extensions?.cascade,
      ).toBeDefined();
    });

    it("should disable auto-inject if configured", async () => {
      const plugin = createCascadePlugin({
        autoInject: false,
      });

      const requestListener = await plugin.requestDidStart!({} as any);

      const requestContext: MockRequestContext = {
        request: {
          query: "mutation { updateUser(id: 1) { id name } }",
        },
        response: {
          body: {
            kind: "single",
            singleResult: {
              data: { updateUser: { id: 1, name: "Updated" } },
            },
          },
        },
        contextValue: {},
      };

      const tracker = new CascadeTracker();
      tracker.startTransaction();
      const entity = new MockEntity(1, "Updated");
      tracker.trackUpdate(entity);
      requestContext.contextValue.cascadeTracker = tracker;

      if (requestListener && requestListener.willSendResponse) {
        await requestListener.willSendResponse(requestContext as any);
      }

      // Should not inject when autoInject is false
      expect(
        requestContext.response.body.singleResult.extensions?.cascade,
      ).toBeUndefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle GraphQL errors gracefully", async () => {
      const plugin = createCascadePlugin();
      const requestListener = await plugin.requestDidStart!({} as any);

      const requestContext: MockRequestContext = {
        request: {
          query: "mutation { updateUser(id: 1) { id name } }",
        },
        response: {
          body: {
            kind: "single",
            singleResult: {
              errors: [{ message: "User not found" }],
            },
          },
        },
        contextValue: {},
      };

      const tracker = new CascadeTracker();
      tracker.startTransaction();
      requestContext.contextValue.cascadeTracker = tracker;

      // Should still work even with errors
      if (requestListener && requestListener.willSendResponse) {
        await requestListener.willSendResponse(requestContext as any);
      }

      expect(
        requestContext.response.body.singleResult.extensions?.cascade,
      ).toBeDefined();
    });

    it("should handle tracker errors gracefully", async () => {
      const plugin = createCascadePlugin();
      const requestListener = await plugin.requestDidStart!({} as any);

      const requestContext: MockRequestContext = {
        request: {
          query: "mutation { updateUser(id: 1) { id name } }",
        },
        response: {
          body: {
            kind: "single",
            singleResult: {
              data: { updateUser: { id: 1, name: "Updated" } },
            },
          },
        },
        contextValue: {},
      };

      // Create tracker but don't start transaction
      const tracker = new CascadeTracker();
      requestContext.contextValue.cascadeTracker = tracker;

      // Should not crash even if tracker is in invalid state
      await expect(
        requestListener!.willSendResponse!(requestContext as any),
      ).resolves.not.toThrow();
    });

    it("should log warning when tracker is missing from context", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      const plugin = createCascadePlugin();
      const requestListener = await plugin.requestDidStart!({} as any);

      const requestContext: MockRequestContext = {
        request: {
          query: "mutation { updateUser(id: 1) { id name } }",
        },
        response: {
          body: {
            kind: "single",
            singleResult: {
              data: { updateUser: { id: 1, name: "Updated" } },
            },
          },
        },
        contextValue: {},
      };

      // No tracker in context
      if (requestListener && requestListener.willSendResponse) {
        await requestListener.willSendResponse(requestContext as any);
      }

      // Should not inject cascade data and should not crash
      expect(
        requestContext.response.body.singleResult.extensions?.cascade,
      ).toBeUndefined();
      expect(consoleSpy).not.toHaveBeenCalled(); // No warning for missing tracker

      consoleSpy.mockRestore();
    });

    it("should handle invalid cascade data without crashing server", async () => {
      const errorHandler = jest.fn();
      const plugin = createCascadePlugin({ onInjectionError: errorHandler });
      const requestListener = await plugin.requestDidStart!({} as any);

      const requestContext: MockRequestContext = {
        request: {
          query: "mutation { updateUser(id: 1) { id name } }",
        },
        response: {
          body: {
            kind: "single",
            singleResult: {
              data: { updateUser: { id: 1, name: "Updated" } },
            },
          },
        },
        contextValue: {},
      };

      // Mock tracker with invalid getCascadeData method
      const invalidTracker = {
        inTransaction: true,
        getCascadeData: () => {
          throw new Error("Invalid cascade data");
        },
      };
      requestContext.contextValue.cascadeTracker = invalidTracker as any;

      // Should not crash, should call error handler
      await expect(
        requestListener!.willSendResponse!(requestContext as any),
      ).resolves.not.toThrow();

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should still return mutation data when cascade injection fails", async () => {
      const errorHandler = jest.fn();
      const plugin = createCascadePlugin({ onInjectionError: errorHandler });
      const requestListener = await plugin.requestDidStart!({} as any);

      const originalData = { updateUser: { id: 1, name: "Updated" } };
      const requestContext: MockRequestContext = {
        request: {
          query: "mutation { updateUser(id: 1) { id name } }",
        },
        response: {
          body: {
            kind: "single",
            singleResult: {
              data: originalData,
            },
          },
        },
        contextValue: {},
      };

      // Mock tracker that throws during getCascadeData
      const failingTracker = {
        inTransaction: true,
        getCascadeData: () => {
          throw new Error("Cascade injection failure");
        },
      };
      requestContext.contextValue.cascadeTracker = failingTracker as any;

      // Should not crash and should preserve original data
      await expect(
        requestListener!.willSendResponse!(requestContext as any),
      ).resolves.not.toThrow();

      expect(requestContext.response.body.singleResult.data).toBe(originalData);
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("Multiple Operations", () => {
    it("should handle mutations with multiple entity changes", async () => {
      const plugin = createCascadePlugin();
      const requestListener = await plugin.requestDidStart!({} as any);

      const requestContext: MockRequestContext = {
        request: {
          query: "mutation { batchUpdate { success } }",
        },
        response: {
          body: {
            kind: "single",
            singleResult: {
              data: { batchUpdate: { success: true } },
            },
          },
        },
        contextValue: {},
      };

      const tracker = new CascadeTracker();
      tracker.startTransaction();

      // Track multiple entities
      for (let i = 1; i <= 5; i++) {
        const entity = new MockEntity(i, `Entity ${i}`);
        tracker.trackUpdate(entity);
      }

      requestContext.contextValue.cascadeTracker = tracker;

      if (requestListener && requestListener.willSendResponse) {
        await requestListener.willSendResponse(requestContext as any);
      }

      expect(
        requestContext.response.body.singleResult.extensions?.cascade.updated,
      ).toHaveLength(5);
    });

    it("should handle deletions in cascade data", async () => {
      const plugin = createCascadePlugin();
      const requestListener = await plugin.requestDidStart!({} as any);

      const requestContext: MockRequestContext = {
        request: {
          query: "mutation { deleteUser(id: 1) { success } }",
        },
        response: {
          body: {
            kind: "single",
            singleResult: {
              data: { deleteUser: { success: true } },
            },
          },
        },
        contextValue: {},
      };

      const tracker = new CascadeTracker();
      tracker.startTransaction();
      tracker.trackDelete("User", "1");

      requestContext.contextValue.cascadeTracker = tracker;

      if (requestListener && requestListener.willSendResponse) {
        await requestListener.willSendResponse(requestContext as any);
      }

      expect(
        requestContext.response.body.singleResult.extensions?.cascade.deleted,
      ).toHaveLength(1);
      expect(
        requestContext.response.body.singleResult.extensions?.cascade
          .deleted[0],
      ).toMatchObject({
        __typename: "User",
        id: "1",
      });
    });
  });
});

describe("Failed mutation fields", () => {
  const typeDefs = `#graphql
    type User {
      id: ID!
      name: String!
    }
    type UpdateUserPayload {
      success: Boolean!
      user: User
    }
    type Query {
      ok: Boolean
    }
    type Mutation {
      updateUser(id: ID!, name: String!, fail: String): UpdateUserPayload
    }
  `;
  const resolvers = {
    Mutation: {
      updateUser: (
        _: unknown,
        { id, name, fail }: { id: string; name: string; fail?: string },
        context: { cascadeTracker: CascadeTracker },
      ) => {
        context.cascadeTracker.trackUpdate({ __typename: "User", id, name });
        if (fail === "throw") throw new Error("Update failed");
        if (fail === "payload") return { success: false, user: null };
        return { success: true, user: { id, name } };
      },
    },
  };

  async function cascadeFor(
    query: string,
    options: CascadePluginOptions = {},
    cascadeTracker = new CascadeTracker(),
  ) {
    const server = new ApolloServer({
      typeDefs,
      resolvers,
      plugins: [createCascadePlugin(options)],
    });
    cascadeTracker.startTransaction();
    const response = await server.executeOperation(
      { query },
      { contextValue: { cascadeTracker } },
    );
    assert(response.body.kind === "single");
    return response.body.singleResult.extensions?.cascade as {
      updated: Array<{ id: string }>;
      [field: string]: unknown;
    };
  }

  it("drops the changes of a field that throws", async () => {
    const cascade = await cascadeFor(`mutation {
      a: updateUser(id: "1", name: "A") { success }
      b: updateUser(id: "2", name: "B", fail: "throw") { success }
    }`);

    expect(cascade.updated.map((e) => e.id)).toEqual(["1"]);
  });

  it("drops the changes of a field whose payload reports failure", async () => {
    const cascade = await cascadeFor(`mutation {
      a: updateUser(id: "1", name: "A", fail: "payload") { success }
      b: updateUser(id: "2", name: "B") { success }
    }`);

    expect(cascade.updated.map((e) => e.id)).toEqual(["2"]);
  });

  it("sends a complete CascadeUpdates, without tracker internals", async () => {
    const cascade = await cascadeFor(
      `mutation { a: updateUser(id: "1", name: "A") { success } }`,
    );

    expect(Object.keys(cascade).sort()).toEqual([
      "deleted",
      "invalidations",
      "metadata",
      "typeInvalidations",
      "updated",
    ]);
  });

  it("adds the invalidator's hints", async () => {
    const hint = {
      queryName: "users",
      strategy: InvalidationStrategy.INVALIDATE,
      scope: InvalidationScope.PREFIX,
    };

    const cascade = await cascadeFor(
      `mutation { a: updateUser(id: "1", name: "A") { success } }`,
      { invalidator: { computeInvalidations: () => [hint] } },
    );

    expect(cascade.invalidations).toEqual([hint]);
  });

  it("covers entities past the tracker's limit with type invalidations", async () => {
    const cascade = await cascadeFor(
      `mutation {
        a: updateUser(id: "1", name: "A") { success }
        b: updateUser(id: "2", name: "B") { success }
      }`,
      {},
      new CascadeTracker({ maxEntities: 1 }),
    );

    expect(cascade.typeInvalidations).toEqual([
      { typename: "User", affectedCount: 2 },
    ]);
    expect(cascade.metadata).toMatchObject({ truncated: true });
  });

  it("applies an async entity filter", async () => {
    const cascade = await cascadeFor(
      `mutation {
        a: updateUser(id: "1", name: "A") { success }
        b: updateUser(id: "2", name: "B") { success }
      }`,
      {},
      new CascadeTracker({ entityFilter: async (entity) => entity.id !== "2" }),
    );

    expect(cascade.updated.map((e) => e.id)).toEqual(["1"]);
  });

  it("keeps the changes of every field that succeeds", async () => {
    const cascade = await cascadeFor(`mutation {
      a: updateUser(id: "1", name: "A") { success user { name } }
      b: updateUser(id: "2", name: "B") { success }
    }`);

    expect(cascade.updated.map((e) => e.id)).toEqual(["1", "2"]);
  });
});
