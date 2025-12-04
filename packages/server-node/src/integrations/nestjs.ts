/**
 * NestJS Integration for GraphQL Cascade
 *
 * Provides CascadeModule and CascadeService for request-scoped
 * cascade tracking in NestJS applications.
 */

import { Module, Injectable, Scope, DynamicModule } from '@nestjs/common';
import { CascadeTracker } from '../tracker';
import { CascadeBuilder } from '../builder';
import {
  CascadeTrackerConfig,
  CascadeBuilderConfig,
  CascadeResponse,
  CascadeErrorInfo,
  GraphQLEntity,
} from '../types';

/**
 * Configuration options for CascadeModule.
 */
export interface CascadeModuleOptions extends CascadeTrackerConfig, CascadeBuilderConfig {}

/**
 * Request-scoped service for cascade tracking in NestJS.
 *
 * This service manages a CascadeTracker and CascadeBuilder instance
 * for each request, providing methods to track entity changes and
 * build cascade responses.
 */
@Injectable({ scope: Scope.REQUEST })
export class CascadeService {
  private tracker: CascadeTracker;
  private builder: CascadeBuilder;

  constructor() {
    // Initialize with default configuration
    // In forRoot scenario, these will be overridden
    this.tracker = new CascadeTracker();
    this.builder = new CascadeBuilder(this.tracker);
  }

  /**
   * Initialize with custom configuration.
   * @internal
   */
  initWithConfig(trackerConfig: CascadeTrackerConfig, builderConfig: CascadeBuilderConfig): void {
    this.tracker = new CascadeTracker(trackerConfig);
    this.builder = new CascadeBuilder(this.tracker, undefined, builderConfig);
  }

  /**
   * Get the underlying CascadeTracker instance.
   */
  getTracker(): CascadeTracker {
    return this.tracker;
  }

  /**
   * Get the underlying CascadeBuilder instance.
   */
  getBuilder(): CascadeBuilder {
    return this.builder;
  }

  /**
   * Start a new cascade transaction.
   */
  startTransaction(): string {
    return this.tracker.startTransaction();
  }

  /**
   * End the current cascade transaction.
   */
  endTransaction(): any {
    return this.tracker.endTransaction();
  }

  /**
   * Get cascade data without ending the transaction.
   */
  getCascadeData(): any {
    return this.tracker.getCascadeData();
  }

  /**
   * Track entity creation.
   */
  trackCreate<T extends GraphQLEntity>(entity: T): void {
    this.tracker.trackCreate(entity);
  }

  /**
   * Track entity update.
   */
  trackUpdate<T extends GraphQLEntity>(entity: T): void {
    this.tracker.trackUpdate(entity);
  }

  /**
   * Track entity deletion.
   */
  trackDelete(typename: string, id: string): void {
    this.tracker.trackDelete(typename, id);
  }

  /**
   * Build a complete cascade response.
   */
  buildResponse<T>(data?: T, success: boolean = true, errors: CascadeErrorInfo[] = []): CascadeResponse {
    return this.builder.buildResponse(data, success, errors);
  }

  /**
   * Build an error cascade response.
   */
  buildErrorResponse(errors: CascadeErrorInfo[], data?: any): CascadeResponse {
    return this.builder.buildErrorResponse(errors, data);
  }
}

/**
 * NestJS module for GraphQL Cascade.
 *
 * Provides request-scoped CascadeService for tracking entity changes
 * during GraphQL mutations.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [CascadeModule],
 *   // ... other configuration
 * })
 * export class AppModule {}
 * ```
 *
 * @example With configuration:
 * ```typescript
 * @Module({
 *   imports: [
 *     CascadeModule.forRoot({
 *       maxDepth: 5,
 *       excludeTypes: ['InternalType'],
 *       maxResponseSizeMb: 10,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  providers: [CascadeService],
  exports: [CascadeService],
})
export class CascadeModule {
  /**
   * Configure CascadeModule with custom options.
   */
  static forRoot(options?: CascadeModuleOptions): DynamicModule {
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

    return {
      module: CascadeModule,
      providers: [
        {
          provide: 'CASCADE_TRACKER_CONFIG',
          useValue: trackerConfig,
        },
        {
          provide: 'CASCADE_BUILDER_CONFIG',
          useValue: builderConfig,
        },
        {
          provide: CascadeService,
          scope: Scope.REQUEST,
          useFactory: () => {
            const service = new CascadeService();
            service.initWithConfig(trackerConfig, builderConfig);
            return service;
          },
        },
      ],
      exports: [CascadeService],
    };
  }
}
