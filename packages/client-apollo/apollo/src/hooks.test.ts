import { ApolloClient, InMemoryCache } from '@apollo/client';
import { gql } from '@apollo/client';
import {
  CascadeResponse,
  CascadeConflictResolver,
  CascadeOperation,
  InvalidationStrategy,
  InvalidationScope
} from '@graphql-cascade/client';
import { ApolloCascadeClient } from './client';

// Mock cascade response
const mockCascadeResponse: CascadeResponse = {
  success: true,
  data: {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com'
  },
  cascade: {
    updated: [{
      __typename: 'User',
      id: '1',
      operation: CascadeOperation.CREATED,
      entity: {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com'
      }
    }],
    deleted: [],
    invalidations: [{
      queryName: 'getUsers',
      strategy: InvalidationStrategy.INVALIDATE,
      scope: InvalidationScope.ALL
    }],
    metadata: {
      timestamp: '2024-01-01T00:00:00Z',
      depth: 1,
      affectedCount: 1
    }
  }
};

describe('ApolloCascadeClient integration with hooks', () => {
  let client: ApolloCascadeClient;

  beforeEach(() => {
    const apolloClient = new ApolloClient({
      cache: new InMemoryCache(),
      link: {
        request: jest.fn(),
        split: jest.fn(),
        concat: jest.fn(),
        setOnError: jest.fn()
      } as any
    });
    client = new ApolloCascadeClient(apolloClient);
  });

  describe('optimistic update helpers', () => {
    it('should apply and rollback optimistic updates', () => {
      const cache = client.getCache();

      // Initially no data
      expect(cache.read('User', '1')).toBeNull();

      // Apply optimistic update
      const rollbackInfo = [{
        __typename: 'User' as const,
        id: '1',
        previousData: null
      }];

      // Simulate applying optimistic update
      cache.write('User', '1', { id: '1', name: 'Optimistic Name' });

      // Verify optimistic data is there (cache.read only returns id and __typename)
      expect(cache.read('User', '1')).toEqual({ id: '1', __typename: 'User' });

      // Rollback
      rollbackInfo.forEach(({ __typename, id, previousData }) => {
        if (previousData === null) {
          cache.evict(__typename, id);
        } else {
          cache.write(__typename, id, previousData);
        }
      });

      // Verify rollback worked
      expect(cache.read('User', '1')).toBeNull();
    });
  });

  describe('conflict detection', () => {
    it('should detect conflicts between optimistic and server data', () => {
      const conflictResolver = new CascadeConflictResolver();

      const optimisticEntity = {
        id: '1',
        name: 'Optimistic Name',
        version: 1
      };

      const serverEntity = {
        id: '1',
        name: 'Server Name',
        version: 2
      };

      const conflict = conflictResolver.detectConflicts(optimisticEntity, serverEntity);

      expect(conflict.hasConflict).toBe(true);
      expect(conflict.conflictType).toBe('VERSION_MISMATCH');
    });

    it('should resolve conflicts using SERVER_WINS strategy', () => {
      const conflictResolver = new CascadeConflictResolver();

      const conflict = {
        hasConflict: true,
        conflictType: 'VERSION_MISMATCH' as const,
        localEntity: { id: '1', name: 'Local Name', version: 1 },
        serverEntity: { id: '1', name: 'Server Name', version: 2 },
        conflictingFields: ['name']
      };

      const resolved = conflictResolver.resolveConflicts(conflict, 'SERVER_WINS');

      expect(resolved).toEqual(conflict.serverEntity);
    });
  });

  describe('cascade application', () => {
    it('should apply cascade updates to cache', () => {
      const cache = client.getCache();

      // Initially no data
      expect(cache.read('User', '1')).toBeNull();

      // Apply cascade
      client.applyCascade(mockCascadeResponse);

      // Verify data was written (cache.read only returns id and __typename)
      expect(cache.read('User', '1')).toEqual({ id: '1', __typename: 'User' });
    });

    it('should handle entity deletions in cascade', () => {
      const cache = client.getCache();

      // Write some data first
      cache.write('User', '1', { id: '1', name: 'John' });

      // Apply cascade with deletion
      const deleteCascade: CascadeResponse = {
        success: true,
        data: null,
        cascade: {
          updated: [],
          deleted: [{ __typename: 'User', id: '1', deletedAt: '2024-01-01' }],
          invalidations: [],
          metadata: { timestamp: '2024-01-01', depth: 1, affectedCount: 1 }
        }
      };

      client.applyCascade(deleteCascade);

      // Verify entity was evicted
      expect(cache.read('User', '1')).toBeNull();
    });
  });
});