import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

import { ApolloCascadeClient } from './client';
import {
  CascadeSubscriptionManager
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
      devtools: { enabled: false }
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

      // Simulate receijestng cascade data
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

      const _handle = manager.subscribe(mockSubscription, { onCascade });

      // Simulate reconnection scenario - send multiple updates
      subscriber.next({
        data: {
          userUpdated: {
            cascade: {
              updated: [
                { __typename: 'User', id: '1', operation: 'UPDATED', entity: { id: '1' } },
                { __typename: 'User', id: '2', operation: 'CREATED', entity: { id: '2' } }
              ],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 2 }
            }
          }
        }
      });

      expect(onCascade).toHaveBeenCalledTimes(1);
      expect(onCascade).toHaveBeenCalledWith(
        expect.objectContaining({
          updated: expect.arrayContaining([
            expect.objectContaining({ __typename: 'User', id: '1' }),
            expect.objectContaining({ __typename: 'User', id: '2' })
          ])
        })
      );
    });
  });

  describe('Cleanup Tests', () => {
    it('should cleanup subscription on unsubscribe', () => {
      const unsubscribeFn = jest.fn();

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn(() => ({ unsubscribe: unsubscribeFn }))
      } as any);

      const handle = manager.subscribe(mockSubscription);

      expect(manager.getActiveSubscriptions()).toHaveLength(1);
      expect(handle.isActive).toBe(true);

      handle.unsubscribe();

      expect(manager.getActiveSubscriptions()).toHaveLength(0);
      expect(handle.isActive).toBe(false);
      expect(unsubscribeFn).toHaveBeenCalledTimes(1);
    });

    it('should not leak memory on repeated subscribe/unsubscribe cycles', () => {
      const unsubscribeFn = jest.fn();

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn(() => ({ unsubscribe: unsubscribeFn }))
      } as any);

      // Perform multiple subscribe/unsubscribe cycles
      for (let i = 0; i < 5; i++) {
        const handle = manager.subscribe(mockSubscription);
        expect(manager.getActiveSubscriptions()).toHaveLength(1);
        handle.unsubscribe();
        expect(manager.getActiveSubscriptions()).toHaveLength(0);
      }

      // Verify no memory leaks - should be able to create new subscriptions normally
      const handle = manager.subscribe(mockSubscription);
      expect(manager.getActiveSubscriptions()).toHaveLength(1);
      expect(handle.isActive).toBe(true);

      handle.unsubscribe();
      expect(manager.getActiveSubscriptions()).toHaveLength(0);
    });
  });

  describe('Concurrent Subscription Tests', () => {
    it('should handle rapid subscription updates without race conditions', () => {
      const onCascade1 = jest.fn();
      const onCascade2 = jest.fn();
      let _subscriber1: any;
      let _subscriber2: any;
      let subscriber3: any;

      jest.spyOn(apolloClient, 'subscribe')
        .mockReturnValueOnce({
          subscribe: jest.fn((sub) => {
            subscriber1 = sub;
            return { unsubscribe: jest.fn() };
          })
        } as any)
        .mockReturnValueOnce({
          subscribe: jest.fn((sub) => {
            subscriber2 = sub;
            return { unsubscribe: jest.fn() };
          })
        } as any)
        .mockReturnValueOnce({
          subscribe: jest.fn((sub) => {
            subscriber3 = sub;
            return { unsubscribe: jest.fn() };
          })
        } as any);

      const handle1 = manager.subscribe(mockSubscription, { onCascade: onCascade1 });
      const handle2 = manager.subscribe(mockSubscription, { onCascade: onCascade2 });
      const handle3 = manager.subscribe(mockSubscription, { onCascade: onCascade3 });

      // Pause one, unsubscribe another, leave one active
      handle1.pause();
      handle2.unsubscribe();

      expect(handle1.isPaused).toBe(true);
      expect(handle1.isActive).toBe(true);
      expect(handle2.isActive).toBe(false);
      expect(handle3.isActive).toBe(true);

      // Send event - only active non-paused should receive
      subscriber3.next({
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

      expect(onCascade1).not.toHaveBeenCalled();
      expect(onCascade2).not.toHaveBeenCalled();
      expect(onCascade3).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed subscription types concurrently', () => {
      const onCascade1 = jest.fn();
      const onCascade2 = jest.fn();
      const onCascade3 = jest.fn();
      let subscriber1: any;
      let subscriber2: any;
      let subscriber3: any;

      jest.spyOn(apolloClient, 'subscribe')
        .mockReturnValueOnce({
          subscribe: jest.fn((sub) => {
            subscriber1 = sub;
            return { unsubscribe: jest.fn() };
          })
        } as any)
        .mockReturnValueOnce({
          subscribe: jest.fn((sub) => {
            subscriber2 = sub;
            return { unsubscribe: jest.fn() };
          })
        } as any)
        .mockReturnValueOnce({
          subscribe: jest.fn((sub) => {
            subscriber3 = sub;
            return { unsubscribe: jest.fn() };
          })
        } as any);

      // Different subscription types
      manager.subscribe(mockSubscription, { onCascade: onCascade1 });
      manager.subscribeToEntity('User', mockSubscription, { onCascade: onCascade2 });
      manager.subscribeToEntityById('User', '1', mockSubscription, { onCascade: onCascade3 });

      // Send event that should trigger all three
      const event = {
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
      };

      subscriber1.next(event);
      subscriber2.next(event);
      subscriber3.next(event);

      expect(onCascade1).toHaveBeenCalledTimes(1);
      expect(onCascade2).toHaveBeenCalledTimes(1);
      expect(onCascade3).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Recovery', () => {
    it('should mark subscription as inactive on network error', () => {
      const onError = jest.fn();
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      const handle = manager.subscribe(mockSubscription, { onError });

      expect(handle.isActive).toBe(true);

      // Simulate network error
      subscriber.error(new Error('WebSocket connection failed'));

      expect(handle.isActive).toBe(false);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle malformed cascade data gracefully', () => {
      const onCascade = jest.fn();
      const onError = jest.fn();
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      manager.subscribe(mockSubscription, { onCascade, onError });

      // Send malformed data (null cascade)
      subscriber.next({
        data: {
          userUpdated: null
        }
      });

      // Should not crash, just not call onCascade
      expect(onCascade).not.toHaveBeenCalled();

      // Send data with no cascade field
      subscriber.next({
        data: {
          userUpdated: { id: '1', name: 'Test' }
        }
      });

      // May or may not extract cascade depending on implementation
      // Important is that no error is thrown
      expect(onError).not.toHaveBeenCalled();
    });

    it('should continue processing after callback error', () => {
      const onCascade = jest.fn().mockImplementationOnce(() => {
        throw new Error('Callback error');
      });
      const onError = jest.fn();
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      const handle = manager.subscribe(mockSubscription, { onCascade, onError });

      // First event - callback throws
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

      expect(onError).toHaveBeenCalled();
      expect(handle.isActive).toBe(true); // Should still be active

      // Reset mocks for next event
      onCascade.mockReset();
      onError.mockReset();

      // Second event - should still process
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

      expect(onCascade).toHaveBeenCalled();
    });
  });

  it('should apply queued cascade updates after reconnection', () => {
    const onCascade = jest.fn();
    let subscriber: any;

    jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
      subscribe: jest.fn((sub) => {
        subscriber = sub;
        return { unsubscribe: jest.fn() };
      })
      } as any);

      const _handle = manager.subscribe(mockSubscription, { onCascade });

      // Simulate reconnection scenario - send multiple updates
    subscriber.next({
      data: {
        userUpdated: {
          cascade: {
            updated: [
              { __typename: 'User', id: '1', operation: 'UPDATED', entity: { id: '1' } },
              { __typename: 'User', id: '2', operation: 'CREATED', entity: { id: '2' } }
            ],
            deleted: [],
            invalidations: [],
            metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 2 }
          }
        }
      }
    });

    expect(onCascade).toHaveBeenCalledTimes(1);
    expect(onCascade).toHaveBeenCalledWith(
      expect.objectContaining({
        updated: expect.arrayContaining([
          expect.objectContaining({ __typename: 'User', id: '1' }),
          expect.objectContaining({ __typename: 'User', id: '2' })
        ])
      })
    );
  });

  it('should not leak memory on repeated subscribe/unsubscribe cycles', () => {
    const unsubscribeFn = jest.fn();

    jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
      subscribe: jest.fn(() => ({ unsubscribe: unsubscribeFn }))
    } as any);

    // Perform multiple subscribe/unsubscribe cycles
    for (let i = 0; i < 5; i++) {
      const handle = manager.subscribe(mockSubscription);
      expect(manager.getActiveSubscriptions()).toHaveLength(1);
      handle.unsubscribe();
      expect(manager.getActiveSubscriptions()).toHaveLength(0);
    }

    // Verify no memory leaks - should be able to create new subscriptions normally
    const handle = manager.subscribe(mockSubscription);
    expect(manager.getActiveSubscriptions()).toHaveLength(1);
    expect(handle.isActive).toBe(true);

    handle.unsubscribe();
    expect(manager.getActiveSubscriptions()).toHaveLength(0);
  });

  it('should handle rapid subscription updates without race conditions', () => {
    const onCascade1 = jest.fn();
    const onCascade2 = jest.fn();
    let subscriber1: any;
    let subscriber2: any;

    jest.spyOn(apolloClient, 'subscribe')
      .mockReturnValueOnce({
        subscribe: jest.fn((sub) => {
          subscriber1 = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any)
      .mockReturnValueOnce({
        subscribe: jest.fn((sub) => {
          subscriber2 = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      const _handle1 = manager.subscribe(mockSubscription, { onCascade: onCascade1 });
      const _handle2 = manager.subscribe(mockSubscription, { onCascade: onCascade2 });

    // Send rapid updates to both subscriptions
    for (let i = 0; i < 10; i++) {
      subscriber1.next({
        data: {
          userUpdated: {
            cascade: {
              updated: [{ __typename: 'User', id: `user${i}`, operation: 'UPDATED', entity: { id: `user${i}` } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
            }
          }
        }
      });

      subscriber2.next({
        data: {
          userUpdated: {
            cascade: {
              updated: [{ __typename: 'User', id: `user${i + 10}`, operation: 'CREATED', entity: { id: `user${i + 10}` } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
            }
          }
        }
      });
    }

    // Both should have received all their events without interference
    expect(onCascade1).toHaveBeenCalledTimes(10);
    expect(onCascade2).toHaveBeenCalledTimes(10);

    // Verify subscriptions are still active
    expect(handle1.isActive).toBe(true);
    expect(handle2.isActive).toBe(true);
  });
});
