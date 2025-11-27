import { runClientBasicTests, CascadeCache, CascadeEntity } from './basic';
import { ClientConformanceOptions } from '../types';

describe('runClientBasicTests', () => {
  let mockCache: jest.Mocked<CascadeCache>;
  let options: ClientConformanceOptions;

  beforeEach(() => {
    // Create mock cache
    const cacheData: Record<string, CascadeEntity & { _stale?: boolean }> = {};

    mockCache = {
      write: jest.fn((entity: CascadeEntity) => {
        if ((mockCache as any)._shouldFailWrite) {
          (mockCache as any)._errorsLogged = true;
          throw new Error('Write failed');
        }
        if (!entity.__typename || !entity.id) {
          throw new Error('Malformed entity');
        }
        const key = `${entity.__typename}:${entity.id}`;
        cacheData[key] = { ...entity };
      }),
      read: jest.fn((key: string) => {
        return cacheData[key] || null;
      }),
      evict: jest.fn((key: string) => {
        if ((mockCache as any)._shouldFailEvict) {
          (mockCache as any)._errorsLogged = true;
          throw new Error('Evict failed');
        }
        delete cacheData[key];
      }),
      identify: jest.fn((entity: CascadeEntity) => {
        return `${entity.__typename}:${entity.id}`;
      }),
      invalidate: jest.fn((key: string) => {
        if (cacheData[key]) {
          cacheData[key]._stale = true;
        }
      }),
      refetch: jest.fn((key: string) => {
        (mockCache as any)._refetchTriggered = true;
      }),
      remove: jest.fn((key: string) => {
        delete cacheData[key];
      }),
      applyCreated: jest.fn((entity: CascadeEntity) => {
        mockCache.write(entity);
      }),
      applyUpdated: jest.fn((entity: CascadeEntity) => {
        mockCache.write(entity);
      }),
      applyDeleted: jest.fn((key: string) => {
        mockCache.evict(key);
      }),
      applyInvalidate: jest.fn((key: string) => {
        mockCache.invalidate(key);
      }),
      applyRefetch: jest.fn((key: string) => {
        mockCache.refetch(key);
      }),
      applyRemove: jest.fn((key: string) => {
        mockCache.remove(key);
      }),
    } as jest.Mocked<CascadeCache>;

    // Add private properties for testing
    (mockCache as any)._refetchTriggered = false;
    (mockCache as any)._errorsLogged = false;
    (mockCache as any)._shouldFailWrite = false;
    (mockCache as any)._shouldFailEvict = false;

    options = {
      createClient: () => mockCache,
      level: 'basic',
    };
  });

  it('should return three test categories', async () => {
    const result = await runClientBasicTests(options);

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Cache Interface');
    expect(result[0].level).toBe('basic');
    expect(result[1].name).toBe('Cascade Application');
    expect(result[1].level).toBe('basic');
    expect(result[2].name).toBe('Error Handling');
    expect(result[2].level).toBe('basic');
  });

  it('should have 10 Cache Interface tests', async () => {
    const result = await runClientBasicTests(options);

    expect(result[0].tests).toHaveLength(10);
  });

  it('should have 10 Cascade Application tests', async () => {
    const result = await runClientBasicTests(options);

    expect(result[1].tests).toHaveLength(10);
  });

  it('should have 6 Error Handling tests', async () => {
    const result = await runClientBasicTests(options);

    expect(result[2].tests).toHaveLength(6);
  });

  it('should pass all Cache Interface tests', async () => {
    const result = await runClientBasicTests(options);

    result[0].tests.forEach(test => {
      expect(test.passed).toBe(true);
    });
  });

  it('should pass all Cascade Application tests', async () => {
    const result = await runClientBasicTests(options);

    result[1].tests.forEach(test => {
      expect(test.passed).toBe(true);
    });
  });

  it('should pass all Error Handling tests', async () => {
    const result = await runClientBasicTests(options);

    result[2].tests.forEach(test => {
      expect(test.passed).toBe(true);
    });
  });

  it('should have correct test names for Cache Interface', async () => {
    const result = await runClientBasicTests(options);
    const expectedNames = [
      'write() stores data',
      'read() retrieves data',
      'read() returns null for missing',
      'evict() removes entity',
      'identify() returns key',
      'invalidate() marks stale',
      'refetch() triggers re-query',
      'remove() deletes data',
      'Multiple entities written',
      'Type isolation',
    ];

    result[0].tests.forEach((test, index) => {
      expect(test.name).toBe(expectedNames[index]);
    });
  });

  it('should have correct test names for Cascade Application', async () => {
    const result = await runClientBasicTests(options);
    const expectedNames = [
      'Updated entities written',
      'Deleted entities evicted',
      'CREATED writes new',
      'UPDATED updates existing',
      'DELETED evicts',
      'Invalidations processed',
      'INVALIDATE marks stale',  // Matches implementation
      'REFETCH triggers query',
      'REMOVE deletes data',
      'Processing order correct',
    ];

    result[1].tests.forEach((test, index) => {
      expect(test.name).toBe(expectedNames[index]);
    });
  });

  it('should have correct test names for Error Handling', async () => {
    const result = await runClientBasicTests(options);
    const expectedNames = [
      'Write failure doesn\'t stop',
      'Evict failure doesn\'t stop',
      'Errors logged',
      'Malformed data handled',
      'Missing __typename handled',
      'Missing id handled',
    ];

    result[2].tests.forEach((test, index) => {
      expect(test.name).toBe(expectedNames[index]);
    });
  });
});