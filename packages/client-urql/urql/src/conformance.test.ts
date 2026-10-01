/**
 * Runs the specification's client conformance cases against
 * InMemoryCascadeCache, through URQLCascadeClient.
 */
import type { Client } from "@urql/core";
import { toCascadeResponse } from "@graphql-cascade/client";
import {
  CASES,
  runClientCases,
  type ClientHarness,
  type ClientState,
} from "@graphql-cascade/conformance";
import { InMemoryCascadeCache } from "./cache";
import { URQLCascadeClient } from "./client";

type Fields = Record<string, unknown>;

/** Client cases skipped for a cache of this kind */
const skippedCases = (cache: "normalized" | "document") =>
  CASES.filter(
    (c) =>
      c.category === "client" && c.cache !== undefined && c.cache !== cache,
  ).map((c) => c.id);

class UrqlHarness implements ClientHarness {
  readonly cache = "normalized";
  private store = new InMemoryCascadeCache();
  private client = new URQLCascadeClient({} as Client, this.store);

  seed({ entities = [], queries = [] }: ClientState) {
    for (const entity of entities) {
      this.store.write(
        entity.__typename as string,
        entity.id as string,
        entity,
      );
    }
    for (const { name, arguments: args, result } of queries) {
      this.store.storeQuery(name, args, result);
    }
  }

  apply(result: Fields) {
    const response = toCascadeResponse(result);
    if (response) this.client.applyCascade(response.cascade);
  }

  entity(typename: string, id: string) {
    return this.store.read(typename, id);
  }

  query(name: string, args?: Fields) {
    const query = this.store.getQuery(name, args);
    return query === null || query.isStale
      ? { state: "invalidated" as const }
      : { state: "fresh" as const, data: query.data };
  }
}

describe("client conformance", () => {
  it("passes every client case for normalized caches", async () => {
    const results = await runClientCases(() => new UrqlHarness());

    expect(
      results.filter((r) => r.status !== "passed").map((r) => r.id),
    ).toEqual(skippedCases("normalized"));
  });
});
