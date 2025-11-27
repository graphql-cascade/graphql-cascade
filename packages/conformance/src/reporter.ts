/**
 * Conformance test reporter
 *
 * Formats and outputs conformance test results.
 */

import type { ConformanceReport, ConformanceLevel } from './types';

export interface ReporterOptions {
  format: 'console' | 'json' | 'markdown';
  verbose?: boolean;
  colors?: boolean;
}

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

/**
 * Get color wrapper functions based on options
 */
function getColorFns(useColors: boolean) {
  if (!useColors) {
    return {
      bold: (s: string) => s,
      red: (s: string) => s,
      green: (s: string) => s,
      yellow: (s: string) => s,
      blue: (s: string) => s,
      gray: (s: string) => s,
    };
  }
  return {
    bold: (s: string) => `${colors.bold}${s}${colors.reset}`,
    red: (s: string) => `${colors.red}${s}${colors.reset}`,
    green: (s: string) => `${colors.green}${s}${colors.reset}`,
    yellow: (s: string) => `${colors.yellow}${s}${colors.reset}`,
    blue: (s: string) => `${colors.blue}${s}${colors.reset}`,
    gray: (s: string) => `${colors.gray}${s}${colors.reset}`,
  };
}

/**
 * Get level display with color
 */
function getLevelDisplay(
  level: ConformanceLevel,
  c: ReturnType<typeof getColorFns>
): string {
  switch (level) {
    case 'complete':
      return c.green('COMPLETE');
    case 'standard':
      return c.blue('STANDARD');
    case 'basic':
      return c.yellow('BASIC');
    case 'none':
      return c.red('NONE');
  }
}

/**
 * Format report as console output
 */
function formatConsole(report: ConformanceReport, options: ReporterOptions): string {
  const c = getColorFns(options.colors !== false);
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(c.bold('GraphQL Cascade Conformance Report'));
  lines.push(c.gray('─'.repeat(50)));
  lines.push('');

  // Target and timestamp
  lines.push(`Target: ${c.bold(report.target.toUpperCase())}`);
  lines.push(`Timestamp: ${c.gray(report.timestamp)}`);
  lines.push('');

  // Level summary
  lines.push(c.bold('Conformance Level'));
  lines.push(`  Tested:   ${getLevelDisplay(report.level.tested, c)}`);
  lines.push(`  Achieved: ${getLevelDisplay(report.level.achieved, c)}`);
  lines.push('');

  // Results by level
  lines.push(c.bold('Test Results'));
  const levels: ConformanceLevel[] = ['basic', 'standard', 'complete'];
  for (const level of levels) {
    const results = report.results[level as keyof typeof report.results];
    const total = results.passed + results.failed + results.skipped;
    if (total === 0) continue;

    const passRate = total > 0 ? Math.round((results.passed / total) * 100) : 0;
    const statusColor = results.failed === 0 ? c.green : c.red;
    lines.push(
      `  ${level.padEnd(10)} ${statusColor(`${results.passed}/${total}`)} (${passRate}%)`
    );
  }
  lines.push('');

  // Failures
  if (report.failures.length > 0) {
    lines.push(c.bold(c.red('Failures')));
    for (const failure of report.failures) {
      lines.push(`  ${c.red('✗')} [${failure.level}] ${failure.test}`);
      lines.push(`    ${c.gray(failure.message)}`);
      if (options.verbose && failure.expected !== undefined) {
        lines.push(`    Expected: ${JSON.stringify(failure.expected)}`);
        lines.push(`    Actual:   ${JSON.stringify(failure.actual)}`);
      }
    }
    lines.push('');
  } else {
    lines.push(c.green('All tests passed!'));
    lines.push('');
  }

  // Summary
  const totalPassed =
    report.results.basic.passed +
    report.results.standard.passed +
    report.results.complete.passed;
  const totalFailed =
    report.results.basic.failed +
    report.results.standard.failed +
    report.results.complete.failed;
  const total = totalPassed + totalFailed;

  lines.push(c.gray('─'.repeat(50)));
  lines.push(
    `Total: ${c.green(`${totalPassed} passed`)}, ${c.red(`${totalFailed} failed`)} (${total} tests)`
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Format report as JSON
 */
function formatJson(report: ConformanceReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Format report as Markdown
 */
function formatMarkdown(report: ConformanceReport, options: ReporterOptions): string {
  const lines: string[] = [];

  // Header
  lines.push('# GraphQL Cascade Conformance Report');
  lines.push('');
  lines.push(`**Target:** ${report.target}`);
  lines.push(`**Timestamp:** ${report.timestamp}`);
  lines.push('');

  // Level summary
  lines.push('## Conformance Level');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Tested | ${report.level.tested} |`);
  lines.push(`| Achieved | ${report.level.achieved} |`);
  lines.push('');

  // Results table
  lines.push('## Test Results');
  lines.push('');
  lines.push('| Level | Passed | Failed | Skipped | Pass Rate |');
  lines.push('|-------|--------|--------|---------|-----------|');

  const levels: ConformanceLevel[] = ['basic', 'standard', 'complete'];
  for (const level of levels) {
    const results = report.results[level as keyof typeof report.results];
    const total = results.passed + results.failed + results.skipped;
    if (total === 0) continue;

    const passRate = total > 0 ? Math.round((results.passed / total) * 100) : 0;
    lines.push(
      `| ${level} | ${results.passed} | ${results.failed} | ${results.skipped} | ${passRate}% |`
    );
  }
  lines.push('');

  // Failures
  if (report.failures.length > 0) {
    lines.push('## Failures');
    lines.push('');
    for (const failure of report.failures) {
      lines.push(`### ${failure.test}`);
      lines.push('');
      lines.push(`**Level:** ${failure.level}`);
      lines.push(`**Message:** ${failure.message}`);
      if (options.verbose && failure.expected !== undefined) {
        lines.push('');
        lines.push('```json');
        lines.push(`Expected: ${JSON.stringify(failure.expected, null, 2)}`);
        lines.push(`Actual: ${JSON.stringify(failure.actual, null, 2)}`);
        lines.push('```');
      }
      lines.push('');
    }
  } else {
    lines.push('## Summary');
    lines.push('');
    lines.push('All tests passed.');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format conformance report for output
 */
export function formatReport(
  report: ConformanceReport,
  options: ReporterOptions = { format: 'console' }
): string {
  switch (options.format) {
    case 'json':
      return formatJson(report);
    case 'markdown':
      return formatMarkdown(report, options);
    case 'console':
    default:
      return formatConsole(report, options);
  }
}

/**
 * Print report to stdout
 */
export function printReport(
  report: ConformanceReport,
  options: ReporterOptions = { format: 'console' }
): void {
  console.log(formatReport(report, options));
}

/**
 * Get exit code based on report results
 */
export function getExitCode(report: ConformanceReport): number {
  const totalFailed =
    report.results.basic.failed +
    report.results.standard.failed +
    report.results.complete.failed;

  return totalFailed > 0 ? 1 : 0;
}
