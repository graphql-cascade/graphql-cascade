import { OptimisticCascadeClient, CascadeConflictResolver } from './optimistic';
import {
  CascadeCache,
  CascadeResponse,
  CascadeOperation,
  ConflictDetection,
  QueryInvalidation
} from './types';

/**
 * Mock cache for testing - tracks all operations performed on it
 */
class MockCache implements CascadeCache {
  private store = new Map<string, any>();
  public written: Array<{ typename: string; id: string; data: any }> = [];
  public evicted: Array<{ typename: string; id: string }> = [];
  public invalidated: QueryInvalidation[] = [];
  public refetched: QueryInvalidation[] = [];
  public removed: QueryInvalidation[] = [];

  write(typename: string, id: string, data: any): void {
    const key = `${typename}:${id}`;
    this.store.set(key, data);
    this.written.push({ typename, id, data });
  }

  read(typename: string, id: string): any | null {
    const key = `${typename}:${id}`;
    return this.store.get(key) || null;
  }

  evict(typename: string, id: string): void {
    const key = `${typename}:${id}`;
    this.store.delete(key);
    this.evicted.push({ typename, id });
  }

  invalidate(invalidation: QueryInvalidation): void {
    this.invalidated.push(invalidation);
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    this.refetched.push(invalidation);
  }

  remove(invalidation: QueryInvalidation): void {
    this.removed.push(invalidation);
  }

  identify(entity: any): string {
    return `${entity.__typename}:${entity.id}`;
  }

  reset(): void {
    this.store.clear();
    this.written = [];
    this.evicted = [];
    this.invalidated = [];
    this.refetched = [];
    this.removed = [];
  }
}

