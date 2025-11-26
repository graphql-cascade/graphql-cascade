import { ApolloClient, DocumentNode, FetchResult, Observable } from '@apollo/client';
import { CascadeUpdates, CascadeResponse } from '@graphql-cascade/client';
import { ApolloCascadeClient } from './client';

/**
 * Subscription cascade event types
 */
export type CascadeSubscriptionEventType =
  | 'ENTITY_UPDATED'
  | 'ENTITY_DELETED'
  | 'QUERY_INVALIDATED'
  | 'BATCH_UPDATE';

/**
 * Subscription cascade event
 */
export interface CascadeSubscriptionEvent {
  type: CascadeSubscriptionEventType;
  cascade: CascadeUpdates;
  timestamp: string;
  source?: string;
}

/**
 * Options for cascade subscription
 */
export interface CascadeSubscriptionOptions<TData = unknown> {
  /**
   * Callback when cascade data is received
   */
  onCascade?: (cascade: CascadeUpdates) => void;

  /**
   * Callback when subscription error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Callback when subscription completes
   */
  onComplete?: () => void;

  /**
   * Whether to automatically apply cascade updates to cache
   * @default true
   */
  autoApply?: boolean;

  /**
   * Filter function to decide which cascade events to process
   */
  filter?: (event: CascadeSubscriptionEvent) => boolean;

  /**
   * GraphQL variables for the subscription
   */
  variables?: Record<string, unknown>;
}

/**
 * Active subscription handle
 */
export interface CascadeSubscriptionHandle {
  /**
   * Unsubscribe from the cascade subscription
   */
  unsubscribe: () => void;

  /**
   * Whether the subscription is still active
   */
  readonly isActive: boolean;

  /**
   * Pause cascade processing (subscription remains active)
   */
  pause: () => void;

  /**
   * Resume cascade processing
   */
  resume: () => void;

  /**
   * Whether cascade processing is paused
   */
  readonly isPaused: boolean;
}

/**
 * Subscription manager for GraphQL Cascade.
 * Handles real-time cascade updates via GraphQL subscriptions.
 */
export class CascadeSubscriptionManager {
  private activeSubscriptions = new Map<string, CascadeSubscriptionHandle>();
  private pausedSubscriptions = new Set<string>();

  constructor(
    private cascadeClient: ApolloCascadeClient,
    private apolloClient: ApolloClient<unknown>
  ) {}

  /**
   * Subscribe to cascade events for a specific subscription.
   *
   * @param subscription - The GraphQL subscription document
   * @param options - Subscription options
   * @returns A handle to manage the subscription
   */
  subscribe<TData = unknown>(
    subscription: DocumentNode,
    options: CascadeSubscriptionOptions<TData> = {}
  ): CascadeSubscriptionHandle {
    const {
      onCascade,
      onError,
      onComplete,
      autoApply = true,
      filter,
      variables
    } = options;

    const subscriptionId = this.generateSubscriptionId();
    let isActive = true;
    let isPaused = false;

    const observable = this.apolloClient.subscribe({
      query: subscription,
      variables
    });

    const subscription$ = observable.subscribe({
      next: (result: FetchResult<TData>) => {
        if (!isActive || isPaused) return;

        try {
          const cascadeEvent = this.extractCascadeEvent(result);

          if (!cascadeEvent) return;

          // Apply filter if provided
          if (filter && !filter(cascadeEvent)) return;

          // Auto-apply cascade updates to cache
          if (autoApply) {
            const mockResponse: CascadeResponse = {
              success: true,
              data: null,
              cascade: cascadeEvent.cascade
            };
            this.cascadeClient.applyCascade(mockResponse);
          }

          // Call user callback
          onCascade?.(cascadeEvent.cascade);

        } catch (err) {
          onError?.(err as Error);
        }
      },
      error: (error: Error) => {
        isActive = false;
        this.activeSubscriptions.delete(subscriptionId);
        onError?.(error);
      },
      complete: () => {
        isActive = false;
        this.activeSubscriptions.delete(subscriptionId);
        onComplete?.();
      }
    });

    const handle: CascadeSubscriptionHandle = {
      unsubscribe: () => {
        isActive = false;
        subscription$.unsubscribe();
        this.activeSubscriptions.delete(subscriptionId);
        this.pausedSubscriptions.delete(subscriptionId);
      },
      get isActive() {
        return isActive;
      },
      pause: () => {
        isPaused = true;
        this.pausedSubscriptions.add(subscriptionId);
      },
      resume: () => {
        isPaused = false;
        this.pausedSubscriptions.delete(subscriptionId);
      },
      get isPaused() {
        return isPaused;
      }
    };

    this.activeSubscriptions.set(subscriptionId, handle);

    return handle;
  }

  /**
   * Subscribe to all entity changes for a specific type.
   *
   * @param typename - The GraphQL typename to watch
   * @param subscription - The subscription document
   * @param options - Subscription options
   */
  subscribeToEntity(
    typename: string,
    subscription: DocumentNode,
    options: CascadeSubscriptionOptions = {}
  ): CascadeSubscriptionHandle {
    return this.subscribe(subscription, {
      ...options,
      filter: (event) => {
        const hasMatchingUpdate = event.cascade.updated.some(
          u => u.__typename === typename
        );
        const hasMatchingDelete = event.cascade.deleted.some(
          d => d.__typename === typename
        );

        const matches = hasMatchingUpdate || hasMatchingDelete;

        // Apply user filter as well if provided
        if (options.filter) {
          return matches && options.filter(event);
        }

        return matches;
      }
    });
  }

