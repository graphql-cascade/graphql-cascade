import {
  cascadeEntryTypename,
  invalidationMatches,
  toCascadeResponse,
} from "@graphql-cascade/client";
import type { ClientState, QueryState } from "./cases";
import { CASES } from "./generated/cases";
import { runClientCases, type ClientHarness } from "./client-runner";

type Fields = Record<string, unknown>;
const isEntity = (value: unknown): value is Fields =>
  value !== null &&
  typeof value === "object" &&
  "__typename" in value &&
  "id" in value;
const key = (typename: unknown, id: unknown) => `${typename}:${id}`;

/**
 * A minimal client that follows the specification: a normalized store whose
 * queries hold references to entities.
 */
class ReferenceClient implements ClientHarness {
  readonly cache: ClientHarness["cache"] = "normalized";
  private entities = new Map<string, Fields>();
  private queries: {
    name: string;
    args: Fields;
    result: unknown;
    state: QueryState;
  }[] = [];

  seed(state: ClientState) {
    state.entities?.forEach((entity) => this.write(entity));
    for (const { name, arguments: args = {}, result } of state.queries ?? []) {
      this.queries.push({
        name,
        args,
        result: this.normalize(result),
        state: "fresh",
      });
    }
  }

  apply(result: Fields) {
    const response = toCascadeResponse(result);
    if (!response?.success) return;
    const { cascade } = response;
    for (const entry of cascade.updated) {
      this.write(entry.entity as Fields);
    }
    for (const entry of cascade.deleted) {
      this.entities.delete(key(cascadeEntryTypename(entry), entry.id));
    }
    for (const hint of cascade.invalidations) {
      for (const query of this.queries) {
        if (invalidationMatches(hint, query.name, query.args)) {
          query.state = "invalidated";
        }
      }
    }
    for (const { typename } of cascade.typeInvalidations ?? []) {
      for (const query of this.queries) {
        if (this.mayContain(query.result, typename))
          query.state = "invalidated";
      }
    }
  }

  entity(typename: string, id: string) {
    return this.entities.get(key(typename, id)) ?? null;
  }

  query(name: string, args: Fields = {}) {
    const query = this.queries.find(
      (q) => q.name === name && JSON.stringify(q.args) === JSON.stringify(args),
    );
    return query
      ? { state: query.state, data: this.denormalize(query.result) }
      : { state: "invalidated" as const };
  }

  private write(entity: Fields) {
    const k = key(entity.__typename, entity.id);
    this.entities.set(k, { ...this.entities.get(k), ...entity });
  }

  private normalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => this.normalize(v));
    if (isEntity(value)) {
      this.write(value);
      return { ref: key(value.__typename, value.id) };
    }
    return value;
  }

  private denormalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => this.denormalize(v));
    if (value !== null && typeof value === "object" && "ref" in value) {
      return this.entities.get((value as { ref: string }).ref) ?? null;
    }
    return value;
  }

  private mayContain(value: unknown, typename: string): boolean {
    if (Array.isArray(value)) {
      return (
        value.length === 0 || value.some((v) => this.mayContain(v, typename))
      );
    }
    return (
      value !== null &&
      typeof value === "object" &&
      "ref" in value &&
      (value as { ref: string }).ref.startsWith(`${typename}:`)
    );
  }
}

describe("runClientCases", () => {
  const clientCases = CASES.filter((c) => c.category === "client");

  it("passes every client case with a client that follows the specification", async () => {
    const results = await runClientCases(() => new ReferenceClient());

    expect(results.map((r) => r.id).sort()).toEqual(
      clientCases.map((c) => c.id).sort(),
    );
    expect(results.filter((r) => r.status === "failed")).toEqual([]);
  });

  it("reports the cases a client fails, with what differed", async () => {
    class IgnoresHints extends ReferenceClient {
      apply(result: Fields) {
        const cascade = (result as { cascade?: Fields }).cascade;
        super.apply(
          cascade
            ? { ...result, cascade: { ...cascade, invalidations: [] } }
            : result,
        );
      }
    }

    const results = await runClientCases(() => new IgnoresHints());
    const exact = results.find((r) => r.id === "TC-C-003");

    expect(exact).toMatchObject({ status: "failed", requirement: "REQ-103" });
    expect(exact?.failures).toEqual([
      'query user {"id":"u1"}: expected invalidated, got fresh',
    ]);
  });

  it("skips cases for another kind of cache", async () => {
    class DocumentClient extends ReferenceClient {
      readonly cache = "document" as const;
    }

    const results = await runClientCases(
      () => new DocumentClient() as ClientHarness,
    );

    expect(results.find((r) => r.id === "TC-C-001")?.status).toBe("skipped");
  });

  it("fails a case whose harness throws", async () => {
    class Throws extends ReferenceClient {
      apply(): void {
        throw new Error("boom");
      }
    }

    const results = await runClientCases(() => new Throws());

    expect(results.every((r) => r.status === "failed")).toBe(true);
    expect(results[0].failures).toEqual(["boom"]);
  });
});
