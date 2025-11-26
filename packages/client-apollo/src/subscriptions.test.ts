import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { CascadeOperation, InvalidationStrategy, InvalidationScope } from '@graphql-cascade/client';
import { ApolloCascadeClient } from './client';
import {
  CascadeSubscriptionManager,
  CascadeSubscriptionEvent,
  createUseCascadeSubscription
} from './subscriptions';

// Mock subscription
const mockSubscription = gql`
  subscription OnUserUpdated {
    userUpdated {
      id
      name
    }
  }
`;

describe('CascadeSubscriptionManager', () => {
  let apolloClient: ApolloClient<unknown>;
  let cascadeClient: ApolloCascadeClient;
  let manager: CascadeSubscriptionManager;

  beforeEach(() => {
    apolloClient = new ApolloClient({
      cache: new InMemoryCache(),
      connectToDevTools: false
    });

    cascadeClient = new ApolloCascadeClient(apolloClient as ApolloClient<any>);
    manager = new CascadeSubscriptionManager(cascadeClient, apolloClient);
  });

  afterEach(() => {
    manager.unsubscribeAll();
  });

  describe('subscribe', () => {
    it('should create subscription handle', () => {
      // Mock the subscribe method
      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn(() => ({
          unsubscribe: jest.fn()
        }))
      } as any);

      const handle = manager.subscribe(mockSubscription);

      expect(handle).toBeDefined();
      expect(handle.isActive).toBe(true);
      expect(handle.isPaused).toBe(false);
      expect(typeof handle.unsubscribe).toBe('function');
      expect(typeof handle.pause).toBe('function');
      expect(typeof handle.resume).toBe('function');
    });

    it('should call onCascade callback when cascade data received', () => {
      const onCascade = jest.fn();
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      manager.subscribe(mockSubscription, { onCascade });

      // Simulate receiving cascade data
      subscriber.next({
        data: {
          userUpdated: {
            cascade: {
              updated: [{ __typename: 'User', id: '1', operation: 'UPDATED', entity: { id: '1' } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
            }
          }
        }
      });

      expect(onCascade).toHaveBeenCalled();
    });

    it('should call onError callback on subscription error', () => {
      const onError = jest.fn();
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      manager.subscribe(mockSubscription, { onError });

      // Simulate error
      subscriber.error(new Error('Connection failed'));

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call onComplete callback when subscription completes', () => {
      const onComplete = jest.fn();
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      const handle = manager.subscribe(mockSubscription, { onComplete });

      // Simulate completion
      subscriber.complete();

      expect(onComplete).toHaveBeenCalled();
      expect(handle.isActive).toBe(false);
    });

    it('should apply filter to cascade events', () => {
      const onCascade = jest.fn();
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      manager.subscribe(mockSubscription, {
        onCascade,
        filter: (event) => event.type === 'ENTITY_DELETED'
      });

      // Send update event (should be filtered out)
      subscriber.next({
        data: {
          userUpdated: {
            cascade: {
              updated: [{ __typename: 'User', id: '1', operation: 'UPDATED', entity: { id: '1' } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
            }
          }
        }
      });

      expect(onCascade).not.toHaveBeenCalled();
    });

    it('should not process events when paused', () => {
      const onCascade = jest.fn();
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      const handle = manager.subscribe(mockSubscription, { onCascade });

      // Pause
      handle.pause();
      expect(handle.isPaused).toBe(true);

      // Send event (should be ignored)
      subscriber.next({
        data: {
          userUpdated: {
            cascade: {
              updated: [{ __typename: 'User', id: '1', operation: 'UPDATED', entity: { id: '1' } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
            }
          }
        }
      });

      expect(onCascade).not.toHaveBeenCalled();

      // Resume and send again
      handle.resume();
      expect(handle.isPaused).toBe(false);

      subscriber.next({
        data: {
          userUpdated: {
            cascade: {
              updated: [{ __typename: 'User', id: '1', operation: 'UPDATED', entity: { id: '1' } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
            }
          }
        }
      });

      expect(onCascade).toHaveBeenCalled();
    });

    it('should auto-apply cascade updates when autoApply is true', () => {
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      const applyCascadeSpy = jest.spyOn(cascadeClient, 'applyCascade');

      manager.subscribe(mockSubscription, { autoApply: true });

      subscriber.next({
        data: {
          userUpdated: {
            cascade: {
              updated: [{ __typename: 'User', id: '1', operation: 'UPDATED', entity: { id: '1' } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
            }
          }
        }
      });

      expect(applyCascadeSpy).toHaveBeenCalled();
    });
  });

  describe('subscribeToEntity', () => {
    it('should filter by typename', () => {
      const onCascade = jest.fn();
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      manager.subscribeToEntity('User', mockSubscription, { onCascade });

      // Send User update (should pass)
      subscriber.next({
        data: {
          userUpdated: {
            cascade: {
              updated: [{ __typename: 'User', id: '1', operation: 'UPDATED', entity: { id: '1' } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
            }
          }
        }
      });

      expect(onCascade).toHaveBeenCalledTimes(1);

      // Send Post update (should be filtered)
      subscriber.next({
        data: {
          postUpdated: {
            cascade: {
              updated: [{ __typename: 'Post', id: '1', operation: 'UPDATED', entity: { id: '1' } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
            }
          }
        }
      });

      expect(onCascade).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('subscribeToEntityById', () => {
    it('should filter by typename and id', () => {
      const onCascade = jest.fn();
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      manager.subscribeToEntityById('User', '1', mockSubscription, { onCascade });

      // Send matching update
      subscriber.next({
        data: {
          userUpdated: {
            cascade: {
              updated: [{ __typename: 'User', id: '1', operation: 'UPDATED', entity: { id: '1' } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
            }
          }
        }
      });

      expect(onCascade).toHaveBeenCalledTimes(1);

      // Send different ID (should be filtered)
      subscriber.next({
        data: {
          userUpdated: {
            cascade: {
              updated: [{ __typename: 'User', id: '2', operation: 'UPDATED', entity: { id: '2' } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
            }
          }
        }
      });

      expect(onCascade).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('getActiveSubscriptions', () => {
    it('should return list of active subscription IDs', () => {
      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn(() => ({
          unsubscribe: jest.fn()
        }))
      } as any);

      manager.subscribe(mockSubscription);
      manager.subscribe(mockSubscription);

      const active = manager.getActiveSubscriptions();

      expect(active).toHaveLength(2);
    });
  });

  describe('unsubscribeAll', () => {
    it('should unsubscribe from all active subscriptions', () => {
      const unsubscribeFn = jest.fn();

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn(() => ({
          unsubscribe: unsubscribeFn
        }))
      } as any);

      manager.subscribe(mockSubscription);
      manager.subscribe(mockSubscription);

      expect(manager.getActiveSubscriptions()).toHaveLength(2);

      manager.unsubscribeAll();

      expect(manager.getActiveSubscriptions()).toHaveLength(0);
      expect(unsubscribeFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('pauseAll / resumeAll', () => {
    it('should pause and resume all subscriptions', () => {
      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn(() => ({
          unsubscribe: jest.fn()
        }))
      } as any);

      const handle1 = manager.subscribe(mockSubscription);
      const handle2 = manager.subscribe(mockSubscription);

      manager.pauseAll();

      expect(handle1.isPaused).toBe(true);
      expect(handle2.isPaused).toBe(true);

      manager.resumeAll();

      expect(handle1.isPaused).toBe(false);
      expect(handle2.isPaused).toBe(false);
    });
  });

  describe('handle.unsubscribe', () => {
    it('should mark subscription as inactive', () => {
      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn(() => ({
          unsubscribe: jest.fn()
        }))
      } as any);

      const handle = manager.subscribe(mockSubscription);

      expect(handle.isActive).toBe(true);

      handle.unsubscribe();

      expect(handle.isActive).toBe(false);
    });
  });
});

describe('createUseCascadeSubscription', () => {
  it('should create hook factory', () => {
    const apolloClient = new ApolloClient({
      cache: new InMemoryCache(),
      connectToDevTools: false
    });

    const cascadeClient = new ApolloCascadeClient(apolloClient as ApolloClient<any>);
    const manager = new CascadeSubscriptionManager(cascadeClient, apolloClient);

    const useCascadeSubscription = createUseCascadeSubscription(manager);

    expect(typeof useCascadeSubscription).toBe('function');
  });
});
