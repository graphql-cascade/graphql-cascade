/**
 * GraphQL Cascade Framework Integrations
 *
 * Optional integrations for popular Node.js frameworks and GraphQL servers.
 */

// NestJS Integration
export {
  CascadeModule,
  CascadeService,
  CascadeModuleOptions,
} from './nestjs';

// Apollo Server Integration
export {
  createCascadePlugin,
  CascadePluginOptions,
} from './apollo';

// Express Integration
export {
  cascadeMiddleware,
  getCascadeData,
  buildCascadeResponse,
  CascadeMiddlewareOptions,
} from './express';

// OpenTelemetry Integration
export {
  OpenTelemetryMetricsCollector,
  type OpenTelemetryConfig,
  type OTelMeter,
  type OTelCounter,
  type OTelHistogram,
  type OTelUpDownCounter,
} from './opentelemetry';
