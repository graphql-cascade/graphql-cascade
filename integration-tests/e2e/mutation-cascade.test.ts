/**
 * End-to-End Integration Tests for GraphQL Cascade
 *
 * Tests the complete flow from entity tracking to response building.
 */

import { CascadeErrorCode } from '@graphql-cascade/client';
import {
  createTestTracker,
  createTestBuilder,
  createUser,
  createPost,
  validateCascadeResponse,
  findUpdatedEntity,
  findDeletedEntity
} from './setup';

describe('End-to-End Cascade Flow', () => {
  describe('Entity Creation', () => {
    it('should track entity creation and build cascade response', () => {
      const tracker = createTestTracker();
      tracker.startTransaction();

      const user = createUser('1', { name: 'John Doe', email: 'john@example.com' });
      tracker.trackCreate(user);

      const builder = createTestBuilder(tracker);
      const response = builder.buildResponse({ id: '1', name: 'John Doe' }, true);

      expect(validateCascadeResponse(response)).toBe(true);
      expect(response.success).toBe(true);
      expect(response.cascade.updated.length).toBe(1);

      const updatedUser = findUpdatedEntity(response, 'User', '1');
      expect(updatedUser).toBeDefined();
      expect(updatedUser.operation).toBe('CREATED');
      expect(updatedUser.entity.name).toBe('John Doe');
    });

    it('should track multiple entity creations in one transaction', () => {
      const tracker = createTestTracker();
      tracker.startTransaction();

      const user = createUser('1');
      const post1 = createPost('101', '1');
      const post2 = createPost('102', '1');

      tracker.trackCreate(user);
      tracker.trackCreate(post1);
      tracker.trackCreate(post2);

      const builder = createTestBuilder(tracker);
      const response = builder.buildResponse(null, true);

      expect(response.cascade.updated.length).toBe(3);
      expect(findUpdatedEntity(response, 'User', '1')).toBeDefined();
      expect(findUpdatedEntity(response, 'Post', '101')).toBeDefined();
      expect(findUpdatedEntity(response, 'Post', '102')).toBeDefined();
    });
  });

  describe('Entity Update', () => {
    it('should track entity update and include in cascade', () => {
      const tracker = createTestTracker();
      tracker.startTransaction();

      const user = createUser('1', { name: 'John Updated' });
      tracker.trackUpdate(user);

      const builder = createTestBuilder(tracker);
      const response = builder.buildResponse(null, true);

      expect(response.cascade.updated.length).toBe(1);
      const updatedUser = findUpdatedEntity(response, 'User', '1');
      expect(updatedUser.operation).toBe('UPDATED');
      expect(updatedUser.entity.name).toBe('John Updated');
    });

    it('should deduplicate multiple updates to same entity', () => {
      const tracker = createTestTracker();
      tracker.startTransaction();

      const user1 = createUser('1', { name: 'First Update' });
      const user2 = createUser('1', { name: 'Second Update' });

      tracker.trackUpdate(user1);
      tracker.trackUpdate(user2);

      const builder = createTestBuilder(tracker);
      const response = builder.buildResponse(null, true);

      // Should only have one entry (deduplicated)
      expect(response.cascade.updated.length).toBe(1);
    });
  });

  describe('Entity Deletion', () => {
    it('should track entity deletion', () => {
      const tracker = createTestTracker();
      tracker.startTransaction();

      tracker.trackDelete('User', '1');

      const builder = createTestBuilder(tracker);
      const response = builder.buildResponse(null, true);

      expect(response.cascade.deleted.length).toBe(1);
      const deletedUser = findDeletedEntity(response, 'User', '1');
      expect(deletedUser).toBeDefined();
      expect(deletedUser.deletedAt).toBeDefined();
    });

    it('should move entity from updated to deleted when deleted after create', () => {
      const tracker = createTestTracker();
      tracker.startTransaction();

      const user = createUser('1');
      tracker.trackCreate(user);
      tracker.trackDelete('User', '1');

      const builder = createTestBuilder(tracker);
      const response = builder.buildResponse(null, true);

      // Should not be in updated
      expect(findUpdatedEntity(response, 'User', '1')).toBeUndefined();
      // Should be in deleted
      expect(findDeletedEntity(response, 'User', '1')).toBeDefined();
    });

    it('should track multiple deletions', () => {
      const tracker = createTestTracker();
      tracker.startTransaction();

      tracker.trackDelete('Post', '101');
      tracker.trackDelete('Post', '102');
      tracker.trackDelete('Comment', '201');

      const builder = createTestBuilder(tracker);
      const response = builder.buildResponse(null, true);

      expect(response.cascade.deleted.length).toBe(3);
    });
  });

  describe('Mixed Operations', () => {
    it('should handle create, update, and delete in same transaction', () => {
      const tracker = createTestTracker();
      tracker.startTransaction();

      // Create a new user
      const newUser = createUser('2', { name: 'New User' });
      tracker.trackCreate(newUser);

      // Update existing user
      const updatedUser = createUser('1', { name: 'Updated User' });
      tracker.trackUpdate(updatedUser);

      // Delete a post
      tracker.trackDelete('Post', '100');

      const builder = createTestBuilder(tracker);
      const response = builder.buildResponse(null, true);

      expect(response.cascade.updated.length).toBe(2);
      expect(response.cascade.deleted.length).toBe(1);

      expect(findUpdatedEntity(response, 'User', '2')?.operation).toBe('CREATED');
      expect(findUpdatedEntity(response, 'User', '1')?.operation).toBe('UPDATED');
      expect(findDeletedEntity(response, 'Post', '100')).toBeDefined();
    });
  });
});

