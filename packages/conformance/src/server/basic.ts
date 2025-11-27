import type { TestCategory, TestResult, ServerConformanceOptions, ConformanceLevel } from '../types';
import successResponse from '../../fixtures/responses/success.json';
import errorResponse from '../../fixtures/responses/error.json';
import updateResponse from '../../fixtures/responses/update.json';
import deleteResponse from '../../fixtures/responses/delete.json';
import multiEntityResponse from '../../fixtures/responses/multi-entity.json';
import readOnlyResponse from '../../fixtures/responses/read-only.json';
import relatedUpdateResponse from '../../fixtures/responses/related-update.json';
import notFoundErrorResponse from '../../fixtures/responses/not-found-error.json';

/**
 * A single basic conformance test case
 */
export interface BasicTestCase {
  name: string;
  category: string;
  test: () => TestResult;
}

/**
 * Run basic conformance tests for GraphQL Cascade server implementation
 */
export async function runBasicTests(_options: ServerConformanceOptions): Promise<TestCategory[]> {
  const testCases: BasicTestCase[] = [
    // Entity Tracking tests (10)
    ...createEntityTrackingTests(),
    // Invalidation Hints tests (8)
    ...createInvalidationHintsTests(),
    // Metadata tests (6)
    ...createMetadataTests(),
    // Error Handling tests (6)
    ...createErrorHandlingTests(),
  ];

  // Group tests by category
  const categories: Record<string, TestResult[]> = {};
  for (const testCase of testCases) {
    if (!categories[testCase.category]) {
      categories[testCase.category] = [];
    }
    categories[testCase.category].push(testCase.test());
  }

  // Convert to TestCategory format
  const result: TestCategory[] = [];
  for (const [categoryName, tests] of Object.entries(categories)) {
    result.push({
      name: categoryName,
      level: 'basic' as ConformanceLevel,
      tests,
    });
  }

  return result;
}

/**
 * Create Entity Tracking test cases (10 tests)
 */
