import {
  CascadeClient,
  applyTypeInvalidations,
  cascadeEntryTypename,
  toCascadeResponse,
} from "./client";
import {
  CascadeCache,
  CascadeResponse,
  CascadeOperation,
  InvalidationStrategy,
  InvalidationScope,
  QueryInvalidation,
} from "./types";
import { configureLogger, getLoggerConfig } from "./logger";

/**
 * Mock cache for testing - tracks all operations performed on it
 */
class MockCache implements CascadeCache {
  public written: Array<{ typename: string; id: string; data: any }> = [];
  public evicted: Array<{ typename: string; id: string }> = [];
  public invalidated: QueryInvalidation[] = [];
  public refetched: QueryInvalidation[] = [];
  public removed: QueryInvalidation[] = [];

  write(typename: string, id: string, data: any): void {
    this.written.push({ typename, id, data });
  }

  read(typename: string, id: string): any | null {
    const found = this.written.find(
      (w) => w.typename === typename && w.id === id,
    );
    return found?.data || null;
  }

  evict(typename: string, id: string): void {
    this.evicted.push({ typename, id });
  }

  invalidate(invalidation: QueryInvalidation): void {
    this.invalidated.push(invalidation);
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    this.refetched.push(invalidation);
  }

  remove(invalidation: QueryInvalidation): void {
    this.removed.push(invalidation);
  }

  identify(entity: any): string {
    return `${entity.__typename}:${entity.id}`;
  }
}

