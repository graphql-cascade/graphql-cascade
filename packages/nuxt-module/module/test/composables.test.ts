import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick } from "vue";
import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
  gql,
  type FetchResult,
} from "@apollo/client/core";
import { provideApolloClient } from "@vue/apollo-composable";
import {
  useCascadeBatch,
  useCascadeMutation,
  useCascadeOptimistic,
  useCascadeQuery,
  useCascadeTracker,
  useCascadeUnionQuery,
} from "../src/runtime/composables";

const USER = gql`
  fragment UserName on User {
    id
    name
  }
`;

const USERS_QUERY = gql`
  query Users {
    users {
      id
      name
    }
  }
`;

const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $name: String!) {
    updateUser(id: $id, name: $name) {
      __typename
      ... on UpdateUserSuccess {
        user {
          id
          name
        }
        cascade {
          updated {
            typename
            id
            operation
            entity
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
        }
      }
      ... on UpdateUserError {
        errors {
          message
        }
      }
    }
  }
`;

type Responder = (operationName: string) => FetchResult;

/** An Apollo Client whose network answers with `respond`, counting requests */
function createClient(respond: Responder) {
  const requests: string[] = [];
  const link = new ApolloLink(
    (operation) =>
      new Observable((observer) => {
        requests.push(operation.operationName);
        try {
          observer.next(respond(operation.operationName));
          observer.complete();
        } catch (error) {
          observer.error(error);
        }
      }),
  );
  const client = new ApolloClient({ link, cache: new InMemoryCache() });
  client.cache.writeFragment({
    id: "User:1",
    fragment: USER,
    data: { __typename: "User", id: "1", name: "Ada" },
  });
  client.cache.writeFragment({
    id: "User:2",
    fragment: USER,
    data: { __typename: "User", id: "2", name: "Grace" },
  });
  provideApolloClient(client);
  return { client, requests };
}

function success(cascade: Record<string, unknown>): FetchResult {
  return {
    data: {
      updateUser: {
        __typename: "UpdateUserSuccess",
        user: { __typename: "User", id: "1", name: "Ada" },
        cascade: {
          __typename: "Cascade",
          updated: [],
          deleted: [],
          invalidations: [],
          ...cascade,
        },
      },
    },
  };
}

function nameOf(client: ApolloClient<unknown>, id: string, optimistic = false) {
  return client.cache.readFragment<{ name: string }>({
    id: `User:${id}`,
    fragment: USER,
    optimistic,
  })?.name;
}

/** Run composables the way a component's setup would */
function inScope<T>(setup: () => T): T {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(setup) as T;
}

const scopes: ReturnType<typeof effectScope>[] = [];

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
});

describe("useCascadeMutation", () => {
  it("applies the cascade's updated entities to the cache", async () => {
    const { client } = createClient(() =>
      success({
        updated: [
          {
            __typename: "UpdatedEntity",
            typename: "User",
            id: "2",
            operation: "UPDATED",
            entity: { __typename: "User", id: "2", name: "Grace Hopper" },
          },
        ],
      }),
    );
    const { mutate } = inScope(() => useCascadeMutation(UPDATE_USER));

    await mutate({ id: "1", name: "Ada" });

    expect(nameOf(client, "2")).toBe("Grace Hopper");
  });

  it("evicts the cascade's deleted entities", async () => {
    const { client } = createClient(() =>
      success({
        deleted: [{ __typename: "DeletedEntity", typename: "User", id: "2" }],
      }),
    );
    const { mutate } = inScope(() => useCascadeMutation(UPDATE_USER));

    await mutate({ id: "1", name: "Ada" });

    expect(client.cache.extract()["User:2"]).toBeUndefined();
  });

  it("refetches the queries the cascade invalidates", async () => {
    let usersFetched = 0;
    const { requests } = createClient((operationName) => {
      if (operationName === "Users") {
        usersFetched += 1;
        return {
          data: {
            users: [
              { __typename: "User", id: "1", name: `Ada ${usersFetched}` },
            ],
          },
        };
      }
      return success({
        invalidations: [
          { queryName: "users", strategy: "INVALIDATE", scope: "EXACT" },
        ],
      });
    });
    const { query, mutation } = inScope(() => ({
      query: useCascadeQuery(USERS_QUERY),
      mutation: useCascadeMutation(UPDATE_USER),
    }));
    await vi.waitFor(() => expect(query.result.value?.users).toHaveLength(1));

    await mutation.mutate({ id: "1", name: "Ada" });

    await vi.waitFor(() =>
      expect(query.result.value?.users[0].name).toBe("Ada 2"),
    );
    expect(requests.filter((name) => name === "Users")).toHaveLength(2);
  });

  it("returns the extracted payload and reports the cascade", async () => {
    createClient(() => success({}));
    const onCascade = vi.fn();
    const { mutate, cascadeData, extractedData, isError } = inScope(() =>
      useCascadeMutation(UPDATE_USER, { onCascade }),
    );

    const result = await mutate({ id: "1", name: "Ada" });

    expect(result).toMatchObject({
      isError: false,
      typename: "UpdateUserSuccess",
      data: { id: "1", name: "Ada" },
    });
    expect(extractedData.value).toMatchObject({ id: "1" });
    expect(cascadeData.value).toMatchObject({ updated: [], deleted: [] });
    expect(isError.value).toBe(false);
    expect(onCascade).toHaveBeenCalledWith(cascadeData.value);
  });

  it("reports error union members without touching the cache", async () => {
    const { client } = createClient(() => ({
      data: {
        updateUser: {
          __typename: "UpdateUserError",
          errors: [{ __typename: "Error", message: "Name taken" }],
        },
      },
    }));
    const onCascade = vi.fn();
    const { mutate, isError, errors } = inScope(() =>
      useCascadeMutation(UPDATE_USER, {
        onCascade,
        cascadeConfig: { errorTypes: ["UpdateUserError"] },
      }),
    );

    await mutate({ id: "1", name: "Ada" });

    expect(isError.value).toBe(true);
    expect(errors.value).toEqual([
      { __typename: "Error", message: "Name taken" },
    ]);
    expect(onCascade).not.toHaveBeenCalled();
    expect(nameOf(client, "2")).toBe("Grace");
  });
});

describe("useCascadeBatch", () => {
  it("applies the cascade of each mutation and collects failures", async () => {
    let call = 0;
    const { client } = createClient(() => {
      call += 1;
      if (call === 2) throw new Error("offline");
      return success({
        updated: [
          {
            __typename: "UpdatedEntity",
            typename: "User",
            id: "2",
            operation: "UPDATED",
            entity: { __typename: "User", id: "2", name: "Grace Hopper" },
          },
        ],
      });
    });
    const { executeBatch, loading } = inScope(() => useCascadeBatch());

    const outcome = await executeBatch([
      { mutation: UPDATE_USER, variables: { id: "1", name: "Ada" } },
      { mutation: UPDATE_USER, variables: { id: "2", name: "Grace" } },
    ]);

    expect(outcome.results).toHaveLength(1);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.allSucceeded).toBe(false);
    expect(loading.value).toBe(false);
    expect(nameOf(client, "2")).toBe("Grace Hopper");
  });
});

describe("useCascadeOptimistic", () => {
  it("shows optimistic updates until the mutation settles", async () => {
    const { client } = createClient(() => success({}));
    const { optimisticUpdate, mutate, optimisticUpdates } = inScope(() =>
      useCascadeOptimistic(),
    );

    optimisticUpdate({ __typename: "User", id: "2", name: "Optimistic" });
    expect(nameOf(client, "2", true)).toBe("Optimistic");
    expect(nameOf(client, "2")).toBe("Grace");

    await mutate(UPDATE_USER, { variables: { id: "1", name: "Ada" } });

    expect(nameOf(client, "2", true)).toBe("Grace");
    expect(optimisticUpdates.value).toEqual([]);
  });

  it("reverts optimistic updates when the mutation fails", async () => {
    const { client } = createClient(() => {
      throw new Error("offline");
    });
    const { optimisticUpdate, mutate } = inScope(() => useCascadeOptimistic());

    optimisticUpdate({ __typename: "User", id: "2", name: "Optimistic" });

    await expect(
      mutate(UPDATE_USER, { variables: { id: "1", name: "Ada" } }),
    ).rejects.toThrow("offline");
    expect(nameOf(client, "2", true)).toBe("Grace");
  });

  it("clears optimistic updates on request", () => {
    const { client } = createClient(() => success({}));
    const { optimisticUpdate, clearOptimisticUpdates } = inScope(() =>
      useCascadeOptimistic(),
    );

    optimisticUpdate({ __typename: "User", id: "2", name: "Optimistic" });
    clearOptimisticUpdates();

    expect(nameOf(client, "2", true)).toBe("Grace");
  });
});

describe("useCascadeUnionQuery", () => {
  const USER_QUERY = gql`
    query User {
      user {
        __typename
        ... on GetUserSuccess {
          user {
            id
            name
          }
        }
        ... on GetUserError {
          errors {
            message
          }
        }
      }
    }
  `;

  it("unwraps the success member's data", async () => {
    createClient(() => ({
      data: {
        user: {
          __typename: "GetUserSuccess",
          user: { __typename: "User", id: "1", name: "Ada" },
        },
      },
    }));
    const { data, isError } = inScope(() => useCascadeUnionQuery(USER_QUERY));

    await vi.waitFor(() => expect(data.value).toMatchObject({ name: "Ada" }));
    expect(isError.value).toBe(false);
  });

  it("reports the error member's errors", async () => {
    createClient(() => ({
      data: {
        user: {
          __typename: "GetUserError",
          errors: [{ __typename: "Error", message: "Not found" }],
        },
      },
    }));
    const { data, isError, errors } = inScope(() =>
      useCascadeUnionQuery(USER_QUERY),
    );

    await vi.waitFor(() => expect(isError.value).toBe(true));
    expect(data.value).toBeNull();
    expect(errors.value).toEqual([
      { __typename: "Error", message: "Not found" },
    ]);
  });
});

describe("useCascadeTracker", () => {
  it("records cascades in order and clears them", async () => {
    const { addCascade, cascadeCount, lastCascade, clearHistory } =
      useCascadeTracker();

    addCascade({ updated: [] });
    addCascade({ deleted: [] });
    await nextTick();

    expect(cascadeCount.value).toBe(2);
    expect(lastCascade.value).toMatchObject({ deleted: [] });

    clearHistory();
    expect(cascadeCount.value).toBe(0);
  });
});
