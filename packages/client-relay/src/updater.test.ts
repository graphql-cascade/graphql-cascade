import { CascadeUpdates, CascadeOperation } from '@graphql-cascade/client';
import { createCascadeUpdater, applyCascadeToStore } from './updater';

// Mock Relay runtime
const mockRecord = {
  setValue: jest.fn(),
  getValue: jest.fn()
};

const mockStoreProxy = {
  get: jest.fn().mockReturnValue(null), // Default to null, will be overridden in specific tests
  create: jest.fn(() => mockRecord),
  delete: jest.fn()
};

describe('createCascadeUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
  });

  describe('entity deletions', () => {
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
});