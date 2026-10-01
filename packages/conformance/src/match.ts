/**
 * Where `actual` departs from `expected`: objects must have the fields
 * `expected` gives, arrays must have its length and match element by
 * element, and other values must be equal. Returns one message per
 * difference.
 */
export function mismatches(
  expected: unknown,
  actual: unknown,
  path = "",
): string[] {
  const at = path === "" ? "value" : path;
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return [`${at}: expected a list, got ${describe(actual)}`];
    }
    if (actual.length !== expected.length) {
      return [`${at}: expected ${expected.length} items, got ${actual.length}`];
    }
    return expected.flatMap((item, i) =>
      mismatches(item, actual[i], `${path}[${i}]`),
    );
  }
  if (expected !== null && typeof expected === "object") {
    if (
      actual === null ||
      typeof actual !== "object" ||
      Array.isArray(actual)
    ) {
      return [`${at}: expected an object, got ${describe(actual)}`];
    }
    return Object.entries(expected).flatMap(([key, value]) =>
      mismatches(
        value,
        (actual as Record<string, unknown>)[key],
        path === "" ? key : `${path}.${key}`,
      ),
    );
  }
  return Object.is(expected, actual)
    ? []
    : [`${at}: expected ${describe(expected)}, got ${describe(actual)}`];
}

/** Whether `actual` contains everything `expected` gives. */
export function matches(expected: unknown, actual: unknown): boolean {
  return mismatches(expected, actual).length === 0;
}

function describe(value: unknown): string {
  return value === undefined ? "nothing" : JSON.stringify(value);
}
