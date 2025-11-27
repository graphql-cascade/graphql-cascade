/**
 * E2E Test Setup Utilities
 *
 * Provides helpers for creating test trackers, builders, and sample entities.
 */

import { CascadeTracker, CascadeBuilder, CascadeTrackerConfig, CascadeBuilderConfig } from '@graphql-cascade/server';
import { CascadeResponse, CascadeOperation } from '@graphql-cascade/client';

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
 * Entity factory types.
 */
export interface TestUser {
  __typename: 'User';
  id: string;
  name: string;
  email: string;
  posts?: TestPost[];
}

export interface TestPost {
  __typename: 'Post';
  id: string;
  title: string;
  content: string;
  authorId: string;
  comments?: TestComment[];
}

export interface TestComment {
  __typename: 'Comment';
  id: string;
  text: string;
  postId: string;
  authorId: string;
}

/**
 * Entity factories.
 */
export function createUser(id: string, overrides: Partial<Omit<TestUser, '__typename' | 'id'>> = {}): TestUser {
  return {
    __typename: 'User',
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    ...overrides
  };
}

export function createPost(id: string, authorId: string, overrides: Partial<Omit<TestPost, '__typename' | 'id' | 'authorId'>> = {}): TestPost {
  return {
    __typename: 'Post',
    id,
    title: `Post ${id}`,
    content: `Content for post ${id}`,
    authorId,
    ...overrides
  };
}

export function createComment(id: string, postId: string, authorId: string, overrides: Partial<Omit<TestComment, '__typename' | 'id' | 'postId' | 'authorId'>> = {}): TestComment {
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
export function validateCascadeResponse(response: any): response is CascadeResponse {
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
export function findUpdatedEntity(response: CascadeResponse, typename: string, id: string): any | undefined {
  return response.cascade.updated.find(
    (e: any) => e.__typename === typename && e.id === id
  );
}

/**
 * Check if an entity is in the deleted list.
 */
export function findDeletedEntity(response: CascadeResponse, typename: string, id: string): any | undefined {
  return response.cascade.deleted.find(
    (e: any) => e.__typename === typename && e.id === id
  );
}
