/**
 * GraphQL Cascade Conformance Test Suite
 *
 * Validates implementations against the GraphQL Cascade specification.
 */

// Export all types
export type {
  ConformanceLevel,
  TestResult,
  TestCategory,
  LevelResults,
  ConformanceReport,
  ValidationError,
  SchemaValidationResult,
  ResponseValidationResult,
  ServerConformanceOptions,
  ClientConformanceOptions,
} from './types';

// Export validators
export { validateSchema } from './validators/schema';
export { validateResponse } from './validators/response';

// Export server test runners
export { runStandardTests } from './server/standard';

// Placeholder exports for runner functions (implemented in later waves)
import type {
  ConformanceReport,
  ServerConformanceOptions,
  ClientConformanceOptions,
} from './types';

/**
 * Run server conformance tests
 */
export async function runServerConformance(
  _options: ServerConformanceOptions
): Promise<ConformanceReport> {
  throw new Error('Not implemented - see Wave 2 implementation');
}

/**
 * Run client conformance tests
 */
export async function runClientConformance(
  _options: ClientConformanceOptions
): Promise<ConformanceReport> {
  throw new Error('Not implemented - see Wave 3 implementation');
}
