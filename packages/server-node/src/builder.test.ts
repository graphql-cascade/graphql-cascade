import {
  CascadeBuilder,
  StreamingCascadeBuilder,
  buildSuccessResponse,
  buildErrorResponse,
  buildStreamingSuccessResponse,
} from './builder';
import { CascadeTracker } from './tracker';
import { CascadeError } from './types';

// Mock entities for testing
class MockEntity {
  constructor(
    public id: number,
    public name: string,
    public __typename: string = 'MockEntity'
  ) {}

  toDict() {
    return {
      id: this.id,
      name: this.name,
    };
  }
}

// Mock invalidator for testing
class MockInvalidator {
  computeInvalidations(updated: any[], deleted: any[], primaryResult?: any) {
    const invalidations = [
      { __typename: 'CacheInvalidation', field: 'testField', reason: 'entity_updated' }
    ];
    return invalidations;
  }
}

describe('CascadeBuilder', () => {
  let tracker: CascadeTracker;
  let builder: CascadeBuilder;
  let mockInvalidator: MockInvalidator;

  beforeEach(() => {
    tracker = new CascadeTracker();
    mockInvalidator = new MockInvalidator();
    builder = new CascadeBuilder(tracker, mockInvalidator);
  });

  describe('Response Building - Success', () => {
    it('should build successful response with primary result', () => {
      tracker.startTransaction();
      const entity = new MockEntity(1, 'Test Entity');
      tracker.trackUpdate(entity);

      const primaryResult = { success: true, data: 'test' };
      const response = builder.buildResponse(primaryResult, true);

      expect(response.success).toBe(true);
      expect(response.data).toBe(primaryResult);
      expect(response.cascade.updated).toHaveLength(1);
      expect(response.cascade.invalidations).toHaveLength(1);
      expect(response.errors).toEqual([]);
    });

    it('should build successful response without primary result', () => {
      tracker.startTransaction();
      const entity = new MockEntity(1, 'Test Entity');
      tracker.trackUpdate(entity);

      const response = builder.buildResponse();

      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
      expect(response.cascade.updated).toHaveLength(1);
    });

    it('should include construction time in metadata', () => {
      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));

      const response = builder.buildResponse();

      expect(response.cascade.metadata.constructionTime).toBeDefined();
      expect(typeof response.cascade.metadata.constructionTime).toBe('number');
    });

    it('should handle responses without invalidator', () => {
      const builderWithoutInvalidator = new CascadeBuilder(tracker);
      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));

      const response = builderWithoutInvalidator.buildResponse();

      expect(response.cascade.invalidations).toEqual([]);
    });
  });

  describe('Response Building - Error', () => {
    it('should build error response with errors', () => {
      const errors: CascadeError[] = [
        { message: 'Test error', code: 'TEST_ERROR' }
      ];

      const response = builder.buildErrorResponse(errors, { partial: 'data' });

      expect(response.success).toBe(false);
      expect(response.data).toEqual({ partial: 'data' });
      expect(response.errors).toEqual(errors);
      expect(response.cascade.updated).toEqual([]);
      expect(response.cascade.deleted).toEqual([]);
      expect(response.cascade.invalidations).toEqual([]);
    });

    it('should build error response when transaction is active', () => {
      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));

      const errors: CascadeError[] = [
        { message: 'Transaction error', code: 'TX_ERROR' }
      ];

      const response = builder.buildErrorResponse(errors);

      expect(response.success).toBe(false);
      expect(response.cascade.updated).toHaveLength(1); // Should include tracked changes
    });

    it('should handle error response when transaction ending fails', () => {
      // Transaction not started, but builder tries to end it
      const errors: CascadeError[] = [
        { message: 'Error', code: 'ERROR' }
      ];

      const response = builder.buildErrorResponse(errors);

      expect(response.success).toBe(false);
      expect(response.cascade.metadata.timestamp).toBeDefined();
      expect(response.cascade.metadata.depth).toBe(0);
    });
  });

  describe('Size Limits and Truncation', () => {
    it('should truncate updated entities when exceeding maxUpdatedEntities', () => {
      const limitedBuilder = new CascadeBuilder(tracker, mockInvalidator, {
        maxUpdatedEntities: 2
      });

      tracker.startTransaction();
      for (let i = 1; i <= 5; i++) {
        tracker.trackUpdate(new MockEntity(i, `Entity ${i}`));
      }

      const response = limitedBuilder.buildResponse();

      expect(response.cascade.updated).toHaveLength(2);
      expect(response.cascade.metadata.truncatedUpdated).toBe(true);
    });

    it('should truncate deleted entities when exceeding maxDeletedEntities', () => {
      const limitedBuilder = new CascadeBuilder(tracker, mockInvalidator, {
        maxDeletedEntities: 1
      });

      tracker.startTransaction();
      tracker.trackDelete('Type1', 1);
      tracker.trackDelete('Type2', 2);
      tracker.trackDelete('Type3', 3);

      const response = limitedBuilder.buildResponse();

      expect(response.cascade.deleted).toHaveLength(1);
      expect(response.cascade.metadata.truncatedDeleted).toBe(true);
    });

    it('should truncate invalidations when exceeding maxInvalidations', () => {
      const mockInvalidatorWithMany = {
        computeInvalidations: () => Array(10).fill({
          __typename: 'Invalidation',
          reason: 'test'
        })
      };

      const limitedBuilder = new CascadeBuilder(tracker, mockInvalidatorWithMany, {
        maxInvalidations: 3
      });

      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));

      const response = limitedBuilder.buildResponse();

      expect(response.cascade.invalidations).toHaveLength(3);
      // Invalidations are sliced in buildResponse, not truncated in applySizeLimits
      expect(response.cascade.metadata.truncatedInvalidations).toBeUndefined();
    });

    it('should truncate response when exceeding size limit', () => {
      // Create a very large response by setting low size limit
      const sizeLimitedBuilder = new CascadeBuilder(tracker, mockInvalidator, {
        maxResponseSizeMb: 0.001 // Very small limit
      });

      tracker.startTransaction();
      // Add many entities to exceed size (need > 100 total entities for truncation)
      for (let i = 1; i <= 60; i++) {
        tracker.trackUpdate(new MockEntity(i, `Entity ${i}`));
      }
      for (let i = 1; i <= 60; i++) {
        tracker.trackDelete('DeletedType', i);
      }

      const response = sizeLimitedBuilder.buildResponse();

      expect(response.cascade.updated.length).toBeLessThanOrEqual(50);
      expect(response.cascade.deleted.length).toBeLessThanOrEqual(50);
      expect(response.cascade.metadata.truncatedSize).toBe(true);
    });

    it('should apply size limits correctly when both entity and size limits are hit', () => {
      const limitedBuilder = new CascadeBuilder(tracker, mockInvalidator, {
        maxUpdatedEntities: 200, // High limit so size limit is hit first
        maxResponseSizeMb: 0.001
      });

      tracker.startTransaction();
      // Add enough entities to trigger size truncation (> 100 total)
      for (let i = 1; i <= 60; i++) {
        tracker.trackUpdate(new MockEntity(i, `Entity ${i}`));
      }
      for (let i = 1; i <= 60; i++) {
        tracker.trackDelete('DeletedType', i);
      }

      const response = limitedBuilder.buildResponse();

      // Should be truncated to 50 of each due to size limit
      expect(response.cascade.updated.length).toBe(50);
      expect(response.cascade.deleted.length).toBe(50);
      expect(response.cascade.metadata.truncatedSize).toBe(true);
    });
  });

  describe('Configuration Options', () => {
    it('should use default configuration values', () => {
      const defaultBuilder = new CascadeBuilder(tracker);

      expect(defaultBuilder['maxResponseSizeMb']).toBe(5.0);
      expect(defaultBuilder['maxUpdatedEntities']).toBe(500);
      expect(defaultBuilder['maxDeletedEntities']).toBe(100);
      expect(defaultBuilder['maxInvalidations']).toBe(50);
    });

    it('should override default configuration values', () => {
      const customBuilder = new CascadeBuilder(tracker, mockInvalidator, {
        maxResponseSizeMb: 1.0,
        maxUpdatedEntities: 100,
        maxDeletedEntities: 50,
        maxInvalidations: 25
      });

      expect(customBuilder['maxResponseSizeMb']).toBe(1.0);
      expect(customBuilder['maxUpdatedEntities']).toBe(100);
      expect(customBuilder['maxDeletedEntities']).toBe(50);
      expect(customBuilder['maxInvalidations']).toBe(25);
    });
  });

  describe('StreamingCascadeBuilder', () => {
    let streamingBuilder: StreamingCascadeBuilder;

    beforeEach(() => {
      streamingBuilder = new StreamingCascadeBuilder(tracker, mockInvalidator);
    });

    it('should build streaming response with updated entities', () => {
      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Entity 1'));
      tracker.trackUpdate(new MockEntity(2, 'Entity 2'));

      const response = streamingBuilder.buildStreamingResponse();

      expect(response.success).toBe(true);
      expect(response.cascade.updated).toHaveLength(2);
      expect(response.cascade.metadata.streaming).toBe(true);
      expect(response.cascade.metadata.affectedCount).toBe(2);
    });

    it('should build streaming response with deleted entities', () => {
      tracker.startTransaction();
      tracker.trackDelete('Type1', 1);
      tracker.trackDelete('Type2', 2);

      const response = streamingBuilder.buildStreamingResponse();

      expect(response.cascade.deleted).toHaveLength(2);
      expect(response.cascade.metadata.affectedCount).toBe(2);
    });

    it('should truncate streaming response when exceeding limits', () => {
      const limitedStreamingBuilder = new StreamingCascadeBuilder(tracker, mockInvalidator, {
        maxUpdatedEntities: 1
      });

      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Entity 1'));
      tracker.trackUpdate(new MockEntity(2, 'Entity 2'));

      const response = limitedStreamingBuilder.buildStreamingResponse();

      expect(response.cascade.updated).toHaveLength(1);
      expect(response.cascade.metadata.truncatedUpdated).toBe(true);
    });

    it('should handle serialization errors in streaming mode', () => {
      tracker.startTransaction();

      const badEntity = {
        id: 1,
        __typename: 'BadEntity',
        badField: Symbol('bad')
      };

      // Mock console.error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      tracker.trackUpdate(badEntity);

      const response = streamingBuilder.buildStreamingResponse();

      // Should include the entity with symbol converted to string
      expect(response.cascade.updated).toHaveLength(1);
      expect(response.cascade.updated[0].entity.badField).toBe('Symbol(bad)');

      consoleSpy.mockRestore();
    });

    it('should compute invalidations in streaming mode', () => {
      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));

      const response = streamingBuilder.buildStreamingResponse();

      expect(response.cascade.invalidations).toHaveLength(1);
    });
  });

  describe('Convenience Functions', () => {
    it('should build success response using convenience function', () => {
      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));

      const response = buildSuccessResponse(tracker, mockInvalidator, { result: 'data' });

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ result: 'data' });
      expect(response.cascade.updated).toHaveLength(1);
    });

    it('should build error response using convenience function', () => {
      const errors: CascadeError[] = [
        { message: 'Convenience error', code: 'CONVENIENCE_ERROR' }
      ];

      const response = buildErrorResponse(tracker, errors, { partial: 'data' });

      expect(response.success).toBe(false);
      expect(response.errors).toEqual(errors);
    });

    it('should build streaming success response using convenience function', () => {
      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));

      const response = buildStreamingSuccessResponse(tracker, mockInvalidator);

      expect(response.success).toBe(true);
      expect(response.cascade.metadata.streaming).toBe(true);
    });
  });

  describe('Invalidations', () => {
    it('should include invalidations when invalidator is provided and operation succeeds', () => {
      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));

      const response = builder.buildResponse(null, true);

      expect(response.cascade.invalidations).toHaveLength(1);
      expect(response.cascade.invalidations[0].reason).toBe('entity_updated');
    });

    it('should not include invalidations when operation fails', () => {
      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));

      const response = builder.buildResponse(null, false);

      expect(response.cascade.invalidations).toEqual([]);
    });

    it('should handle invalidator returning null or undefined', () => {
      const nullInvalidator = {
        computeInvalidations: () => null
      };

      const builderWithNullInvalidator = new CascadeBuilder(tracker, nullInvalidator);

      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));

      const response = builderWithNullInvalidator.buildResponse();

      expect(response.cascade.invalidations).toEqual([]);
    });

    it('should slice invalidations to maxInvalidations limit', () => {
      const manyInvalidationsInvalidator = {
        computeInvalidations: () => Array(100).fill({
          __typename: 'Invalidation',
          reason: 'many'
        })
      };

      const limitedBuilder = new CascadeBuilder(tracker, manyInvalidationsInvalidator, {
        maxInvalidations: 10
      });

      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));

      const response = limitedBuilder.buildResponse();

      expect(response.cascade.invalidations).toHaveLength(10);
    });
  });

  describe('Metadata Handling', () => {
    it('should include comprehensive metadata in response', () => {
      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));
      tracker.trackDelete('DeletedType', 2);

      const response = builder.buildResponse();

      expect(response.cascade.metadata.transactionId).toBeDefined();
      expect(response.cascade.metadata.timestamp).toBeDefined();
      expect(response.cascade.metadata.depth).toBeDefined();
      expect(response.cascade.metadata.affectedCount).toBe(2);
      expect(response.cascade.metadata.trackingTime).toBeDefined();
      expect(response.cascade.metadata.constructionTime).toBeDefined();
    });

    it('should handle metadata in error responses', () => {
      const response = builder.buildErrorResponse([]);

      expect(response.cascade.metadata.timestamp).toBeDefined();
      expect(response.cascade.metadata.depth).toBe(0);
      expect(response.cascade.metadata.affectedCount).toBe(0);
      expect(response.cascade.metadata.constructionTime).toBe(0);
    });

    it('should include truncation flags in metadata when limits are hit', () => {
      const limitedBuilder = new CascadeBuilder(tracker, mockInvalidator, {
        maxUpdatedEntities: 0
      });

      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));

      const response = limitedBuilder.buildResponse();

      expect(response.cascade.metadata.truncatedUpdated).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalidator errors gracefully', () => {
      const errorInvalidator = {
        computeInvalidations: () => {
          throw new Error('Invalidator error');
        }
      };

      const builderWithErrorInvalidator = new CascadeBuilder(tracker, errorInvalidator);

      tracker.startTransaction();
      tracker.trackUpdate(new MockEntity(1, 'Test'));

      // Should not throw, should handle error gracefully
      expect(() => {
        builderWithErrorInvalidator.buildResponse();
      }).not.toThrow();
    });

    it('should handle tracker errors during response building', () => {
      // Tracker in invalid state
      const response = builder.buildResponse();

      // Should handle gracefully without throwing
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
    });

    it('should handle malformed cascade data', () => {
      // Mock tracker with malformed data
      const mockTracker = {
        getCascadeData: () => ({
          updated: null, // Invalid
          deleted: [],
          invalidations: [],
          metadata: {}
        }),
        endTransaction: () => {}
      } as any;

      const builderWithMockTracker = new CascadeBuilder(mockTracker);

      const response = builderWithMockTracker.buildResponse();

      expect(response).toBeDefined();
      // Should handle null updated array gracefully
    });
  });

  describe('Response Size Estimation', () => {
    it('should estimate response size correctly', () => {
      const size = builder['estimateResponseSize'](
        [{ entity: { field: 'value' } }],
        [{ __typename: 'Type', id: '1', deletedAt: '2023-01-01' }],
        [{ __typename: 'Invalidation', reason: 'test' }]
      );

      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('should handle empty arrays in size estimation', () => {
      const size = builder['estimateResponseSize']([], [], []);

      expect(size).toBeGreaterThan(0); // Metadata size
    });
  });
});