describe("CascadeClient", () => {
  let cache: MockCache;
  let mockExecutor: jest.Mock;
  let client: CascadeClient;

  beforeEach(() => {
    cache = new MockCache();
    mockExecutor = jest.fn();
    client = new CascadeClient(cache, mockExecutor);
  });

  describe("applyCascade", () => {
    it("should write primary data to cache when data has __typename and id", () => {
      const response: CascadeResponse = {
        success: true,
        data: { __typename: "User", id: "1", name: "John" },
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: "2024-01-01", depth: 1, affectedCount: 1 },
        },
      };

      client.applyCascade(response);

      expect(cache.written).toHaveLength(1);
      expect(cache.written[0]).toEqual({
        typename: "User",
        id: "1",
        data: { __typename: "User", id: "1", name: "John" },
      });
    });

    it("should write updated entities to cache", () => {
      const response: CascadeResponse = {
        success: true,
        data: null,
        cascade: {
          updated: [
            {
              typename: "User",
              id: "1",
              operation: CascadeOperation.UPDATED,
              entity: { name: "John" },
            },
            {
              typename: "Post",
              id: "2",
              operation: CascadeOperation.CREATED,
              entity: { title: "Hello" },
            },
          ],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: "2024-01-01", depth: 1, affectedCount: 2 },
        },
      };

      client.applyCascade(response);

      expect(cache.written).toHaveLength(2);
      expect(cache.written[0]).toEqual({
        typename: "User",
        id: "1",
        data: { name: "John" },
      });
      expect(cache.written[1]).toEqual({
        typename: "Post",
        id: "2",
        data: { title: "Hello" },
      });
    });

    it("should evict deleted entities from cache", () => {
      const response: CascadeResponse = {
        success: true,
        data: null,
        cascade: {
          updated: [],
          deleted: [
            { typename: "User", id: "1", deletedAt: "2024-01-01" },
            { typename: "Post", id: "2", deletedAt: "2024-01-01" },
          ],
          invalidations: [],
          metadata: { timestamp: "2024-01-01", depth: 1, affectedCount: 2 },
        },
      };

      client.applyCascade(response);

      expect(cache.evicted).toHaveLength(2);
      expect(cache.evicted[0]).toEqual({ typename: "User", id: "1" });
      expect(cache.evicted[1]).toEqual({ typename: "Post", id: "2" });
    });

    it("should call invalidate for INVALIDATE strategy", () => {
      const invalidation: QueryInvalidation = {
        queryName: "getUsers",
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.EXACT,
      };

      const response: CascadeResponse = {
        success: true,
        data: null,
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [invalidation],
          metadata: { timestamp: "2024-01-01", depth: 1, affectedCount: 0 },
        },
      };

      client.applyCascade(response);

      expect(cache.invalidated).toHaveLength(1);
      expect(cache.invalidated[0]).toEqual(invalidation);
    });

    it("should call refetch for REFETCH strategy", () => {
      const invalidation: QueryInvalidation = {
        queryName: "getUsers",
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.ALL,
      };

      const response: CascadeResponse = {
        success: true,
        data: null,
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [invalidation],
          metadata: { timestamp: "2024-01-01", depth: 1, affectedCount: 0 },
        },
      };

      client.applyCascade(response);

      expect(cache.refetched).toHaveLength(1);
    });

    it("should call remove for REMOVE strategy", () => {
      const invalidation: QueryInvalidation = {
        queryName: "getUsers",
        strategy: InvalidationStrategy.REMOVE,
        scope: InvalidationScope.PREFIX,
      };

      const response: CascadeResponse = {
        success: true,
        data: null,
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [invalidation],
          metadata: { timestamp: "2024-01-01", depth: 1, affectedCount: 0 },
        },
      };

      client.applyCascade(response);

      expect(cache.removed).toHaveLength(1);
    });
  });

  describe("deprecated __typename on cascade entries", () => {
    it("applies entries from pre-1.3 servers, which only send __typename", () => {
      const response = {
        success: true,
        data: null,
        cascade: {
          updated: [
            {
              __typename: "User",
              id: "1",
              operation: CascadeOperation.UPDATED,
              entity: { name: "John" },
            },
          ],
          deleted: [{ __typename: "Post", id: "2", deletedAt: "2024-01-01" }],
          invalidations: [],
          metadata: { timestamp: "2024-01-01", depth: 1, affectedCount: 2 },
        },
      } as unknown as CascadeResponse;

      client.applyCascade(response);

      expect(cache.written).toEqual([
        { typename: "User", id: "1", data: { name: "John" } },
      ]);
      expect(cache.evicted).toEqual([{ typename: "Post", id: "2" }]);
    });
  });

  describe("type invalidations", () => {
    const truncatedResponse = (typenames: string[]): CascadeResponse => ({
      success: true,
      data: null,
      cascade: {
        updated: [
          {
            typename: "Author",
            id: "1",
            operation: CascadeOperation.UPDATED,
            entity: { id: "1" },
          },
        ],
        deleted: [],
        invalidations: [],
        typeInvalidations: typenames.map((typename) => ({ typename })),
        metadata: {
          timestamp: "2024-01-01",
          depth: 1,
          affectedCount: 500,
          truncated: true,
        },
      },
    });

    class TypeAwareCache extends MockCache {
      public events: string[] = [];
      write(typename: string, id: string, data: any): void {
        this.events.push(`write:${typename}`);
        super.write(typename, id, data);
      }
      invalidateType(typename: string): void {
        this.events.push(`invalidateType:${typename}`);
      }
    }

    it("invalidates each type after applying entity updates", () => {
      const typeAware = new TypeAwareCache();
      new CascadeClient(typeAware, mockExecutor).applyCascade(
        truncatedResponse(["Post", "Comment"]),
      );

      expect(typeAware.events).toEqual([
        "write:Author",
        "invalidateType:Post",
        "invalidateType:Comment",
      ]);
    });

    it("falls back to one invalidation of every query when the cache cannot target types", () => {
      client.applyCascade(truncatedResponse(["Post", "Comment"]));

      expect(cache.invalidated).toEqual([
        {
          strategy: InvalidationStrategy.INVALIDATE,
          scope: InvalidationScope.ALL,
        },
      ]);
    });

    it("does nothing for responses from servers without type invalidations", () => {
      client.applyCascade({
        success: true,
        data: null,
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: "2024-01-01", depth: 0, affectedCount: 0 },
        },
      });

      expect(cache.invalidated).toEqual([]);
    });

    it("is exported for integrations that apply cascades themselves", () => {
      applyTypeInvalidations(cache, [{ typename: "Post" }]);

      expect(cache.invalidated).toHaveLength(1);
    });
  });

  describe("mutate", () => {
    it("should execute mutation, apply cascade, and return data", async () => {
      const cascadeResponse: CascadeResponse = {
        success: true,
        data: { __typename: "User", id: "1", name: "John" },
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: "2024-01-01", depth: 1, affectedCount: 1 },
        },
      };

      mockExecutor.mockResolvedValue({
        data: { createUser: cascadeResponse },
      });

      const result = await client.mutate({} as any, { name: "John" });

      expect(mockExecutor).toHaveBeenCalled();
      expect(result).toEqual({ __typename: "User", id: "1", name: "John" });
      expect(cache.written).toHaveLength(1);
    });
  });

  describe("query", () => {
    it("should execute query and return data without cascade processing", async () => {
      mockExecutor.mockResolvedValue({
        data: { users: [{ id: "1", name: "John" }] },
      });

      const result = await client.query({} as any);

      expect(result).toEqual({ users: [{ id: "1", name: "John" }] });
      expect(cache.written).toHaveLength(0);
    });
  });

  describe("getCache", () => {
    it("should return the cache instance", () => {
      expect(client.getCache()).toBe(cache);
    });
  });
});

