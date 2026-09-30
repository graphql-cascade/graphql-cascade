import { URQLCascadeClient, OptimisticConfig } from "./client";
import { InMemoryCascadeCache } from "./cache";
import {
  CascadeUpdates,
  CascadeOperation,
  InvalidationStrategy,
  InvalidationScope,
} from "./types";
import type { Client, OperationResult, CombinedError } from "@urql/core";

// Mock URQL client
const createMockClient = (
  mockResult: Partial<OperationResult> = {},
): Client => {
  const defaultResult: OperationResult = {
    operation: {} as any,
    data: null,
    stale: false,
    hasNext: false,
    ...mockResult,
  };

  return {
    mutation: jest.fn().mockReturnValue({
      toPromise: jest.fn().mockResolvedValue(defaultResult),
    }),
  } as unknown as Client;
};

// Helper to create cascade updates
const createCascadeUpdates = (
  options: Partial<CascadeUpdates> = {},
): CascadeUpdates => ({
  updated: options.updated ?? [],
  deleted: options.deleted ?? [],
  invalidations: options.invalidations ?? [],
  typeInvalidations: options.typeInvalidations,
  metadata: options.metadata ?? {
    timestamp: new Date().toISOString(),
    depth: 1,
    affectedCount: 0,
  },
});

describe("URQLCascadeClient", () => {
  let mockClient: Client;
  let cache: InMemoryCascadeCache;
  let client: URQLCascadeClient;

  beforeEach(() => {
    mockClient = createMockClient();
    cache = new InMemoryCascadeCache();
    client = new URQLCascadeClient(mockClient, cache);
  });

  describe("constructor", () => {
    it("should create client with default config", () => {
      const config = client.getConfig();

      expect(config.autoApply).toBe(true);
      expect(config.excludeTypes).toEqual([]);
    });

    it("should merge provided config with defaults", () => {
      const customClient = new URQLCascadeClient(mockClient, cache, {
        autoApply: false,
        excludeTypes: ["AuditLog"],
      });

      const config = customClient.getConfig();

      expect(config.autoApply).toBe(false);
      expect(config.excludeTypes).toEqual(["AuditLog"]);
    });
  });

  describe("mutate", () => {
    it("should execute mutation and return result", async () => {
      const mockData = { createUser: { id: "1", name: "John" } };
      mockClient = createMockClient({ data: mockData });
      client = new URQLCascadeClient(mockClient, cache);

      const result = await client.mutate({} as any, { name: "John" });

      expect(result.data).toEqual(mockData);
      expect(result.error).toBeUndefined();
    });

    it("should extract and return cascade data", async () => {
      const cascade = createCascadeUpdates({
        updated: [
          {
            typename: "User",
            id: "1",
            operation: CascadeOperation.CREATED,
            entity: { name: "John" },
          },
        ],
      });

      const mockData = {
        createUser: {
          success: true,
          data: { id: "1", name: "John" },
        },
      };

      // Cascade data comes from extensions, not the data response
      mockClient = createMockClient({
        data: mockData,
        extensions: { cascade },
      });
      client = new URQLCascadeClient(mockClient, cache);

      const result = await client.mutate({} as any, {});

      expect(result.cascade).toEqual(cascade);
    });

    it("should apply cascade updates to cache by default", async () => {
      const cascade = createCascadeUpdates({
        updated: [
          {
            typename: "User",
            id: "1",
            operation: CascadeOperation.CREATED,
            entity: { name: "John" },
          },
        ],
      });

      const mockData = {
        createUser: {
          success: true,
          data: { id: "1", name: "John" },
        },
      };

      // Cascade data comes from extensions, not the data response
      mockClient = createMockClient({
        data: mockData,
        extensions: { cascade },
      });
      client = new URQLCascadeClient(mockClient, cache);

      await client.mutate({} as any, {});

      const cached = cache.read("User", "1");
      expect(cached).toBeTruthy();
      expect(cached?.name).toBe("John");
    });

    it("should not apply cascade when autoApply is false", async () => {
      const cascade = createCascadeUpdates({
        updated: [
          {
            typename: "User",
            id: "1",
            operation: CascadeOperation.CREATED,
            entity: { name: "John" },
          },
        ],
      });

      const mockData = {
        createUser: {
          success: true,
          data: { id: "1", name: "John" },
          cascade,
        },
      };

      mockClient = createMockClient({ data: mockData });
      client = new URQLCascadeClient(mockClient, cache, { autoApply: false });

      await client.mutate({} as any, {});

      const cached = cache.read("User", "1");
      expect(cached).toBeNull();
    });

    it("should return error from mutation result", async () => {
      const error = new Error("Mutation failed") as CombinedError;
      mockClient = createMockClient({ error, data: null });
      client = new URQLCascadeClient(mockClient, cache);

      const result = await client.mutate({} as any, {});

      expect(result.error).toBe(error);
      expect(result.data).toBeNull();
    });

    it("should handle timeout errors in mutation", async () => {
      const timeoutError = new Error("Request timeout") as CombinedError;
      mockClient = {
        mutation: jest.fn().mockReturnValue({
          toPromise: jest.fn().mockRejectedValue(timeoutError),
        }),
      } as unknown as Client;
      client = new URQLCascadeClient(mockClient, cache);

      await expect(client.mutate({} as any, {})).rejects.toThrow(
        "Request timeout",
      );
    });

    it("should handle network errors in mutation", async () => {
      const networkError = new Error("Network error") as CombinedError;
      mockClient = createMockClient({ error: networkError, data: null });
      client = new URQLCascadeClient(mockClient, cache);

      const result = await client.mutate({} as any, {});

      expect(result.error).toBe(networkError);
      expect(result.data).toBeNull();
      expect(result.cascade).toBeNull();
    });

    it("should handle GraphQL validation errors in mutation", async () => {
      const validationError = new Error(
        "GraphQL validation error",
      ) as CombinedError;
      mockClient = createMockClient({ error: validationError, data: null });
      client = new URQLCascadeClient(mockClient, cache);

      const result = await client.mutate({} as any, {});

      expect(result.error).toBe(validationError);
      expect(result.data).toBeNull();
    });
  });

  describe("applyCascade", () => {
    it("marks cached queries stale for type invalidations", () => {
      cache.storeQuery("listPosts", undefined, [
        { __typename: "Post", id: "1" },
      ]);

      client.applyCascade(
        createCascadeUpdates({ typeInvalidations: [{ typename: "Post" }] }),
      );

      expect(cache.getQuery("listPosts")?.isStale).toBe(true);
    });

    it("ignores type invalidations for excluded types", () => {
      const excluding = new URQLCascadeClient(mockClient, cache, {
        excludeTypes: ["AuditLog"],
      });
      cache.storeQuery("listPosts", undefined, []);

      excluding.applyCascade(
        createCascadeUpdates({ typeInvalidations: [{ typename: "AuditLog" }] }),
      );

      expect(cache.getQuery("listPosts")?.isStale).toBe(false);
    });
  });

  describe("mutateOptimistic", () => {
    it("should apply optimistic updates before mutation", async () => {
      const optimisticConfig: OptimisticConfig<
        { id: string; name: string },
        { name: string }
      > = {
        optimisticResponse: (vars) => ({ id: "temp-1", name: vars.name }),
        optimisticCascade: (vars, response) =>
          createCascadeUpdates({
            updated: [
              {
                typename: "User",
                id: response.id,
                operation: CascadeOperation.CREATED,
                entity: response,
              },
            ],
          }),
      };

      const serverCascade = createCascadeUpdates({
        updated: [
          {
            typename: "User",
            id: "1",
            operation: CascadeOperation.CREATED,
            entity: { id: "1", name: "John" },
          },
        ],
      });

      const mockData = {
        createUser: {
          success: true,
          data: { id: "1", name: "John" },
          cascade: serverCascade,
        },
      };

      mockClient = createMockClient({ data: mockData });
      client = new URQLCascadeClient(mockClient, cache);

      const result = await client.mutateOptimistic(
        {} as any,
        { name: "John" },
        optimisticConfig,
      );

      expect(result.data).toEqual(mockData);
    });

    it("should rollback optimistic updates on error", async () => {
      // Pre-populate cache
      cache.write("User", "1", { id: "1", name: "Original" });

      const optimisticConfig: OptimisticConfig<
        { id: string; name: string },
        { name: string }
      > = {
        optimisticResponse: (vars) => ({ id: "1", name: vars.name }),
        optimisticCascade: () =>
          createCascadeUpdates({
            updated: [
              {
                typename: "User",
                id: "1",
                operation: CascadeOperation.UPDATED,
                entity: { id: "1", name: "Optimistic" },
              },
            ],
          }),
      };

      mockClient = {
        mutation: jest.fn().mockReturnValue({
          toPromise: jest.fn().mockRejectedValue(new Error("Network error")),
        }),
      } as unknown as Client;
      client = new URQLCascadeClient(mockClient, cache);

      await expect(
        client.mutateOptimistic(
          {} as any,
          { name: "Optimistic" },
          optimisticConfig,
        ),
      ).rejects.toThrow("Network error");

      // Should rollback to original
      const cached = cache.read("User", "1");
      expect(cached?.name).toBe("Original");
    });

    describe("rolls back when the mutation does not succeed", () => {
      const optimisticConfig: OptimisticConfig<
        { id: string; name: string },
        { name: string }
      > = {
        optimisticResponse: (vars) => ({ id: "1", name: vars.name }),
        optimisticCascade: () =>
          createCascadeUpdates({
            updated: [
              {
                typename: "User",
                id: "1",
                operation: CascadeOperation.UPDATED,
                entity: { id: "1", name: "Optimistic" },
              },
            ],
          }),
      };

      it.each<[string, Partial<OperationResult>]>([
        [
          "an error result",
          { error: new Error("Network error") as unknown as CombinedError },
        ],
        [
          "a failure payload",
          {
            data: {
              renameUser: {
                __typename: "CascadeFailure",
                errors: [{ message: "Taken", code: "CONFLICT" }],
              },
            },
          },
        ],
      ])("%s", async (_, mockResult) => {
        cache.write("User", "1", { id: "1", name: "Original" });
        client = new URQLCascadeClient(createMockClient(mockResult), cache);

        await client.mutateOptimistic(
          {} as any,
          { name: "Optimistic" },
          optimisticConfig,
        );

        expect(cache.read("User", "1")?.name).toBe("Original");
      });
    });

    it("should evict new entities on rollback", async () => {
      const optimisticConfig: OptimisticConfig<
        { id: string; name: string },
        { name: string }
      > = {
        optimisticResponse: (vars) => ({ id: "new-1", name: vars.name }),
        optimisticCascade: () =>
          createCascadeUpdates({
            updated: [
              {
                typename: "User",
                id: "new-1",
                operation: CascadeOperation.CREATED,
                entity: { id: "new-1", name: "New" },
              },
            ],
          }),
      };

      mockClient = {
        mutation: jest.fn().mockReturnValue({
          toPromise: jest.fn().mockRejectedValue(new Error("Network error")),
        }),
      } as unknown as Client;
      client = new URQLCascadeClient(mockClient, cache);

      await expect(
        client.mutateOptimistic({} as any, { name: "New" }, optimisticConfig),
      ).rejects.toThrow("Network error");

      // Should evict the new entity
      const cached = cache.read("User", "new-1");
      expect(cached).toBeNull();
    });
  });

  describe("applyCascade", () => {
    it("should write updated entities to cache", () => {
      const cascade = createCascadeUpdates({
        updated: [
          {
            typename: "User",
            id: "1",
            operation: CascadeOperation.CREATED,
            entity: { name: "John" },
          },
          {
            typename: "User",
            id: "2",
            operation: CascadeOperation.UPDATED,
            entity: { name: "Jane" },
          },
        ],
      });

      client.applyCascade(cascade);

      expect(cache.read("User", "1")?.name).toBe("John");
      expect(cache.read("User", "2")?.name).toBe("Jane");
    });

    it("applies entries from pre-1.3 servers, which only send __typename", () => {
      cache.write("User", "2", { id: "2", name: "Gone" });
      const cascade = createCascadeUpdates({
        updated: [
          {
            __typename: "User",
            id: "1",
            operation: CascadeOperation.CREATED,
            entity: { name: "John" },
          },
        ],
        deleted: [{ __typename: "User", id: "2", deletedAt: "2024-01-01" }],
      } as unknown as Partial<CascadeUpdates>);

      client.applyCascade(cascade);

      expect(cache.read("User", "1")?.name).toBe("John");
      expect(cache.read("User", "2")).toBeNull();
    });

    it("should evict deleted entities from cache", () => {
      cache.write("User", "1", { id: "1", name: "John" });

      const cascade = createCascadeUpdates({
        deleted: [
          { typename: "User", id: "1", deletedAt: new Date().toISOString() },
        ],
      });

      client.applyCascade(cascade);

      expect(cache.read("User", "1")).toBeNull();
    });

    it("should evict entities with DELETED operation in updated array", () => {
      cache.write("User", "1", { id: "1", name: "John" });

      const cascade = createCascadeUpdates({
        updated: [
          {
            typename: "User",
            id: "1",
            operation: CascadeOperation.DELETED,
            entity: {},
          },
        ],
      });

      client.applyCascade(cascade);

      expect(cache.read("User", "1")).toBeNull();
    });

    it("should skip excluded types", () => {
      client = new URQLCascadeClient(mockClient, cache, {
        excludeTypes: ["AuditLog"],
      });

      const cascade = createCascadeUpdates({
        updated: [
          {
            typename: "User",
            id: "1",
            operation: CascadeOperation.CREATED,
            entity: { name: "John" },
          },
          {
            typename: "AuditLog",
            id: "1",
            operation: CascadeOperation.CREATED,
            entity: { action: "create" },
          },
        ],
      });

      client.applyCascade(cascade);

      expect(cache.read("User", "1")).toBeTruthy();
      expect(cache.read("AuditLog", "1")).toBeNull();
    });

    it("should process invalidations with INVALIDATE strategy", () => {
      cache.storeQuery("getUsers", undefined, []);

      const cascade = createCascadeUpdates({
        invalidations: [
          {
            strategy: InvalidationStrategy.INVALIDATE,
            scope: InvalidationScope.EXACT,
            queryName: "getUsers",
          },
        ],
      });

      client.applyCascade(cascade);

      const query = cache.getQuery("getUsers");
      expect(query?.isStale).toBe(true);
    });

    it("should process invalidations with REMOVE strategy", () => {
      cache.storeQuery("getUsers", undefined, []);

      const cascade = createCascadeUpdates({
        invalidations: [
          {
            strategy: InvalidationStrategy.REMOVE,
            scope: InvalidationScope.EXACT,
            queryName: "getUsers",
          },
        ],
      });

      client.applyCascade(cascade);

      expect(cache.getQuery("getUsers")).toBeNull();
    });
  });

  describe("getClient", () => {
    it("should return the underlying URQL client", () => {
      expect(client.getClient()).toBe(mockClient);
    });
  });

  describe("getCache", () => {
    it("should return the cache adapter", () => {
      expect(client.getCache()).toBe(cache);
    });
  });
});

