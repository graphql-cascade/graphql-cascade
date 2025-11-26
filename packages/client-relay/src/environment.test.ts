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