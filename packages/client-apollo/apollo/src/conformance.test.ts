/**
 * Runs the specification's client conformance cases against Apollo's cache.
 */
import { ApolloClient, ApolloLink, InMemoryCache, gql } from "@apollo/client";
import type { DocumentNode } from "graphql";
import { toCascadeResponse } from "@graphql-cascade/client";
import {
  CASES,
  runClientCases,
  type ClientHarness,
  type ClientState,
} from "@graphql-cascade/conformance";
import { ApolloCascadeCache } from "./cache";
import { ApolloCascadeClient } from "./client";

type Fields = Record<string, unknown>;

/** Client cases skipped for a cache of this kind */
const skippedCases = (cache: "normalized" | "document") =>
  CASES.filter(
    (c) =>
      c.category === "client" && c.cache !== undefined && c.cache !== cache,
  ).map((c) => c.id);

/** A selection set reading `value` as cached. */
function selection(value: unknown): string {
  const items = Array.isArray(value) ? value : [value];
  const fields = new Map<string, unknown[]>();
  for (const item of items) {
    if (item === null || typeof item !== "object") continue;
    for (const [field, nested] of Object.entries(item)) {
      fields.set(field, [...(fields.get(field) ?? []), nested]);
    }
  }
  if (fields.size === 0) return "";
  const selections = [...fields].map(([field, values]) => {
    const nested = selection(values.flat());
    return nested === "" ? field : `${field} ${nested}`;
  });
  return `{ ${selections.join(" ")} }`;
}

const literal = (value: unknown): string =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? `{ ${Object.entries(value)
        .map(([k, v]) => `${k}: ${literal(v)}`)
        .join(", ")} }`
    : JSON.stringify(value);

function queryDocument(
  name: string,
  args: Fields | undefined,
  result: unknown,
) {
  const argList = args
    ? `(${Object.entries(args)
        .map(([k, v]) => `${k}: ${literal(v)}`)
        .join(", ")})`
    : "";
  return gql(`query { ${name}${argList} ${selection(result)} }`);
}

class ApolloHarness implements ClientHarness {
  readonly cache = "normalized";
  private apollo = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });
  private cascadeCache = new ApolloCascadeCache(this.apollo.cache, this.apollo);
  private documents = new Map<string, DocumentNode>();

  seed({ entities = [], queries = [] }: ClientState) {
    for (const entity of entities) {
      this.cascadeCache.write(
        entity.__typename as string,
        entity.id as string,
        entity,
      );
    }
    for (const { name, arguments: args, result } of queries) {
      const query = queryDocument(name, args, result);
      this.documents.set(key(name, args), query);
      this.apollo.cache.writeQuery({ query, data: { [name]: result } });
    }
  }

  apply(result: Fields) {
    const response = toCascadeResponse(result);
    if (response) new ApolloCascadeClient(this.apollo).applyCascade(response);
  }

  entity(typename: string, id: string) {
    return this.cascadeCache.read(typename, id);
  }

  query(name: string, args?: Fields) {
    const query = this.documents.get(key(name, args));
    const data = query && this.apollo.cache.readQuery<Fields>({ query });
    return data
      ? { state: "fresh" as const, data: data[name] }
      : { state: "invalidated" as const };
  }
}

const key = (name: string, args?: Fields) =>
  `${name}${JSON.stringify(args ?? {})}`;

describe("client conformance", () => {
  it("passes every client case for normalized caches", async () => {
    const results = await runClientCases(() => new ApolloHarness());

    expect(
      results.filter((r) => r.status !== "passed").map((r) => r.id),
    ).toEqual(skippedCases("normalized"));
    expect(results.filter((r) => r.status === "failed")).toEqual([]);
  });
});
