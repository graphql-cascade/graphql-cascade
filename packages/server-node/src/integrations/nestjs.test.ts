/**
 * Tests for NestJS integration
 *
 * Tests for CascadeModule and CascadeService that provide
 * request-scoped cascade tracking in NestJS applications.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CascadeModule, CascadeService } from './nestjs';
import { CascadeResponse } from '../types';

// Mock entity for testing
class MockEntity {
  constructor(
    public id: number,
    public name: string,
    public __typename: string = 'MockEntity'
  ) {}

  toDict() {
    return {
      id: String(this.id),
      name: this.name,
    };
  }
}

describe('CascadeService', () => {
  let service: CascadeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CascadeService],
    }).compile();

    service = await module.resolve<CascadeService>(CascadeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have a tracker instance', () => {
    expect(service.getTracker()).toBeDefined();
  });

  it('should have a builder instance', () => {
    expect(service.getBuilder()).toBeDefined();
  });

  describe('Entity Tracking', () => {
    beforeEach(() => {
      service.startTransaction();
    });

    afterEach(() => {
      // Clean up transaction if still active
      try {
        service.endTransaction();
      } catch (e) {
        // Ignore if already ended
      }
    });

    it('should track entity creation', () => {
      const entity = new MockEntity(1, 'Test Entity');
      service.trackCreate(entity);

      const cascadeData = service.getCascadeData();
      expect(cascadeData.updated).toHaveLength(1);
      expect(cascadeData.updated[0].operation).toBe('CREATED');
      expect(cascadeData.updated[0].entity.name).toBe('Test Entity');
    });

    it('should track entity update', () => {
      const entity = new MockEntity(1, 'Updated Entity');
      service.trackUpdate(entity);

      const cascadeData = service.getCascadeData();
      expect(cascadeData.updated).toHaveLength(1);
      expect(cascadeData.updated[0].operation).toBe('UPDATED');
    });

    it('should track entity deletion', () => {
      service.trackDelete('MockEntity', '1');

      const cascadeData = service.getCascadeData();
      expect(cascadeData.deleted).toHaveLength(1);
      expect(cascadeData.deleted[0].__typename).toBe('MockEntity');
      expect(cascadeData.deleted[0].id).toBe('1');
    });
  });

  describe('Response Building', () => {
    beforeEach(() => {
      service.startTransaction();
    });

    it('should build success response', () => {
      const entity = new MockEntity(1, 'Test Entity');
      service.trackCreate(entity);

      const response: CascadeResponse = service.buildResponse({ id: 1 });

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: 1 });
      expect(response.cascade.updated).toHaveLength(1);
      expect(response.errors).toHaveLength(0);
    });

    it('should build error response', () => {
      const errors = [{ message: 'Test error', code: 'TEST_ERROR' }];
      const response: CascadeResponse = service.buildErrorResponse(errors);

      expect(response.success).toBe(false);
      expect(response.errors).toEqual(errors);
    });

    it('should end transaction after building response', () => {
      const entity = new MockEntity(1, 'Test Entity');
      service.trackCreate(entity);
      service.buildResponse({ id: 1 });

      // Transaction should be ended
      expect(() => service.getCascadeData()).toThrow();
    });
  });

  describe('Transaction Management', () => {
    it('should start transaction', () => {
      const transactionId = service.startTransaction();
      expect(typeof transactionId).toBe('string');
      expect(transactionId).toContain('cascade_');
    });

    it('should end transaction', () => {
      service.startTransaction();
      const entity = new MockEntity(1, 'Test');
      service.trackCreate(entity);

      const cascadeData = service.endTransaction();
      expect(cascadeData.updated).toHaveLength(1);
    });

    it('should throw error when starting transaction twice', () => {
      service.startTransaction();
      expect(() => service.startTransaction()).toThrow('Transaction already in progress');
    });
  });
});

describe('CascadeModule', () => {
  it('should compile with default configuration', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CascadeModule],
    }).compile();

    expect(module).toBeDefined();
  });

  it('should provide CascadeService', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CascadeModule],
    }).compile();

    const service = await module.resolve<CascadeService>(CascadeService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(CascadeService);
  });

  it('should compile with custom configuration', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        CascadeModule.forRoot({
          maxDepth: 5,
          excludeTypes: ['InternalType'],
          maxResponseSizeMb: 10,
        }),
      ],
    }).compile();

    expect(module).toBeDefined();
    const service = await module.resolve<CascadeService>(CascadeService);
    expect(service).toBeDefined();
  });

  it('should be request-scoped', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CascadeModule],
    }).compile();

    // Get two instances - in a real NestJS app, these would be different per request
    const service1 = await module.resolve<CascadeService>(CascadeService);
    const service2 = await module.resolve<CascadeService>(CascadeService);

    // Start separate transactions
    service1.startTransaction();
    const entity1 = new MockEntity(1, 'Entity 1');
    service1.trackCreate(entity1);

    service2.startTransaction();
    const entity2 = new MockEntity(2, 'Entity 2');
    service2.trackCreate(entity2);

    // Each service should track its own entities
    const data1 = service1.getCascadeData();
    const data2 = service2.getCascadeData();

    expect(data1.updated).toHaveLength(1);
    expect(data2.updated).toHaveLength(1);
    expect(data1.updated[0].entity.name).toBe('Entity 1');
    expect(data2.updated[0].entity.name).toBe('Entity 2');

    // Clean up
    service1.endTransaction();
    service2.endTransaction();
  });
});
