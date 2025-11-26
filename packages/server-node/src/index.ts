/**
 * GraphQL Cascade - TypeScript/Node.js Server Implementation
 *
 * Automatic cache updates for GraphQL mutations.
 */

// Core classes
export { CascadeTracker, CascadeTransaction, trackCascade } from './tracker';
export { CascadeBuilder, StreamingCascadeBuilder } from './builder';

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
  CascadeResponse,
  CascadeError,
  CascadeTrackerConfig,
  CascadeBuilderConfig,
  GraphQLEntity,
  EntityChangeIterator,
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
} from './integrations';

// Version
export const VERSION = '0.1.0';