describe("cascadeEntryTypename", () => {
  it("reads typename", () => {
    expect(cascadeEntryTypename({ typename: "User" })).toBe("User");
  });

  it("falls back to the deprecated __typename", () => {
    expect(cascadeEntryTypename({ __typename: "User" })).toBe("User");
  });

  it("prefers typename when both are present", () => {
    expect(
      cascadeEntryTypename({ typename: "User", __typename: "UpdatedEntity" }),
    ).toBe("User");
  });

  it("rejects entries without a type name", () => {
    expect(() => cascadeEntryTypename({})).toThrow(
      "Cascade entry has neither typename nor __typename",
    );
  });
});

describe("toCascadeResponse", () => {
  const cascade = {
    updated: [],
    deleted: [],
    invalidations: [],
    metadata: { timestamp: "2026-01-01", depth: 0, affectedCount: 0 },
  };
  const warning = { message: "Email not sent", code: "INTERNAL_ERROR" };

  it("keeps a 1.x CascadeResponse as it is", () => {
    const response = { success: true, errors: [], data: { id: "1" }, cascade };
    expect(toCascadeResponse(response)).toEqual(response);
  });

  it("reads a CascadePayload, whose warnings mark a partial success", () => {
    expect(
      toCascadeResponse({ data: { id: "1" }, cascade, warnings: [warning] }),
    ).toEqual({ success: true, errors: [warning], data: { id: "1" }, cascade });
  });

  it("turns a CascadeFailure into a failed response with an empty cascade", () => {
    const failure = { message: "Not found", code: "NOT_FOUND" };
    expect(toCascadeResponse({ errors: [failure] })).toEqual({
      success: false,
      errors: [failure],
      data: null,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        typeInvalidations: [],
        metadata: { timestamp: expect.any(String), depth: 0, affectedCount: 0 },
      },
    });
  });

  it("returns undefined for results that are not cascade results", () => {
    expect(toCascadeResponse({ id: "1" })).toBeUndefined();
    expect(toCascadeResponse(null)).toBeUndefined();
  });
});

describe("CascadeClient.mutate with result unions", () => {
  const entry = {
    typename: "User",
    id: "1",
    operation: CascadeOperation.UPDATED,
    entity: { name: "John" },
  };

  it("applies the cascade of a success payload", async () => {
    const cache = new MockCache();
    const client = new CascadeClient(cache, async () => ({
      data: {
        renameUser: {
          data: { id: "1" },
          warnings: [],
          cascade: {
            updated: [entry],
            deleted: [],
            invalidations: [],
            metadata: { timestamp: "2026-01-01", depth: 1, affectedCount: 1 },
          },
        },
      },
    }));

    const data = await client.mutate({} as any, {});

    expect(data).toEqual({ id: "1" });
    expect(cache.written).toEqual([
      { typename: "User", id: "1", data: { name: "John" } },
    ]);
  });

  it("applies nothing for a CascadeFailure", async () => {
    const cache = new MockCache();
    const client = new CascadeClient(cache, async () => ({
      data: {
        renameUser: { errors: [{ message: "Not found", code: "NOT_FOUND" }] },
      },
    }));

    const data = await client.mutate({} as any, {});

    expect(data).toBeNull();
    expect(cache.written).toEqual([]);
  });
});

describe("CascadeClient REFETCH hints", () => {
  const originalConfig = getLoggerConfig();
  afterEach(() => configureLogger(originalConfig));

  it("reports a refetch that fails instead of leaving it unhandled", async () => {
    const failure = new Error("network down");
    const cache = new MockCache();
    cache.refetch = () => Promise.reject(failure);
    const error = jest.fn();
    configureLogger({
      level: "error",
      logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error },
    });

    new CascadeClient(cache, jest.fn()).applyCascade({
      success: true,
      data: null,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [
          {
            queryName: "todos",
            strategy: InvalidationStrategy.REFETCH,
            scope: InvalidationScope.EXACT,
          },
        ],
        metadata: { timestamp: "t", depth: 0, affectedCount: 0 },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("todos"),
      failure,
    );
  });
});