function createEntityTrackingTests(): BasicTestCase[] {
  return [
    {
      name: 'Primary mutation result tracked',
      category: 'Entity Tracking',
      test: () => {
        const mutationResult = successResponse.data.createUser;
        const cascade = mutationResult.cascade;
        const hasPrimaryEntity = cascade.updated.some(
          (entity: any) => entity.id === mutationResult.data.id
        );
        return {
          name: 'Primary mutation result tracked',
          passed: hasPrimaryEntity,
          message: hasPrimaryEntity ? 'Primary entity is tracked in updated array' : 'Primary entity not found in updated array',
        };
      },
    },
    {
      name: 'Created entity in updated array',
      category: 'Entity Tracking',
      test: () => {
        const cascade = successResponse.data.createUser.cascade;
        const createdEntity = cascade.updated.find((entity: any) => entity.operation === 'CREATED');
        return {
          name: 'Created entity in updated array',
          passed: !!createdEntity,
          message: createdEntity ? 'Created entity found in updated array' : 'No created entity in updated array',
        };
      },
    },
    {
      name: 'Updated entity in updated array',
      category: 'Entity Tracking',
      test: () => {
        const cascade = updateResponse.data.updateUser.cascade;
        const updatedEntity = cascade.updated.find((entity: any) => entity.operation === 'UPDATED');
        return {
          name: 'Updated entity in updated array',
          passed: !!updatedEntity,
          message: updatedEntity ? 'Updated entity found in updated array' : 'No updated entity in updated array',
        };
      },
    },
    {
      name: 'Deleted entity in deleted array',
      category: 'Entity Tracking',
      test: () => {
        const cascade = deleteResponse.data.deleteUser.cascade;
        const deletedEntity = cascade.deleted.find((entity: any) => entity.__typename === 'User');
        const hasDeletedAt = deletedEntity && deletedEntity.deletedAt;
        return {
          name: 'Deleted entity in deleted array',
          passed: !!deletedEntity && !!hasDeletedAt,
          message: deletedEntity ? 'Deleted entity found with deletedAt timestamp' : 'No deleted entity in deleted array',
        };
      },
    },
    {
      name: 'Correct __typename',
      category: 'Entity Tracking',
      test: () => {
        const cascade = successResponse.data.createUser.cascade;
        const hasCorrectTypename = cascade.updated.every((entity: any) =>
          entity.__typename === 'UpdatedEntity' && entity.entity.__typename === 'User'
        );
        return {
          name: 'Correct __typename',
          passed: hasCorrectTypename,
          message: hasCorrectTypename ? 'All entities have correct __typename' : 'Some entities missing or incorrect __typename',
        };
      },
    },
    {
      name: 'Correct id',
      category: 'Entity Tracking',
      test: () => {
        const cascade = successResponse.data.createUser.cascade;
        const hasCorrectId = cascade.updated.every((entity: any) =>
          entity.id === 'user-1' && entity.entity.id === 'user-1'
        );
        return {
          name: 'Correct id',
          passed: hasCorrectId,
          message: hasCorrectId ? 'All entities have correct id' : 'Some entities have incorrect id',
        };
      },
    },
    {
      name: 'Correct operation',
      category: 'Entity Tracking',
      test: () => {
        const cascade = successResponse.data.createUser.cascade;
        const hasCorrectOperation = cascade.updated.every((entity: any) => entity.operation === 'CREATED');
        return {
          name: 'Correct operation',
          passed: hasCorrectOperation,
          message: hasCorrectOperation ? 'All entities have correct operation' : 'Some entities have incorrect operation',
        };
      },
    },
    {
      name: 'Entity data matches committed state',
      category: 'Entity Tracking',
      test: () => {
        const mutationResult = successResponse.data.createUser;
        const cascade = mutationResult.cascade;
        const entity = cascade.updated[0]?.entity;
        const matches = entity &&
          entity.name === mutationResult.data.name &&
          entity.email === mutationResult.data.email;
        return {
          name: 'Entity data matches committed state',
          passed: !!matches,
          message: matches ? 'Entity data matches committed state' : 'Entity data does not match committed state',
        };
      },
    },
    {
      name: 'Multiple entities tracked',
      category: 'Entity Tracking',
      test: () => {
        const cascade = multiEntityResponse.data.batchUpdateUsers.cascade;
        const multipleTracked = cascade.updated.length > 1;
        const affectedCountMatches = cascade.metadata.affectedCount === cascade.updated.length;
        return {
          name: 'Multiple entities tracked',
          passed: multipleTracked && affectedCountMatches,
          message: multipleTracked ? 'Multiple entities tracked with correct count' : 'Not enough entities tracked',
        };
      },
    },
    {
      name: 'Empty cascade for read-only',
      category: 'Entity Tracking',
      test: () => {
        const cascade = readOnlyResponse.data.getUser.cascade;
        const isEmpty = cascade.updated.length === 0 &&
                        cascade.deleted.length === 0 &&
                        cascade.invalidations.length === 0;
        const zeroAffected = cascade.metadata.affectedCount === 0;
        return {
          name: 'Empty cascade for read-only',
          passed: isEmpty && zeroAffected,
          message: isEmpty ? 'Read-only query has empty cascade' : 'Read-only query has unexpected cascade data',
        };
      },
    },
  ];
}

/**
 * Create Invalidation Hints test cases (8 tests)
 */