describe('OptimisticCascadeClient', () => {
  let cache: MockCache;
  let mockExecutor: jest.Mock;
  let client: OptimisticCascadeClient;

  beforeEach(() => {
    cache = new MockCache();
    mockExecutor = jest.fn();
    client = new OptimisticCascadeClient(cache, mockExecutor);
  });

  describe('mutateOptimistic', () => {
    it('should apply optimistic update immediately', async () => {
      const optimisticResponse: CascadeResponse = {
        success: true,
        data: { __typename: 'User', id: '1', name: 'Optimistic John' },
        cascade: {
          updated: [
            { __typename: 'User', id: '1', operation: CascadeOperation.UPDATED, entity: { name: 'Optimistic John' } }
          ],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01T00:00:00Z', depth: 1, affectedCount: 1 }
        }
      };

      const serverResponse: CascadeResponse = {
        success: true,
        data: { __typename: 'User', id: '1', name: 'Server John' },
        cascade: {
          updated: [
            { __typename: 'User', id: '1', operation: CascadeOperation.UPDATED, entity: { name: 'Server John' } }
          ],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01T00:00:00Z', depth: 1, affectedCount: 1 }
        }
      };

      mockExecutor.mockResolvedValue({
        data: { updateUser: serverResponse }
      });

      const result = await client.mutateOptimistic({} as any, {}, optimisticResponse);

      // Verify optimistic was applied first, then server response
      expect(cache.written.length).toBeGreaterThanOrEqual(2);

      // First write should be optimistic data
      expect(cache.written[0].typename).toBe('User');
      expect(cache.written[0].id).toBe('1');
      expect(cache.written[0].data.name).toBe('Optimistic John');

      // Result should be server data
      expect(result.name).toBe('Server John');
    });

    it('should confirm on successful mutation', async () => {
      const optimisticResponse: CascadeResponse = {
        success: true,
        data: { __typename: 'User', id: '1', name: 'John' },
        cascade: {
          updated: [],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01T00:00:00Z', depth: 1, affectedCount: 1 }
        }
      };

      mockExecutor.mockResolvedValue({
        data: { updateUser: optimisticResponse }
      });

      await client.mutateOptimistic({} as any, {}, optimisticResponse);

      // Optimistic updates should be cleared after successful mutation
      expect((client as any).optimisticUpdates.size).toBe(0);
    });

    it('should rollback on mutation error', async () => {
      // Pre-populate cache with existing data
      cache.write('User', '1', { __typename: 'User', id: '1', name: 'Original' });
      cache.reset(); // Clear tracking but keep data in store
      cache.write('User', '1', { __typename: 'User', id: '1', name: 'Original' }); // Re-add to store

      const optimisticResponse: CascadeResponse = {
        success: true,
        data: { __typename: 'User', id: '1', name: 'Optimistic' },
        cascade: {
          updated: [
            { __typename: 'User', id: '1', operation: CascadeOperation.UPDATED, entity: { name: 'Optimistic' } }
          ],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01T00:00:00Z', depth: 1, affectedCount: 1 }
        }
      };

      mockExecutor.mockRejectedValue(new Error('Mutation failed'));

      await expect(client.mutateOptimistic({} as any, {}, optimisticResponse)).rejects.toThrow('Mutation failed');

      // Optimistic updates should be cleared after rollback
      expect((client as any).optimisticUpdates.size).toBe(0);

      // Last write should restore original state
      const lastWrite = cache.written[cache.written.length - 1];
      expect(lastWrite.typename).toBe('User');
      expect(lastWrite.id).toBe('1');
      expect(lastWrite.data.name).toBe('Original');
    });
  });

  describe('rollback', () => {
    it('should restore previous entity state', () => {
      cache.write('User', '1', { __typename: 'User', id: '1', name: 'Original' });

      const optimisticResponse: CascadeResponse = {
        success: true,
        data: { __typename: 'User', id: '1', name: 'Optimistic' },
        cascade: {
          updated: [
            { __typename: 'User', id: '1', operation: CascadeOperation.UPDATED, entity: { name: 'Optimistic' } }
          ],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01T00:00:00Z', depth: 1, affectedCount: 1 }
        }
      };

      (client as any).applyOptimistic('test-id', optimisticResponse);
      (client as any).rollbackOptimistic('test-id');

      // Last write should be the rollback restoring original
      const lastWrite = cache.written[cache.written.length - 1];
      expect(lastWrite.typename).toBe('User');
      expect(lastWrite.id).toBe('1');
      expect(lastWrite.data.name).toBe('Original');
    });

    it('should evict newly created entities on rollback', () => {
      // Entity doesn't exist initially
      const optimisticResponse: CascadeResponse = {
        success: true,
        data: { __typename: 'User', id: 'new-1', name: 'New User' },
        cascade: {
          updated: [
            { __typename: 'User', id: 'new-1', operation: CascadeOperation.CREATED, entity: { name: 'New User' } }
          ],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01T00:00:00Z', depth: 1, affectedCount: 1 }
        }
      };

      (client as any).applyOptimistic('test-id', optimisticResponse);
      (client as any).rollbackOptimistic('test-id');

      // Should evict the newly created entity since it didn't exist before
      expect(cache.evicted).toContainEqual({ typename: 'User', id: 'new-1' });
    });

    it('should handle entities that did not exist before', () => {
      const optimisticResponse: CascadeResponse = {
        success: true,
        data: { __typename: 'Post', id: '999', title: 'New Post' },
        cascade: {
          updated: [
            { __typename: 'Post', id: '999', operation: CascadeOperation.CREATED, entity: { title: 'New Post' } }
          ],
          deleted: [],
          invalidations: [],
          metadata: { timestamp: '2024-01-01T00:00:00Z', depth: 1, affectedCount: 1 }
        }
      };

      (client as any).applyOptimistic('test-id', optimisticResponse);

      // Verify entity was written
      expect(cache.written.some(w => w.typename === 'Post' && w.id === '999')).toBe(true);

      (client as any).rollbackOptimistic('test-id');

      // Should evict since it was null before
      expect(cache.evicted.some(e => e.typename === 'Post' && e.id === '999')).toBe(true);
    });

    it('should do nothing when rollback ID does not exist', () => {
      const initialWriteCount = cache.written.length;
      const initialEvictCount = cache.evicted.length;

      (client as any).rollbackOptimistic('non-existent-id');

      expect(cache.written.length).toBe(initialWriteCount);
      expect(cache.evicted.length).toBe(initialEvictCount);
    });
  });

  describe('generateMutationId', () => {
    it('should generate unique IDs', () => {
      const id1 = (client as any).generateMutationId();
      const id2 = (client as any).generateMutationId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^optimistic_\d+_/);
    });
  });
});

