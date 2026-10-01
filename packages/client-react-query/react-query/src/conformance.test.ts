/**
 * Runs the specification's client conformance cases against TanStack Query.
 */
import { QueryClient } from "@tanstack/react-query";
import { toCascadeResponse } from "@graphql-cascade/client";
import {
  CASES,
  runClientCases,
  type ClientHarness,
  type ClientState,
} from "@graphql-cascade/conformance";
import { ReactQueryCascadeClient } from "./client";

type Fields = Record<string, unknown>;

/** Client cases skipped for a cache of this kind */
const skippedCases = (cache: "normalized" | "document") =>
  CASES.filter(
    (c) =>
      c.category === "client" && c.cache !== undefined && c.cache !== cache,
  ).map((c) => c.id);

const queryKey = (name: string, args?: Fields) =>
  args ? [name, args] : [name];

class ReactQueryHarness implements ClientHarness {
  readonly cache = "document";
  private queryClient = new QueryClient();
  private client = new ReactQueryCascadeClient(this.queryClient, () =>
    Promise.reject(new Error("The conformance cases run no operations")),
  );

  seed({ queries = [] }: ClientState) {
    // A document cache holds entities only inside query results.
    for (const { name, arguments: args, result } of queries) {
      this.queryClient.setQueryData(queryKey(name, args), result);
    }
  }

  apply(result: Fields) {
    const response = toCascadeResponse(result);
    if (response) this.client.applyCascade(response);
  }

  entity(typename: string, id: string) {
    return this.client.getCache().read(typename, id);
  }

  query(name: string, args?: Fields) {
    const state = this.queryClient.getQueryState(queryKey(name, args));
    return state === undefined || state.isInvalidated
      ? { state: "invalidated" as const }
      : { state: "fresh" as const, data: state.data };
  }
}

describe("client conformance", () => {
  it("passes every client case for document caches", async () => {
    const results = await runClientCases(() => new ReactQueryHarness());

    expect(
      results.filter((r) => r.status !== "passed").map((r) => r.id),
    ).toEqual(skippedCases("document"));
  });
});
