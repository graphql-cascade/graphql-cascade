import * as fc from 'fast-check';
import { CascadeClient } from './client';
import {
  CascadeCache,
  CascadeResponse,
  CascadeOperation,
  InvalidationStrategy,
  InvalidationScope,
  QueryInvalidation,
  UpdatedEntity,
  DeletedEntity,
  CascadeUpdates,
  CascadeMetadata,
  CascadeErrorCode
} from './types';

/**
 * Property-based tests for GraphQL Cascade client core functionality.
 *
 * These tests use fast-check to verify invariants and edge cases that
 * traditional example-based tests might miss.
 */

/**
 * Mock cache implementation that tracks all operations for property testing.
 * Extends the existing MockCache with additional state tracking needed for properties.
 */
class PropertyTestCache implements CascadeCache {
  private data = new Map<string, any>();
  public operations: Array<{
    type: 'write' | 'evict' | 'invalidate' | 'refetch' | 'remove';
    key?: string;
    data?: any;
    invalidation?: QueryInvalidation;
  }> = [];

  write(typename: string, id: string, data: any): void {
    const key = `${typename}:${id}`;
    this.data.set(key, data);
    this.operations.push({ type: 'write', key, data });
  }

  read(typename: string, id: string): any | null {
    const key = `${typename}:${id}`;
    return this.data.get(key) || null;
  }

  evict(typename: string, id: string): void {
    const key = `${typename}:${id}`;
    this.data.delete(key);
    this.operations.push({ type: 'evict', key });
  }

  invalidate(invalidation: QueryInvalidation): void {
    this.operations.push({ type: 'invalidate', invalidation });
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    this.operations.push({ type: 'refetch', invalidation });
  }

  remove(invalidation: QueryInvalidation): void {
    this.operations.push({ type: 'remove', invalidation });
  }

  identify(entity: any): string {
    return `${entity.__typename}:${entity.id}`;
  }

  /**
   * Get a snapshot of the current cache state for comparison.
   */
  getStateSnapshot(): Map<string, any> {
    return new Map(this.data);
  }

  /**
   * Reset the cache to a clean state.
   */
  reset(): void {
    this.data.clear();
    this.operations = [];
  }

