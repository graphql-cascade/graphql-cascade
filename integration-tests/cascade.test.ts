import {
  CascadeResponse,
  CascadeOperation,
  InvalidationStrategy,
  InvalidationScope
} from '@graphql-cascade/client';

describe('GraphQL Cascade Integration', () => {
  it('should correctly type a CascadeResponse', () => {
    const response: CascadeResponse<{ id: string; name: string }> = {
      success: true,
      data: { id: '1', name: 'Test' },
      cascade: {
        updated: [
          {
            __typename: 'User',
            id: '1',
            operation: CascadeOperation.CREATED,
            entity: { id: '1', name: 'Test' }
          }
        ],
        deleted: [],
        invalidations: [
          {
            queryName: 'getUsers',
            strategy: InvalidationStrategy.REFETCH,
            scope: InvalidationScope.ALL
          }
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          depth: 1,
          affectedCount: 1
        }
      }
    };

    expect(response.success).toBe(true);
    expect(response.data.name).toBe('Test');
    expect(response.cascade.updated).toHaveLength(1);
  });
});