describe('Response Format', () => {
  it('should produce valid CascadeResponse structure', () => {
    const tracker = createTestTracker();
    tracker.startTransaction();
    tracker.trackCreate(createUser('1'));

    const builder = createTestBuilder(tracker);
    const response = builder.buildResponse({ id: '1' }, true);

    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('data');
    expect(response).toHaveProperty('cascade');
    expect(response.cascade).toHaveProperty('updated');
    expect(response.cascade).toHaveProperty('deleted');
    expect(response.cascade).toHaveProperty('metadata');
  });

  it('should include metadata in response', () => {
    const tracker = createTestTracker();
    tracker.startTransaction();
    tracker.trackCreate(createUser('1'));

    const builder = createTestBuilder(tracker);
    const response = builder.buildResponse(null, true);

    expect(response.cascade.metadata).toHaveProperty('timestamp');
    expect(response.cascade.metadata).toHaveProperty('affectedCount');
    expect(typeof response.cascade.metadata.timestamp).toBe('string');
  });

  it('should handle empty transactions gracefully', () => {
    const tracker = createTestTracker();
    tracker.startTransaction();
    // No tracking calls

    const builder = createTestBuilder(tracker);
    const response = builder.buildResponse(null, true);

    expect(validateCascadeResponse(response)).toBe(true);
    expect(response.cascade.updated.length).toBe(0);
    expect(response.cascade.deleted.length).toBe(0);
  });

  it('should include primary result in response', () => {
    const tracker = createTestTracker();
    tracker.startTransaction();

    const user = createUser('1', { name: 'Test User' });
    tracker.trackCreate(user);

    const primaryResult = { id: '1', name: 'Test User', email: 'test@example.com' };
    const builder = createTestBuilder(tracker);
    const response = builder.buildResponse(primaryResult, true);

    expect(response.data).toEqual(primaryResult);
  });
});

