import { InvalidationScope, QueryInvalidation } from "./types";

/**
 * Whether a cached query, identified by its name and arguments, is one the
 * invalidation hint selects:
 * - EXACT: the name equals `queryName` and, when the hint has `arguments`,
 *   the arguments equal them;
 * - PREFIX: the name starts with `queryName`;
 * - PATTERN: the name matches the glob `queryPattern`, where `*` matches any
 *   run of characters and `?` one character;
 * - ALL: every query.
 */
export function invalidationMatches(
  invalidation: QueryInvalidation,
  queryName: string,
  args?: Record<string, unknown>,
): boolean {
  switch (invalidation.scope) {
    case InvalidationScope.EXACT:
      return (
        invalidation.queryName === queryName &&
        (invalidation.arguments === undefined ||
          canonicalJson(invalidation.arguments) === canonicalJson(args ?? {}))
      );
    case InvalidationScope.PREFIX:
      return (
        invalidation.queryName !== undefined &&
        queryName.startsWith(invalidation.queryName)
      );
    case InvalidationScope.PATTERN:
      return (
        invalidation.queryPattern !== undefined &&
        matchesGlob(invalidation.queryPattern, queryName)
      );
    case InvalidationScope.ALL:
      return true;
    default:
      return false;
  }
}

/** JSON with object keys sorted, so equal values serialize equally. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) =>
    nested !== null && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(
          Object.entries(nested).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : nested,
  );
}

/**
 * Match `text` against a glob in O(pattern × text) time, whatever the
 * pattern.
 */
function matchesGlob(pattern: string, text: string): boolean {
  let p = 0;
  let t = 0;
  let starP = -1;
  let starT = 0;
  while (t < text.length) {
    if (p < pattern.length && (pattern[p] === "?" || pattern[p] === text[t])) {
      p++;
      t++;
    } else if (p < pattern.length && pattern[p] === "*") {
      starP = p++;
      starT = t;
    } else if (starP !== -1) {
      p = starP + 1;
      t = ++starT;
    } else {
      return false;
    }
  }
  while (pattern[p] === "*") p++;
  return p === pattern.length;
}
