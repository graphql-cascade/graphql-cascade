import { mismatches } from "./match";

describe("mismatches", () => {
  it("accepts objects holding at least the expected fields", () => {
    expect(mismatches({ a: 1 }, { a: 1, b: 2 })).toEqual([]);
  });

  it("reports differing and missing fields with their path", () => {
    expect(mismatches({ a: { b: 1, c: 2 } }, { a: { b: 3 } })).toEqual([
      "a.b: expected 1, got 3",
      "a.c: expected 2, got nothing",
    ]);
  });

  it("compares lists element by element, with equal lengths", () => {
    expect(mismatches([{ id: "1" }], [{ id: "1", x: 0 }])).toEqual([]);
    expect(mismatches([{ id: "1" }], [])).toEqual([
      "value: expected 1 items, got 0",
    ]);
  });

  it("distinguishes null from missing", () => {
    expect(mismatches({ a: null }, {})).toEqual([
      "a: expected null, got nothing",
    ]);
  });
});
