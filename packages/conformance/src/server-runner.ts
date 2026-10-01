import type {
  CascadeExpectation,
  CascadeLimits,
  CaseResult,
  ConformanceCase,
  EntryPattern,
  FieldExpectation,
  ServerCase,
  ServerState,
} from "./cases";
import { CASES } from "./generated/cases";
import { matches, mismatches } from "./match";

type MaybePromise<T> = T | Promise<T>;
type Fields = Record<string, unknown>;

/** A GraphQL response */
export interface GraphQLResponse {
  data?: Fields | null;
  errors?: readonly { message: string }[];
  extensions?: Fields;
}

/** A server under test, implementing the conformance domain. */
export interface ServerTarget {
  /** Replace the server's data with `state`, and apply `limits` until the next setup */
  setup(state: ServerState, limits?: CascadeLimits): MaybePromise<void>;
  /** Execute a GraphQL operation and return the GraphQL response */
  execute(
    operation: string,
    variables?: Record<string, unknown>,
  ): MaybePromise<GraphQLResponse>;
  /** Optional transports and features the server supports */
  capabilities?: "extensions"[];
}

/**
 * Run the server and transport cases against `target`.
 */
export async function runServerCases(
  target: ServerTarget,
  { cases = CASES }: { cases?: ConformanceCase[] } = {},
): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const testCase of cases) {
    if (testCase.category === "client") continue;
    const result = {
      id: testCase.id,
      name: testCase.name,
      requirement: testCase.requirement,
      level: testCase.level,
    };
    const missing = (testCase.requires ?? []).filter(
      (capability) => !target.capabilities?.includes(capability),
    );
    if (missing.length > 0) {
      results.push({ ...result, status: "skipped", failures: [] });
      continue;
    }
    let failures: string[];
    try {
      failures = await runCase(target, testCase);
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
  target: ServerTarget,
  { input, expected }: ServerCase,
): Promise<string[]> {
  await target.setup(input.state, input.limits);
  const response = await target.execute(input.operation, input.variables);

  const failures = (response.errors ?? []).map(
    (error) => `GraphQL error: ${error.message}`,
  );
  for (const [key, field] of Object.entries(expected.fields ?? {})) {
    const actual = response.data?.[key];
    if (actual === undefined || actual === null) {
      failures.push(`${key}: missing from the response`);
    } else {
      failures.push(...checkField(key, field, actual as Fields));
    }
  }
  if (expected.extensions) {
    const cascade = response.extensions?.cascade;
    failures.push(
      ...(cascade
        ? checkCascade(
            "extensions.cascade",
            expected.extensions.cascade,
            cascade as Fields,
          )
        : ["extensions.cascade: missing from the response"]),
    );
  }
  return failures;
}

function checkField(
  key: string,
  expected: FieldExpectation,
  actual: Fields,
): string[] {
  const failures: string[] = [];
  if (
    expected.typename !== undefined &&
    actual.__typename !== expected.typename
  ) {
    failures.push(
      `${key}.__typename: expected ${expected.typename}, got ${String(actual.__typename)}`,
    );
  }
  if (expected.success !== undefined && actual.success !== expected.success) {
    failures.push(
      `${key}.success: expected ${expected.success}, got ${String(actual.success)}`,
    );
  }
  const codes = ((actual.errors ?? []) as { code?: string }[]).map(
    (e) => e.code,
  );
  for (const { code } of expected.errors ?? []) {
    if (!codes.includes(code)) {
      failures.push(`${key}.errors: expected an error with code ${code}`);
    }
  }
  if (expected.cascade) {
    failures.push(
      ...(actual.cascade
        ? checkCascade(
            `${key}.cascade`,
            expected.cascade,
            actual.cascade as Fields,
          )
        : [`${key}.cascade: missing from the response`]),
    );
  }
  return failures;
}

type Entry = {
  typename: string;
  id: string;
  operation?: string;
  entity?: Fields;
};

const entryMatches = (pattern: EntryPattern, entry: Entry) =>
  entry.typename === pattern.typename &&
  (pattern.id === undefined || entry.id === pattern.id) &&
  (pattern.operation === undefined || entry.operation === pattern.operation) &&
  (pattern.entity === undefined || matches(pattern.entity, entry.entity));

/** Each pattern must match a distinct entry. */
function missingEntries(patterns: EntryPattern[] = [], entries: Entry[]) {
  const unused = [...entries];
  return patterns.filter((pattern) => {
    const i = unused.findIndex((entry) => entryMatches(pattern, entry));
    if (i === -1) return true;
    unused.splice(i, 1);
    return false;
  });
}

function checkCascade(
  label: string,
  expected: CascadeExpectation,
  cascade: Fields,
): string[] {
  const failures: string[] = [];
  for (const field of [
    "updated",
    "deleted",
    "invalidations",
    "typeInvalidations",
    "metadata",
  ]) {
    if (cascade[field] === undefined || cascade[field] === null) {
      failures.push(`${label}: missing ${field} (REQ-010)`);
    }
  }
  const updated = (cascade.updated ?? []) as Entry[];
  const deleted = (cascade.deleted ?? []) as Entry[];
  const typeInvalidations = (cascade.typeInvalidations ?? []) as Fields[];
  const invalidations = (cascade.invalidations ?? []) as Fields[];
  const metadata = (cascade.metadata ?? {}) as Fields;
  const key = (entry: Entry) => `${entry.typename}:${entry.id}`;

  for (const [list, entries] of [
    ["updated", updated],
    ["deleted", deleted],
  ] as const) {
    const keys = entries.map(key);
    for (const duplicate of new Set(
      keys.filter((k, i) => keys.indexOf(k) !== i),
    )) {
      failures.push(
        `${label}: ${duplicate} appears more than once in ${list} (REQ-005)`,
      );
    }
  }
  const deletedKeys = new Set(deleted.map(key));
  for (const both of new Set(
    updated.map(key).filter((k) => deletedKeys.has(k)),
  )) {
    failures.push(`${label}: ${both} is in both updated and deleted (REQ-003)`);
  }
  if (metadata.truncated === true && typeInvalidations.length === 0) {
    failures.push(
      `${label}: metadata.truncated is true without typeInvalidations (REQ-050)`,
    );
  }

  for (const [list, entries] of [
    ["updated", updated],
    ["deleted", deleted],
  ] as const) {
    for (const pattern of missingEntries(expected[list], entries)) {
      failures.push(
        `${label}.${list}: no entry matches ${JSON.stringify(pattern)}`,
      );
    }
  }
  for (const pattern of expected.absent ?? []) {
    for (const entry of [...updated, ...deleted].filter((e) =>
      entryMatches(pattern, e),
    )) {
      failures.push(`${label}: ${key(entry)} must not appear`);
    }
  }
  for (const [list, actual] of [
    ["invalidations", invalidations],
    ["typeInvalidations", typeInvalidations],
  ] as const) {
    for (const hint of (expected[list] ?? []) as Fields[]) {
      if (!actual.some((candidate) => matches(hint, candidate))) {
        failures.push(
          `${label}.${list}: no entry matches ${JSON.stringify(hint)}`,
        );
      }
    }
  }
  if (
    expected.noChanges &&
    (updated.length > 0 || deleted.length > 0 || typeInvalidations.length > 0)
  ) {
    failures.push(
      `${label}: expected no changes, got ${updated.length} updated, ${deleted.length} deleted, ${typeInvalidations.length} typeInvalidations (REQ-020)`,
    );
  }
  if (expected.metadata) {
    failures.push(
      ...mismatches(expected.metadata, metadata).map(
        (m) => `${label}.metadata.${m}`,
      ),
    );
  }
  return failures;
}

/**
 * A target for a server reached over HTTP. `setup` puts the server into a
 * case's state, typically through a test-only endpoint or the database.
 */
export function httpTarget(
  endpoint: string,
  options: {
    setup: ServerTarget["setup"];
    headers?: Record<string, string>;
    capabilities?: ServerTarget["capabilities"];
    fetch?: typeof fetch;
  },
): ServerTarget {
  const send = options.fetch ?? fetch;
  return {
    setup: options.setup,
    capabilities: options.capabilities,
    async execute(operation, variables) {
      const response = await send(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...options.headers },
        body: JSON.stringify({ query: operation, variables }),
      });
      return (await response.json()) as GraphQLResponse;
    },
  };
}