  /**
   * Check if two cache states are equivalent.
   */
  statesEqual(other: PropertyTestCache): boolean {
    if (this.data.size !== other.data.size) return false;
    for (const [key, value] of this.data) {
      const otherValue = other.data.get(key);
      if (!this.deepEqual(value, otherValue)) return false;
    }
    return true;
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
}

/**
 * Mock executor for property testing.
 */
const mockExecutor = async () => ({ data: {} });

/**
 * Fast-check arbitraries for generating test data.
 */

// Generate entity type names
const entityTypeArb = fc.constantFrom('User', 'Post', 'Comment', 'Todo', 'Project');

// Generate entity IDs
const entityIdArb = fc.string({ minLength: 1, maxLength: 10 });

// Generate entity data based on type
const entityDataArb = fc.oneof(
  // User entity
  fc.record({
    __typename: fc.constant('User'),
    id: entityIdArb,
    name: fc.string({ minLength: 1, maxLength: 50 }),
    email: fc.string({ minLength: 5, maxLength: 50 }).map(s => `${s}@example.com`),
    age: fc.integer({ min: 1, max: 120 })
  }),
  // Post entity
  fc.record({
    __typename: fc.constant('Post'),
    id: entityIdArb,
    title: fc.string({ minLength: 1, maxLength: 100 }),
    content: fc.string({ minLength: 0, maxLength: 1000 }),
    authorId: entityIdArb,
    published: fc.boolean()
  }),
  // Comment entity
  fc.record({
    __typename: fc.constant('Comment'),
    id: entityIdArb,
    text: fc.string({ minLength: 1, maxLength: 500 }),
    postId: entityIdArb,
    authorId: entityIdArb
  }),
  // Todo entity
  fc.record({
    __typename: fc.constant('Todo'),
    id: entityIdArb,
    title: fc.string({ minLength: 1, maxLength: 100 }),
    completed: fc.boolean(),
    priority: fc.integer({ min: 1, max: 5 })
  }),
  // Project entity
  fc.record({
    __typename: fc.constant('Project'),
    id: entityIdArb,
    name: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.string({ minLength: 0, maxLength: 200 }),
    ownerId: entityIdArb
  })
);

// Generate updated entities
const updatedEntityArb: fc.Arbitrary<UpdatedEntity> = fc.record({
  __typename: entityTypeArb,
  id: entityIdArb,
  operation: fc.constantFrom(CascadeOperation.CREATED, CascadeOperation.UPDATED),
  entity: fc.oneof(
    fc.record({ name: fc.string({ minLength: 1, maxLength: 50 }) }),
    fc.record({ title: fc.string({ minLength: 1, maxLength: 100 }) }),
    fc.record({ text: fc.string({ minLength: 1, maxLength: 500 }) }),
    fc.record({ completed: fc.boolean() }),
    fc.record({ description: fc.string({ minLength: 0, maxLength: 200 }) })
  )
});

// Generate deleted entities
const deletedEntityArb: fc.Arbitrary<DeletedEntity> = fc.record({
  __typename: entityTypeArb,
  id: entityIdArb,
  deletedAt: fc.date().map(d => d.toISOString())
});

// Generate query invalidations
const queryInvalidationArb: fc.Arbitrary<QueryInvalidation> = fc.record({
  queryName: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
  queryHash: fc.option(fc.string({ minLength: 1, maxLength: 32 })),
  arguments: fc.option(fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.boolean()))),
  queryPattern: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
  strategy: fc.constantFrom(InvalidationStrategy.INVALIDATE, InvalidationStrategy.REFETCH, InvalidationStrategy.REMOVE),
  scope: fc.constantFrom(InvalidationScope.EXACT, InvalidationScope.PREFIX, InvalidationScope.PATTERN, InvalidationScope.ALL)
});

// Generate cascade metadata
const cascadeMetadataArb: fc.Arbitrary<CascadeMetadata> = fc.record({
  timestamp: fc.date().map(d => d.toISOString()),
  transactionId: fc.option(fc.uuid()),
  depth: fc.integer({ min: 0, max: 10 }),
  affectedCount: fc.integer({ min: 0, max: 100 })
});

