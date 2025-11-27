import { TestCategory, TestResult, ClientConformanceOptions } from '../types';

/**
 * Basic entity interface for Cascade
 */
export interface CascadeEntity {
  __typename: string;
  id: string;
  [key: string]: any;
}

/**
 * Mock CascadeCache interface for basic conformance testing
 */
export interface CascadeCache {
  write(entity: CascadeEntity): void;
  read(key: string): CascadeEntity | null;
  evict(key: string): void;
  identify(entity: CascadeEntity): string;
  invalidate(key: string): void;
  refetch(key: string): void;
  remove(key: string): void;

  // Cascade operations
  applyCreated(entity: CascadeEntity): void;
  applyUpdated(entity: CascadeEntity): void;
  applyDeleted(key: string): void;
  applyInvalidate(key: string): void;
  applyRefetch(key: string): void;
  applyRemove(key: string): void;
}

/**
 * Run basic client conformance tests
 */
export async function runClientBasicTests(options: ClientConformanceOptions): Promise<TestCategory[]> {
  const cache = options.createClient() as CascadeCache;

  const cacheInterfaceTests: TestResult[] = [
    testWriteStoresData(cache),
    testReadRetrievesData(cache),
    testReadReturnsNullForMissing(cache),
    testEvictRemovesEntity(cache),
    testIdentifyReturnsKey(cache),
    testInvalidateMarksStale(cache),
    testRefetchTriggersRequery(cache),
    testRemoveDeletesData(cache),
    testMultipleEntitiesWritten(cache),
    testTypeIsolation(cache),
  ];

  const cascadeApplicationTests: TestResult[] = [
    testUpdatedEntitiesWritten(cache),
    testDeletedEntitiesEvicted(cache),
    testCreatedWritesNew(cache),
    testUpdatedUpdatesExisting(cache),
    testDeletedEvicts(cache),
    testInvalidationsProcessed(cache),
    testCascadeInvalidateMarksStale(cache),
    testRefetchTriggersQuery(cache),
    testCascadeRemoveDeletesData(cache),
    testProcessingOrderCorrect(cache),
  ];

  const errorHandlingTests: TestResult[] = [
    testWriteFailureDoesntStop(cache),
    testEvictFailureDoesntStop(cache),
    testErrorsLogged(cache),
    testMalformedDataHandled(cache),
    testMissingTypenameHandled(cache),
    testMissingIdHandled(cache),
  ];

  return [
    {
      name: 'Cache Interface',
      level: 'basic',
      tests: cacheInterfaceTests,
    },
    {
      name: 'Cascade Application',
      level: 'basic',
      tests: cascadeApplicationTests,
    },
    {
      name: 'Error Handling',
      level: 'basic',
      tests: errorHandlingTests,
    },
  ];
}