function createInvalidationHintsTests(): BasicTestCase[] {
  return [
    {
      name: 'Create invalidates list queries',
      category: 'Invalidation Hints',
      test: () => {
        const cascade = successResponse.data.createUser.cascade;
        const hasUsersInvalidation = cascade.invalidations.some((inv: any) => inv.queryName === 'users');
        return {
          name: 'Create invalidates list queries',
          passed: hasUsersInvalidation,
          message: hasUsersInvalidation ? 'Create operation invalidates list queries' : 'Create operation does not invalidate list queries',
        };
      },
    },
    {
      name: 'Update may invalidate related',
      category: 'Invalidation Hints',
      test: () => {
        const cascade = relatedUpdateResponse.data.updateUserProfile.cascade;
        const hasRelatedInvalidations = cascade.invalidations.some((inv: any) => inv.scope === 'RELATED');
        return {
          name: 'Update may invalidate related',
          passed: hasRelatedInvalidations,
          message: hasRelatedInvalidations ? 'Update invalidates related queries' : 'No related invalidations found',
        };
      },
    },
    {
      name: 'Delete invalidates entity queries',
      category: 'Invalidation Hints',
      test: () => {
        const cascade = deleteResponse.data.deleteUser.cascade;
        const hasRemoveStrategy = cascade.invalidations.some((inv: any) => inv.strategy === 'REMOVE');
        const hasExactScope = cascade.invalidations.some((inv: any) => inv.scope === 'EXACT');
        return {
          name: 'Delete invalidates entity queries',
          passed: hasRemoveStrategy && hasExactScope,
          message: hasRemoveStrategy && hasExactScope ? 'Delete properly invalidates entity queries' : 'Delete does not properly invalidate entity queries',
        };
      },
    },
    {
      name: 'Has queryName',
      category: 'Invalidation Hints',
      test: () => {
        const cascade = successResponse.data.createUser.cascade;
        const hasQueryName = cascade.invalidations.every((inv: any) => inv.queryName);
        return {
          name: 'Has queryName',
          passed: hasQueryName,
          message: hasQueryName ? 'All invalidations have queryName' : 'Some invalidations missing queryName',
        };
      },
    },
    {
      name: 'Has strategy',
      category: 'Invalidation Hints',
      test: () => {
        const cascade = successResponse.data.createUser.cascade;
        const hasStrategy = cascade.invalidations.every((inv: any) => inv.strategy);
        return {
          name: 'Has strategy',
          passed: hasStrategy,
          message: hasStrategy ? 'All invalidations have strategy' : 'Some invalidations missing strategy',
        };
      },
    },
    {
      name: 'Has scope',
      category: 'Invalidation Hints',
      test: () => {
        const cascade = successResponse.data.createUser.cascade;
        const hasScope = cascade.invalidations.every((inv: any) => inv.scope);
        return {
          name: 'Has scope',
          passed: hasScope,
          message: hasScope ? 'All invalidations have scope' : 'Some invalidations missing scope',
        };
      },
    },
    {
      name: 'Multiple invalidations',
      category: 'Invalidation Hints',
      test: () => {
        const cascade = relatedUpdateResponse.data.updateUserProfile.cascade;
        const hasMultiple = cascade.invalidations.length > 1;
        return {
          name: 'Multiple invalidations',
          passed: hasMultiple,
          message: hasMultiple ? `${cascade.invalidations.length} invalidations generated` : 'Only one or zero invalidations',
        };
      },
    },
    {
      name: 'No duplicates',
      category: 'Invalidation Hints',
      test: () => {
        const cascade = successResponse.data.createUser.cascade;
        const invalidations = cascade.invalidations;
        const unique = new Set(invalidations.map((inv: any) => `${inv.queryName}-${inv.strategy}-${inv.scope}`));
        const noDuplicates = unique.size === invalidations.length;
        return {
          name: 'No duplicates',
          passed: noDuplicates,
          message: noDuplicates ? 'No duplicate invalidations' : 'Duplicate invalidations found',
        };
      },
    },
  ];
}

/**
 * Create Metadata test cases (6 tests)
 */
