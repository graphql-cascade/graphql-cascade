import {
  graphQLErrorsOf,
  graphQLResultError,
  isApolloError,
  isNetworkError,
} from "./apollo-compat";

/** Errors shaped as each Apollo Client major raises them */
const v3 = (fields: {
  graphQLErrors?: unknown[];
  networkError?: Error | null;
}) =>
  Object.assign(new Error("Apollo Client 3"), {
    graphQLErrors: [],
    networkError: null,
    ...fields,
  });
const v4 = (name: string, fields: Record<string, unknown> = {}) =>
  Object.assign(new Error("Apollo Client 4"), { name, ...fields });

describe("apollo-compat", () => {
  it("recognizes Apollo errors of both majors", () => {
    expect(isApolloError(v3({}))).toBe(true);
    expect(isApolloError(v4("CombinedGraphQLErrors"))).toBe(true);
    expect(isApolloError(v4("ServerError"))).toBe(true);
    expect(isApolloError(new Error("other"))).toBe(false);
    expect(isApolloError({ graphQLErrors: [], networkError: null })).toBe(
      false,
    );
  });

  it("reads GraphQL errors from both majors", () => {
    const errors = [{ message: "Bad name" }];

    expect(graphQLErrorsOf(v3({ graphQLErrors: errors }))).toEqual(errors);
    expect(graphQLErrorsOf(v4("CombinedGraphQLErrors", { errors }))).toEqual(
      errors,
    );
    expect(graphQLErrorsOf(v4("ServerError", { errors }))).toEqual([]);
    expect(graphQLErrorsOf(null)).toEqual([]);
  });

  it("tells network errors from GraphQL errors", () => {
    expect(isNetworkError(v3({ networkError: new Error("down") }))).toBe(true);
    expect(isNetworkError(v3({}))).toBe(false);
    expect(isNetworkError(v4("ServerError"))).toBe(true);
    expect(isNetworkError(v4("ServerParseError"))).toBe(true);
    expect(isNetworkError(v4("CombinedGraphQLErrors"))).toBe(false);
    expect(isNetworkError("down")).toBe(false);
  });

  it("raises the installed major's error for GraphQL errors", () => {
    const error = graphQLResultError([{ message: "Bad name" }]);

    expect(isApolloError(error)).toBe(true);
    expect(graphQLErrorsOf(error)).toEqual([{ message: "Bad name" }]);
  });
});
