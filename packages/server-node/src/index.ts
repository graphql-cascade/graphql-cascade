/**
 * GraphQL Cascade - TypeScript/Node.js Server Implementation
 *
 * Automatic cache updates for GraphQL mutations.
 */

// Core classes
export {
  AsyncEntityFilterError,
  CascadeTracker,
  CascadeTransaction,
  trackCascade,
} from "./tracker";
export type { TrackerCheckpoint } from "./tracker";
export { CascadeBuilder, StreamingCascadeBuilder } from "./builder";
export { CascadeError } from "./errors";
export {
  CascadeErrorCode,
  InvalidationScope,
  InvalidationStrategy,
} from "./types";

// Error convenience functions
export {
  validationError,
  notFoundError,
  timeoutError,
  rateLimitedError,
  serviceUnavailableError,
  unauthorizedError,
  forbiddenError,
  conflictError,
  withDomainCode,
} from "./errors";

// Logging
export {
  logger,
  configureLogger,
  getLoggerConfig,
  createScopedLogger,
  silentLogger,
} from "./logger";
export type { LogLevel, CascadeLogger, LoggerConfig } from "./logger";

// Metrics
export { DefaultMetricsCollector, exportPrometheusMetrics } from "./metrics";
export type {
  MetricsCollector,
  CascadeMetricsSnapshot,
  CounterMetric,
  GaugeMetric,
  HistogramMetric,
} from "./metrics";

// Health Check
export { createHealthCheck, getHealthStatusCode } from "./health";
export type { CascadeHealthStatus, HealthCheckConfig } from "./health";

// Convenience functions
export {
  buildSuccessResponse,
  buildErrorResponse,
  buildStreamingSuccessResponse,
} from "./builder";

// Types
export type {
  EntityChange,
  CascadeMetadata,
  CascadeUpdatedEntity,
  CascadeDeletedEntity,
  QueryInvalidation,
  Invalidator,
  CascadeTypeInvalidation,
  CascadeData,
  CascadeErrorInfo,
  CascadeResponse,
  CascadeErrorInfo as CascadeErrorType,
  CascadeTrackerConfig,
  CascadeBuilderConfig,
  GraphQLEntity,
  EntityChangeIterator,
  CascadeLoggerInterface,
} from "./types";

// OpenTelemetry metrics (no runtime dependency on @opentelemetry/api).
// Framework integrations have their own entries, so this one loads without
// their peer dependencies: @graphql-cascade/server/nestjs, /express and
// /apollo.
export { OpenTelemetryMetricsCollector } from "./integrations/opentelemetry";
export type {
  OpenTelemetryConfig,
  OTelMeter,
  OTelCounter,
  OTelHistogram,
  OTelUpDownCounter,
} from "./integrations/opentelemetry";

// Version
export const VERSION = "0.3.0";