describe("URQLCascadeClient payload cascades", () => {
  const renameTo = (name: string) =>
    createCascadeUpdates({
      updated: [
        {
          typename: "User",
          id: "1",
          operation: CascadeOperation.UPDATED,
          entity: { name },
        },
      ],
    });

  async function mutateWith(result: Partial<OperationResult>) {
    const cache = new InMemoryCascadeCache();
    const client = new URQLCascadeClient(createMockClient(result), cache);
    const outcome = await client.mutate({} as any, {});
    return { cache, outcome };
  }

  it("applies the cascade carried in the mutation payload", async () => {
    const { cache } = await mutateWith({
      data: {
        renameUser: {
          success: true,
          data: { id: "1" },
          cascade: renameTo("New"),
        },
      },
    });

    expect(cache.read("User", "1")?.name).toBe("New");
  });

  it("applies every mutation field's cascade, in field order", async () => {
    const { cache } = await mutateWith({
      data: {
        first: { data: null, warnings: [], cascade: renameTo("First") },
        second: { data: null, warnings: [], cascade: renameTo("Second") },
      },
    });

    expect(cache.read("User", "1")?.name).toBe("Second");
  });

  it("applies nothing for a CascadeFailure", async () => {
    const { cache } = await mutateWith({
      data: {
        renameUser: { errors: [{ message: "Not found", code: "NOT_FOUND" }] },
      },
    });

    expect(cache.read("User", "1")).toBeNull();
  });

  it("uses extensions.cascade only when no payload carries a cascade", async () => {
    const { cache } = await mutateWith({
      data: { renameUser: { cascade: renameTo("Payload") } },
      extensions: { cascade: renameTo("Extensions") },
    });

    expect(cache.read("User", "1")?.name).toBe("Payload");
  });
});
