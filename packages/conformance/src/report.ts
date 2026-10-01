import type { CaseResult, ConformanceLevel } from "./cases";

const LEVELS: ConformanceLevel[] = ["basic", "standard", "complete"];

type Counts = Record<CaseResult["status"], number>;

export interface Summary {
  /** The highest level whose cases, and those of the levels below, all pass */
  achieved: ConformanceLevel | "none";
  levels: Record<ConformanceLevel, Counts>;
}

export function summarize(results: CaseResult[]): Summary {
  const levels = Object.fromEntries(
    LEVELS.map((level) => [level, { passed: 0, failed: 0, skipped: 0 }]),
  ) as Record<ConformanceLevel, Counts>;
  for (const { level, status } of results) levels[level][status]++;

  let achieved: Summary["achieved"] = "none";
  for (const level of LEVELS) {
    if (levels[level].failed > 0) break;
    achieved = level;
  }
  return { achieved, levels };
}

/**
 * 1 when a case fails, or with `level`, when a case of that level or a
 * lower one fails; 0 otherwise.
 */
export function getExitCode(
  results: CaseResult[],
  level?: ConformanceLevel,
): number {
  const required =
    level === undefined ? LEVELS : LEVELS.slice(0, LEVELS.indexOf(level) + 1);
  return results.some(
    (r) => r.status === "failed" && required.includes(r.level),
  )
    ? 1
    : 0;
}

export interface ReportOptions {
  format: "console" | "json" | "markdown";
  /** List passed and skipped cases too (console) */
  verbose?: boolean;
  colors?: boolean;
}

export function formatReport(
  results: CaseResult[],
  { format, verbose = false, colors = true }: ReportOptions,
): string {
  const summary = summarize(results);
  if (format === "json") {
    return JSON.stringify({ ...summary, results }, null, 2);
  }
  if (format === "markdown") {
    return [
      `**Achieved level:** ${summary.achieved}`,
      "",
      "| Case | Requirement | Level | Status | Failures |",
      "|------|-------------|-------|--------|----------|",
      ...results.map(
        (r) =>
          `| ${r.id} | ${r.requirement} | ${r.level} | ${r.status} | ${r.failures
            .join("<br>")
            .replace(/\|/g, "\\|")} |`,
      ),
    ].join("\n");
  }

  const paint = (code: number) => (text: string) =>
    colors ? `\x1b[${code}m${text}\x1b[0m` : text;
  const [green, red, gray] = [paint(32), paint(31), paint(90)];
  const symbol = { passed: green("✓"), failed: red("✗"), skipped: gray("-") };
  const lines = results
    .filter((r) => verbose || r.status === "failed")
    .flatMap((r) => [
      `${symbol[r.status]} ${r.id} ${r.name} (${r.requirement}, ${r.level})`,
      ...r.failures.map((failure) => `    ${failure}`),
    ]);
  const counts = LEVELS.map((level) => {
    const { passed, failed, skipped } = summary.levels[level];
    return `${level}: ${passed} passed, ${failed} failed, ${skipped} skipped`;
  });
  return [...lines, "", ...counts, `Achieved level: ${summary.achieved}`].join(
    "\n",
  );
}
