/**
 * GraphQL Cascade Conformance Test Suite
 *
 * Validates implementations against the GraphQL Cascade specification.
 */

// Export all types
export {
  runClientCases,
  type ClientHarness,
  type CaseResult,
} from "./client-runner";
export type {
  ConformanceCase,
  ClientCase,
  ServerCase,
  ClientState,
  CachedQuery,
  QueryState,
  ServerState,
  CascadeLimits,
} from "./cases";
export { CASES, DOMAIN_SCHEMA, REFERENCE_SCHEMA } from "./generated/cases";

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
} from "./types";

// Export validators
export { validateSchema } from "./validators/schema";
export { validateResponse } from "./validators/response";

// Export server test runners
export { runBasicTests, runStandardTests, runCompleteTests } from "./server";

// Export client test runners
export {
  runClientBasicTests,
  runClientStandardTests,
  runClientCompleteTests,
} from "./client";

// Export main conformance runners
export { runServerConformance, runClientConformance } from "./runner";

// Export reporter utilities
export {
  formatReport,
  printReport,
  getExitCode,
  type ReporterOptions,
} from "./reporter";

// Export CLI utilities
export { parseArgs, main as runCli } from "./cli";
