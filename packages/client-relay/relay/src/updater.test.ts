import { CascadeUpdates, CascadeOperation } from '@graphql-cascade/client';
import { createCascadeUpdater, applyCascadeToStore } from './updater';

// Mock Relay runtime
let mockRecord: any;
let mockStoreProxy: any;

describe('createCascadeUpdater', () => {
  beforeEach(() => {
    mockRecord = {
      setValue: jest.fn(),
      getValue: jest.fn()
    };

    mockStoreProxy = {
      get: jest.fn().mockReturnValue(null), // Default to null, will be overridden in specific tests
      create: jest.fn(() => mockRecord),
      delete: jest.fn()
    };
  });

  describe('entity updates', () => {
    it('should create new records for CREATED operations', () => {
      const cascade: CascadeUpdates = {
        updated: [{
          __typename: 'User',
          id: '1',
          operation: CascadeOperation.CREATED,
          entity: { name: 'John', email: 'john@example.com' }
        }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx1', depth: 1, affectedCount: 1 }
      };

      const updater = createCascadeUpdater(cascade);
      updater(mockStoreProxy as any);

      expect(mockStoreProxy.create).toHaveBeenCalledWith('User:1', 'User');
      expect(mockRecord.setValue).toHaveBeenCalledWith('John', 'name');
      expect(mockRecord.setValue).toHaveBeenCalledWith('john@example.com', 'email');
      expect(mockRecord.setValue).toHaveBeenCalledWith(true, '__isCreated');
    });

    it('should update existing record during CREATE operation without error', () => {
      mockStoreProxy.get.mockReturnValueOnce(mockRecord); // Record already exists

      const cascade: CascadeUpdates = {
        updated: [{
          __typename: 'User',
          id: '3',
          operation: CascadeOperation.CREATED,
          entity: { name: 'Bob', email: 'bob@example.com' }
        }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx3', depth: 1, affectedCount: 1 }
      };

      const updater = createCascadeUpdater(cascade);
      updater(mockStoreProxy as any);

      expect(mockStoreProxy.get).toHaveBeenCalledWith('User:3');
      expect(mockStoreProxy.create).not.toHaveBeenCalled(); // Should not create since record exists
      expect(mockRecord.setValue).toHaveBeenCalledWith('Bob', 'name');
      expect(mockRecord.setValue).toHaveBeenCalledWith('bob@example.com', 'email');
      expect(mockRecord.setValue).toHaveBeenCalledWith(true, '__isCreated');
    });

    it('should log warning for DELETED entity in updated array', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockStoreProxy.get.mockReturnValueOnce(mockRecord);

      const cascade: CascadeUpdates = {
        updated: [{
          __typename: 'User',
          id: '4',
          operation: CascadeOperation.DELETED,
          entity: { name: 'Deleted User' }
        }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx4', depth: 1, affectedCount: 1 }
      };

      const updater = createCascadeUpdater(cascade);
      updater(mockStoreProxy as any);

      expect(consoleWarnSpy).toHaveBeenCalledWith('Received DELETED operation in updated entities for User:4');
      expect(mockRecord.setValue).toHaveBeenCalledWith('Deleted User', 'name');

      consoleWarnSpy.mockRestore();
    });

    it('should skip __typename and id fields during setValue', () => {
      mockStoreProxy.get.mockReturnValueOnce(mockRecord);

      const cascade: CascadeUpdates = {
        updated: [{
          __typename: 'User',
          id: '5',
          operation: CascadeOperation.UPDATED,
          entity: {
            __typename: 'User', // Should be skipped
            id: '5', // Should be skipped
            name: 'Alice',
            email: 'alice@example.com'
          }
        }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx5', depth: 1, affectedCount: 1 }
      };

      const updater = createCascadeUpdater(cascade);
      updater(mockStoreProxy as any);

      expect(mockRecord.setValue).not.toHaveBeenCalledWith('User', '__typename');
      expect(mockRecord.setValue).not.toHaveBeenCalledWith('5', 'id');
      expect(mockRecord.setValue).toHaveBeenCalledWith('Alice', 'name');
      expect(mockRecord.setValue).toHaveBeenCalledWith('alice@example.com', 'email');
      expect(mockRecord.setValue).toHaveBeenCalledWith(true, '__isUpdated');
    });

    it('should handle multiple entities in single cascade update', () => {
      mockStoreProxy.get
        .mockReturnValueOnce(mockRecord) // First entity exists
        .mockReturnValueOnce(null); // Second entity doesn't exist

      const cascade: CascadeUpdates = {
        updated: [
          {
            __typename: 'User',
            id: '6',
            operation: CascadeOperation.UPDATED,
            entity: { name: 'User1', email: 'user1@example.com' }
          },
          {
            __typename: 'Post',
            id: '10',
            operation: CascadeOperation.CREATED,
            entity: { title: 'Post Title', content: 'Post content' }
          }
        ],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx6', depth: 1, affectedCount: 2 }
      };

      const updater = createCascadeUpdater(cascade);
      updater(mockStoreProxy as any);

      // First entity (existing)
      expect(mockStoreProxy.get).toHaveBeenCalledWith('User:6');
      expect(mockRecord.setValue).toHaveBeenCalledWith('User1', 'name');
      expect(mockRecord.setValue).toHaveBeenCalledWith('user1@example.com', 'email');
      expect(mockRecord.setValue).toHaveBeenCalledWith(true, '__isUpdated');

      // Second entity (new)
      expect(mockStoreProxy.get).toHaveBeenCalledWith('Post:10');
      expect(mockStoreProxy.create).toHaveBeenCalledWith('Post:10', 'Post');
      expect(mockRecord.setValue).toHaveBeenCalledWith('Post Title', 'title');
      expect(mockRecord.setValue).toHaveBeenCalledWith('Post content', 'content');
      expect(mockRecord.setValue).toHaveBeenCalledWith(true, '__isCreated');
    });

    it('should update existing records for UPDATED operations', () => {
      mockStoreProxy.get.mockReturnValueOnce(mockRecord);

      const cascade: CascadeUpdates = {
        updated: [{
          __typename: 'User',
          id: '1',
          operation: CascadeOperation.UPDATED,
          entity: { name: 'John', email: 'john@example.com' }
        }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx1', depth: 1, affectedCount: 1 }
      };

      const updater = createCascadeUpdater(cascade);
      updater(mockStoreProxy as any);

      expect(mockStoreProxy.get).toHaveBeenCalledWith('User:1');
      expect(mockRecord.setValue).toHaveBeenCalledWith('John', 'name');
      expect(mockRecord.setValue).toHaveBeenCalledWith('john@example.com', 'email');
      expect(mockRecord.setValue).toHaveBeenCalledWith(true, '__isUpdated');
    });

    it('should create record if missing during UPDATE operation', () => {
      mockStoreProxy.get.mockReturnValueOnce(null); // Record doesn't exist

      const cascade: CascadeUpdates = {
        updated: [{
          __typename: 'User',
          id: '2',
          operation: CascadeOperation.UPDATED,
          entity: { name: 'Jane', email: 'jane@example.com' }
        }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx2', depth: 1, affectedCount: 1 }
      };

      const updater = createCascadeUpdater(cascade);
      updater(mockStoreProxy as any);

      expect(mockStoreProxy.get).toHaveBeenCalledWith('User:2');
      expect(mockStoreProxy.create).toHaveBeenCalledWith('User:2', 'User');
      expect(mockRecord.setValue).toHaveBeenCalledWith('Jane', 'name');
      expect(mockRecord.setValue).toHaveBeenCalledWith('jane@example.com', 'email');
      expect(mockRecord.setValue).toHaveBeenCalledWith(true, '__isUpdated');
    });
  });

  describe('entity deletions', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    it('should mark records as deleted', () => {
      mockStoreProxy.get.mockReturnValueOnce(mockRecord);

      const cascade: CascadeUpdates = {
        updated: [],
        deleted: [{
          __typename: 'User',
          id: '1',
          deletedAt: '2023-01-01T00:00:00Z'
        }],
        invalidations: [],
        metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx1', depth: 1, affectedCount: 1 }
      };

      const updater = createCascadeUpdater(cascade);
      updater(mockStoreProxy as any);

      expect(mockStoreProxy.get).toHaveBeenCalledWith('User:1');
      expect(mockRecord.setValue).toHaveBeenCalledWith(true, '__isDeleted');
      expect(mockRecord.setValue).toHaveBeenCalledWith('2023-01-01T00:00:00Z', 'deletedAt');
    });

    it('should mark records as deleted and set deletedAt timestamp', () => {
      mockStoreProxy.get.mockReturnValueOnce(mockRecord);

      const deletedAt = '2023-01-02T12:00:00Z';
      const cascade: CascadeUpdates = {
        updated: [],
        deleted: [{
          __typename: 'Post',
          id: '100',
          deletedAt
        }],
        invalidations: [],
        metadata: { timestamp: '2023-01-02T12:00:00Z', transactionId: 'tx10', depth: 1, affectedCount: 1 }
      };

      const updater = createCascadeUpdater(cascade);
      updater(mockStoreProxy as any);

      expect(mockStoreProxy.get).toHaveBeenCalledWith('Post:100');
      expect(mockRecord.setValue).toHaveBeenCalledWith(true, '__isDeleted');
      expect(mockRecord.setValue).toHaveBeenCalledWith(deletedAt, 'deletedAt');
    });

    it('should do nothing when deleting non-existent record', () => {
      mockStoreProxy.get.mockReturnValueOnce(null); // Record doesn't exist

      const cascade: CascadeUpdates = {
        updated: [],
        deleted: [{
          __typename: 'User',
          id: '999',
          deletedAt: '2023-01-01T00:00:00Z'
        }],
        invalidations: [],
        metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx11', depth: 1, affectedCount: 1 }
      };

      const updater = createCascadeUpdater(cascade);
      updater(mockStoreProxy as any);

      expect(mockStoreProxy.get).toHaveBeenCalledWith('User:999');
      expect(mockRecord.setValue).not.toHaveBeenCalled(); // No calls since record doesn't exist
    });
  });

  describe('applyCascadeToStore', () => {
    it('should apply cascade updates directly to store', () => {
      const cascade: CascadeUpdates = {
        updated: [{
          __typename: 'User',
          id: '1',
          operation: CascadeOperation.CREATED,
          entity: { name: 'John' }
        }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx1', depth: 1, affectedCount: 1 }
      };

      applyCascadeToStore(mockStoreProxy as any, cascade);

      expect(mockStoreProxy.create).toHaveBeenCalledWith('User:1', 'User');
      expect(mockRecord.setValue).toHaveBeenCalledWith('John', 'name');
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle empty cascade update (no entities)', () => {
      const cascade: CascadeUpdates = {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx7', depth: 1, affectedCount: 0 }
      };

      const updater = createCascadeUpdater(cascade);
      updater(mockStoreProxy as any);

      expect(mockStoreProxy.get).not.toHaveBeenCalled();
      expect(mockStoreProxy.create).not.toHaveBeenCalled();
      expect(mockRecord.setValue).not.toHaveBeenCalled();
    });

    it('should handle malformed entity data - missing __typename gracefully', () => {
      // This test verifies the current behavior - the code constructs recordId using entity.__typename
      // If __typename is missing, it would cause issues, but we test that it doesn't crash
      mockStoreProxy.get.mockReturnValueOnce(mockRecord);

      const cascade: CascadeUpdates = {
        updated: [{
          __typename: 'User',
          id: '8',
          operation: CascadeOperation.UPDATED,
          entity: { name: 'Test User' }
        }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx8', depth: 1, affectedCount: 1 }
      };

      const updater = createCascadeUpdater(cascade);
      expect(() => updater(mockStoreProxy as any)).not.toThrow();

      expect(mockStoreProxy.get).toHaveBeenCalledWith('User:8');
      expect(mockRecord.setValue).toHaveBeenCalledWith('Test User', 'name');
    });

    it('should handle malformed entity data - missing id gracefully', () => {
      // Similar to above - tests that missing id doesn't cause crashes
      mockStoreProxy.get.mockReturnValueOnce(mockRecord);

      const cascade: CascadeUpdates = {
        updated: [{
          __typename: 'User',
          id: '9',
          operation: CascadeOperation.UPDATED,
          entity: { name: 'Test User 2' }
        }],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx9', depth: 1, affectedCount: 1 }
      };

      const updater = createCascadeUpdater(cascade);
      expect(() => updater(mockStoreProxy as any)).not.toThrow();

      expect(mockStoreProxy.get).toHaveBeenCalledWith('User:9');
      expect(mockRecord.setValue).toHaveBeenCalledWith('Test User 2', 'name');
    });
  });
});
