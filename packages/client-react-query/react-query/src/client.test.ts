import { QueryClient } from "@tanstack/react-query";
import { CascadeOperation } from "@graphql-cascade/client";
import { ReactQueryCascadeClient } from "./client";

describe("ReactQueryCascadeClient", () => {
  let queryClient: QueryClient;
  let mockExecutor: jest.Mock;
  let client: ReactQueryCascadeClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockExecutor = jest.fn();
    client = new ReactQueryCascadeClient(queryClient, mockExecutor);
  });

  describe("constructor", () => {
    it("should initialize with QueryClient and executor", () => {
      expect(client).toBeInstanceOf(ReactQueryCascadeClient);
    });
  });

  describe("getQueryClient", () => {
    it("should return the underlying QueryClient", () => {
      expect(client.getQueryClient()).toBe(queryClient);
    });
  });

  describe("type invalidations", () => {
    it("invalidate every cached query, since documents are not normalized by type", () => {
      queryClient.setQueryData(
        ["listPosts"],
        [{ __typename: "Post", id: "1" }],
      );
      queryClient.setQueryData(["drafts"], []);

      client.applyCascade({
        success: true,
        data: null,
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [],
          typeInvalidations: [{ typename: "Post" }],
          metadata: {
            timestamp: "2024-01-01T00:00:00Z",
            depth: 0,
            affectedCount: 800,
            truncated: true,
          },
        },
      });

      expect(queryClient.getQueryState(["listPosts"])?.isInvalidated).toBe(
        true,
      );
      expect(queryClient.getQueryState(["drafts"])?.isInvalidated).toBe(true);
    });
  });

  describe("mutate", () => {
    it("should execute mutation through executor", async () => {
      const mockResult = {
        data: {
          createUser: {
            success: true,
            data: { __typename: "User", id: "1", name: "John" },
            cascade: {
              updated: [],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: "2024-01-01", depth: 1, affectedCount: 1 },
            },
          },
        },
      };

      mockExecutor.mockResolvedValue(mockResult);

      const result = await client.mutate({} as any, { name: "John" });

      expect(mockExecutor).toHaveBeenCalled();
      expect(result).toEqual({ __typename: "User", id: "1", name: "John" });
    });
  });

  describe("mutateOptimistic", () => {
    it("restores query data when the mutation fails", async () => {
      queryClient.setQueryData(
        ["users"],
        [
          { __typename: "User", id: "1", name: "John" },
          { __typename: "User", id: "2", name: "Jane" },
        ],
      );
      mockExecutor.mockRejectedValue(new Error("network down"));

      await expect(
        client.mutateOptimistic(
          {} as any,
          {},
          {
            success: true,
            data: null,
            cascade: {
              updated: [
                {
                  typename: "User",
                  id: "1",
                  operation: CascadeOperation.UPDATED,
                  entity: { __typename: "User", id: "1", name: "Johnny" },
                },
              ],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: "t", depth: 1, affectedCount: 1 },
            },
          },
        ),
      ).rejects.toThrow("network down");

      expect(queryClient.getQueryData(["users"])).toEqual([
        { __typename: "User", id: "1", name: "John" },
        { __typename: "User", id: "2", name: "Jane" },
      ]);
    });
  });

  describe("query", () => {
    it("should execute query through executor", async () => {
      const mockResult = {
        data: { users: [{ id: "1", name: "John" }] },
      };

      mockExecutor.mockResolvedValue(mockResult);

      const result = await client.query({} as any);

      expect(mockExecutor).toHaveBeenCalled();
      expect(result).toEqual({ users: [{ id: "1", name: "John" }] });
    });
  });
});
