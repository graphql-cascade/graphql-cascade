/**
 * Conformance test runner
 *
 * Orchestrates running test suites and produces conformance reports.
 */

import type {
  ConformanceLevel,
  ConformanceReport,
  LevelResults,
  ServerConformanceOptions,
  ClientConformanceOptions,
  TestCategory,
} from './types';

import { runBasicTests, runStandardTests, runCompleteTests } from './server';
import {
  runClientBasicTests,
  runClientStandardTests,
  runClientCompleteTests,
} from './client';

/**
 * Aggregate test results for a specific level
 */
function aggregateResults(categories: TestCategory[]): LevelResults {
  let passed = 0;
  let failed = 0;
  const skipped = 0;

  for (const category of categories) {
    for (const test of category.tests) {
      if (test.passed) {
        passed++;
      } else {
        failed++;
      }
    }
  }

  return { passed, failed, skipped };
}

/**
 * Determine the achieved conformance level based on results
 */
function determineAchievedLevel(
  basicResults: LevelResults,
  standardResults: LevelResults,
  completeResults: LevelResults,
  testedLevel: ConformanceLevel
): ConformanceLevel {
  // If any basic tests failed, no conformance level achieved
  if (basicResults.failed > 0) {
    return 'none';
  }

  // If only tested basic, return basic
  if (testedLevel === 'basic') {
    return 'basic';
  }

  // If standard tests failed, only basic achieved
  if (standardResults.failed > 0) {
    return 'basic';
  }

  // If only tested standard, return standard
  if (testedLevel === 'standard') {
    return 'standard';
  }

  // If complete tests failed, only standard achieved
  if (completeResults.failed > 0) {
    return 'standard';
  }

  return 'complete';
}

/**
 * Extract failures from test categories
 */
function extractFailures(
  categories: TestCategory[]
): ConformanceReport['failures'] {
  const failures: ConformanceReport['failures'] = [];

  for (const category of categories) {
    for (const test of category.tests) {
      if (!test.passed) {
        failures.push({
          test: `${category.name}: ${test.name}`,
          level: category.level,
          message: test.message || 'Test failed',
          expected: test.expected,
          actual: test.actual,
        });
      }
    }
  }

  return failures;
}

/**
 * Run server conformance tests
 */
export async function runServerConformance(
  options: ServerConformanceOptions
): Promise<ConformanceReport> {
  const timestamp = new Date().toISOString();
  const testedLevel = options.level;

  // Always run basic tests
  const basicCategories = await runBasicTests(options);
  const basicResults = aggregateResults(basicCategories);

  // Run standard tests if requested
  let standardCategories: TestCategory[] = [];
  let standardResults: LevelResults = { passed: 0, failed: 0, skipped: 0 };
  if (testedLevel === 'standard' || testedLevel === 'complete') {
    standardCategories = await runStandardTests(options);
    standardResults = aggregateResults(standardCategories);
  }

  // Run complete tests if requested
  let completeCategories: TestCategory[] = [];
  let completeResults: LevelResults = { passed: 0, failed: 0, skipped: 0 };
  if (testedLevel === 'complete') {
    completeCategories = await runCompleteTests(options);
    completeResults = aggregateResults(completeCategories);
  }

  // Determine achieved level
  const achievedLevel = determineAchievedLevel(
    basicResults,
    standardResults,
    completeResults,
    testedLevel
  );

  // Collect all failures
  const failures = [
    ...extractFailures(basicCategories),
    ...extractFailures(standardCategories),
    ...extractFailures(completeCategories),
  ];

  return {
    timestamp,
    target: 'server',
    level: {
      achieved: achievedLevel,
      tested: testedLevel,
    },
    results: {
      basic: basicResults,
      standard: standardResults,
      complete: completeResults,
    },
    failures,
  };
}

/**
 * Run client conformance tests
 */
export async function runClientConformance(
  options: ClientConformanceOptions
): Promise<ConformanceReport> {
  const timestamp = new Date().toISOString();
  const testedLevel = options.level;

  // Always run basic tests
  const basicCategories = await runClientBasicTests(options);
  const basicResults = aggregateResults(basicCategories);

  // Run standard tests if requested
  let standardCategories: TestCategory[] = [];
  let standardResults: LevelResults = { passed: 0, failed: 0, skipped: 0 };
  if (testedLevel === 'standard' || testedLevel === 'complete') {
    standardCategories = await runClientStandardTests(options);
    standardResults = aggregateResults(standardCategories);
  }

  // Run complete tests if requested
  let completeCategories: TestCategory[] = [];
  let completeResults: LevelResults = { passed: 0, failed: 0, skipped: 0 };
  if (testedLevel === 'complete') {
    completeCategories = await runClientCompleteTests(options);
    completeResults = aggregateResults(completeCategories);
  }

  // Determine achieved level
  const achievedLevel = determineAchievedLevel(
    basicResults,
    standardResults,
    completeResults,
    testedLevel
  );

  // Collect all failures
  const failures = [
    ...extractFailures(basicCategories),
    ...extractFailures(standardCategories),
    ...extractFailures(completeCategories),
  ];

  return {
    timestamp,
    target: 'client',
    level: {
      achieved: achievedLevel,
      tested: testedLevel,
    },
    results: {
      basic: basicResults,
      standard: standardResults,
      complete: completeResults,
    },
    failures,
  };
}