  /**
   * Subscribe to changes for a specific entity by ID.
   *
   * @param typename - The GraphQL typename
   * @param id - The entity ID
   * @param subscription - The subscription document
   * @param options - Subscription options
   */
  subscribeToEntityById(
    typename: string,
    id: string,
    subscription: DocumentNode,
    options: CascadeSubscriptionOptions = {}
  ): CascadeSubscriptionHandle {
    return this.subscribe(subscription, {
      ...options,
      filter: (event) => {
        const hasMatchingUpdate = event.cascade.updated.some(
          u => u.__typename === typename && u.id === id
        );
        const hasMatchingDelete = event.cascade.deleted.some(
          d => d.__typename === typename && d.id === id
        );

        const matches = hasMatchingUpdate || hasMatchingDelete;

        if (options.filter) {
          return matches && options.filter(event);
        }

        return matches;
      }
    });
  }

  /**
   * Get all active subscriptions.
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.activeSubscriptions.keys());
  }

  /**
   * Unsubscribe from all active subscriptions.
   */
  unsubscribeAll(): void {
    this.activeSubscriptions.forEach(handle => handle.unsubscribe());
    this.activeSubscriptions.clear();
    this.pausedSubscriptions.clear();
  }

  /**
   * Pause all subscriptions.
   */
  pauseAll(): void {
    this.activeSubscriptions.forEach(handle => handle.pause());
  }

  /**
   * Resume all subscriptions.
   */
  resumeAll(): void {
    this.activeSubscriptions.forEach(handle => handle.resume());
  }

  /**
   * Extract cascade event from subscription result.
   */
  private extractCascadeEvent<TData>(
    result: FetchResult<TData>
  ): CascadeSubscriptionEvent | null {
    if (!result.data) return null;

    // Try to find cascade data in the result
    // Subscriptions can return cascade in different ways:
    // 1. Direct cascade field: { cascade: { updated: [], deleted: [], ... } }
    // 2. Nested in a field: { entityUpdated: { cascade: { ... } } }
    // 3. In extensions: result.extensions.cascade

    // Check extensions first (standard location per spec)
    if (result.extensions?.cascade) {
      return {
        type: this.inferEventType(result.extensions.cascade as CascadeUpdates),
        cascade: result.extensions.cascade as CascadeUpdates,
        timestamp: new Date().toISOString(),
        source: 'extensions'
      };
    }

    // Check for direct cascade field in data
    const data = result.data as Record<string, unknown>;
    const subscriptionName = Object.keys(data)[0];
    const subscriptionData = data[subscriptionName] as Record<string, unknown>;

    if (subscriptionData?.cascade) {
      return {
        type: this.inferEventType(subscriptionData.cascade as CascadeUpdates),
        cascade: subscriptionData.cascade as CascadeUpdates,
        timestamp: new Date().toISOString(),
        source: subscriptionName
      };
    }

    // Try to construct cascade from entity updates
    if (subscriptionData && typeof subscriptionData === 'object') {
      const entity = subscriptionData as Record<string, unknown>;
      if (entity.__typename && entity.id) {
        // Import CascadeOperation from types
        const CascadeOperation = { CREATED: 'CREATED', UPDATED: 'UPDATED', DELETED: 'DELETED' } as const;
        return {
          type: 'ENTITY_UPDATED',
          cascade: {
            updated: [{
              __typename: entity.__typename as string,
              id: entity.id as string,
              operation: CascadeOperation.UPDATED as unknown as import('@graphql-cascade/client').CascadeOperation,
              entity
            }],
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: new Date().toISOString(),
              depth: 1,
              affectedCount: 1
            }
          },
          timestamp: new Date().toISOString(),
          source: subscriptionName
        };
      }
    }

    return null;
  }

  /**
   * Infer the event type from cascade updates.
   */
  private inferEventType(cascade: CascadeUpdates): CascadeSubscriptionEventType {
    const hasUpdates = cascade.updated.length > 0;
    const hasDeletes = cascade.deleted.length > 0;
    const hasInvalidations = cascade.invalidations.length > 0;

    if (hasUpdates && hasDeletes) {
      return 'BATCH_UPDATE';
    }
    if (hasDeletes) {
      return 'ENTITY_DELETED';
    }
    if (hasInvalidations && !hasUpdates) {
      return 'QUERY_INVALIDATED';
    }
    return 'ENTITY_UPDATED';
  }

  /**
   * Generate a unique subscription ID.
   */
  private generateSubscriptionId(): string {
    return `cascade_sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * React hook for cascade subscriptions (for use with @apollo/client).
 * Note: This is a factory function - actual implementation requires React context.
 */
export function createUseCascadeSubscription(
  subscriptionManager: CascadeSubscriptionManager
) {
  return function useCascadeSubscription<TData = unknown>(
    subscription: DocumentNode,
    options: CascadeSubscriptionOptions<TData> = {}
  ) {
    // This would be implemented with React hooks in a React-specific file
    // For now, return the manager's subscribe method
    return subscriptionManager.subscribe(subscription, options);
  };
}
