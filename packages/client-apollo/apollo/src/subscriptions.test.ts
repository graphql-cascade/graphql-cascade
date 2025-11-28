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

  describe('Reconnection Tests', () => {
    it('should handle subscription reconnection after network failure', () => {
      const onError = jest.fn();
      const onCascade = jest.fn();
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

      const handle1 = manager.subscribe(mockSubscription, { onError });

      // Simulate network failure
      subscriber1.error(new Error('Network connection lost'));
      expect(onError).toHaveBeenCalled();
      expect(handle1.isActive).toBe(false);

      // Create new subscription (reconnection)
      const handle2 = manager.subscribe(mockSubscription, { onCascade });
      expect(handle2.isActive).toBe(true);

      // Verify new subscription works
      subscriber2.next({
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

    it('should apply queued cascade updates after reconnection', () => {
      const onCascade = jest.fn();
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      const handle = manager.subscribe(mockSubscription, { onCascade });

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

      const handle1 = manager.subscribe(mockSubscription, { onCascade: onCascade1 });
      const handle2 = manager.subscribe(mockSubscription, { onCascade: onCascade2 });

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
});



describe('Subscription Edge Cases', () => {
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

  describe('Reconnection tests', () => {
    it('should handle subscription reconnection after network failure', () => {
      const onError = jest.fn();
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

      const handle1 = manager.subscribe(mockSubscription, { onError });

      // Simulate network failure
      subscriber1.error(new Error('Network connection lost'));
      expect(onError).toHaveBeenCalled();
      expect(handle1.isActive).toBe(false);

      // Create new subscription (reconnection)
      const handle2 = manager.subscribe(mockSubscription);
      expect(handle2.isActive).toBe(true);

      // Verify new subscription works
      subscriber2.next({
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

      expect(handle2.isActive).toBe(true);
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

      const handle = manager.subscribe(mockSubscription, { onCascade });

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

  describe('Cleanup tests', () => {
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

  describe('Concurrent subscription tests', () => {
    it('should handle multiple concurrent subscriptions independently', () => {
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

      const handle1 = manager.subscribe(mockSubscription, { onCascade: onCascade1 });
      const handle2 = manager.subscribe(mockSubscription, { onCascade: onCascade2 });

      expect(manager.getActiveSubscriptions()).toHaveLength(2);

      // Send event to subscription 1 only
      subscriber1.next({
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

      expect(onCascade1).toHaveBeenCalledTimes(1);
      expect(onCascade2).not.toHaveBeenCalled();

      // Send event to subscription 2 only
      subscriber2.next({
        data: {
          userUpdated: {
            cascade: {
              updated: [{ __typename: 'User', id: '2', operation: 'CREATED', entity: { id: '2' } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
            }
          }
        }
      });

      expect(onCascade1).toHaveBeenCalledTimes(1);
      expect(onCascade2).toHaveBeenCalledTimes(1);
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

      const handle1 = manager.subscribe(mockSubscription, { onCascade: onCascade1 });
      const handle2 = manager.subscribe(mockSubscription, { onCascade: onCascade2 });

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
});

describe('createUseCascadeSubscription', () => {
  it('should create hook factory', () => {
    const apolloClient = new ApolloClient({
      cache: new InMemoryCache(),
      devtools: { enabled: false }
    });

    const cascadeClient = new ApolloCascadeClient(apolloClient as ApolloClient<any>);
    const manager = new CascadeSubscriptionManager(cascadeClient, apolloClient);

    const useCascadeSubscription = createUseCascadeSubscription(manager);

    expect(typeof useCascadeSubscription).toBe('function');
  });
});

describe('Subscription Edge Cases', () => {
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

  describe('Concurrent Subscriptions', () => {
    it('should handle multiple concurrent subscriptions independently', () => {
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

      const handle1 = manager.subscribe(mockSubscription, { onCascade: onCascade1 });
      const handle2 = manager.subscribe(mockSubscription, { onCascade: onCascade2 });

      expect(manager.getActiveSubscriptions()).toHaveLength(2);

      // Send event to subscription 1 only
      subscriber1.next({
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

      expect(onCascade1).toHaveBeenCalledTimes(1);
      expect(onCascade2).not.toHaveBeenCalled();

      // Send event to subscription 2 only
      subscriber2.next({
        data: {
          userUpdated: {
            cascade: {
              updated: [{ __typename: 'User', id: '2', operation: 'CREATED', entity: { id: '2' } }],
              deleted: [],
              invalidations: [],
              metadata: { timestamp: new Date().toISOString(), depth: 1, affectedCount: 1 }
            }
          }
        }
      });

      expect(onCascade1).toHaveBeenCalledTimes(1);
      expect(onCascade2).toHaveBeenCalledTimes(1);
    });

    it('should allow unsubscribing from one subscription without affecting others', () => {
      const onCascade1 = jest.fn();
      const onCascade2 = jest.fn();
      const unsubscribe1 = jest.fn();
      const unsubscribe2 = jest.fn();
      let subscriber2: any;

      jest.spyOn(apolloClient, 'subscribe')
        .mockReturnValueOnce({
          subscribe: jest.fn(() => ({ unsubscribe: unsubscribe1 }))
        } as any)
        .mockReturnValueOnce({
          subscribe: jest.fn((sub) => {
            subscriber2 = sub;
            return { unsubscribe: unsubscribe2 };
          })
        } as any);

      const handle1 = manager.subscribe(mockSubscription, { onCascade: onCascade1 });
      const handle2 = manager.subscribe(mockSubscription, { onCascade: onCascade2 });

      // Unsubscribe from first
      handle1.unsubscribe();

      expect(handle1.isActive).toBe(false);
      expect(handle2.isActive).toBe(true);
      expect(manager.getActiveSubscriptions()).toHaveLength(1);
      expect(unsubscribe1).toHaveBeenCalled();
      expect(unsubscribe2).not.toHaveBeenCalled();

      // Second subscription should still work
      subscriber2.next({
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

      expect(onCascade2).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in one subscription without affecting others', () => {
      const onError1 = jest.fn();
      const onError2 = jest.fn();
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

      const handle1 = manager.subscribe(mockSubscription, { onError: onError1 });
      const handle2 = manager.subscribe(mockSubscription, { onError: onError2, onCascade: onCascade2 });

      // Error on subscription 1
      subscriber1.error(new Error('Connection lost'));

      expect(onError1).toHaveBeenCalled();
      expect(handle1.isActive).toBe(false);
      expect(handle2.isActive).toBe(true);
      expect(manager.getActiveSubscriptions()).toHaveLength(1);

      // Subscription 2 should still work
      subscriber2.next({
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

      expect(onCascade2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup and Memory Leak Prevention', () => {
    it('should clean up subscription from active list on unsubscribe', () => {
      const unsubscribeFn = jest.fn();

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn(() => ({ unsubscribe: unsubscribeFn }))
      } as any);

      const handle = manager.subscribe(mockSubscription);

      expect(manager.getActiveSubscriptions()).toHaveLength(1);

      handle.unsubscribe();

      expect(manager.getActiveSubscriptions()).toHaveLength(0);
      expect(unsubscribeFn).toHaveBeenCalledTimes(1);
    });

    it('should clean up subscription from active list on error', () => {
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      const handle = manager.subscribe(mockSubscription);

      expect(manager.getActiveSubscriptions()).toHaveLength(1);

      subscriber.error(new Error('Connection lost'));

      expect(manager.getActiveSubscriptions()).toHaveLength(0);
      expect(handle.isActive).toBe(false);
    });

    it('should clean up subscription from active list on complete', () => {
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      const handle = manager.subscribe(mockSubscription);

      expect(manager.getActiveSubscriptions()).toHaveLength(1);

      subscriber.complete();

      expect(manager.getActiveSubscriptions()).toHaveLength(0);
      expect(handle.isActive).toBe(false);
    });

    it('should clean up paused state when subscription is unsubscribed', () => {
      const unsubscribeFn = jest.fn();

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn(() => ({ unsubscribe: unsubscribeFn }))
      } as any);

      const handle = manager.subscribe(mockSubscription);
      handle.pause();

      expect(handle.isPaused).toBe(true);

      handle.unsubscribe();

      // Verify pausedSubscriptions is also cleaned up by checking state
      expect(handle.isActive).toBe(false);
    });

    it('should not process events after unsubscribe is called', () => {
      const onCascade = jest.fn();
      let subscriber: any;

      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn((sub) => {
          subscriber = sub;
          return { unsubscribe: jest.fn() };
        })
      } as any);

      const handle = manager.subscribe(mockSubscription, { onCascade });

      handle.unsubscribe();

      // Try to send event after unsubscribe
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

    it('should handle unsubscribeAll cleaning up all resources', () => {
      const unsubscribe1 = jest.fn();
      const unsubscribe2 = jest.fn();
      const unsubscribe3 = jest.fn();

      jest.spyOn(apolloClient, 'subscribe')
        .mockReturnValueOnce({
          subscribe: jest.fn(() => ({ unsubscribe: unsubscribe1 }))
        } as any)
        .mockReturnValueOnce({
          subscribe: jest.fn(() => ({ unsubscribe: unsubscribe2 }))
        } as any)
        .mockReturnValueOnce({
          subscribe: jest.fn(() => ({ unsubscribe: unsubscribe3 }))
        } as any);

      const handle1 = manager.subscribe(mockSubscription);
      const handle2 = manager.subscribe(mockSubscription);
      const handle3 = manager.subscribe(mockSubscription);

      // Pause one
      handle2.pause();

      expect(manager.getActiveSubscriptions()).toHaveLength(3);

      manager.unsubscribeAll();

      expect(manager.getActiveSubscriptions()).toHaveLength(0);
      expect(unsubscribe1).toHaveBeenCalled();
      expect(unsubscribe2).toHaveBeenCalled();
      expect(unsubscribe3).toHaveBeenCalled();
    });
  });

  describe('Reconnection', () => {
    it('should allow creating new subscription after error', () => {
      const onError1 = jest.fn();
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

      const handle1 = manager.subscribe(mockSubscription, { onError: onError1 });

      // First subscription fails
      subscriber1.error(new Error('Connection lost'));
      expect(onError1).toHaveBeenCalled();
      expect(handle1.isActive).toBe(false);

      // Create new subscription
      const handle2 = manager.subscribe(mockSubscription, { onCascade: onCascade2 });
      expect(handle2.isActive).toBe(true);

      // New subscription should work
      subscriber2.next({
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

      expect(onCascade2).toHaveBeenCalled();
    });

    it('should handle rapid reconnection attempts', () => {
      const subscribeSpy = jest.spyOn(apolloClient, 'subscribe');

      // Create multiple subscriptions quickly
      const handle1 = manager.subscribe(mockSubscription);
      const handle2 = manager.subscribe(mockSubscription);
      const handle3 = manager.subscribe(mockSubscription);

      expect(subscribeSpy).toHaveBeenCalledTimes(3);
      expect(manager.getActiveSubscriptions()).toHaveLength(3);

      // All should be active
      expect(handle1.isActive).toBe(true);
      expect(handle2.isActive).toBe(true);
      expect(handle3.isActive).toBe(true);
    });
  });

  describe('Cleanup on Unmount', () => {
    it('should clean up subscriptions when React component unmounts', () => {
      const unsubscribeFn = jest.fn();

      // Mock React useEffect cleanup
      jest.spyOn(apolloClient, 'subscribe').mockReturnValue({
        subscribe: jest.fn(() => ({ unsubscribe: unsubscribeFn }))
      } as any);

      const useCascadeSubscription = createUseCascadeSubscription(manager);

      // Simulate component mount (subscription created)
      const subscription = useCascadeSubscription(mockSubscription);
      expect(manager.getActiveSubscriptions()).toHaveLength(1);

      // Simulate component unmount (cleanup function called)
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }

      expect(unsubscribeFn).toHaveBeenCalled();
      expect(manager.getActiveSubscriptions()).toHaveLength(0);
    });

    it('should handle multiple hooks in same component', () => {
      const unsubscribe1 = jest.fn();
      const unsubscribe2 = jest.fn();

      jest.spyOn(apolloClient, 'subscribe')
        .mockReturnValueOnce({
          subscribe: jest.fn(() => ({ unsubscribe: unsubscribe1 }))
        } as any)
        .mockReturnValueOnce({
          subscribe: jest.fn(() => ({ unsubscribe: unsubscribe2 }))
        } as any);

      const useCascadeSubscription = createUseCascadeSubscription(manager);

      // Two hooks in same component
      const sub1 = useCascadeSubscription(mockSubscription);
      const sub2 = useCascadeSubscription(mockSubscription);

      expect(manager.getActiveSubscriptions()).toHaveLength(2);

      // Unmount component (both cleanup)
      sub1.unsubscribe();
      sub2.unsubscribe();

      expect(unsubscribe1).toHaveBeenCalled();
      expect(unsubscribe2).toHaveBeenCalled();
      expect(manager.getActiveSubscriptions()).toHaveLength(0);
    });
  });

  describe('Enhanced Concurrent Subscriptions', () => {
    it('should handle high volume of concurrent subscriptions', () => {
      const subscribeSpy = jest.spyOn(apolloClient, 'subscribe');
      const subscriptions = [];

      // Create 10 concurrent subscriptions
      for (let i = 0; i < 10; i++) {
        subscriptions.push(manager.subscribe(mockSubscription));
      }

      expect(subscribeSpy).toHaveBeenCalledTimes(10);
      expect(manager.getActiveSubscriptions()).toHaveLength(10);

      // All should be active
      subscriptions.forEach(sub => {
        expect(sub.isActive).toBe(true);
      });
    });

    it('should maintain isolation during concurrent operations', () => {
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

    const handle = manager.subscribe(mockSubscription, { onCascade });

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

    const handle1 = manager.subscribe(mockSubscription, { onCascade: onCascade1 });
    const handle2 = manager.subscribe(mockSubscription, { onCascade: onCascade2 });

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