describe('Configuration Limits', () => {
  it('should respect maxEntities tracker limit', () => {
    const tracker = createTestTracker({ maxEntities: 5, enableRelationshipTracking: false });
    tracker.startTransaction();

    // Create more entities than the limit
    for (let i = 0; i < 10; i++) {
      tracker.trackCreate(createUser(String(i)));
    }

    const builder = createTestBuilder(tracker);
    const response = builder.buildResponse(null, true);

    expect(response.cascade.updated.length).toBeLessThanOrEqual(5);
  });

  it('should respect maxUpdatedEntities builder limit', () => {
    const tracker = createTestTracker({ enableRelationshipTracking: false });
    tracker.startTransaction();

    for (let i = 0; i < 20; i++) {
      tracker.trackCreate(createUser(String(i)));
    }

    const builder = createTestBuilder(tracker, { maxUpdatedEntities: 10 });
    const response = builder.buildResponse(null, true);

    expect(response.cascade.updated.length).toBeLessThanOrEqual(10);
  });

  it('should respect maxDeletedEntities builder limit', () => {
    const tracker = createTestTracker();
    tracker.startTransaction();

    for (let i = 0; i < 20; i++) {
      tracker.trackDelete('User', String(i));
    }

    const builder = createTestBuilder(tracker, { maxDeletedEntities: 5 });
    const response = builder.buildResponse(null, true);

    expect(response.cascade.deleted.length).toBeLessThanOrEqual(5);
  });

  it('should indicate truncation in metadata when limits exceeded', () => {
    const tracker = createTestTracker({ maxEntities: 5, enableRelationshipTracking: false });
    tracker.startTransaction();

    for (let i = 0; i < 10; i++) {
      tracker.trackCreate(createUser(String(i)));
    }

    const builder = createTestBuilder(tracker);
    const response = builder.buildResponse(null, true);

    expect(response.cascade.metadata.truncatedUpdated).toBe(true);
  });
});

describe('Error Scenarios', () => {
  it('should build error response correctly', () => {
    const tracker = createTestTracker();
    tracker.startTransaction();

    const builder = createTestBuilder(tracker);
    const response = builder.buildErrorResponse([
      {
        message: 'Validation failed',
        code: CascadeErrorCode.VALIDATION_ERROR,
        field: 'email'
      }
    ], null);

    expect(response.success).toBe(false);
    expect(response.errors).toHaveLength(1);
    expect(response.errors![0].code).toBe(CascadeErrorCode.VALIDATION_ERROR);
  });

  it('should throw when tracking without transaction', () => {
    const tracker = createTestTracker();
    // Don't start transaction

    expect(() => {
      tracker.trackCreate(createUser('1'));
    }).toThrow(/transaction/i);
  });

  it('should throw when starting transaction twice', () => {
    const tracker = createTestTracker();
    tracker.startTransaction();

    expect(() => {
      tracker.startTransaction();
    }).toThrow(/already in progress/i);
  });

  it('should handle error response with partial cascade data', () => {
    const tracker = createTestTracker();
    tracker.startTransaction();

    // Track some entities before error
    tracker.trackCreate(createUser('1'));

    const builder = createTestBuilder(tracker);
    const response = builder.buildErrorResponse([
      { message: 'Something went wrong', code: CascadeErrorCode.INTERNAL_ERROR }
    ], null);

    expect(response.success).toBe(false);
    // Error response should still have cascade structure
    expect(response.cascade).toBeDefined();
  });
});

describe('Serialization', () => {
  it('should produce JSON-serializable response', () => {
    const tracker = createTestTracker();
    tracker.startTransaction();

    const user = createUser('1', { name: 'Test User' });
    tracker.trackCreate(user);

    const builder = createTestBuilder(tracker);
    const response = builder.buildResponse({ id: '1' }, true);

    // Should not throw
    const serialized = JSON.stringify(response);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.success).toBe(response.success);
    expect(deserialized.cascade.updated.length).toBe(response.cascade.updated.length);
  });

  it('should preserve entity data through serialization', () => {
    const tracker = createTestTracker();
    tracker.startTransaction();

    const user = createUser('1', { name: 'John Doe', email: 'john@example.com' });
    tracker.trackCreate(user);

    const builder = createTestBuilder(tracker);
    const response = builder.buildResponse(null, true);

    const serialized = JSON.stringify(response);
    const deserialized = JSON.parse(serialized);

    const updatedUser = deserialized.cascade.updated[0];
    expect(updatedUser.entity.name).toBe('John Doe');
    expect(updatedUser.entity.email).toBe('john@example.com');
  });
});
