import { createCascadeRelayEnvironment, createBasicCascadeEnvironment } from './environment';
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
  Environment: jest.fn().mockImplementation(() => ({
    execute: jest.fn(() => mockObservable)
  }))
}));

describe('createCascadeRelayEnvironment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a Relay Environment', () => {
    const { Environment } = require('relay-runtime');
    const environment = createCascadeRelayEnvironment(mockNetwork as any, mockStore as any);
    expect(Environment).toHaveBeenCalled();
  });

  it('should create environment with cascade network wrapper', () => {
    const { Network } = require('relay-runtime');
    const environment = createCascadeRelayEnvironment(mockNetwork as any, mockStore as any);

    // Verify that Network.create was called to wrap the network
    expect(Network.create).toHaveBeenCalled();
  });
});

describe('createBasicCascadeEnvironment', () => {
  it('should create a basic environment with cascade support', () => {
    const { Environment, Network, Store } = require('relay-runtime');
    const fetchFn = jest.fn();

    const environment = createBasicCascadeEnvironment(fetchFn);
    expect(Network.create).toHaveBeenCalledWith(fetchFn);
    expect(Store).toHaveBeenCalled();
    expect(Environment).toHaveBeenCalled();
  });
});

describe('cascade processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log cascade updates when debug is enabled', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const config = { debug: true };

    createCascadeRelayEnvironment(mockNetwork as any, mockStore as any, config);

    // Get the network wrapper function
    const { Network } = require('relay-runtime');
    const networkWrapper = (Network.create as jest.Mock).mock.calls[0][0];

    // Mock the observable map to trigger cascade processing
    mockObservable.map.mockImplementation((fn) => {
      const payload = {
        data: {
          createUser: {
            cascade: {
              updated: [{ __typename: 'User', id: '1', operation: 'CREATED', entity: { name: 'Test' } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx1', depth: 1, affectedCount: 1 }
            }
          }
        }
      };
      fn(payload);
      return mockObservable;
    });

    // Trigger network execution through the wrapper
    const operation = { operationKind: 'mutation' };
    networkWrapper(operation, {});

    expect(consoleLogSpy).toHaveBeenCalledWith('Applied cascade updates:', expect.any(Object));
    consoleLogSpy.mockRestore();
  });

  it('should respect custom config options', () => {
    const config = { debug: false, customOption: 'test' };
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    createCascadeRelayEnvironment(mockNetwork as any, mockStore as any, config);

    // Get the network wrapper function
    const { Network } = require('relay-runtime');
    const networkWrapper = (Network.create as jest.Mock).mock.calls[0][0];

    // Mock the observable map to trigger cascade processing
    mockObservable.map.mockImplementation((fn) => {
      const payload = {
        data: {
          createUser: {
            cascade: {
              updated: [],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: '2023-01-01T00:00:00Z', transactionId: 'tx1', depth: 1, affectedCount: 0 }
            }
          }
        }
      };
      fn(payload);
      return mockObservable;
    });

    // Trigger network execution through the wrapper
    const operation = { operationKind: 'mutation' };
    networkWrapper(operation, {});

    expect(consoleLogSpy).not.toHaveBeenCalled();
    consoleLogSpy.mockRestore();
  });

  it('should handle null cascade data gracefully', () => {
    const config = { debug: true };
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    createCascadeRelayEnvironment(mockNetwork as any, mockStore as any, config);

    // Get the network wrapper function
    const { Network } = require('relay-runtime');
    const networkWrapper = (Network.create as jest.Mock).mock.calls[0][0];

    // Mock the observable map to trigger cascade processing with null cascade
    mockObservable.map.mockImplementation((fn) => {
      const payload = {
        data: {
          createUser: {
            cascade: null
          }
        }
      };
      fn(payload);
      return mockObservable;
    });

    // Trigger network execution through the wrapper
    const operation = { operationKind: 'mutation' };
    networkWrapper(operation, {});

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(mockStore.commitUpdates).not.toHaveBeenCalled();
    consoleLogSpy.mockRestore();
  });
});