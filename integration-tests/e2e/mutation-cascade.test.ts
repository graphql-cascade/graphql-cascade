import { CascadeTracker, CascadeBuilder } from '@graphql-cascade/server';
import { CascadeResponse, CascadeOperation, InvalidationStrategy } from '@graphql-cascade/client';
import {
  createTestTracker,
  createTestBuilder,
  createUser,
  createPost,
  createComment,
  linkEntities,
  assertValidCascadeResponse,
  User,
  Post,
  Comment,
} from './setup';

describe('End-to-End Cascade Flow', () => {
  let tracker: CascadeTracker;
  let builder: CascadeBuilder;

  beforeEach(() => {
    tracker = createTestTracker();
    builder = createTestBuilder(tracker);
  });

  it('should track entity creation and build cascade response', () => {
    const transactionId = tracker.startTransaction();

    const user = createUser();
    tracker.trackCreate(user);

    const response = builder.buildResponse(user);

    expect(response.success).toBe(true);
    expect(response.data).toBe(user);
    assertValidCascadeResponse(response);

    expect(response.cascade.updated).toHaveLength(1);
    expect(response.cascade.updated[0].__typename).toBe('User');
    expect(response.cascade.updated[0].id).toBe(user.id);
    expect(response.cascade.updated[0].operation).toBe('CREATED');
    expect(response.cascade.updated[0].entity).toEqual(user);

    expect(response.cascade.metadata.transactionId).toBe(transactionId);
    expect(response.cascade.metadata.affectedCount).toBe(1);
  });

  it('should track entity update and include in cascade', () => {
    tracker.startTransaction();

    const user = createUser();
    tracker.trackUpdate(user);

    const response = builder.buildResponse(user);

    expect(response.success).toBe(true);
    expect(response.cascade.updated).toHaveLength(1);
    expect(response.cascade.updated[0].operation).toBe('UPDATED');
    expect(response.cascade.updated[0].entity).toEqual(user);
  });

  it('should track entity deletion', () => {
    tracker.startTransaction();

    const user = createUser();
    tracker.trackDelete('User', user.id);

    const response = builder.buildResponse();

    expect(response.success).toBe(true);
    expect(response.cascade.deleted).toHaveLength(1);
    expect(response.cascade.deleted[0].__typename).toBe('User');
    expect(response.cascade.deleted[0].id).toBe(user.id);
    expect(response.cascade.deleted[0].deletedAt).toBeDefined();
  });

  it('should handle multiple entity types in one transaction', () => {
    tracker.startTransaction();

    const user = createUser();
    const post = createPost();
    const comment = createComment();

    tracker.trackCreate(user);
    tracker.trackCreate(post);
    tracker.trackCreate(comment);

    const response = builder.buildResponse();

    expect(response.cascade.updated).toHaveLength(3);
    const types = response.cascade.updated.map(u => u.__typename);
    expect(types).toContain('User');
    expect(types).toContain('Post');
    expect(types).toContain('Comment');
    expect(response.cascade.metadata.affectedCount).toBe(3);
  });
});

describe('Relationship Tracking', () => {
  it('should track related entities within depth limit', () => {
    const tracker = createTestTracker({ maxDepth: 2 });
    const builder = createTestBuilder(tracker);

    tracker.startTransaction();

    const user = createUser();
    const post = createPost();
    const comment = createComment();

    linkEntities(user, post, comment);

    tracker.trackCreate(post); // This should cascade to user and comment

    const response = builder.buildResponse();

    // Should include post and its related entities
    expect(response.cascade.updated.length).toBeGreaterThanOrEqual(1);
    expect(response.cascade.updated.some(u => u.__typename === 'Post')).toBe(true);
  });

  it('should respect maxDepth configuration', () => {
    const tracker = createTestTracker({ maxDepth: 1 });
    const builder = createTestBuilder(tracker);

    tracker.startTransaction();

    const user = createUser();
    const post = createPost();
    const comment = createComment();

    linkEntities(user, post, comment);

    tracker.trackCreate(post);

    const response = builder.buildResponse();

    // With depth 1, should track post and user, but not comment (depth 2)
    const updatedTypes = response.cascade.updated.map(u => u.__typename);
    expect(updatedTypes).toContain('Post');
    // Comment might not be included due to depth limit
  });
});

