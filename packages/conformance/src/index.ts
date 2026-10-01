/**
 * GraphQL Cascade conformance: runs the specification's conformance cases
 * against a server or a client.
 */

export { runServerCases, httpTarget } from "./server-runner";
export type { ServerTarget, GraphQLResponse } from "./server-runner";
export { runClientCases } from "./client-runner";
export type { ClientHarness } from "./client-runner";
export { summarize, formatReport, getExitCode } from "./report";
export type { Summary, ReportOptions } from "./report";
export { runCli, parseArgs } from "./cli";
export type { ConformanceConfig, CliOptions } from "./cli";
export type {
  CaseResult,
  ConformanceCase,
  ConformanceLevel,
  ServerCase,
  ClientCase,
  ServerState,
  CascadeLimits,
  ClientState,
  CachedQuery,
  QueryState,
  EntryPattern,
  CascadeExpectation,
  FieldExpectation,
} from "./cases";
export { CASES, DOMAIN_SCHEMA, REFERENCE_SCHEMA } from "./generated/cases";
