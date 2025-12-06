import type { ResponseValidationResult, ValidationError } from '../types';

/**
 * Validates a cascade mutation response
 */
export function validateResponse(
  response: unknown,
  _options?: { strict?: boolean }
): ResponseValidationResult {
  const errors: ValidationError[] = [];

  if (!response || typeof response !== 'object') {
    return {
      valid: false,
      errors: [
        {
          code: 'INVALID_RESPONSE',
          message: 'Response must be an object',
        },
      ],
    };
  }

  const r = response as Record<string, unknown>;

  // Check success field
  if (typeof r.success !== 'boolean') {
    errors.push({
      code: 'MISSING_SUCCESS',
      message: 'Response must have success: boolean',
      path: 'success',
    });
  }

  // Check cascade field
  if (!r.cascade || typeof r.cascade !== 'object') {
    errors.push({
      code: 'MISSING_CASCADE',
      message: 'Response must have cascade: CascadeUpdates',
      path: 'cascade',
    });
  } else {
    const cascade = r.cascade as Record<string, unknown>;

    // Validate updated array
    if (!Array.isArray(cascade.updated)) {
      errors.push({
        code: 'INVALID_UPDATED',
        message: 'cascade.updated must be an array',
        path: 'cascade.updated',
      });
    } else {
      cascade.updated.forEach((entity: unknown, i: number) => {
        if (!entity || typeof entity !== 'object') return;
        const e = entity as Record<string, unknown>;
        if (!e.__typename) {
          errors.push({
            code: 'MISSING_TYPENAME',
            message: 'UpdatedEntity must have __typename',
            path: `cascade.updated[${i}].__typename`,
          });
        }
        if (!e.id) {
          errors.push({
            code: 'MISSING_ID',
            message: 'UpdatedEntity must have id',
            path: `cascade.updated[${i}].id`,
          });
        }
        if (!e.operation) {
          errors.push({
            code: 'MISSING_OPERATION',
            message: 'UpdatedEntity must have operation',
            path: `cascade.updated[${i}].operation`,
          });
        }
      });
    }

    // Validate deleted array
    if (!Array.isArray(cascade.deleted)) {
      errors.push({
        code: 'INVALID_DELETED',
        message: 'cascade.deleted must be an array',
        path: 'cascade.deleted',
      });
    } else {
      cascade.deleted.forEach((entity: unknown, i: number) => {
        if (!entity || typeof entity !== 'object') return;
        const e = entity as Record<string, unknown>;
        if (!e.__typename) {
          errors.push({
            code: 'MISSING_TYPENAME',
            message: 'DeletedEntity must have __typename',
            path: `cascade.deleted[${i}].__typename`,
          });
        }
        if (!e.id) {
          errors.push({
            code: 'MISSING_ID',
            message: 'DeletedEntity must have id',
            path: `cascade.deleted[${i}].id`,
          });
        }
      });
    }

    // Validate invalidations array
    if (!Array.isArray(cascade.invalidations)) {
      errors.push({
        code: 'INVALID_INVALIDATIONS',
        message: 'cascade.invalidations must be an array',
        path: 'cascade.invalidations',
      });
    } else {
      cascade.invalidations.forEach((inv: unknown, i: number) => {
        if (!inv || typeof inv !== 'object') return;
        const v = inv as Record<string, unknown>;
        if (!v.queryName) {
          errors.push({
            code: 'MISSING_QUERY_NAME',
            message: 'QueryInvalidation must have queryName',
            path: `cascade.invalidations[${i}].queryName`,
          });
        }
      });
    }

    // Validate metadata
    if (!cascade.metadata || typeof cascade.metadata !== 'object') {
      errors.push({
        code: 'MISSING_METADATA',
        message: 'cascade must have metadata',
        path: 'cascade.metadata',
      });
    } else {
      const meta = cascade.metadata as Record<string, unknown>;
      if (meta.timestamp === undefined || meta.timestamp === null) {
        errors.push({
          code: 'MISSING_TIMESTAMP',
          message: 'metadata must have timestamp',
          path: 'cascade.metadata.timestamp',
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
