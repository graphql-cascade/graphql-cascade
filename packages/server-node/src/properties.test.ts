import * as fc from 'fast-check';
import { CascadeTracker } from './tracker';
import { CascadeBuilder } from './builder';

/**
 * Property-based tests for GraphQL Cascade server functionality.
 *
 * These tests use fast-check to verify invariants that traditional
 * example-based tests might miss.
 */

// Entity arbitrary - generates test entities with required fields
const entityArb = fc.record({
  __typename: fc.constantFrom('User', 'Post', 'Comment', 'Todo', 'Project'),
  id: fc.string({ minLength: 1, maxLength: 10 }),
  name: fc.string({ minLength: 1, maxLength: 50 })
});

// Entity with more fields for serialization testing
const richEntityArb = fc.record({
  __typename: fc.constant('User'),
  id: fc.string({ minLength: 1, maxLength: 10 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  age: fc.integer({ min: 1, max: 100 }),
  active: fc.boolean(),
  score: fc.double({ min: 0, max: 100, noNaN: true })
});

describe('Property-based tests for server', () => {
  describe('Tracker idempotency', () => {
    it('tracking same entity twice produces same result', () => {
      fc.assert(
        fc.property(entityArb, (entity) => {
          const tracker = new CascadeTracker();
          tracker.startTransaction();

          tracker.trackCreate(entity);
          const firstData = tracker.getCascadeData();

          // Track same entity again - should be deduplicated
          tracker.trackCreate(entity);
          const secondData = tracker.getCascadeData();

          // Should have same number of updated entities (deduplicated by key)
          return firstData.updated.length === secondData.updated.length;
        }),
        { numRuns: 100 }
      );
    });

    it('trackUpdate on same entity multiple times keeps entity count stable', () => {
      fc.assert(
        fc.property(entityArb, (entity) => {
          const tracker = new CascadeTracker();
          tracker.startTransaction();

          tracker.trackUpdate(entity);
          const count1 = tracker.getCascadeData().updated.length;

          tracker.trackUpdate(entity);
          const count2 = tracker.getCascadeData().updated.length;

          tracker.trackUpdate(entity);
          const count3 = tracker.getCascadeData().updated.length;

          // All counts should be equal (deduplicated)
          return count1 === count2 && count2 === count3;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Builder response consistency', () => {
    it('same input produces same output structure', () => {
      fc.assert(
        fc.property(entityArb, (entity) => {
          const tracker1 = new CascadeTracker();
          tracker1.startTransaction();
          tracker1.trackCreate(entity);
          const builder1 = new CascadeBuilder(tracker1);
          const response1 = builder1.buildResponse();

          const tracker2 = new CascadeTracker();
          tracker2.startTransaction();
          tracker2.trackCreate(entity);
          const builder2 = new CascadeBuilder(tracker2);
          const response2 = builder2.buildResponse();

          return (
            response1.success === response2.success &&
            response1.cascade.updated.length === response2.cascade.updated.length
          );
        }),
        { numRuns: 100 }
      );
    });

    it('builder response always has required cascade structure', () => {
      fc.assert(
        fc.property(entityArb, (entity) => {
          const tracker = new CascadeTracker();
          tracker.startTransaction();
          tracker.trackCreate(entity);
          const builder = new CascadeBuilder(tracker);
          const response = builder.buildResponse();

          // Response must have required structure
          return (
            typeof response.success === 'boolean' &&
            Array.isArray(response.cascade.updated) &&
            Array.isArray(response.cascade.deleted) &&
            typeof response.cascade.metadata === 'object' &&
            typeof response.cascade.metadata.timestamp === 'string'
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Order independence', () => {
    it('entity tracking order does not affect final count', () => {
      fc.assert(
        fc.property(
          fc.array(entityArb, { minLength: 1, maxLength: 10 }),
          (entities) => {
            // Deduplicate by typename+id
            const uniqueEntities = Array.from(
              new Map(entities.map(e => [`${e.__typename}:${e.id}`, e])).values()
            );

            const tracker1 = new CascadeTracker();
            tracker1.startTransaction();
            for (const entity of uniqueEntities) {
              tracker1.trackCreate(entity);
            }
            const data1 = tracker1.getCascadeData();

            const tracker2 = new CascadeTracker();
            tracker2.startTransaction();
            for (const entity of [...uniqueEntities].reverse()) {
              tracker2.trackCreate(entity);
            }
            const data2 = tracker2.getCascadeData();

            return data1.updated.length === data2.updated.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('mixed create/update order does not affect entity count', () => {
      fc.assert(
        fc.property(
          fc.array(entityArb, { minLength: 2, maxLength: 5 }),
          (entities) => {
            // Deduplicate entities
            const uniqueEntities = Array.from(
              new Map(entities.map(e => [`${e.__typename}:${e.id}`, e])).values()
            );

            // Tracker 1: all creates then all updates
            const tracker1 = new CascadeTracker();
            tracker1.startTransaction();
            for (const entity of uniqueEntities) {
              tracker1.trackCreate(entity);
            }
            for (const entity of uniqueEntities) {
              tracker1.trackUpdate(entity);
            }
            const count1 = tracker1.getCascadeData().updated.length;

            // Tracker 2: interleaved creates and updates
            const tracker2 = new CascadeTracker();
            tracker2.startTransaction();
            for (const entity of uniqueEntities) {
              tracker2.trackCreate(entity);
              tracker2.trackUpdate(entity);
            }
            const count2 = tracker2.getCascadeData().updated.length;

            return count1 === count2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Serialization round-trip', () => {
    it('entity data survives serialization', () => {
      fc.assert(
        fc.property(richEntityArb, (entity) => {
          const tracker = new CascadeTracker();
          tracker.startTransaction();
          tracker.trackCreate(entity);
          const data = tracker.getCascadeData();

          // Serialize and deserialize
          const serialized = JSON.stringify(data);
          const deserialized = JSON.parse(serialized);

          // Structure should be preserved
          return (
            deserialized.updated.length === data.updated.length &&
            deserialized.updated[0].__typename === entity.__typename &&
            deserialized.updated[0].id === entity.id
          );
        }),
        { numRuns: 100 }
      );
    });

    it('cascade response survives full serialization round-trip', () => {
      fc.assert(
        fc.property(richEntityArb, (entity) => {
          const tracker = new CascadeTracker();
          tracker.startTransaction();
          tracker.trackCreate(entity);
          const builder = new CascadeBuilder(tracker);
          const response = builder.buildResponse();

          // Serialize and deserialize
          const serialized = JSON.stringify(response);
          const deserialized = JSON.parse(serialized);

          // All key properties should survive
          return (
            deserialized.success === response.success &&
            deserialized.cascade.updated.length === response.cascade.updated.length &&
            deserialized.cascade.deleted.length === response.cascade.deleted.length &&
            typeof deserialized.cascade.metadata.timestamp === 'string'
          );
        }),
        { numRuns: 100 }
      );
    });

    it('entity field values are preserved through serialization', () => {
      fc.assert(
        fc.property(richEntityArb, (entity) => {
          const tracker = new CascadeTracker();
          tracker.startTransaction();
          tracker.trackCreate(entity);
          const data = tracker.getCascadeData();

          // Serialize and deserialize
          const serialized = JSON.stringify(data);
          const deserialized = JSON.parse(serialized);

          const originalEntity = data.updated[0].entity;
          const deserializedEntity = deserialized.updated[0].entity;

          // Key field values should match
          return (
            originalEntity.name === deserializedEntity.name &&
            originalEntity.age === deserializedEntity.age &&
            originalEntity.active === deserializedEntity.active
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Deletion tracking', () => {
    it('trackDelete adds entity to deleted list', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('User', 'Post', 'Comment'),
          fc.string({ minLength: 1, maxLength: 10 }).filter(s => !s.includes(':')), // Avoid : in id
          (typename, id) => {
            const tracker = new CascadeTracker();
            tracker.startTransaction();

            // Delete the entity
            tracker.trackDelete(typename, id);
            const data = tracker.getCascadeData();

            // Should be in deleted list
            const entityInDeleted = data.deleted.some(
              (e: any) => e.__typename === typename && e.id === id
            );

            return entityInDeleted && data.deleted.length === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('trackDelete removes entity from updated list if it was tracked', () => {
      fc.assert(
        fc.property(
          fc.record({
            __typename: fc.constantFrom('User', 'Post', 'Comment'),
            id: fc.string({ minLength: 1, maxLength: 10 }).filter(s => !s.includes(':')),
            name: fc.string({ minLength: 1, maxLength: 50 })
          }),
          (entity) => {
            const tracker = new CascadeTracker();
            tracker.startTransaction();

            // First create the entity
            tracker.trackCreate(entity);

            // Then delete it using same typename and id
            tracker.trackDelete(entity.__typename, entity.id);
            const data = tracker.getCascadeData();

            // After deletion, entity should not be in updated list
            const entityInUpdated = data.updated.some(
              (e: any) => e.__typename === entity.__typename && e.id === entity.id
            );

            // Should be in deleted list
            const entityInDeleted = data.deleted.some(
              (e: any) => e.__typename === entity.__typename && e.id === entity.id
            );

            return !entityInUpdated && entityInDeleted;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Transaction isolation', () => {
    it('concurrent trackers do not interfere with each other', () => {
      fc.assert(
        fc.property(
          fc.array(entityArb, { minLength: 1, maxLength: 5 }),
          fc.array(entityArb, { minLength: 1, maxLength: 5 }),
          (entities1, entities2) => {
            // Deduplicate each set
            const unique1 = Array.from(
              new Map(entities1.map(e => [`${e.__typename}:${e.id}`, e])).values()
            );
            const unique2 = Array.from(
              new Map(entities2.map(e => [`${e.__typename}:${e.id}`, e])).values()
            );

            const tracker1 = new CascadeTracker();
            const tracker2 = new CascadeTracker();

            tracker1.startTransaction();
            tracker2.startTransaction();

            // Track different entities in each
            for (const entity of unique1) {
              tracker1.trackCreate(entity);
            }
            for (const entity of unique2) {
              tracker2.trackCreate(entity);
            }

            const data1 = tracker1.getCascadeData();
            const data2 = tracker2.getCascadeData();

            // Each tracker should only have its own entities
            return (
              data1.updated.length === unique1.length &&
              data2.updated.length === unique2.length
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('ending one transaction does not affect another', () => {
      fc.assert(
        fc.property(entityArb, entityArb, (entity1, entity2) => {
          const tracker1 = new CascadeTracker();
          const tracker2 = new CascadeTracker();

          tracker1.startTransaction();
          tracker2.startTransaction();

          tracker1.trackCreate(entity1);
          tracker2.trackCreate(entity2);

          // End tracker1's transaction
          const result1 = tracker1.endTransaction();

          // tracker2 should still be able to get data
          const data2 = tracker2.getCascadeData();

          return (
            result1.updated.length === 1 &&
            data2.updated.length === 1
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Configuration limits', () => {
    it('tracker respects maxEntities configuration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 20 }),
          fc.array(entityArb, { minLength: 30, maxLength: 50 }),
          (maxEntities, entities) => {
            // Deduplicate and ensure we have enough unique entities
            const uniqueEntities = Array.from(
              new Map(entities.map(e => [`${e.__typename}:${e.id}`, e])).values()
            );

            const tracker = new CascadeTracker({
              maxEntities,
              enableRelationshipTracking: false
            });
            tracker.startTransaction();

            for (const entity of uniqueEntities) {
              tracker.trackCreate(entity);
            }

            const data = tracker.getCascadeData();

            // Should not exceed maxEntities
            return data.updated.length <= maxEntities;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('tracker indicates when limit was reached', () => {
      fc.assert(
        fc.property(
          fc.array(entityArb, { minLength: 20, maxLength: 30 }),
          (entities) => {
            // Deduplicate
            const uniqueEntities = Array.from(
              new Map(entities.map(e => [`${e.__typename}:${e.id}`, e])).values()
            );

            if (uniqueEntities.length <= 10) {
              return true; // Skip if not enough unique entities
            }

            const tracker = new CascadeTracker({
              maxEntities: 10,
              enableRelationshipTracking: false
            });
            tracker.startTransaction();

            for (const entity of uniqueEntities) {
              tracker.trackCreate(entity);
            }

            const data = tracker.getCascadeData();

            // Should indicate truncation occurred
            return data.metadata.truncatedUpdated === true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Builder size limits', () => {
    it('builder respects maxUpdatedEntities configuration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 15 }),
          fc.array(entityArb, { minLength: 30, maxLength: 50 }),
          (maxUpdated, entities) => {
            // Deduplicate
            const uniqueEntities = Array.from(
              new Map(entities.map(e => [`${e.__typename}:${e.id}`, e])).values()
            );

            const tracker = new CascadeTracker({ enableRelationshipTracking: false });
            tracker.startTransaction();

            for (const entity of uniqueEntities) {
              tracker.trackCreate(entity);
            }

            const builder = new CascadeBuilder(tracker, undefined, {
              maxUpdatedEntities: maxUpdated
            });
            const response = builder.buildResponse(null, true);

            // Builder should respect max limit
            return response.cascade.updated.length <= maxUpdated;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('builder marks truncation when limit exceeded', () => {
      fc.assert(
        fc.property(
          fc.array(entityArb, { minLength: 30, maxLength: 50 }),
          (entities) => {
            // Deduplicate
            const uniqueEntities = Array.from(
              new Map(entities.map(e => [`${e.__typename}:${e.id}`, e])).values()
            );

            if (uniqueEntities.length <= 10) {
              return true; // Skip if not enough unique
            }

            const tracker = new CascadeTracker({ enableRelationshipTracking: false });
            tracker.startTransaction();

            for (const entity of uniqueEntities) {
              tracker.trackCreate(entity);
            }

            const builder = new CascadeBuilder(tracker, undefined, {
              maxUpdatedEntities: 10
            });
            const response = builder.buildResponse(null, true);

            // Should indicate truncation
            return response.cascade.metadata.truncatedUpdated === true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('builder respects maxDeletedEntities configuration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          fc.array(
            fc.record({
              typename: fc.constantFrom('User', 'Post', 'Comment'),
              id: fc.string({ minLength: 1, maxLength: 10 }).filter(s => !s.includes(':'))
            }),
            { minLength: 20, maxLength: 30 }
          ),
          (maxDeleted, deletions) => {
            // Deduplicate
            const uniqueDeletions = Array.from(
              new Map(deletions.map(d => [`${d.typename}:${d.id}`, d])).values()
            );

            const tracker = new CascadeTracker();
            tracker.startTransaction();

            for (const { typename, id } of uniqueDeletions) {
              tracker.trackDelete(typename, id);
            }

            const builder = new CascadeBuilder(tracker, undefined, {
              maxDeletedEntities: maxDeleted
            });
            const response = builder.buildResponse(null, true);

            return response.cascade.deleted.length <= maxDeleted;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
