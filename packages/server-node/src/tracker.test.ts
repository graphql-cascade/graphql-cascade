import {
  CascadeTracker,
  CascadeTransaction,
  trackCascade,
} from './tracker';

// Mock entities for testing
class MockEntity {
  constructor(
    public id: number,
    public name: string,
    public __typename: string = 'MockEntity',
    public relatedEntity?: MockEntity,
    public relatedEntities?: MockEntity[]
  ) {}

  toDict() {
    return {
      id: String(this.id),
      name: this.name,
      relatedEntity: this.relatedEntity ? { id: String(this.relatedEntity.id), __typename: this.relatedEntity.__typename } : null,
      relatedEntities: this.relatedEntities?.map(e => ({ id: String(e.id), __typename: e.__typename })) || [],
    };
  }
}

class MockEntityWithoutId {
  constructor(public name: string) {}
}

describe('CascadeTracker', () => {
  let tracker: CascadeTracker;

  beforeEach(() => {
    tracker = new CascadeTracker();
  });

  describe('Transaction Management', () => {
    it('should start and end transactions correctly', () => {
      const transactionId = tracker.startTransaction();
      expect(typeof transactionId).toBe('string');
      expect(tracker.inTransaction).toBe(true);
      expect(tracker.transactionId).toBe(transactionId);

      const result = tracker.endTransaction();
      expect(tracker.inTransaction).toBe(false);
      expect(result.metadata.transactionId).toBe(transactionId);
    });

    it('should throw error when starting transaction while already in one', () => {
      tracker.startTransaction();
      expect(() => tracker.startTransaction()).toThrow('Transaction already in progress');
    });

    it('should throw error when ending transaction without starting one', () => {
      expect(() => tracker.endTransaction()).toThrow('No transaction in progress');
    });

    it('should reset transaction state on error in context manager', () => {
      const transaction = new CascadeTransaction(tracker);
      const transactionId = transaction.enter();
      expect(tracker.inTransaction).toBe(true);

      // Simulate exception
      transaction.exit('error', 'error message', null);
      expect(tracker.inTransaction).toBe(false);
      expect(tracker.transactionId).toBeUndefined();
    });

    it('should maintain transaction state on normal exit', () => {
      const transaction = new CascadeTransaction(tracker);
      transaction.enter();
      expect(tracker.inTransaction).toBe(true);

      transaction.exit(null, null, null);
      expect(tracker.inTransaction).toBe(false);
    });
  });

  describe('Entity Tracking - Create', () => {
    it('should track entity creation', () => {
      tracker.startTransaction();
      const entity = new MockEntity(1, 'Test Entity');

      tracker.trackCreate(entity);

      const result = tracker.endTransaction();
      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].__typename).toBe('MockEntity');
      expect(result.updated[0].id).toBe('1');
      expect(result.updated[0].operation).toBe('CREATED');
      expect(result.updated[0].entity.name).toBe('Test Entity');
    });

    it('should throw error when tracking without transaction', () => {
      const entity = new MockEntity(1, 'Test Entity');
      expect(() => tracker.trackCreate(entity)).toThrow('No cascade transaction in progress');
    });

    it('should throw error for entity without id', () => {
      tracker.startTransaction();
      const entity = new MockEntityWithoutId('Test');
      expect(() => tracker.trackCreate(entity)).toThrow('Entity [object Object] has no \'id\' attribute');
    });
  });

  describe('Entity Tracking - Update', () => {
    it('should track entity updates', () => {
      tracker.startTransaction();
      const entity = new MockEntity(1, 'Updated Entity');

      tracker.trackUpdate(entity);

      const result = tracker.endTransaction();
      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].operation).toBe('UPDATED');
    });

    it('should throw error when tracking update without transaction', () => {
      const entity = new MockEntity(1, 'Test Entity');
      expect(() => tracker.trackUpdate(entity)).toThrow('No cascade transaction in progress');
    });
  });

  describe('Entity Tracking - Delete', () => {
    it('should track entity deletion', () => {
      tracker.startTransaction();

      tracker.trackDelete('MockEntity', 1);

      const result = tracker.endTransaction();
      expect(result.deleted).toHaveLength(1);
      expect(result.deleted[0].__typename).toBe('MockEntity');
      expect(result.deleted[0].id).toBe('1');
      expect(result.deleted[0].deletedAt).toBeDefined();
    });

    it('should throw error when tracking delete without transaction', () => {
      expect(() => tracker.trackDelete('MockEntity', 1)).toThrow('No cascade transaction in progress');
    });

    it('should remove entity from updated when deleted', () => {
      tracker.startTransaction();
      const entity = new MockEntity(1, 'Test Entity');

      tracker.trackUpdate(entity);
      tracker.trackDelete('MockEntity', 1);

      const result = tracker.endTransaction();
      expect(result.updated).toHaveLength(0);
      expect(result.deleted).toHaveLength(1);
    });
  });

  describe('Relationship Traversal', () => {
    it('should traverse single related entity', () => {
      tracker.startTransaction();
      const relatedEntity = new MockEntity(2, 'Related Entity');
      const mainEntity = new MockEntity(1, 'Main Entity', 'MockEntity', relatedEntity);

      tracker.trackUpdate(mainEntity);

      const result = tracker.endTransaction();
      expect(result.updated).toHaveLength(2);
      const mainUpdate = result.updated.find((u: any) => u.id === '1');
      const relatedUpdate = result.updated.find((u: any) => u.id === '2');
      expect(mainUpdate).toBeDefined();
      expect(relatedUpdate).toBeDefined();
      expect(relatedUpdate?.operation).toBe('UPDATED');
    });

    it('should traverse array of related entities', () => {
      tracker.startTransaction();
      const related1 = new MockEntity(2, 'Related 1');
      const related2 = new MockEntity(3, 'Related 2');
      const mainEntity = new MockEntity(1, 'Main Entity', 'MockEntity', undefined, [related1, related2]);

      tracker.trackUpdate(mainEntity);

      const result = tracker.endTransaction();
      expect(result.updated).toHaveLength(3);
      expect(result.updated.map((u: any) => u.id)).toEqual(expect.arrayContaining(['1', '2', '3']));
    });

    it('should respect max depth limit', () => {
      const shallowTracker = new CascadeTracker({ maxDepth: 1 });
      shallowTracker.startTransaction();

      const level2 = new MockEntity(3, 'Level 2');
      const level1 = new MockEntity(2, 'Level 1', 'MockEntity', level2);
      const root = new MockEntity(1, 'Root', 'MockEntity', level1);

      shallowTracker.trackUpdate(root);

      const result = shallowTracker.endTransaction();
      // Should only track root and level1, not level2 due to depth limit
      expect(result.updated).toHaveLength(2);
      expect(result.updated.map((u: any) => u.id)).toEqual(expect.arrayContaining(['1', '2']));
    });

    it('should skip null related entities', () => {
      tracker.startTransaction();
      const mainEntity = new MockEntity(1, 'Main Entity', 'MockEntity', undefined);

      tracker.trackUpdate(mainEntity);

      const result = tracker.endTransaction();
      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].id).toBe('1');
    });

    it('should use custom getRelatedEntities method', () => {
      tracker.startTransaction();

      const customEntity = {
        id: 1,
        __typename: 'CustomEntity',
        name: 'Custom',
        getRelatedEntities: () => [new MockEntity(2, 'Related')]
      };

      tracker.trackUpdate(customEntity);

      const result = tracker.endTransaction();
      expect(result.updated).toHaveLength(2);
    });
  });

  describe('Configuration Options', () => {
    it('should respect excludeTypes configuration', () => {
      const configuredTracker = new CascadeTracker({
        excludeTypes: ['ExcludedType']
      });
      configuredTracker.startTransaction();

      const excludedEntity = new MockEntity(1, 'Excluded', 'ExcludedType');
      const includedEntity = new MockEntity(2, 'Included', 'IncludedType');

      configuredTracker.trackUpdate(excludedEntity);
      configuredTracker.trackUpdate(includedEntity);

      const result = configuredTracker.endTransaction();
      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].__typename).toBe('IncludedType');
    });

    it('should disable relationship tracking when configured', () => {
      const configuredTracker = new CascadeTracker({
        enableRelationshipTracking: false
      });
      configuredTracker.startTransaction();

      const relatedEntity = new MockEntity(2, 'Related');
      const mainEntity = new MockEntity(1, 'Main', 'MockEntity', relatedEntity);

      configuredTracker.trackUpdate(mainEntity);

      const result = configuredTracker.endTransaction();
      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].id).toBe('1');
    });
  });

  describe('Serialization', () => {
    it('should serialize basic types correctly', () => {
      tracker.startTransaction();

      const entity = {
        id: 1,
        __typename: 'TestEntity',
        stringField: 'test',
        numberField: 42,
        booleanField: true,
        nullField: null,
        dateField: new Date('2023-01-01'),
        arrayField: [1, 2, 3],
        objectField: { nested: 'value' }
      };

      tracker.trackUpdate(entity);

      const result = tracker.endTransaction();
      const serialized = result.updated[0].entity;

      expect(serialized.stringField).toBe('test');
      expect(serialized.numberField).toBe(42);
      expect(serialized.booleanField).toBe(true);
      expect(serialized.nullField).toBe(null);
      expect(serialized.dateField).toBe('2023-01-01T00:00:00.000Z');
      expect(serialized.arrayField).toEqual([1, 2, 3]);
      expect(serialized.objectField).toEqual({ nested: 'value' });
    });

    it('should serialize related entities as references', () => {
      tracker.startTransaction();

      const relatedEntity = new MockEntity(2, 'Related');
      const mainEntity = new MockEntity(1, 'Main', 'MockEntity', relatedEntity);

      tracker.trackUpdate(mainEntity);

      const result = tracker.endTransaction();
      const mainSerialized = result.updated.find((u: any) => u.id === '1')?.entity;

      expect(mainSerialized?.relatedEntity).toEqual({
        __typename: 'MockEntity',
        id: '2'
      });
    });

    it('should use custom toDict method when available', () => {
      tracker.startTransaction();

      const entityWithToDict = {
        id: 1,
        __typename: 'CustomEntity',
        name: 'Test',
        toDict: () => ({ id: 1, customField: 'customized' })
      };

      tracker.trackUpdate(entityWithToDict);

      const result = tracker.endTransaction();
      expect(result.updated[0].entity).toEqual({
        id: 1,
        customField: 'customized'
      });
    });

    it('should skip private properties starting with underscore', () => {
      tracker.startTransaction();

      const entity = {
        id: 1,
        __typename: 'TestEntity',
        publicField: 'public',
        _privateField: 'private'
      };

      tracker.trackUpdate(entity);

      const result = tracker.endTransaction();
      expect(result.updated[0].entity.publicField).toBe('public');
      expect(result.updated[0].entity._privateField).toBeUndefined();
    });
  });

  describe('Iterator Methods', () => {
    it('should iterate over updated entities', () => {
      tracker.startTransaction();
      const entity1 = new MockEntity(1, 'Entity 1');
      const entity2 = new MockEntity(2, 'Entity 2');

      tracker.trackUpdate(entity1);
      tracker.trackUpdate(entity2);

      const updates: Array<[any, string]> = [];
      for (const update of tracker.getUpdatedStream()) {
        updates.push(update);
      }

      expect(updates).toHaveLength(2);
      expect(updates[0][1]).toBe('UPDATED');
      expect(updates[1][1]).toBe('UPDATED');
    });

    it('should iterate over deleted entities', () => {
      tracker.startTransaction();

      tracker.trackDelete('Type1', 1);
      tracker.trackDelete('Type2', 2);

      const deletes: Array<[string, string]> = [];
      for (const del of tracker.getDeletedStream()) {
        deletes.push(del);
      }

      expect(deletes).toHaveLength(2);
      expect(deletes).toEqual(expect.arrayContaining([
        ['Type1', '1'],
        ['Type2', '2']
      ]));
    });
  });

  describe('Cascade Data Retrieval', () => {
    it('should return cascade data without ending transaction', () => {
      tracker.startTransaction();
      const entity = new MockEntity(1, 'Test');

      tracker.trackUpdate(entity);

      const cascadeData = tracker.getCascadeData();
      expect(cascadeData.updated).toHaveLength(1);
      expect(tracker.inTransaction).toBe(true); // Transaction still active

      // Should be able to get data again
      const cascadeData2 = tracker.getCascadeData();
      expect(cascadeData2.updated).toHaveLength(1);
    });

    it('should throw error when getting cascade data without transaction', () => {
      expect(() => tracker.getCascadeData()).toThrow('No transaction in progress');
    });
  });

  describe('Convenience Functions', () => {
    it('should create cascade transaction context manager', () => {
      const transaction = trackCascade();
      expect(transaction).toBeInstanceOf(CascadeTransaction);
    });

    it('should support configuration in convenience function', () => {
      const transaction = trackCascade({ maxDepth: 5 });
      expect(transaction).toBeInstanceOf(CascadeTransaction);
    });
  });

  describe('Error Handling', () => {
    it('should handle serialization errors gracefully', () => {
      tracker.startTransaction();

      const badEntity = {
        id: 1,
        __typename: 'BadEntity',
        badField: Symbol('bad') // Symbols can't be serialized
      };

      // Mock console.error to avoid noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      tracker.trackUpdate(badEntity);

      const result = tracker.endTransaction();

      // Should still include the entity despite serialization issues
      expect(result.updated).toHaveLength(1);

      consoleSpy.mockRestore();
    });

    it('should handle entities without proper type information', () => {
      tracker.startTransaction();

      const entity = {
        id: 1,
        name: 'Test'
        // No __typename
      };

      tracker.trackUpdate(entity);

      const result = tracker.endTransaction();
      expect(result.updated[0].__typename).toBe('Object');
    });
  });

  describe('Performance and Metadata', () => {
    it('should track timing information', () => {
      tracker.startTransaction();
      const entity = new MockEntity(1, 'Test');

      tracker.trackUpdate(entity);

      const result = tracker.endTransaction();
      expect(result.metadata.trackingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.affectedCount).toBe(1);
    });

    it('should track depth information', () => {
      tracker.startTransaction();
      const related = new MockEntity(2, 'Related');
      const main = new MockEntity(1, 'Main', 'MockEntity', related);

      tracker.trackUpdate(main);

      const result = tracker.endTransaction();
      expect(result.metadata.depth).toBeGreaterThanOrEqual(1);
    });
  });
});