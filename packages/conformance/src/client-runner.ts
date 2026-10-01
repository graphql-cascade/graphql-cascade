import type {
  ClientCase,
  ClientState,
  ConformanceCase,
  ConformanceLevel,
  QueryState,
} from "./cases";
import { CASES } from "./generated/cases";
import { mismatches } from "./match";

type MaybePromise<T> = T | Promise<T>;

/**
 * A client under test. Each case gets a fresh harness: seeded, given one
 * mutation result, then inspected.
 */
export interface ClientHarness {
  /** The kind of cache, for cases that hold for one kind only */
  readonly cache: "normalized" | "document";
  /** Fill the cache with entities and query results */
  seed(state: ClientState): MaybePromise<void>;
  /** Apply a mutation field's result as the client does on a response */
  apply(result: Record<string, unknown>): MaybePromise<void>;
  /** The cached entity's fields, or null when it is not cached */
  entity(
    typename: string,
    id: string,
  ): MaybePromise<Record<string, unknown> | null>;
  /** A cached query's state, and its result when fresh */
  query(
    name: string,
    args?: Record<string, unknown>,
  ): MaybePromise<{ state: QueryState; data?: unknown }>;
}

export interface CaseResult {
  id: string;
  name: string;
  requirement: string;
  level: ConformanceLevel;
  status: "passed" | "failed" | "skipped";
  /** What differed from the case's expectations */
  failures: string[];
}

/**
 * Run the client cases against fresh harnesses from `createHarness`.
 */
export async function runClientCases(
  createHarness: () => MaybePromise<ClientHarness>,
  { cases = CASES }: { cases?: ConformanceCase[] } = {},
): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const testCase of cases) {
    if (testCase.category !== "client") continue;
    const harness = await createHarness();
    const result = {
      id: testCase.id,
      name: testCase.name,
      requirement: testCase.requirement,
      level: testCase.level,
    };
    if (testCase.cache !== undefined && testCase.cache !== harness.cache) {
      results.push({ ...result, status: "skipped", failures: [] });
      continue;
    }
    let failures: string[];
    try {
      failures = await runCase(harness, testCase);
    } catch (error) {
      failures = [error instanceof Error ? error.message : String(error)];
    }
    results.push({
      ...result,
      status: failures.length === 0 ? "passed" : "failed",
      failures,
    });
  }
  return results;
}

async function runCase(
  harness: ClientHarness,
  { input, expected }: ClientCase,
): Promise<string[]> {
  await harness.seed(input.state);
  await harness.apply(input.result);

  const failures: string[] = [];
  for (const [key, fields] of Object.entries(expected.entities ?? {})) {
    const separator = key.indexOf(":");
    const actual = await harness.entity(
      key.slice(0, separator),
      key.slice(separator + 1),
    );
    if (fields === null) {
      if (actual !== null) failures.push(`entity ${key}: expected no entity`);
    } else if (actual === null) {
      failures.push(`entity ${key}: expected an entity, got none`);
    } else {
      failures.push(
        ...mismatches(fields, actual).map((m) => `entity ${key} ${m}`),
      );
    }
  }
  for (const query of expected.queries ?? []) {
    const label = `query ${query.name}${
      query.arguments ? ` ${JSON.stringify(query.arguments)}` : ""
    }`;
    const actual = await harness.query(query.name, query.arguments);
    if (actual.state !== query.state) {
      failures.push(`${label}: expected ${query.state}, got ${actual.state}`);
    } else if (query.result !== undefined) {
      failures.push(
        ...mismatches(query.result, actual.data).map((m) => `${label} ${m}`),
      );
    }
  }
  return failures;
}