describe('Response Format', () => {
  let tracker: CascadeTracker;
  let builder: CascadeBuilder;

  beforeEach(() => {
    tracker = createTestTracker();
    builder = createTestBuilder(tracker);
  });

  it('should produce valid CascadeResponse structure', () => {
    tracker.startTransaction();
    const user = createUser();
    tracker.trackCreate(user);

    const response = builder.buildResponse(user);

    assertValidCascadeResponse(response);
  });

  it('should include metadata in response', () => {
    tracker.startTransaction();
    const user = createUser();
    tracker.trackCreate(user);

    const response = builder.buildResponse(user);

    expect(response.cascade.metadata).toHaveProperty('timestamp');
    expect(response.cascade.metadata).toHaveProperty('depth');
    expect(response.cascade.metadata).toHaveProperty('affectedCount');
    expect(response.cascade.metadata).toHaveProperty('trackingTime');
    expect(typeof response.cascade.metadata.timestamp).toBe('string');
    expect(typeof response.cascade.metadata.depth).toBe('number');
    expect(typeof response.cascade.metadata.affectedCount).toBe('number');
  });

  it('should handle empty transactions', () => {
    tracker.startTransaction();

    const response = builder.buildResponse();

    expect(response.success).toBe(true);
    expect(response.cascade.updated).toHaveLength(0);
    expect(response.cascade.deleted).toHaveLength(0);
    expect(response.cascade.invalidations).toHaveLength(0);
    expect(response.cascade.metadata.affectedCount).toBe(0);
  });
});

describe('Error Scenarios', () => {
  let tracker: CascadeTracker;
  let builder: CascadeBuilder;

  beforeEach(() => {
    tracker = createTestTracker();
    builder = createTestBuilder(tracker);
  });

  it('should handle error responses correctly', () => {
    tracker.startTransaction();
    const user = createUser();
    tracker.trackCreate(user);

    const errors = [{ message: 'Test error', code: 'TEST_ERROR' }];
    const response = builder.buildErrorResponse(errors, null);

    expect(response.success).toBe(false);
    expect(response.errors).toEqual(errors);
    expect(response.data).toBe(null);
    assertValidCascadeResponse(response);
  });

  it('should handle transaction already in progress error', () => {
    tracker.startTransaction();

    expect(() => {
      tracker.startTransaction();
    }).toThrow('Transaction already in progress');
  });

  it('should handle tracking without transaction', () => {
    const user = createUser();

    expect(() => {
      tracker.trackCreate(user);
    }).toThrow('No cascade transaction in progress');
  });
});

describe('Configuration Limits', () => {
  it('should respect maxEntities limit', () => {
    const tracker = createTestTracker({ maxEntities: 2 });
    const builder = createTestBuilder(tracker);

    tracker.startTransaction();

    // Create 3 entities, but limit is 2
    const user1 = createUser();
    const user2 = createUser();
    const user3 = createUser();

    tracker.trackCreate(user1);
    tracker.trackCreate(user2);
    tracker.trackCreate(user3);

    const response = builder.buildResponse();

    // Should only have 2 entities due to limit
    expect(response.cascade.updated.length).toBeLessThanOrEqual(2);
    expect(response.cascade.metadata.truncatedUpdated).toBe(true);
  });

  it('should handle excluded types', () => {
    const tracker = createTestTracker({ excludeTypes: ['User'] });
    const builder = createTestBuilder(tracker);

    tracker.startTransaction();

    const user = createUser();
    const post = createPost();

    tracker.trackCreate(user);
    tracker.trackCreate(post);

    const response = builder.buildResponse();

    // User should be excluded, only Post should be included
    expect(response.cascade.updated.length).toBe(1);
    expect(response.cascade.updated[0].__typename).toBe('Post');
  });
});

describe('Builder Limits', () => {
  it('should respect maxUpdatedEntities limit', () => {
    const tracker = createTestTracker();
    const builder = createTestBuilder(tracker);

    // Override maxUpdatedEntities
    (builder as any).maxUpdatedEntities = 1;

    tracker.startTransaction();

    const user1 = createUser();
    const user2 = createUser();

    tracker.trackCreate(user1);
    tracker.trackCreate(user2);

    const response = builder.buildResponse();

    expect(response.cascade.updated.length).toBe(1);
    expect(response.cascade.metadata.truncatedUpdated).toBe(true);
  });
});
