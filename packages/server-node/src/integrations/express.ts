/**
 * Express Middleware for GraphQL Cascade
 *
 * Provides Express middleware that attaches a CascadeTracker to each request.
 */

import { Request, Response, NextFunction } from 'express';
import { CascadeTracker } from '../tracker';
import { CascadeBuilder } from '../builder';
import { CascadeTrackerConfig, CascadeBuilderConfig } from '../types';

/**
 * Extend Express Request type to include cascade tracker and builder.
 */
declare global {
  namespace Express {
    interface Request {
      cascadeTracker?: CascadeTracker;
      cascadeBuilder?: CascadeBuilder;
    }
  }
}

/**
 * Configuration options for cascade middleware.
 */
export interface CascadeMiddlewareOptions extends CascadeTrackerConfig, CascadeBuilderConfig {}

/**
 * Creates Express middleware that attaches a CascadeTracker and CascadeBuilder
 * to each request.
 *
 * @param options - Configuration options for the tracker and builder
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { cascadeMiddleware } from '@graphql-cascade/server';
 *
 * const app = express();
 *
 * // Add cascade middleware
 * app.use(cascadeMiddleware({
 *   maxDepth: 5,
 *   excludeTypes: ['InternalType'],
 * }));
 *
 * // Use in routes
 * app.post('/graphql', (req, res) => {
 *   req.cascadeTracker.startTransaction();
 *   // ... your GraphQL handling
 * });
 * ```
 *
 * @example With GraphQL HTTP:
 * ```typescript
 * import { createHandler } from 'graphql-http/lib/use/express';
 * import { cascadeMiddleware } from '@graphql-cascade/server';
 *
 * app.use('/graphql', cascadeMiddleware());
 * app.all('/graphql', createHandler({
 *   schema,
 *   context: (req) => ({
 *     cascadeTracker: req.raw.cascadeTracker,
 *   }),
 * }));
 * ```
 */
export function cascadeMiddleware(options?: CascadeMiddlewareOptions) {
  const trackerConfig: CascadeTrackerConfig = {
    maxDepth: options?.maxDepth,
    excludeTypes: options?.excludeTypes,
    enableRelationshipTracking: options?.enableRelationshipTracking,
  };

  const builderConfig: CascadeBuilderConfig = {
    maxResponseSizeMb: options?.maxResponseSizeMb,
    maxUpdatedEntities: options?.maxUpdatedEntities,
    maxDeletedEntities: options?.maxDeletedEntities,
    maxInvalidations: options?.maxInvalidations,
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Create a new tracker and builder for this request
    req.cascadeTracker = new CascadeTracker(trackerConfig);
    req.cascadeBuilder = new CascadeBuilder(req.cascadeTracker, undefined, builderConfig);

    next();
  };
}

/**
 * Helper function to get cascade data from a request.
 *
 * @param req - Express request object
 * @returns Cascade data if available, null otherwise
 */
export function getCascadeData(req: Request): any | null {
  if (!req.cascadeTracker) {
    return null;
  }

  try {
    return req.cascadeTracker.getCascadeData();
  } catch (error) {
    // Transaction not started or other error
    return null;
  }
}

/**
 * Helper function to build a cascade response from a request.
 *
 * @param req - Express request object
 * @param data - The primary response data
 * @param success - Whether the operation succeeded
 * @param errors - Any errors that occurred
 * @returns Cascade response
 */
export function buildCascadeResponse(
  req: Request,
  data?: any,
  success: boolean = true,
  errors: any[] = []
): any {
  if (!req.cascadeBuilder) {
    throw new Error('CascadeBuilder not found on request. Did you add cascadeMiddleware?');
  }

  return req.cascadeBuilder.buildResponse(data, success, errors);
}
