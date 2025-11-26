/**
 * GraphQL Cascade URQL Integration
 *
 * Provides URQL exchange and cache adapter for processing
 * GraphQL Cascade responses.
 *
 * @packageDocumentation
 */

// Types
export * from './types';

// Exchange
export { cascadeExchange, extractCascadeData, hasCascadeData } from './exchange';

// Cache
export { InMemoryCascadeCache } from './cache';

// Client
export { URQLCascadeClient } from './client';
export type { CascadeMutationResult, OptimisticConfig } from './client';
