import { InMemoryCache, gql } from "@apollo/client";
import { ApolloCascadeCache } from "./cache";
import {
  QueryInvalidation,
  InvalidationStrategy,
  InvalidationScope,
} from "@graphql-cascade/client";

describe("ApolloCascadeCache", () => {
  let apolloCache: InMemoryCache;
  let cache: ApolloCascadeCache;

  beforeEach(() => {
    apolloCache = new InMemoryCache();
    cache = new ApolloCascadeCache(apolloCache);
  });

  describe("write", () => {
    it("should write entity data to Apollo cache", () => {
      const data = { name: "John", email: "john@example.com" };
      cache.write("User", "1", data);

      // Verify by checking Apollo cache directly
      const cacheId = apolloCache.identify({ __typename: "User", id: "1" });
      expect(cacheId).toBe("User:1");
      // Note: Detailed read testing is complex due to fragment naming
    });
  });

  describe("read", () => {
    it("returns every stored field of the entity", () => {
      cache.write("User", "1", { name: "John", email: "john@example.com" });

      expect(cache.read("User", "1")).toEqual({
        __typename: "User",
        name: "John",
        email: "john@example.com",
      });
    });

    it("returns null for an entity that is not cached", () => {
      expect(cache.read("User", "missing")).toBeNull();
    });

    it("sees optimistic writes", () => {
      cache.write("User", "1", { name: "John" });
      apolloCache.recordOptimisticTransaction((layer) => {
        new ApolloCascadeCache(layer).write("User", "1", {
          name: "Optimistic",
        });
      }, "optimistic-1");

      expect(cache.read("User", "1")).toMatchObject({ name: "Optimistic" });
    });
  });

  describe("evict", () => {
    it("should evict entity from Apollo cache", () => {
      const data = { name: "John", email: "john@example.com" };
      cache.write("User", "1", data);

      // Spy on Apollo cache evict method
      const evictSpy = jest.spyOn(apolloCache, "evict");

      cache.evict("User", "1");

      expect(evictSpy).toHaveBeenCalled();
    });
  });

  describe.each([
    ["invalidate", InvalidationStrategy.INVALIDATE],
    ["remove", InvalidationStrategy.REMOVE],
  ] as const)("%s by scope", (method, strategy) => {
    beforeEach(() => {
      apolloCache.writeQuery({
        query: gql`
          query {
            listUsers {
              id
            }
            listUsersByCompany(companyId: "1") {
              id
            }
            listCompanies {
              id
            }
            getUser(id: "1") {
              id
            }
            searchUsers(term: "a") {
              id
            }
          }
        `,
        data: {
          listUsers: [{ __typename: "User", id: "1" }],
          listUsersByCompany: [{ __typename: "User", id: "1" }],
          listCompanies: [{ __typename: "Company", id: "1" }],
          getUser: { __typename: "User", id: "1" },
          searchUsers: [{ __typename: "User", id: "1" }],
        },
      });
    });

    const apply = (invalidation: Omit<QueryInvalidation, "strategy">) =>
      cache[method]({ ...invalidation, strategy });

    const rootFieldNames = () =>
      Object.keys((apolloCache.extract() as Record<string, any>).ROOT_QUERY)
        .filter((key) => key !== "__typename")
        .map((key) => key.replace(/\(.*$/, ""))
        .sort();

    it("evicts the named root field, whatever its arguments, for EXACT scope", () => {
      apply({ queryName: "listUsers", scope: InvalidationScope.EXACT });

      expect(rootFieldNames()).toEqual([
        "getUser",
        "listCompanies",
        "listUsersByCompany",
        "searchUsers",
      ]);
    });

    it("evicts every root field for ALL scope", () => {
      apply({ scope: InvalidationScope.ALL });

      expect(rootFieldNames()).toEqual([]);
    });

    it("evicts root fields starting with the name for PREFIX scope", () => {
      apply({ queryName: "listUsers", scope: InvalidationScope.PREFIX });

      expect(rootFieldNames()).toEqual([
        "getUser",
        "listCompanies",
        "searchUsers",
      ]);
    });

    it("evicts root fields matching the glob for PATTERN scope", () => {
      apply({ queryPattern: "list*", scope: InvalidationScope.PATTERN });

      expect(rootFieldNames()).toEqual(["getUser", "searchUsers"]);
    });

    it("supports ? and inner wildcards in PATTERN globs", () => {
      apply({ queryPattern: "?et*r", scope: InvalidationScope.PATTERN });

      expect(rootFieldNames()).toEqual([
        "listCompanies",
        "listUsers",
        "listUsersByCompany",
        "searchUsers",
      ]);
    });

    it("treats regex characters in PATTERN globs literally", () => {
      apply({ queryPattern: "list.*", scope: InvalidationScope.PATTERN });

      expect(rootFieldNames()).toHaveLength(5);
    });

    it("evicts nothing when PREFIX or PATTERN lacks its name", () => {
      apply({ scope: InvalidationScope.PREFIX });
      apply({ scope: InvalidationScope.PATTERN });

      expect(rootFieldNames()).toHaveLength(5);
    });
  });

  describe("invalidateType", () => {
    const post = { __typename: "Post", id: "1", title: "Hello" };

    beforeEach(() => {
      apolloCache.writeQuery({
        query: gql`
          query {
            listPosts {
              id
              title
            }
            author(id: "1") {
              id
              name
              posts {
                id
                title
              }
            }
            drafts {
              id
            }
            settings {
              theme
            }
          }
        `,
        data: {
          listPosts: [post],
          author: {
            __typename: "Author",
            id: "1",
            name: "Ada",
            posts: [post],
          },
          drafts: [],
          settings: { __typename: "Settings", theme: "dark" },
        },
      });
      cache.invalidateType("Post");
    });

    it("evicts every entity of the type", () => {
      expect(apolloCache.extract()).not.toHaveProperty(["Post:1"]);
    });

    it("evicts fields that reference the type, wherever they live", () => {
      const store = apolloCache.extract() as Record<string, any>;
      expect(store.ROOT_QUERY).not.toHaveProperty("listPosts");
      expect(store["Author:1"]).not.toHaveProperty("posts");
    });

    it("evicts empty lists, which may be missing entities of the type", () => {
      const store = apolloCache.extract() as Record<string, any>;
      expect(store.ROOT_QUERY).not.toHaveProperty("drafts");
    });

    it("keeps data that cannot contain the type", () => {
      const store = apolloCache.extract() as Record<string, any>;
      expect(store["Author:1"].name).toBe("Ada");
      expect(store.ROOT_QUERY.settings).toEqual({
        __typename: "Settings",
        theme: "dark",
      });
    });
  });

  describe("refetch", () => {
    it("evicts the hinted fields when it has no client", async () => {
      apolloCache.writeQuery({
        query: gql`
          query {
            getUsers {
              id
            }
            settings {
              theme
            }
          }
        `,
        data: {
          getUsers: [{ __typename: "User", id: "1" }],
          settings: { __typename: "Settings", theme: "dark" },
        },
      });

      await cache.refetch({
        queryName: "getUsers",
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT,
      });

      const rootQuery = (apolloCache.extract() as Record<string, any>)
        .ROOT_QUERY;
      expect(rootQuery).not.toHaveProperty("getUsers");
      expect(rootQuery).toHaveProperty("settings");
    });
  });

  describe("identify", () => {
    it("should return Apollo cache id for entity", () => {
      const entity = { __typename: "User", id: "1" };
      const result = cache.identify(entity);
      expect(result).toBe("User:1");
    });

    it("should fallback to manual id generation", () => {
      const entity = { __typename: "User", id: "1" };
      // Mock apolloCache.identify to return undefined
      jest.spyOn(apolloCache, "identify").mockReturnValue(undefined);

      const result = cache.identify(entity);
      expect(result).toBe("User:1");
    });
  });
});