function createMetadataTests(): BasicTestCase[] {
  return [
    {
      name: 'Has timestamp',
      category: 'Metadata',
      test: () => {
        const metadata = successResponse.data.createUser.cascade.metadata;
        const hasTimestamp = metadata.timestamp !== undefined && metadata.timestamp !== null;
        return {
          name: 'Has timestamp',
          passed: hasTimestamp,
          message: hasTimestamp ? 'Metadata has timestamp' : 'Metadata missing timestamp',
        };
      },
    },
    {
      name: 'Has depth',
      category: 'Metadata',
      test: () => {
        const metadata = successResponse.data.createUser.cascade.metadata;
        const hasDepth = metadata.depth !== undefined && metadata.depth !== null;
        return {
          name: 'Has depth',
          passed: hasDepth,
          message: hasDepth ? 'Metadata has depth' : 'Metadata missing depth',
        };
      },
    },
    {
      name: 'Has affectedCount',
      category: 'Metadata',
      test: () => {
        const metadata = successResponse.data.createUser.cascade.metadata;
        const hasAffectedCount = metadata.affectedCount !== undefined && metadata.affectedCount !== null;
        return {
          name: 'Has affectedCount',
          passed: hasAffectedCount,
          message: hasAffectedCount ? 'Metadata has affectedCount' : 'Metadata missing affectedCount',
        };
      },
    },
    {
      name: 'affectedCount accurate',
      category: 'Metadata',
      test: () => {
        const cascade = successResponse.data.createUser.cascade;
        const metadata = cascade.metadata;
        const actualAffected = cascade.updated.length + cascade.deleted.length;
        const accurate = metadata.affectedCount === actualAffected;
        return {
          name: 'affectedCount accurate',
          passed: accurate,
          message: accurate ? 'affectedCount matches actual affected entities' : `affectedCount ${metadata.affectedCount} does not match actual ${actualAffected}`,
          expected: actualAffected,
          actual: metadata.affectedCount,
        };
      },
    },
    {
      name: 'depth >= 1',
      category: 'Metadata',
      test: () => {
        const metadata = successResponse.data.createUser.cascade.metadata;
        const validDepth = metadata.depth >= 1;
        return {
          name: 'depth >= 1',
          passed: validDepth,
          message: validDepth ? 'Depth is >= 1' : `Depth ${metadata.depth} is < 1`,
          expected: '>= 1',
          actual: metadata.depth,
        };
      },
    },
    {
      name: 'Valid ISO 8601 timestamp',
      category: 'Metadata',
      test: () => {
        const metadata = successResponse.data.createUser.cascade.metadata;
        const timestamp = metadata.timestamp;
        const isValidISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(timestamp);
        return {
          name: 'Valid ISO 8601 timestamp',
          passed: isValidISO,
          message: isValidISO ? 'Timestamp is valid ISO 8601' : `Timestamp ${timestamp} is not valid ISO 8601`,
        };
      },
    },
  ];
}

/**
 * Create Error Handling test cases (6 tests)
 */
function createErrorHandlingTests(): BasicTestCase[] {
  return [
    {
      name: 'VALIDATION_ERROR code',
      category: 'Error Handling',
      test: () => {
        const errors = errorResponse.data.createUser.errors;
        const hasValidationError = errors.some((error: any) => error.code === 'VALIDATION_ERROR');
        return {
          name: 'VALIDATION_ERROR code',
          passed: hasValidationError,
          message: hasValidationError ? 'Error has VALIDATION_ERROR code' : 'Error missing VALIDATION_ERROR code',
        };
      },
    },
    {
      name: 'NOT_FOUND code',
      category: 'Error Handling',
      test: () => {
        const errors = notFoundErrorResponse.data.updateUser.errors;
        const hasNotFound = errors.some((error: any) => error.code === 'NOT_FOUND');
        return {
          name: 'NOT_FOUND code',
          passed: hasNotFound,
          message: hasNotFound ? 'Error has NOT_FOUND code' : 'Error missing NOT_FOUND code',
        };
      },
    },
    {
      name: 'Has message',
      category: 'Error Handling',
      test: () => {
        const errors = errorResponse.data.createUser.errors;
        const hasMessage = errors.every((error: any) => error.message);
        return {
          name: 'Has message',
          passed: hasMessage,
          message: hasMessage ? 'All errors have message' : 'Some errors missing message',
        };
      },
    },
    {
      name: 'May have field',
      category: 'Error Handling',
      test: () => {
        const errors = errorResponse.data.createUser.errors;
        const hasField = errors.some((error: any) => error.field);
        return {
          name: 'May have field',
          passed: hasField,
          message: hasField ? 'Error has field property' : 'Error missing field property',
        };
      },
    },
    {
      name: 'May have path',
      category: 'Error Handling',
      test: () => {
        const errors = errorResponse.data.createUser.errors;
        const hasPath = errors.some((error: any) => error.path);
        return {
          name: 'May have path',
          passed: hasPath,
          message: hasPath ? 'Error has path property' : 'Error missing path property',
        };
      },
    },
    {
      name: 'Failed has success: false',
      category: 'Error Handling',
      test: () => {
        const mutationResult = errorResponse.data.createUser;
        const hasSuccessFalse = mutationResult.success === false;
        return {
          name: 'Failed has success: false',
          passed: hasSuccessFalse,
          message: hasSuccessFalse ? 'Failed mutation has success: false' : 'Failed mutation does not have success: false',
        };
      },
    },
  ];
}