import { QueryClient } from "@tanstack/react-query";
import { ReactQueryCascadeCache } from "./cache";
import {
  InvalidationStrategy,
  InvalidationScope,
} from "@graphql-cascade/client";

describe("ReactQueryCascadeCache", () => {
  let queryClient: QueryClient;
  let cache: ReactQueryCascadeCache;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    cache = new ReactQueryCascadeCache(queryClient);
  });

  describe("write", () => {
    it("should update entity in query data", () => {
      // Set up initial query data
      queryClient.setQueryData(
        ["users"],
        [
          { __typename: "User", id: "1", name: "John" },
          { __typename: "User", id: "2", name: "Jane" },
        ],
      );

      // Update user 1
      cache.write("User", "1", { name: "John Updated" });

      const updatedData = queryClient.getQueryData(["users"]);
      expect(updatedData).toEqual([
        { __typename: "User", id: "1", name: "John Updated" },
        { __typename: "User", id: "2", name: "Jane" },
      ]);
    });
  });

  describe("read", () => {
    it("returns null for an entity no query holds", () => {
      expect(cache.read("User", "1")).toBeNull();
    });

    it("returns the entity's fields from every query holding it", () => {
      queryClient.setQueryData(
        ["users"],
        [{ __typename: "User", id: "1", name: "John" }],
      );
      queryClient.setQueryData(["user", { id: "1" }], {
        user: { __typename: "User", id: "1", email: "john@example.com" },
      });

      expect(cache.read("User", "1")).toEqual({
        __typename: "User",
        id: "1",
        name: "John",
        email: "john@example.com",
      });
    });
  });

  describe("evict", () => {
    it("should remove entity from query data", () => {
      // Set up initial query data
      queryClient.setQueryData(
        ["users"],
        [
          { __typename: "User", id: "1", name: "John" },
          { __typename: "User", id: "2", name: "Jane" },
        ],
      );

      // Evict user 1
      cache.evict("User", "1");

      const updatedData = queryClient.getQueryData(["users"]);
      expect(updatedData).toEqual([
        { __typename: "User", id: "2", name: "Jane" },
      ]);
    });
  });

  describe("hint scopes", () => {
    const keys = [
      ["getUser", { id: "1" }],
      ["getUser", { id: "2" }],
      ["listUsers"],
      ["listUsersByCompany", { companyId: "7" }],
      ["searchUsers", { term: "a" }],
    ];

    let fetched: unknown[][];

    beforeEach(async () => {
      fetched = [];
      await Promise.all(
        keys.map((queryKey) =>
          queryClient.prefetchQuery({
            queryKey,
            queryFn: () => {
              fetched.push(queryKey);
              return { value: 1 };
            },
          }),
        ),
      );
      fetched = [];
    });

    const invalidated = () =>
      keys.filter((key) => queryClient.getQueryState(key)?.isInvalidated);

    it("EXACT with arguments selects the query with those arguments", () => {
      cache.invalidate({
        queryName: "getUser",
        arguments: { id: "1" },
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.EXACT,
      });

      expect(invalidated()).toEqual([["getUser", { id: "1" }]]);
    });

    it("EXACT without arguments selects every query of that name", () => {
      cache.invalidate({
        queryName: "getUser",
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.EXACT,
      });

      expect(invalidated()).toEqual([
        ["getUser", { id: "1" }],
        ["getUser", { id: "2" }],
      ]);
    });

    it("PREFIX selects the queries whose name starts with queryName", () => {
      cache.invalidate({
        queryName: "listUsers",
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.PREFIX,
      });

      expect(invalidated()).toEqual([
        ["listUsers"],
        ["listUsersByCompany", { companyId: "7" }],
      ]);
    });

    it("PATTERN selects the queries whose name matches the glob", () => {
      cache.invalidate({
        queryPattern: "*Users*",
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.PATTERN,
      });

      expect(invalidated()).toEqual([
        ["listUsers"],
        ["listUsersByCompany", { companyId: "7" }],
        ["searchUsers", { term: "a" }],
      ]);
    });

    it("ALL selects every query", () => {
      cache.invalidate({
        strategy: InvalidationStrategy.INVALIDATE,
        scope: InvalidationScope.ALL,
      });

      expect(invalidated()).toEqual(keys);
    });

    it("refetch refetches the selected queries", async () => {
      await cache.refetch({
        queryName: "listUsers",
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.PREFIX,
      });

      expect(fetched).toEqual([
        ["listUsers"],
        ["listUsersByCompany", { companyId: "7" }],
      ]);
    });

    it("remove removes the selected queries", () => {
      cache.remove({
        queryName: "getUser",
        arguments: { id: "2" },
        strategy: InvalidationStrategy.REMOVE,
        scope: InvalidationScope.EXACT,
      });

      expect(
        keys.filter((key) => queryClient.getQueryData(key) === undefined),
      ).toEqual([["getUser", { id: "2" }]]);
    });
  });

  describe("identify", () => {
    it("should return entity identifier", () => {
      const entity = { __typename: "User", id: "1" };
      const result = cache.identify(entity);
      expect(result).toBe("User:1");
    });
  });
});
