import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
  gql,
} from "@apollo/client";
import type { AnyApolloClient } from "./apollo-compat";
import { ApolloCascadeClient } from "./client";
import {
  InvalidationStrategy,
  InvalidationScope,
} from "@graphql-cascade/client";

/** An Observable emitting `value`, then completing */
const observableOf = <T>(value: T) =>
  new Observable<T>((observer) => {
    observer.next(value);
    observer.complete();
  });

describe("ApolloCascadeClient", () => {
  let apolloClient: AnyApolloClient;
  let client: ApolloCascadeClient;

  beforeEach(() => {
    apolloClient = new ApolloClient({
      cache: new InMemoryCache(),
      // Mock link for testing
      link: {
        request: jest.fn(),
        split: jest.fn(),
        concat: jest.fn(),
        setOnError: jest.fn(),
      } as any,
    });
    client = new ApolloCascadeClient(apolloClient);
  });

  describe("mutate", () => {
    it("should execute mutation and apply cascade", async () => {
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

      jest.spyOn(apolloClient, "mutate").mockResolvedValue(mockResult);

      const result = await client.mutate({} as any, { name: "John" });

      expect(apolloClient.mutate).toHaveBeenCalled();
      expect(result).toEqual({ __typename: "User", id: "1", name: "John" });
    });
  });

  describe("query", () => {
    it("should execute query and return data", async () => {
      const mockResult = {
        data: { users: [{ id: "1", name: "John" }] },
      };

      jest.spyOn(apolloClient, "query").mockResolvedValue({
        ...mockResult,
        loading: false,
        networkStatus: 7, // NetworkStatus.ready
      } as any);

      const result = await client.query({} as any);

      expect(apolloClient.query).toHaveBeenCalled();
      expect(result).toEqual({ users: [{ id: "1", name: "John" }] });
    });
  });

  describe("getApolloClient", () => {
    it("should return the underlying Apollo Client", () => {
      expect(client.getApolloClient()).toBe(apolloClient);
    });
  });
});

describe("ApolloCascadeClient.mutate with result unions", () => {
  const RENAME = gql`
    mutation Rename {
      renameUser {
        ... on RenameUserPayload {
          data {
            id
          }
          warnings {
            message
            code
          }
          cascade {
            updated {
              typename
              id
              operation
              entity {
                id
                ... on User {
                  name
                }
              }
            }
            deleted {
              typename
              id
            }
            invalidations {
              queryName
              strategy
              scope
            }
            metadata {
              timestamp
              depth
              affectedCount
            }
          }
        }
        ... on CascadeFailure {
          errors {
            message
            code
          }
        }
      }
    }
  `;

  function clientReturning(renameUser: Record<string, unknown>) {
    const cache = new InMemoryCache({
      possibleTypes: {
        RenameUserResult: ["RenameUserPayload", "CascadeFailure"],
        Node: ["User"],
      },
    });
    const apollo = new ApolloClient({
      cache,
      link: new ApolloLink(() => observableOf({ data: { renameUser } })),
    });
    return { cache, client: new ApolloCascadeClient(apollo) };
  }

  it("applies the cascade of a success payload", async () => {
    const { cache, client } = clientReturning({
      __typename: "RenameUserPayload",
      data: { __typename: "User", id: "1" },
      warnings: [],
      cascade: {
        __typename: "CascadeUpdates",
        updated: [
          {
            __typename: "UpdatedEntity",
            typename: "User",
            id: "1",
            operation: "UPDATED",
            entity: { __typename: "User", id: "1", name: "New" },
          },
        ],
        deleted: [],
        invalidations: [],
        metadata: {
          __typename: "CascadeMetadata",
          timestamp: "t",
          depth: 1,
          affectedCount: 1,
        },
      },
    });

    const data = await client.mutate(RENAME);

    expect(data).toEqual({ __typename: "User", id: "1" });
    expect(cache.extract()["User:1"]).toMatchObject({ name: "New" });
  });

  it("applies nothing for a CascadeFailure", async () => {
    const { cache, client } = clientReturning({
      __typename: "CascadeFailure",
      errors: [
        { __typename: "CascadeError", message: "Not found", code: "NOT_FOUND" },
      ],
    });

    const data = await client.mutate(RENAME);

    expect(data).toBeNull();
    expect(cache.extract()["User:1"]).toBeUndefined();
  });
});

describe("ApolloCascadeClient REFETCH hints", () => {
  const TODOS = gql`
    query Todos {
      todos {
        id
        title
      }
    }
  `;
  const ADD = gql`
    mutation AddTodo {
      addTodo {
        success
        data {
          id
        }
        cascade {
          updated {
            typename
            id
          }
          invalidations {
            queryName
            strategy
            scope
          }
        }
      }
    }
  `;

  it("refetches the active queries reading the hinted field", async () => {
    let todosFetches = 0;
    const apollo = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink((operation) => {
        if (operation.operationName === "Todos") {
          todosFetches++;
          return observableOf({
            data: { todos: [{ __typename: "Todo", id: "1", title: "A" }] },
          });
        }
        return observableOf({
          data: {
            addTodo: {
              success: true,
              data: { __typename: "Todo", id: "2" },
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
                metadata: { timestamp: "t", depth: 1, affectedCount: 0 },
              },
            },
          },
        });
      }),
    });
    const watched = apollo.watchQuery({ query: TODOS }).subscribe(() => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(todosFetches).toBe(1);

    await new ApolloCascadeClient(apollo).mutate(ADD);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(todosFetches).toBe(2);
    watched.unsubscribe();
  });
});