// Helper function to deduplicate entities by typename+id (keeps first occurrence)
function deduplicateEntities(entities: UpdatedEntity[]): UpdatedEntity[] {
  const seen = new Set<string>();
  return entities.filter(e => {
    const key = `${e.__typename}:${e.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Helper function to deduplicate deleted entities by typename+id
function deduplicateDeletedEntities(entities: DeletedEntity[]): DeletedEntity[] {
  const seen = new Set<string>();
  return entities.filter(e => {
    const key = `${e.__typename}:${e.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Generate cascade updates
const cascadeUpdatesArb: fc.Arbitrary<CascadeUpdates> = fc.record({
  updated: fc.array(updatedEntityArb, { minLength: 0, maxLength: 20 }),
  deleted: fc.array(deletedEntityArb, { minLength: 0, maxLength: 10 }),
  invalidations: fc.array(queryInvalidationArb, { minLength: 0, maxLength: 5 }),
  metadata: cascadeMetadataArb
});

// Generate cascade responses
const cascadeResponseArb: fc.Arbitrary<CascadeResponse> = fc.record({
  success: fc.boolean(),
  errors: fc.option(fc.array(fc.record({
    message: fc.string({ minLength: 1, maxLength: 100 }),
    code: fc.constantFrom(
      CascadeErrorCode.VALIDATION_ERROR,
      CascadeErrorCode.NOT_FOUND,
      CascadeErrorCode.UNAUTHORIZED,
      CascadeErrorCode.FORBIDDEN,
      CascadeErrorCode.CONFLICT,
      CascadeErrorCode.INTERNAL_ERROR,
      CascadeErrorCode.TRANSACTION_FAILED
    ),
    field: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
    path: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 5 })),
    extensions: fc.option(fc.object())
  }), { minLength: 0, maxLength: 3 })),
  data: fc.oneof(fc.constant(null), entityDataArb),
  cascade: cascadeUpdatesArb
});

describe('Property-based tests for CascadeClient', () => {
  describe('Idempotency: Cascade updates applied twice produce same result', () => {
    it('should be idempotent - applying cascade twice gives same cache state', () => {
      fc.assert(
        fc.property(cascadeResponseArb, (response) => {
          const cache1 = new PropertyTestCache();
          const cache2 = new PropertyTestCache();
          const client1 = new CascadeClient(cache1, mockExecutor);
          const client2 = new CascadeClient(cache2, mockExecutor);

          // Apply cascade once to cache1
          client1.applyCascade(response);

          // Apply cascade twice to cache2
          client2.applyCascade(response);
          client2.applyCascade(response);

          // Both caches should have the same final state
          return cache1.statesEqual(cache2);
        }),
        { numRuns: 1000, verbose: true }
      );
    });
  });

  describe('Order Independence: Entity order does not affect final state', () => {
    it('should produce same result regardless of entity update order (unique entities)', () => {
      fc.assert(
        fc.property(
          fc.array(updatedEntityArb, { minLength: 1, maxLength: 20 }),
          fc.array(deletedEntityArb, { minLength: 0, maxLength: 10 }),
          fc.array(queryInvalidationArb, { minLength: 0, maxLength: 5 }),
          cascadeMetadataArb,
          (updatedEntities, deletedEntities, invalidations, metadata) => {
            // Deduplicate entities by typename+id to test order independence
            // (When there are duplicates, last-write-wins means order matters)
            const uniqueUpdated = deduplicateEntities(updatedEntities);
            const uniqueDeleted = deduplicateDeletedEntities(deletedEntities);

            const cache1 = new PropertyTestCache();
            const cache2 = new PropertyTestCache();
            const client1 = new CascadeClient(cache1, mockExecutor);
            const client2 = new CascadeClient(cache2, mockExecutor);

            // Create responses with different entity orders
            const response1: CascadeResponse = {
              success: true,
              data: null,
              cascade: { updated: uniqueUpdated, deleted: uniqueDeleted, invalidations, metadata }
            };

            const response2: CascadeResponse = {
              success: true,
              data: null,
              cascade: {
                updated: [...uniqueUpdated].reverse(), // Reverse order
                deleted: [...uniqueDeleted].reverse(),
                invalidations: [...invalidations].reverse(),
                metadata
              }
            };

            // Apply cascades
            client1.applyCascade(response1);
            client2.applyCascade(response2);

            // Final states should be identical for unique entities
            return cache1.statesEqual(cache2);
          }
        ),
        { numRuns: 1000, verbose: true }
      );
    });
  });

  describe('Deduplication: Duplicate entities are handled correctly', () => {
    it('should handle duplicate entity updates correctly (last write wins)', () => {
      fc.assert(
        fc.property(
          fc.array(updatedEntityArb, { minLength: 1, maxLength: 10 }),
          (entities) => {
            const cache = new PropertyTestCache();
            const client = new CascadeClient(cache, mockExecutor);

            // Create duplicates by appending the same entities again with different data
            const duplicates = entities.map(entity => ({
              ...entity,
              entity: { ...entity.entity, _duplicate: true } // Mark as duplicate with different data
            }));

            const response: CascadeResponse = {
              success: true,
              data: null,
              cascade: {
                updated: [...entities, ...duplicates], // Original + duplicates
                deleted: [],
                invalidations: [],
                metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: entities.length * 2 }
              }
            };

            client.applyCascade(response);

            // Each entity should only appear once in the final cache state
            const uniqueKeys = new Set(entities.map(e => `${e.__typename}:${e.id}`));
            const finalKeys = Array.from(cache.getStateSnapshot().keys());

            // All original entities should be present
            for (const key of uniqueKeys) {
              if (!finalKeys.includes(key)) return false;
            }

            // No extra keys should be present
            return finalKeys.length === uniqueKeys.size;
          }
        ),
        { numRuns: 500, verbose: true }
      );
    });

    it('should handle duplicate deletions correctly', () => {
      fc.assert(
        fc.property(
          fc.array(deletedEntityArb, { minLength: 1, maxLength: 10 }),
          (deletions) => {
            const cache = new PropertyTestCache();
            const client = new CascadeClient(cache, mockExecutor);

            // First write some entities
            const entitiesToDelete = deletions.map(d => ({
              __typename: d.__typename,
              id: d.id,
              operation: CascadeOperation.CREATED as const,
              entity: { id: d.id, name: 'test' }
            }));

            const writeResponse: CascadeResponse = {
              success: true,
              data: null,
              cascade: {
                updated: entitiesToDelete,
                deleted: [],
                invalidations: [],
                metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: entitiesToDelete.length }
              }
            };

            client.applyCascade(writeResponse);

            // Now delete with duplicates
            const deleteResponse: CascadeResponse = {
              success: true,
              data: null,
              cascade: {
                updated: [],
                deleted: [...deletions, ...deletions], // Duplicate deletions
                invalidations: [],
                metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: deletions.length * 2 }
              }
            };

            client.applyCascade(deleteResponse);

            // All entities should be deleted (even with duplicate delete operations)
            const remainingKeys = Array.from(cache.getStateSnapshot().keys());
            const expectedDeletedKeys = new Set(deletions.map(d => `${d.__typename}:${d.id}`));

            // None of the deleted entities should remain
            for (const key of expectedDeletedKeys) {
              if (remainingKeys.includes(key)) return false;
            }

            return true;
          }
        ),
        { numRuns: 500, verbose: true }
      );
    });
  });

  describe('Edge Cases and Invariants', () => {
    it('should handle empty cascade responses', () => {
      fc.assert(
        fc.property(cascadeMetadataArb, (metadata) => {
          const cache = new PropertyTestCache();
          const client = new CascadeClient(cache, mockExecutor);

          const response: CascadeResponse = {
            success: true,
            data: null,
            cascade: {
              updated: [],
              deleted: [],
              invalidations: [],
              metadata
            }
          };

          client.applyCascade(response);

          // Cache should remain empty
          return cache.getStateSnapshot().size === 0;
        }),
        { numRuns: 100, verbose: true }
      );
    });

    it('should handle responses with only invalidations', () => {
      fc.assert(
        fc.property(
          fc.array(queryInvalidationArb, { minLength: 1, maxLength: 5 }),
          cascadeMetadataArb,
          (invalidations, metadata) => {
            const cache = new PropertyTestCache();
            const client = new CascadeClient(cache, mockExecutor);

            const response: CascadeResponse = {
              success: true,
              data: null,
              cascade: {
                updated: [],
                deleted: [],
                invalidations,
                metadata
              }
            };

            client.applyCascade(response);

            // Cache data should remain empty, but operations should be recorded
            return cache.getStateSnapshot().size === 0 && cache.operations.length === invalidations.length;
          }
        ),
        { numRuns: 200, verbose: true }
      );
    });

    it('should handle mixed operations correctly', () => {
      fc.assert(
        fc.property(
          fc.array(updatedEntityArb, { minLength: 0, maxLength: 5 }),
          fc.array(deletedEntityArb, { minLength: 0, maxLength: 3 }),
          fc.array(queryInvalidationArb, { minLength: 0, maxLength: 2 }),
          cascadeMetadataArb,
          (updates, deletions, invalidations, metadata) => {
            const cache = new PropertyTestCache();
            const client = new CascadeClient(cache, mockExecutor);

            const response: CascadeResponse = {
              success: true,
              data: null,
              cascade: { updated: updates, deleted: deletions, invalidations, metadata }
            };

            client.applyCascade(response);

            // Operations count should match total operations performed
            const expectedOperations = updates.length + deletions.length + invalidations.length;
            return cache.operations.length === expectedOperations;
          }
        ),
        { numRuns: 300, verbose: true }
      );
    });
  });
});