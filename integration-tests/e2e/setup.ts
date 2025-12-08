/**
 * E2E Test Setup Utilities
 *
 * Provides helpers for creating test trackers, builders, and sample entities.
 */

import { CascadeTracker, CascadeBuilder, CascadeTrackerConfig, CascadeBuilderConfig } from '@graphql-cascade/server';

/**
 * Create a test tracker with optional configuration.
 */
export function createTestTracker(config: CascadeTrackerConfig = {}): CascadeTracker {
  return new CascadeTracker({
    maxDepth: 3,
    maxEntities: 100,
    enableRelationshipTracking: true,
    ...config
  });
}

/**
 * Create a test builder from a tracker.
 */
export function createTestBuilder(
  tracker: CascadeTracker,
  config: CascadeBuilderConfig = {}
): CascadeBuilder {
  return new CascadeBuilder(tracker, undefined, {
    maxUpdatedEntities: 100,
    maxDeletedEntities: 50,
    ...config
  });
}

/**
 * Entity type definitions.
 */
export type TestEntity = Record<string, unknown> & {
  __typename: string;
  id: string;
};

/**
 * Entity factories - return plain objects compatible with tracker.
 */
export function createUser(id: string, overrides: Record<string, unknown> = {}): TestEntity {
  return {
    __typename: 'User',
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    ...overrides
  };
}

export function createPost(id: string, authorId: string, overrides: Record<string, unknown> = {}): TestEntity {
  return {
    __typename: 'Post',
    id,
    title: `Post ${id}`,
    content: `Content for post ${id}`,
    authorId,
    ...overrides
  };
}

export function createComment(id: string, postId: string, authorId: string, overrides: Record<string, unknown> = {}): TestEntity {
  return {
    __typename: 'Comment',
    id,
    text: `Comment ${id}`,
    postId,
    authorId,
    ...overrides
  };
}

/**
 * Validate that a response matches the CascadeResponse structure.
 */
export function validateCascadeResponse(response: any): boolean {
  return (
    typeof response === 'object' &&
    typeof response.success === 'boolean' &&
    typeof response.cascade === 'object' &&
    Array.isArray(response.cascade.updated) &&
    Array.isArray(response.cascade.deleted) &&
    typeof response.cascade.metadata === 'object' &&
    typeof response.cascade.metadata.timestamp === 'string'
  );
}

/**
 * Check if an entity is in the updated list.
 */
export function findUpdatedEntity(response: any, typename: string, id: string): any | undefined {
  return response.cascade.updated.find(
    (e: any) => e.__typename === typename && e.id === id
  );
}

/**
 * Check if an entity is in the deleted list.
 */
export function findDeletedEntity(response: any, typename: string, id: string): any | undefined {
  return response.cascade.deleted.find(
    (e: any) => e.__typename === typename && e.id === id
  );
}
