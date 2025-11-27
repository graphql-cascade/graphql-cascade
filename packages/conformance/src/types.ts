/**
 * Conformance level for GraphQL Cascade implementations
 */
export type ConformanceLevel = 'basic' | 'standard' | 'complete' | 'none';

/**
 * Result of a single conformance test
 */
export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
  expected?: unknown;
  actual?: unknown;
}

/**
 * Category of tests at a specific conformance level
 */
export interface TestCategory {
  name: string;
  level: ConformanceLevel;
  tests: TestResult[];
}

/**
 * Results summary for a conformance level
 */
export interface LevelResults {
  passed: number;
  failed: number;
  skipped: number;
}

/**
 * Full conformance test report
 */
export interface ConformanceReport {
  timestamp: string;
  target: 'server' | 'client';
  level: {
    achieved: ConformanceLevel;
    tested: ConformanceLevel;
  };
  results: {
    basic: LevelResults;
    standard: LevelResults;
    complete: LevelResults;
  };
  failures: Array<{
    test: string;
    level: ConformanceLevel;
    message: string;
    expected?: unknown;
    actual?: unknown;
  }>;
}

/**
 * Validation error details
 */
export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

/**
 * Result of schema validation
 */
export interface SchemaValidationResult {
  valid: boolean;
  level: ConformanceLevel;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Result of response validation
 */
export interface ResponseValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Options for server conformance testing
 */
export interface ServerConformanceOptions {
  createServer?: () => unknown;
  endpoint?: string;
  level: ConformanceLevel;
}

/**
 * Options for client conformance testing
 */
export interface ClientConformanceOptions {
  createClient: () => unknown;
  level: ConformanceLevel;
}
