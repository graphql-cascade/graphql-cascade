import { CascadeTracker, CascadeBuilder } from '@graphql-cascade/server';
import { CascadeResponse, CascadeOperation, InvalidationStrategy } from '@graphql-cascade/client';

/**
 * Test setup utilities for GraphQL Cascade E2E tests
 */

/**
 * Sample entity types for testing
 */
export interface User {
  __typename: 'User';
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  __typename: 'Post';
  id: string;
  title: string;
  content: string;
  authorId: string;
  author?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  __typename: 'Comment';
  id: string;
  content: string;
  postId: string;
  post?: Post;
  authorId: string;
  author?: User;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a configured CascadeTracker for testing
 */
export function createTestTracker(config: Partial<{
  maxDepth: number;
  enableRelationshipTracking: boolean;
  maxEntities: number;
}> = {}): CascadeTracker {
  return new CascadeTracker({
    maxDepth: config.maxDepth ?? 2,
    enableRelationshipTracking: config.enableRelationshipTracking ?? true,
    maxEntities: config.maxEntities ?? 100,
    excludeTypes: [],
    maxRelatedPerEntity: 10,
  });
}

/**
 * Create a configured CascadeBuilder for testing
 */
export function createTestBuilder(tracker: CascadeTracker): CascadeBuilder {
  return new CascadeBuilder(tracker, undefined, {
    maxResponseSizeMb: 1.0,
    maxUpdatedEntities: 50,
    maxDeletedEntities: 20,
    maxInvalidations: 10,
  });
}

/**
 * Entity factory functions
 */
export function createUser(overrides: Partial<User> = {}): User {
  const now = new Date().toISOString();
  return {
    __typename: 'User',
    id: `user_${Math.random().toString(36).substring(2, 11)}`,
    name: 'Test User',
    email: 'test@example.com',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createPost(overrides: Partial<Post> = {}): Post {
  const now = new Date().toISOString();
  return {
    __typename: 'Post',
    id: `post_${Math.random().toString(36).substring(2, 11)}`,
    title: 'Test Post',
    content: 'Test content',
    authorId: `user_${Math.random().toString(36).substring(2, 11)}`,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createComment(overrides: Partial<Comment> = {}): Comment {
  const now = new Date().toISOString();
  return {
    __typename: 'Comment',
    id: `comment_${Math.random().toString(36).substring(2, 11)}`,
    content: 'Test comment',
    postId: `post_${Math.random().toString(36).substring(2, 11)}`,
    authorId: `user_${Math.random().toString(36).substring(2, 11)}`,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Helper to simulate entity relationships
 */
export function linkEntities(user: User, post: Post, comment?: Comment): void {
  post.authorId = user.id;
  post.author = user;
  
  if (comment) {
    comment.postId = post.id;
    comment.post = post;
    comment.authorId = user.id;
    comment.author = user;
  }
}

/**
 * Helper to assert CascadeResponse structure
 */
export function assertValidCascadeResponse(response: CascadeResponse): void {
  expect(response).toHaveProperty('success');
  expect(response).toHaveProperty('data');
  expect(response).toHaveProperty('cascade');
  
  expect(response.cascade).toHaveProperty('updated');
  expect(response.cascade).toHaveProperty('deleted');
  expect(response.cascade).toHaveProperty('invalidations');
  expect(response.cascade).toHaveProperty('metadata');
  
  expect(Array.isArray(response.cascade.updated)).toBe(true);
  expect(Array.isArray(response.cascade.deleted)).toBe(true);
  expect(Array.isArray(response.cascade.invalidations)).toBe(true);
  
  expect(response.cascade.metadata).toHaveProperty('timestamp');
  expect(response.cascade.metadata).toHaveProperty('depth');
  expect(response.cascade.metadata).toHaveProperty('affectedCount');
}
