import type { CaseResult } from "./cases";
import { formatReport, getExitCode, summarize } from "./report";

const result = (
  id: string,
  level: CaseResult["level"],
  status: CaseResult["status"],
  failures: string[] = [],
): CaseResult => ({
  id,
  name: `Case ${id}`,
  requirement: "REQ-001",
  level,
  status,
  failures,
});

describe("summarize", () => {
  it("achieves the highest level whose cases, and those below, all pass", () => {
    expect(
      summarize([
        result("A", "basic", "passed"),
        result("B", "standard", "passed"),
        result("C", "standard", "skipped"),
        result("D", "complete", "failed", ["x"]),
      ]).achieved,
    ).toBe("standard");
  });

  it("achieves no level when a basic case fails", () => {
    expect(
      summarize([
        result("A", "basic", "failed", ["x"]),
        result("B", "standard", "passed"),
      ]).achieved,
    ).toBe("none");
  });

  it("counts cases by level and status", () => {
    expect(
      summarize([
        result("A", "basic", "passed"),
        result("B", "basic", "skipped"),
      ]).levels.basic,
    ).toEqual({ passed: 1, failed: 0, skipped: 1 });
  });
});

describe("getExitCode", () => {
  const results = [
    result("A", "basic", "passed"),
    result("B", "standard", "failed", ["x"]),
  ];

  it("fails when any case fails", () => {
    expect(getExitCode(results)).toBe(1);
    expect(getExitCode([results[0]])).toBe(0);
  });

  it("with a level, fails only below it", () => {
    expect(getExitCode(results, "basic")).toBe(0);
    expect(getExitCode(results, "standard")).toBe(1);
  });
});

describe("formatReport", () => {
  const results = [
    result("TC-S-001", "basic", "passed"),
    result("TC-S-002", "standard", "failed", [
      "updateUser.success: expected true, got false",
    ]),
  ];

  it("lists failures with their requirement in console output", () => {
    const output = formatReport(results, { format: "console", colors: false });

    expect(output).toContain("Achieved level: basic");
    expect(output).toContain("✗ TC-S-002 Case TC-S-002 (REQ-001, standard)");
    expect(output).toContain(
      "    updateUser.success: expected true, got false",
    );
    expect(output).not.toContain("TC-S-001 Case");
  });

  it("lists every case with verbose", () => {
    expect(
      formatReport(results, {
        format: "console",
        colors: false,
        verbose: true,
      }),
    ).toContain("✓ TC-S-001 Case TC-S-001 (REQ-001, basic)");
  });

  it("returns the summary and results as JSON", () => {
    expect(JSON.parse(formatReport(results, { format: "json" }))).toEqual({
      achieved: "basic",
      levels: expect.any(Object),
      results,
    });
  });

  it("renders a markdown table", () => {
    expect(formatReport(results, { format: "markdown" })).toContain(
      "| TC-S-002 | REQ-001 | standard | failed |",
    );
  });
});
