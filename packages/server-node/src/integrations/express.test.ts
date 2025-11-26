/**
 * Tests for Express middleware integration
 */

import { Request, Response, NextFunction } from 'express';
import { cascadeMiddleware, getCascadeData, buildCascadeResponse } from './express';
import { CascadeTracker } from '../tracker';

// Mock Express Request
interface MockRequest extends Partial<Request> {
  cascadeTracker?: CascadeTracker;
  cascadeBuilder?: any;
}

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

describe('cascadeMiddleware', () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {};
    mockNext = jest.fn();
  });

  it('should attach cascadeTracker to request', () => {
    const middleware = cascadeMiddleware();
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.cascadeTracker).toBeDefined();
    expect(mockReq.cascadeTracker).toBeInstanceOf(CascadeTracker);
  });

  it('should attach cascadeBuilder to request', () => {
    const middleware = cascadeMiddleware();
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.cascadeBuilder).toBeDefined();
  });

  it('should call next()', () => {
    const middleware = cascadeMiddleware();
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should create unique tracker for each request', () => {
    const middleware = cascadeMiddleware();

    const req1: MockRequest = {};
    const req2: MockRequest = {};

    middleware(req1 as Request, mockRes as Response, mockNext);
    middleware(req2 as Request, mockRes as Response, mockNext);

    expect(req1.cascadeTracker).not.toBe(req2.cascadeTracker);
  });

  it('should accept configuration options', () => {
    const middleware = cascadeMiddleware({
      maxDepth: 10,
      excludeTypes: ['PrivateType'],
      maxResponseSizeMb: 20,
    });

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.cascadeTracker).toBeDefined();
  });
});

describe('getCascadeData', () => {
  it('should return null when no tracker present', () => {
    const mockReq: MockRequest = {};
    const data = getCascadeData(mockReq as Request);

    expect(data).toBeNull();
  });

  it('should return null when transaction not started', () => {
    const mockReq: MockRequest = {
      cascadeTracker: new CascadeTracker(),
    };

    const data = getCascadeData(mockReq as Request);
    expect(data).toBeNull();
  });

  it('should return cascade data when transaction active', () => {
    const tracker = new CascadeTracker();
    tracker.startTransaction();

    const entity = new MockEntity(1, 'Test');
    tracker.trackCreate(entity);

    const mockReq: MockRequest = {
      cascadeTracker: tracker,
    };

    const data = getCascadeData(mockReq as Request);
    expect(data).toBeDefined();
    expect(data.updated).toHaveLength(1);
  });
});

describe('buildCascadeResponse', () => {
  it('should throw error when builder not present', () => {
    const mockReq: MockRequest = {};

    expect(() => {
      buildCascadeResponse(mockReq as Request, { id: 1 });
    }).toThrow('CascadeBuilder not found on request');
  });

  it('should build response when builder present', () => {
    const testReq: MockRequest = {};
    const middleware = cascadeMiddleware();
    middleware(testReq as Request, {} as Response, jest.fn());

    testReq.cascadeTracker!.startTransaction();
    const entity = new MockEntity(1, 'Test');
    testReq.cascadeTracker!.trackCreate(entity);

    const response = buildCascadeResponse(testReq as Request, { id: 1 });

    expect(response.success).toBe(true);
    expect(response.data).toEqual({ id: 1 });
    expect(response.cascade.updated).toHaveLength(1);
  });

  it('should build error response', () => {
    const testReq: MockRequest = {};
    const middleware = cascadeMiddleware();
    middleware(testReq as Request, {} as Response, jest.fn());

    testReq.cascadeTracker!.startTransaction();

    const errors = [{ message: 'Test error', code: 'TEST_ERROR' }];
    const response = buildCascadeResponse(testReq as Request, null, false, errors);

    expect(response.success).toBe(false);
    expect(response.errors).toEqual(errors);
  });
});

describe('Integration with GraphQL', () => {
  it('should work in a typical GraphQL flow', () => {
    // 1. Middleware attaches tracker
    const middleware = cascadeMiddleware();
    const testReq: MockRequest = {};
    middleware(testReq as Request, {} as Response, jest.fn());

    // 2. Resolver starts transaction and tracks changes
    testReq.cascadeTracker!.startTransaction();
    const entity1 = new MockEntity(1, 'User 1');
    const entity2 = new MockEntity(2, 'User 2');
    testReq.cascadeTracker!.trackCreate(entity1);
    testReq.cascadeTracker!.trackUpdate(entity2);

    // 3. Build response
    const response = buildCascadeResponse(testReq as Request, { success: true });

    // 4. Verify response
    expect(response.success).toBe(true);
    expect(response.cascade.updated).toHaveLength(2);
    expect(response.cascade.updated[0].operation).toBe('CREATED');
    expect(response.cascade.updated[1].operation).toBe('UPDATED');
  });
});
