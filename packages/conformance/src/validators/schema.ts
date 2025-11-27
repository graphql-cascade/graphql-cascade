import {
  GraphQLSchema,
  isInterfaceType,
  isEnumType,
  isObjectType,
} from 'graphql';
import type { SchemaValidationResult, ValidationError, ConformanceLevel } from '../types';

const REQUIRED_BASIC_TYPES = [
  'CascadeUpdates',
  'UpdatedEntity',
  'DeletedEntity',
  'QueryInvalidation',
  'CascadeMetadata',
];

const REQUIRED_ENUMS = [
  'CascadeOperation',
  'InvalidationStrategy',
  'InvalidationScope',
];

const CASCADE_OPERATION_VALUES = ['CREATED', 'UPDATED', 'DELETED'];
const INVALIDATION_STRATEGY_VALUES = ['INVALIDATE', 'REFETCH', 'REMOVE'];
const INVALIDATION_SCOPE_VALUES = ['EXACT', 'PREFIX', 'PATTERN', 'ALL'];

/**
 * Validates a GraphQL schema for Cascade conformance
 */
export function validateSchema(schema: GraphQLSchema): SchemaValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const typeMap = schema.getTypeMap();

  // Check for Node interface
  const nodeType = typeMap['Node'];
  if (!nodeType || !isInterfaceType(nodeType)) {
    errors.push({
      code: 'MISSING_NODE',
      message: 'Schema must have Node interface',
      path: 'Node',
    });
  } else {
    const fields = nodeType.getFields();
    if (!fields['id']) {
      errors.push({
        code: 'MISSING_NODE_ID',
        message: 'Node interface must have id: ID! field',
        path: 'Node.id',
      });
    }
  }

  // Check required types
  for (const typeName of REQUIRED_BASIC_TYPES) {
    if (!typeMap[typeName] || !isObjectType(typeMap[typeName])) {
      errors.push({
        code: 'MISSING_TYPE',
        message: `Schema must have ${typeName} type`,
        path: typeName,
      });
    }
  }

  // Check CascadeUpdates structure
  const cascadeUpdatesType = typeMap['CascadeUpdates'];
  if (cascadeUpdatesType && isObjectType(cascadeUpdatesType)) {
    const fields = cascadeUpdatesType.getFields();
    const requiredFields = ['updated', 'deleted', 'invalidations', 'metadata'];
    for (const fieldName of requiredFields) {
      if (!fields[fieldName]) {
        errors.push({
          code: 'MISSING_CASCADE_FIELD',
          message: `CascadeUpdates must have ${fieldName} field`,
          path: `CascadeUpdates.${fieldName}`,
        });
      }
    }
  }

  // Check enums
  for (const enumName of REQUIRED_ENUMS) {
    const enumType = typeMap[enumName];
    if (!enumType || !isEnumType(enumType)) {
      errors.push({
        code: 'MISSING_ENUM',
        message: `Schema must have ${enumName} enum`,
        path: enumName,
      });
    } else {
      // Validate enum values
      const values = enumType.getValues().map((v) => v.name);
      let expectedValues: string[] = [];

      if (enumName === 'CascadeOperation') {
        expectedValues = CASCADE_OPERATION_VALUES;
      } else if (enumName === 'InvalidationStrategy') {
        expectedValues = INVALIDATION_STRATEGY_VALUES;
      } else if (enumName === 'InvalidationScope') {
        expectedValues = INVALIDATION_SCOPE_VALUES;
      }

      for (const expected of expectedValues) {
        if (!values.includes(expected)) {
          errors.push({
            code: 'MISSING_ENUM_VALUE',
            message: `${enumName} must have ${expected} value`,
            path: `${enumName}.${expected}`,
          });
        }
      }
    }
  }

  // Determine conformance level
  let level: ConformanceLevel = 'none';
  if (errors.length === 0) {
    level = 'basic';

    // Check for standard features
    const hasDepthField =
      cascadeUpdatesType &&
      isObjectType(cascadeUpdatesType) &&
      cascadeUpdatesType.getFields()['metadata'];

    if (hasDepthField) {
      const metadataType = typeMap['CascadeMetadata'];
      if (metadataType && isObjectType(metadataType)) {
        const metaFields = metadataType.getFields();
        if (metaFields['depth'] && metaFields['affectedCount']) {
          level = 'standard';
        }
      }
    }

    // Check for complete features (optimistic types, etc.)
    const hasOptimisticTypes =
      typeMap['OptimisticUpdate'] || typeMap['ConflictResolution'];
    if (level === 'standard' && hasOptimisticTypes) {
      level = 'complete';
    }
  }

  return { valid: errors.length === 0, level, errors, warnings };
}
