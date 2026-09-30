import { invalidationMatches } from "./invalidation";
import { InvalidationScope, InvalidationStrategy } from "./types";

const hint = (fields: Record<string, unknown>) => ({
  strategy: InvalidationStrategy.INVALIDATE,
  scope: InvalidationScope.EXACT,
  ...fields,
});

describe("invalidationMatches", () => {
  it("EXACT matches the name, and the arguments when given", () => {
    const exact = hint({ queryName: "getUser", arguments: { id: "1" } });

    expect(invalidationMatches(exact, "getUser", { id: "1" })).toBe(true);
    expect(invalidationMatches(exact, "getUser", { id: "2" })).toBe(false);
    expect(invalidationMatches(exact, "getUsers", { id: "1" })).toBe(false);
  });

  it("EXACT compares arguments whatever their key order", () => {
    const exact = hint({
      queryName: "listUsers",
      arguments: { first: 10, filter: { role: "ADMIN", active: true } },
    });

    expect(
      invalidationMatches(exact, "listUsers", {
        filter: { active: true, role: "ADMIN" },
        first: 10,
      }),
    ).toBe(true);
  });

  it("EXACT without arguments matches every query of that name", () => {
    const exact = hint({ queryName: "getUser" });

    expect(invalidationMatches(exact, "getUser", { id: "1" })).toBe(true);
    expect(invalidationMatches(exact, "getUser")).toBe(true);
  });

  it("PREFIX matches names starting with queryName", () => {
    const prefix = hint({
      queryName: "listUsers",
      scope: InvalidationScope.PREFIX,
    });

    expect(invalidationMatches(prefix, "listUsersByCompany")).toBe(true);
    expect(invalidationMatches(prefix, "listUser")).toBe(false);
  });

  it("PATTERN matches names against the glob", () => {
    const pattern = hint({
      queryPattern: "list*s?",
      scope: InvalidationScope.PATTERN,
    });

    expect(invalidationMatches(pattern, "listUsers1")).toBe(true);
    expect(invalidationMatches(pattern, "listUsers")).toBe(false);
    expect(invalidationMatches(pattern, "getList")).toBe(false);
  });

  it("PATTERN treats regular expression characters literally", () => {
    const pattern = hint({
      queryPattern: "get.User",
      scope: InvalidationScope.PATTERN,
    });

    expect(invalidationMatches(pattern, "get.User")).toBe(true);
    expect(invalidationMatches(pattern, "getXUser")).toBe(false);
  });

  it("ALL matches every query", () => {
    expect(
      invalidationMatches(hint({ scope: InvalidationScope.ALL }), "anything"),
    ).toBe(true);
  });

  it("matches nothing when the name or pattern its scope needs is missing", () => {
    expect(invalidationMatches(hint({}), "getUser")).toBe(false);
    expect(
      invalidationMatches(
        hint({ scope: InvalidationScope.PATTERN }),
        "getUser",
      ),
    ).toBe(false);
  });
});
