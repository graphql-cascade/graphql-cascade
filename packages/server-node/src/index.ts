/**
 * GraphQL Cascade - TypeScript/Node.js Server Implementation
 *
 * Automatic cache updates for GraphQL mutations.
 */

// Core classes
export { CascadeTracker, CascadeTransaction, trackCascade } from './tracker';
export { CascadeBuilder, StreamingCascadeBuilder } from './builder';
export { CascadeError, CascadeErrorCode } from './errors';

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
} from './errors';

// Logging
export {
  logger,
  configureLogger,
  getLoggerConfig,
  createScopedLogger,
  silentLogger,
} from './logger';
export type { LogLevel, CascadeLogger, LoggerConfig } from './logger';

// Metrics
export {
  DefaultMetricsCollector,
  exportPrometheusMetrics,
} from './metrics';
export type {
  MetricsCollector,
  CascadeMetricsSnapshot,
  CounterMetric,
  GaugeMetric,
  HistogramMetric,
} from './metrics';

// Health Check
export { createHealthCheck, getHealthStatusCode } from './health';
export type { CascadeHealthStatus, HealthCheckConfig } from './health';

// Convenience functions
export {
  buildSuccessResponse,
  buildErrorResponse,
  buildStreamingSuccessResponse,
} from './builder';

// Types
export type {
  EntityChange,
  CascadeMetadata,
  CascadeUpdatedEntity,
  CascadeDeletedEntity,
  CascadeInvalidation,
  CascadeData,
  CascadeErrorInfo,
  CascadeResponse,
  CascadeErrorInfo as CascadeErrorType,
  CascadeTrackerConfig,
  CascadeBuilderConfig,
  GraphQLEntity,
  EntityChangeIterator,
  CascadeLoggerInterface,
} from './types';

// Integrations (optional - require peer dependencies)
export {
  CascadeModule,
  CascadeService,
  CascadeModuleOptions,
  createCascadePlugin,
  CascadePluginOptions,
  cascadeMiddleware,
  getCascadeData,
  buildCascadeResponse,
  CascadeMiddlewareOptions,
  OpenTelemetryMetricsCollector,
} from './integrations';
export type {
  OpenTelemetryConfig,
  OTelMeter,
  OTelCounter,
  OTelHistogram,
  OTelUpDownCounter,
} from './integrations';

// Version
export const VERSION = '0.3.0';