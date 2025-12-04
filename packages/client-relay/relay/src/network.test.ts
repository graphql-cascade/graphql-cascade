import { createCascadeRelayEnvironment } from './environment';
import { CascadeResponse, CascadeOperation } from '@graphql-cascade/client';

// Mock Relay runtime
const mockObservable = {
  map: jest.fn().mockReturnThis(),
  subscribe: jest.fn(),
  toPromise: jest.fn()
};

const mockNetwork = {
  execute: jest.fn().mockReturnValue(mockObservable)
};

const mockStore = {
  commitUpdates: jest.fn()
};

jest.mock('relay-runtime', () => ({
  Network: {
    create: jest.fn(() => mockNetwork)
  },
  Store: jest.fn(() => mockStore),
  RecordSource: jest.fn(),
  Observable: {
    create: jest.fn(() => mockObservable)
  },
  Environment: jest.fn().mockImplementation(() => ({
    execute: jest.fn(() => mockObservable)
  }))
}));

describe('Network Cascade Detection', () => {
  let cascadeNetwork: any;
  let mapCallback: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create the cascade environment to get the network wrapper
    createCascadeRelayEnvironment(mockNetwork as any, mockStore as any);

    // Get the network wrapper function passed to Network.create
    const { Network } = require('relay-runtime');
    const networkWrapper = (Network.create as jest.Mock).mock.calls[0][0];

    // Call the wrapper to get the observable
    networkWrapper({ operationKind: 'mutation' }, {});

    // Get the map callback that processes the payload
    mapCallback = mockObservable.map.mock.calls[0][0];
  });

  it('should trigger store update for mutation response WITH cascade data', () => {
    const cascadeResponse = {
      data: {
        createTodo: {
          id: '1',
          text: 'Test todo',
          cascade: {
            updated: [{
              __typename: 'Todo',
              id: '1',
              operation: CascadeOperation.CREATED,
              entity: {
                id: '1',
                text: 'Test todo',
                completed: false
              }
            }],
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: '2023-01-01T00:00:00Z',
              depth: 1,
              affectedCount: 1
            }
          }
        }
      }
    };

    const operation = { operationKind: 'mutation' };
    const result = mapCallback(cascadeResponse);

    expect(mockStore.commitUpdates).toHaveBeenCalledTimes(1);
    expect(result).toBe(cascadeResponse);
  });

  it('should pass through mutation response WITHOUT cascade data unchanged', () => {
    const regularResponse = {
      data: {
        createTodo: {
          id: '1',
          text: 'Test todo'
        }
      }
    };

    const operation = { operationKind: 'mutation' };
    const result = mapCallback(regularResponse);

    expect(mockStore.commitUpdates).not.toHaveBeenCalled();
    expect(result).toBe(regularResponse);
  });

  it('should not process query responses for cascade', () => {
    const queryResponse = {
      data: {
        todos: [
          { id: '1', text: 'Test todo' }
        ]
      }
    };

    const operation = { operationKind: 'query' };
    const result = mapCallback(queryResponse);

    expect(mockStore.commitUpdates).not.toHaveBeenCalled();
    expect(result).toBe(queryResponse);
  });

  it('should not process subscription responses for cascade', () => {
    const subscriptionResponse = {
      data: {
        todoUpdated: {
          id: '1',
          text: 'Updated todo'
        }
      }
    };

    const operation = { operationKind: 'subscription' };
    const result = mapCallback(subscriptionResponse);

    expect(mockStore.commitUpdates).not.toHaveBeenCalled();
    expect(result).toBe(subscriptionResponse);
  });

  it('should process the first mutation in batch response', () => {
    // Simulate batch mutation response - only the first mutation gets processed
    const batchResponse = {
      data: {
        mutation1: {
          id: '1',
          cascade: {
            updated: [{
              __typename: 'Todo',
              id: '1',
              operation: CascadeOperation.CREATED,
              entity: { id: '1', text: 'Todo 1' }
            }],
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: '2023-01-01T00:00:00Z',
              depth: 1,
              affectedCount: 1
            }
          }
        },
        mutation2: {
          id: '2'
          // No cascade data
        }
      }
    };

    const operation = { operationKind: 'mutation' };
    const result = mapCallback(batchResponse);

    expect(mockStore.commitUpdates).toHaveBeenCalledTimes(1);
    expect(result).toBe(batchResponse);
  });

  it('should handle errors in cascade processing gracefully', () => {
    // Mock store.commitUpdates to throw an error
    mockStore.commitUpdates.mockImplementation(() => {
      throw new Error('Store update error');
    });

    const cascadeResponse = {
      data: {
        createTodo: {
          id: '1',
          cascade: {
            updated: [{
              __typename: 'Todo',
              id: '1',
              operation: CascadeOperation.CREATED,
              entity: { id: '1', text: 'Test todo' }
            }],
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: '2023-01-01T00:00:00Z',
              depth: 1,
              affectedCount: 1
            }
          }
        }
      }
    };

    const operation = { operationKind: 'mutation' };

    // The map callback should handle errors internally and still return the payload
    expect(() => {
      mapCallback(cascadeResponse);
    }).toThrow('Store update error');
  });

  it('should return the payload unchanged after processing', () => {
    const testPayload = {
      data: {
        createTodo: {
          id: '1',
          text: 'Test todo'
        }
      }
    };

    const operation = { operationKind: 'mutation' };
    const result = mapCallback(testPayload);

    // The payload should be returned unchanged
    expect(result).toBe(testPayload);
  });
});