describe('CascadeConflictResolver', () => {
  let resolver: CascadeConflictResolver;

  beforeEach(() => {
    resolver = new CascadeConflictResolver();
  });

  describe('detectConflicts', () => {
    it('should detect version mismatch', () => {
      const localEntity = { __typename: 'User', id: '1', name: 'John', version: 1 };
      const serverEntity = { __typename: 'User', id: '1', name: 'John', version: 2 };

      const result = resolver.detectConflicts(localEntity, serverEntity);

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe('VERSION_MISMATCH');
      expect(result.localEntity).toBe(localEntity);
      expect(result.serverEntity).toBe(serverEntity);
    });

    it('should detect timestamp mismatch when local is newer', () => {
      const localEntity = {
        __typename: 'User',
        id: '1',
        name: 'John',
        updatedAt: '2024-01-02T00:00:00Z'
      };
      const serverEntity = {
        __typename: 'User',
        id: '1',
        name: 'John',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const result = resolver.detectConflicts(localEntity, serverEntity);

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe('TIMESTAMP_MISMATCH');
    });

    it('should not detect timestamp conflict when server is newer', () => {
      const localEntity = {
        __typename: 'User',
        id: '1',
        name: 'John',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      const serverEntity = {
        __typename: 'User',
        id: '1',
        name: 'John',
        updatedAt: '2024-01-02T00:00:00Z'
      };

      const result = resolver.detectConflicts(localEntity, serverEntity);

      expect(result.hasConflict).toBe(false);
    });

    it('should detect field conflicts', () => {
      const localEntity = { __typename: 'User', id: '1', name: 'John', email: 'john@example.com' };
      const serverEntity = { __typename: 'User', id: '1', name: 'John', email: 'john@other.com' };

      const result = resolver.detectConflicts(localEntity, serverEntity);

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe('FIELD_CONFLICT');
      expect(result.conflictingFields).toContain('email');
    });

    it('should detect multiple field conflicts', () => {
      const localEntity = { __typename: 'User', id: '1', name: 'John', email: 'john@a.com', age: 30 };
      const serverEntity = { __typename: 'User', id: '1', name: 'Jane', email: 'jane@b.com', age: 25 };

      const result = resolver.detectConflicts(localEntity, serverEntity);

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe('FIELD_CONFLICT');
      expect(result.conflictingFields).toContain('name');
      expect(result.conflictingFields).toContain('email');
      expect(result.conflictingFields).toContain('age');
    });

    it('should return no conflict when entities match', () => {
      const localEntity = { __typename: 'User', id: '1', name: 'John', version: 1 };
      const serverEntity = { __typename: 'User', id: '1', name: 'John', version: 1 };

      const result = resolver.detectConflicts(localEntity, serverEntity);

      expect(result.hasConflict).toBe(false);
    });

    it('should ignore metadata fields in conflict detection', () => {
      const localEntity = {
        __typename: 'User',
        id: '1',
        name: 'John'
      };
      const serverEntity = {
        __typename: 'User',
        id: '1',
        name: 'John'
      };

      const result = resolver.detectConflicts(localEntity, serverEntity);

      expect(result.hasConflict).toBe(false);
    });
  });

  describe('resolveConflicts', () => {
    const conflict: ConflictDetection = {
      hasConflict: true,
      conflictType: 'FIELD_CONFLICT',
      localEntity: { __typename: 'User', id: '1', name: 'Local', email: 'local@example.com' },
      serverEntity: { __typename: 'User', id: '1', name: 'Server', email: 'server@example.com' },
      conflictingFields: ['name', 'email']
    };

    it('should return server entity for SERVER_WINS', () => {
      const result = resolver.resolveConflicts(conflict, 'SERVER_WINS');

      expect(result).toBe(conflict.serverEntity);
    });

    it('should return local entity for CLIENT_WINS', () => {
      const result = resolver.resolveConflicts(conflict, 'CLIENT_WINS');

      expect(result).toBe(conflict.localEntity);
    });

    it('should merge entities for MERGE strategy', () => {
      const result = resolver.resolveConflicts(conflict, 'MERGE');

      expect(result.name).toBe('Server'); // server wins by default
      expect(result.email).toBe('server@example.com');
    });

    it('should throw for MANUAL strategy', () => {
      expect(() => {
        resolver.resolveConflicts(conflict, 'MANUAL');
      }).toThrow('Manual conflict resolution required');
    });

    it('should return server entity when no conflict', () => {
      const noConflict: ConflictDetection = {
        hasConflict: false,
        serverEntity: { __typename: 'User', id: '1', name: 'Server' }
      };

      const result = resolver.resolveConflicts(noConflict, 'SERVER_WINS');

      expect(result).toBe(noConflict.serverEntity);
    });

    it('should default to SERVER_WINS when strategy not specified', () => {
      const result = resolver.resolveConflicts(conflict);

      expect(result).toBe(conflict.serverEntity);
    });
  });

  describe('mergeEntities', () => {
    it('should merge non-null values from local', () => {
      const local = { __typename: 'User', id: '1', name: 'Local', bio: 'My bio' };
      const server = { __typename: 'User', id: '1', name: 'Server', bio: null };

      const result = (resolver as any).mergeEntities(local, server);

      expect(result.name).toBe('Server'); // server value preserved
      expect(result.bio).toBe('My bio'); // local fills in null
    });

    it('should prefer server values over local values when both exist', () => {
      const local = { __typename: 'User', id: '1', name: 'Local', email: 'local@example.com' };
      const server = { __typename: 'User', id: '1', name: 'Server', email: 'server@example.com' };

      const result = (resolver as any).mergeEntities(local, server);

      expect(result.name).toBe('Server');
      expect(result.email).toBe('server@example.com');
    });

    it('should add local fields not in server', () => {
      const local = { __typename: 'User', id: '1', name: 'Local', extraField: 'extra' };
      const server = { __typename: 'User', id: '1', name: 'Server' };

      const result = (resolver as any).mergeEntities(local, server);

      expect(result.name).toBe('Server');
      expect(result.extraField).toBe('extra');
    });
  });
});