// Cache Interface Tests
function testWriteStoresData(cache: CascadeCache): TestResult {
  try {
    const entity: CascadeEntity = { __typename: 'User', id: '1', name: 'John' };
    cache.write(entity);
    const readEntity = cache.read('User:1');
    const passed = readEntity !== null && readEntity.name === 'John';
    return {
      name: 'write() stores data',
      passed,
      message: passed ? undefined : 'Entity not stored correctly',
      expected: entity,
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'write() stores data',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testReadRetrievesData(cache: CascadeCache): TestResult {
  try {
    const entity: CascadeEntity = { __typename: 'User', id: '2', name: 'Jane' };
    cache.write(entity);
    const readEntity = cache.read('User:2');
    const passed = readEntity !== null && readEntity.name === 'Jane';
    return {
      name: 'read() retrieves data',
      passed,
      message: passed ? undefined : 'Entity not retrieved correctly',
      expected: entity,
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'read() retrieves data',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testReadReturnsNullForMissing(cache: CascadeCache): TestResult {
  try {
    const readEntity = cache.read('User:nonexistent');
    const passed = readEntity === null;
    return {
      name: 'read() returns null for missing',
      passed,
      message: passed ? undefined : 'Should return null for missing entity',
      expected: null,
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'read() returns null for missing',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testEvictRemovesEntity(cache: CascadeCache): TestResult {
  try {
    const entity: CascadeEntity = { __typename: 'User', id: '3', name: 'Bob' };
    cache.write(entity);
    cache.evict('User:3');
    const readEntity = cache.read('User:3');
    const passed = readEntity === null;
    return {
      name: 'evict() removes entity',
      passed,
      message: passed ? undefined : 'Entity not evicted',
      expected: null,
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'evict() removes entity',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testIdentifyReturnsKey(cache: CascadeCache): TestResult {
  try {
    const entity: CascadeEntity = { __typename: 'User', id: '4', name: 'Alice' };
    const key = cache.identify(entity);
    const passed = key === 'User:4';
    return {
      name: 'identify() returns key',
      passed,
      message: passed ? undefined : 'Key format incorrect',
      expected: 'User:4',
      actual: key,
    };
  } catch (error) {
    return {
      name: 'identify() returns key',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testInvalidateMarksStale(cache: CascadeCache): TestResult {
  try {
    const entity: CascadeEntity = { __typename: 'User', id: '5', name: 'Charlie' };
    cache.write(entity);
    cache.invalidate('User:5');
    const readEntity = cache.read('User:5');
    // Assume stale entities have _stale flag
    const passed = readEntity !== null && (readEntity as any)._stale === true;
    return {
      name: 'invalidate() marks stale',
      passed,
      message: passed ? undefined : 'Entity not marked as stale',
      expected: { ...entity, _stale: true },
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'invalidate() marks stale',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testRefetchTriggersRequery(cache: CascadeCache): TestResult {
  try {
    cache.refetch('User:6');
    // Assume refetch sets a flag
    const passed = (cache as any)._refetchTriggered === true;
    return {
      name: 'refetch() triggers re-query',
      passed,
      message: passed ? undefined : 'Refetch not triggered',
      expected: true,
      actual: (cache as any)._refetchTriggered,
    };
  } catch (error) {
    return {
      name: 'refetch() triggers re-query',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testRemoveDeletesData(cache: CascadeCache): TestResult {
  try {
    const entity: CascadeEntity = { __typename: 'User', id: '7', name: 'David' };
    cache.write(entity);
    cache.remove('User:7');
    const readEntity = cache.read('User:7');
    const passed = readEntity === null;
    return {
      name: 'remove() deletes data',
      passed,
      message: passed ? undefined : 'Entity not removed',
      expected: null,
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'remove() deletes data',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testMultipleEntitiesWritten(cache: CascadeCache): TestResult {
  try {
    const entity1: CascadeEntity = { __typename: 'User', id: '8', name: 'Eve' };
    const entity2: CascadeEntity = { __typename: 'User', id: '9', name: 'Frank' };
    cache.write(entity1);
    cache.write(entity2);
    const read1 = cache.read('User:8');
    const read2 = cache.read('User:9');
    const passed = read1 !== null && read2 !== null && read1.name === 'Eve' && read2.name === 'Frank';
    return {
      name: 'Multiple entities written',
      passed,
      message: passed ? undefined : 'Multiple entities not stored correctly',
      expected: [entity1, entity2],
      actual: [read1, read2],
    };
  } catch (error) {
    return {
      name: 'Multiple entities written',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testTypeIsolation(cache: CascadeCache): TestResult {
  try {
    const user: CascadeEntity = { __typename: 'User', id: '10', name: 'Grace' };
    const post: CascadeEntity = { __typename: 'Post', id: '10', title: 'Hello' };
    cache.write(user);
    cache.write(post);
    const readUser = cache.read('User:10');
    const readPost = cache.read('Post:10');
    const passed = readUser !== null && readPost !== null &&
                   readUser.name === 'Grace' && readPost.title === 'Hello';
    return {
      name: 'Type isolation',
      passed,
      message: passed ? undefined : 'Types not isolated',
      expected: { user, post },
      actual: { user: readUser, post: readPost },
    };
  } catch (error) {
    return {
      name: 'Type isolation',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

// Cascade Application Tests
function testUpdatedEntitiesWritten(cache: CascadeCache): TestResult {
  try {
    const entity: CascadeEntity = { __typename: 'User', id: '11', name: 'Henry' };
    cache.applyUpdated(entity);
    const readEntity = cache.read('User:11');
    const passed = readEntity !== null && readEntity.name === 'Henry';
    return {
      name: 'Updated entities written',
      passed,
      message: passed ? undefined : 'Updated entity not written',
      expected: entity,
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'Updated entities written',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testDeletedEntitiesEvicted(cache: CascadeCache): TestResult {
  try {
    const entity: CascadeEntity = { __typename: 'User', id: '12', name: 'Ivy' };
    cache.write(entity);
    cache.applyDeleted('User:12');
    const readEntity = cache.read('User:12');
    const passed = readEntity === null;
    return {
      name: 'Deleted entities evicted',
      passed,
      message: passed ? undefined : 'Deleted entity not evicted',
      expected: null,
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'Deleted entities evicted',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testCreatedWritesNew(cache: CascadeCache): TestResult {
  try {
    const entity: CascadeEntity = { __typename: 'User', id: '13', name: 'Jack' };
    cache.applyCreated(entity);
    const readEntity = cache.read('User:13');
    const passed = readEntity !== null && readEntity.name === 'Jack';
    return {
      name: 'CREATED writes new',
      passed,
      message: passed ? undefined : 'CREATED did not write new entity',
      expected: entity,
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'CREATED writes new',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testUpdatedUpdatesExisting(cache: CascadeCache): TestResult {
  try {
    const original: CascadeEntity = { __typename: 'User', id: '14', name: 'Kate', age: 20 };
    const updated: CascadeEntity = { __typename: 'User', id: '14', name: 'Kate', age: 21 };
    cache.write(original);
    cache.applyUpdated(updated);
    const readEntity = cache.read('User:14');
    const passed = readEntity !== null && readEntity.age === 21;
    return {
      name: 'UPDATED updates existing',
      passed,
      message: passed ? undefined : 'UPDATED did not update existing entity',
      expected: updated,
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'UPDATED updates existing',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testDeletedEvicts(cache: CascadeCache): TestResult {
  try {
    const entity: CascadeEntity = { __typename: 'User', id: '15', name: 'Liam' };
    cache.write(entity);
    cache.applyDeleted('User:15');
    const readEntity = cache.read('User:15');
    const passed = readEntity === null;
    return {
      name: 'DELETED evicts',
      passed,
      message: passed ? undefined : 'DELETED did not evict entity',
      expected: null,
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'DELETED evicts',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testInvalidationsProcessed(cache: CascadeCache): TestResult {
  try {
    const entity: CascadeEntity = { __typename: 'User', id: '16', name: 'Mia' };
    cache.write(entity);
    cache.applyInvalidate('User:16');
    const readEntity = cache.read('User:16');
    const passed = readEntity !== null && (readEntity as any)._stale === true;
    return {
      name: 'Invalidations processed',
      passed,
      message: passed ? undefined : 'Invalidation not processed',
      expected: { ...entity, _stale: true },
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'Invalidations processed',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testCascadeInvalidateMarksStale(cache: CascadeCache): TestResult {
  try {
    const entity: CascadeEntity = { __typename: 'User', id: '16b', name: 'Mia2' };
    cache.write(entity);
    cache.applyInvalidate('User:16b');
    const readEntity = cache.read('User:16b');
    const passed = readEntity !== null && (readEntity as any)._stale === true;
    return {
      name: 'INVALIDATE marks stale',
      passed,
      message: passed ? undefined : 'INVALIDATE did not mark entity as stale',
      expected: { ...entity, _stale: true },
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'INVALIDATE marks stale',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testRefetchTriggersQuery(cache: CascadeCache): TestResult {
  try {
    cache.applyRefetch('User:17');
    const passed = (cache as any)._refetchTriggered === true;
    return {
      name: 'REFETCH triggers query',
      passed,
      message: passed ? undefined : 'REFETCH did not trigger query',
      expected: true,
      actual: (cache as any)._refetchTriggered,
    };
  } catch (error) {
    return {
      name: 'REFETCH triggers query',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testCascadeRemoveDeletesData(cache: CascadeCache): TestResult {
  // Cascade version of remove deletes data
  try {
    const entity: CascadeEntity = { __typename: 'User', id: '18', name: 'Noah' };
    cache.write(entity);
    cache.applyRemove('User:18');
    const readEntity = cache.read('User:18');
    const passed = readEntity === null;
    return {
      name: 'REMOVE deletes data',
      passed,
      message: passed ? undefined : 'REMOVE did not delete data',
      expected: null,
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'REMOVE deletes data',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testProcessingOrderCorrect(cache: CascadeCache): TestResult {
  try {
    // Apply multiple operations and check order
    const entity1: CascadeEntity = { __typename: 'User', id: '19', name: 'Olivia' };
    const entity2: CascadeEntity = { __typename: 'User', id: '19', name: 'Olivia Updated' };
    cache.applyCreated(entity1);
    cache.applyUpdated(entity2);
    cache.applyDeleted('User:19');
    const readEntity = cache.read('User:19');
    const passed = readEntity === null; // Should be deleted last
    return {
      name: 'Processing order correct',
      passed,
      message: passed ? undefined : 'Processing order not correct',
      expected: null,
      actual: readEntity,
    };
  } catch (error) {
    return {
      name: 'Processing order correct',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

// Error Handling Tests
function testWriteFailureDoesntStop(cache: CascadeCache): TestResult {
  try {
    // Mock a failure - assume cache throws on certain writes
    (cache as any)._shouldFailWrite = true;
    const entity: CascadeEntity = { __typename: 'User', id: '20', name: 'Peter' };
    let threw = false;
    try {
      cache.write(entity);
    } catch {
      threw = true;
    }
    // Reset failure flag
    (cache as any)._shouldFailWrite = false;
    // Continue with another operation
    const entity2: CascadeEntity = { __typename: 'User', id: '21', name: 'Quinn' };
    cache.write(entity2);
    const readEntity2 = cache.read('User:21');
    const passed = threw && readEntity2 !== null;
    return {
      name: 'Write failure doesn\'t stop',
      passed,
      message: passed ? undefined : 'Write failure stopped processing',
      expected: { threw: true, entity2Written: true },
      actual: { threw, entity2Written: readEntity2 !== null },
    };
  } catch (error) {
    return {
      name: 'Write failure doesn\'t stop',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}
    // Reset before continuing with another operation
    (cache as any)._shouldFailWrite = false;
    const entity2: CascadeEntity = { __typename: 'User', id: '21', name: 'Quinn' };
    cache.write(entity2);
    const readEntity2 = cache.read('User:21');
    const passed = threw && readEntity2 !== null;
    return {
      name: 'Write failure doesn\'t stop',
      passed,
      message: passed ? undefined : 'Write failure stopped processing',
      expected: { threw: true, entity2Written: true },
      actual: { threw, entity2Written: readEntity2 !== null },
    };
  } catch (error) {
    return {
      name: 'Write failure doesn\'t stop',
      passed: false,
      message: `Error: ${error}`,
    };
  } finally {
    (cache as any)._shouldFailWrite = false;
  }
}

function testEvictFailureDoesntStop(cache: CascadeCache): TestResult {
  try {
    (cache as any)._shouldFailEvict = true;
    let threw = false;
    try {
      cache.evict('User:22');
    } catch {
      threw = true;
    }
    // Reset before continuing
    (cache as any)._shouldFailEvict = false;
    const entity: CascadeEntity = { __typename: 'User', id: '23', name: 'Rachel' };
    cache.write(entity);
    const readEntity = cache.read('User:23');
    const passed = threw && readEntity !== null;
    return {
      name: 'Evict failure doesn\'t stop',
      passed,
      message: passed ? undefined : 'Evict failure stopped processing',
      expected: { threw: true, entityWritten: true },
      actual: { threw, entityWritten: readEntity !== null },
    };
  } catch (error) {
    return {
      name: 'Evict failure doesn\'t stop',
      passed: false,
      message: `Error: ${error}`,
    };
  } finally {
    (cache as any)._shouldFailEvict = false;
  }
}

function testErrorsLogged(cache: CascadeCache): TestResult {
  try {
    (cache as any)._shouldFailWrite = true;
    const entity: CascadeEntity = { __typename: 'User', id: '24', name: 'Sam' };
    try {
      cache.write(entity);
    } catch {
      // Expected
    }
    const logged = (cache as any)._errorsLogged === true;
    const passed = logged;
    return {
      name: 'Errors logged',
      passed,
      message: passed ? undefined : 'Errors not logged',
      expected: true,
      actual: logged,
    };
  } catch (error) {
    return {
      name: 'Errors logged',
      passed: false,
      message: `Error: ${error}`,
    };
  } finally {
    (cache as any)._shouldFailWrite = false;
  }
}

function testMalformedDataHandled(cache: CascadeCache): TestResult {
  try {
    const malformed = { name: 'Tom' } as any; // Missing __typename and id
    let threw = false;
    try {
      cache.write(malformed);
    } catch {
      threw = true;
    }
    const passed = threw; // Should throw or handle gracefully
    return {
      name: 'Malformed data handled',
      passed,
      message: passed ? undefined : 'Malformed data not handled',
      expected: true, // Should throw
      actual: threw,
    };
  } catch (error) {
    return {
      name: 'Malformed data handled',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testMissingTypenameHandled(cache: CascadeCache): TestResult {
  try {
    const missingType = { id: '25', name: 'Uma' } as any; // Missing __typename
    let threw = false;
    try {
      cache.write(missingType);
    } catch {
      threw = true;
    }
    const passed = threw;
    return {
      name: 'Missing __typename handled',
      passed,
      message: passed ? undefined : 'Missing __typename not handled',
      expected: true,
      actual: threw,
    };
  } catch (error) {
    return {
      name: 'Missing __typename handled',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}

function testMissingIdHandled(cache: CascadeCache): TestResult {
  try {
    const missingId = { __typename: 'User', name: 'Victor' } as any; // Missing id
    let threw = false;
    try {
      cache.write(missingId);
    } catch {
      threw = true;
    }
    const passed = threw;
    return {
      name: 'Missing id handled',
      passed,
      message: passed ? undefined : 'Missing id not handled',
      expected: true,
      actual: threw,
    };
  } catch (error) {
    return {
      name: 'Missing id handled',
      passed: false,
      message: `Error: ${error}`,
    };
  }
}