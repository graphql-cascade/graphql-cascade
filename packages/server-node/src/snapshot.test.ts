/**
 * Snapshot Tests for Cascade Response Formats
 *
 * These tests ensure response format stability. If the response structure
 * changes, these tests will fail, prompting a review of the changes.
 */

import { CascadeTracker } from './tracker';
import { CascadeBuilder, StreamingCascadeBuilder } from './builder';

/**
 * Normalize dynamic fields in cascade response for snapshot consistency.
 */
function normalizeResponse(response: any): any {
  const normalized = JSON.parse(JSON.stringify(response));

  // Normalize metadata timestamps and IDs
  if (normalized.cascade?.metadata) {
    normalized.cascade.metadata.timestamp = 'NORMALIZED_TIMESTAMP';
    normalized.cascade.metadata.transactionId = 'NORMALIZED_TRANSACTION_ID';
    normalized.cascade.metadata.trackingTime = 0;
    normalized.cascade.metadata.constructionTime = 0;
  }

  // Normalize entity timestamps
  if (normalized.cascade?.deleted) {
    normalized.cascade.deleted.forEach((deleted: any) => {
      if (deleted.deletedAt) {
        deleted.deletedAt = 'NORMALIZED_DELETED_AT';
      }
    });
  }

  return normalized;
}

describe('Cascade Response Snapshots', () => {
  describe('Create Response', () => {
    it('should match create response snapshot', () => {
      const tracker = new CascadeTracker();
      tracker.startTransaction();

      tracker.trackCreate({
        __typename: 'User',
        id: '1',
        name: 'Test User',
        email: 'test@example.com'
      });

      const builder = new CascadeBuilder(tracker);
      const response = builder.buildResponse({ id: '1', name: 'Test User' }, true);

      expect(normalizeResponse(response)).toMatchSnapshot();
    });

    it('should match multiple creates response snapshot', () => {
      const tracker = new CascadeTracker();
      tracker.startTransaction();

      tracker.trackCreate({ __typename: 'User', id: '1', name: 'User 1' });
      tracker.trackCreate({ __typename: 'Post', id: '101', title: 'Post 1', authorId: '1' });
      tracker.trackCreate({ __typename: 'Comment', id: '1001', text: 'Comment', postId: '101' });

      const builder = new CascadeBuilder(tracker);
      const response = builder.buildResponse(null, true);

      expect(normalizeResponse(response)).toMatchSnapshot();
    });
  });

  describe('Update Response', () => {
    it('should match update response snapshot', () => {
      const tracker = new CascadeTracker();
      tracker.startTransaction();

      tracker.trackUpdate({
        __typename: 'User',
        id: '1',
        name: 'Updated Name',
        email: 'updated@example.com'
      });

      const builder = new CascadeBuilder(tracker);
      const response = builder.buildResponse({ id: '1', name: 'Updated Name' }, true);

      expect(normalizeResponse(response)).toMatchSnapshot();
    });
  });

  describe('Delete Response', () => {
    it('should match delete response snapshot', () => {
      const tracker = new CascadeTracker();
      tracker.startTransaction();

      tracker.trackDelete('User', '1');

      const builder = new CascadeBuilder(tracker);
      const response = builder.buildResponse({ deleted: true }, true);

      expect(normalizeResponse(response)).toMatchSnapshot();
    });

    it('should match multiple deletes response snapshot', () => {
      const tracker = new CascadeTracker();
      tracker.startTransaction();

      tracker.trackDelete('Post', '101');
      tracker.trackDelete('Post', '102');
      tracker.trackDelete('Comment', '1001');

      const builder = new CascadeBuilder(tracker);
      const response = builder.buildResponse({ deletedCount: 3 }, true);

      expect(normalizeResponse(response)).toMatchSnapshot();
    });
  });

  describe('Mixed Operations Response', () => {
    it('should match mixed operations response snapshot', () => {
      const tracker = new CascadeTracker();
      tracker.startTransaction();

      // Create a user
      tracker.trackCreate({ __typename: 'User', id: '2', name: 'New User' });

      // Update existing user
      tracker.trackUpdate({ __typename: 'User', id: '1', name: 'Updated User' });

      // Delete a post
      tracker.trackDelete('Post', '100');

      const builder = new CascadeBuilder(tracker);
      const response = builder.buildResponse(null, true);

      expect(normalizeResponse(response)).toMatchSnapshot();
    });
  });

  describe('Error Response', () => {
    it('should match error response snapshot', () => {
      const tracker = new CascadeTracker();
      tracker.startTransaction();

      const builder = new CascadeBuilder(tracker);
      const response = builder.buildErrorResponse([
        {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          field: 'email'
        }
      ], null);

      expect(normalizeResponse(response)).toMatchSnapshot();
    });

    it('should match multiple errors response snapshot', () => {
      const tracker = new CascadeTracker();
      tracker.startTransaction();

      const builder = new CascadeBuilder(tracker);
      const response = builder.buildErrorResponse([
        { message: 'Email is required', code: 'VALIDATION_ERROR', field: 'email' },
        { message: 'Name is too short', code: 'VALIDATION_ERROR', field: 'name' }
      ], null);

      expect(normalizeResponse(response)).toMatchSnapshot();
    });
  });

  describe('Streaming Response', () => {
    it('should match streaming response snapshot', () => {
      const tracker = new CascadeTracker();
      tracker.startTransaction();

      tracker.trackCreate({ __typename: 'User', id: '1', name: 'User 1' });
      tracker.trackCreate({ __typename: 'Post', id: '101', title: 'Post 1' });

      const builder = new StreamingCascadeBuilder(tracker);
      const response = builder.buildStreamingResponse({ id: '1' }, true);

      expect(normalizeResponse(response)).toMatchSnapshot();
    });
  });

  describe('Empty Response', () => {
    it('should match empty cascade response snapshot', () => {
      const tracker = new CascadeTracker();
      tracker.startTransaction();
      // No operations

      const builder = new CascadeBuilder(tracker);
      const response = builder.buildResponse(null, true);

      expect(normalizeResponse(response)).toMatchSnapshot();
    });
  });

  describe('Truncated Response', () => {
    it('should match truncated response snapshot', () => {
      const tracker = new CascadeTracker({
        maxEntities: 3,
        enableRelationshipTracking: false
      });
      tracker.startTransaction();

      // Track more entities than limit
      for (let i = 0; i < 10; i++) {
        tracker.trackCreate({ __typename: 'User', id: String(i), name: `User ${i}` });
      }

      const builder = new CascadeBuilder(tracker);
      const response = builder.buildResponse(null, true);

      expect(normalizeResponse(response)).toMatchSnapshot();
    });
  });
});
