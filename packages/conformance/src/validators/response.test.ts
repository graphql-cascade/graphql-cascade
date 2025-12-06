import { validateResponse } from './response';

describe('validateResponse', () => {
  it('valid complete response passes', () => {
    const response = {
      success: true,
      cascade: {
        updated: [
          { __typename: 'User', id: '1', operation: 'CREATE' }
        ],
        deleted: [
          { __typename: 'Post', id: '2' }
        ],
        invalidations: [
          { queryName: 'getUsers' }
        ],
        metadata: {
          timestamp: Date.now()
        }
      }
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('response missing success fails', () => {
    const response = {
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: Date.now() }
      }
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: 'MISSING_SUCCESS',
      message: 'Response must have success: boolean',
      path: 'success'
    });
  });

  it('response missing cascade fails', () => {
    const response = {
      success: true
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: 'MISSING_CASCADE',
      message: 'Response must have cascade: CascadeUpdates',
      path: 'cascade'
    });
  });

  it('invalid updated entity fails (missing __typename)', () => {
    const response = {
      success: true,
      cascade: {
        updated: [
          { id: '1', operation: 'CREATE' } // missing __typename
        ],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: Date.now() }
      }
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: 'MISSING_TYPENAME',
      message: 'UpdatedEntity must have __typename',
      path: 'cascade.updated[0].__typename'
    });
  });

  it('invalid deleted entity fails (missing id)', () => {
    const response = {
      success: true,
      cascade: {
        updated: [],
        deleted: [
          { __typename: 'Post' } // missing id
        ],
        invalidations: [],
        metadata: { timestamp: Date.now() }
      }
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: 'MISSING_ID',
      message: 'DeletedEntity must have id',
      path: 'cascade.deleted[0].id'
    });
  });

  it('invalid invalidation fails (missing queryName)', () => {
    const response = {
      success: true,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [
          {} // missing queryName
        ],
        metadata: { timestamp: Date.now() }
      }
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: 'MISSING_QUERY_NAME',
      message: 'QueryInvalidation must have queryName',
      path: 'cascade.invalidations[0].queryName'
    });
  });

  it('invalid metadata fails (missing timestamp)', () => {
    const response = {
      success: true,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: {} // missing timestamp
      }
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: 'MISSING_TIMESTAMP',
      message: 'metadata must have timestamp',
      path: 'cascade.metadata.timestamp'
    });
  });

  it('empty cascade arrays are valid', () => {
    const response = {
      success: true,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: Date.now() }
      }
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('error response with success=false is valid', () => {
    const response = {
      success: false,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: Date.now() }
      }
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('strict mode catches additional issues (placeholder)', () => {
    const response = {
      success: true,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: Date.now() }
      }
    };

    const result = validateResponse(response, { strict: true });
    // Placeholder: in strict mode, we might check for additional constraints
    // For now, it passes like normal mode
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});