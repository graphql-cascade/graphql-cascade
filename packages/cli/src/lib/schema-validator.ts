import * as fs from 'fs';
import {
  GraphQLSchema,
  buildSchema,
  buildClientSchema,
  isObjectType,
  isScalarType,
  isEnumType,
  isInterfaceType,
  isUnionType,
  GraphQLObjectType,
  GraphQLField,
  GraphQLType,
  getNamedType,
  isNonNullType,
  isListType,
  IntrospectionQuery
} from 'graphql';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  compatibility: number;
}

/**
 * Load a GraphQL schema from a file.
 * Supports both SDL (.graphql, .gql) and JSON introspection formats.
 */
export function loadSchema(filePath: string): GraphQLSchema {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Schema file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Try to parse as JSON first (introspection query result)
  if (filePath.endsWith('.json')) {
    try {
      const introspection = JSON.parse(content);
      const schema = ('__schema' in introspection)
        ? introspection.__schema
        : introspection.data?.__schema;
      if (!schema) {
        throw new Error('Invalid introspection query result');
      }
      return buildClientSchema(schema as any);
    } catch (error) {
      throw new Error(`Failed to parse JSON schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Otherwise parse as SDL
  try {
    return buildSchema(content);
  } catch (error) {
    throw new Error(`Failed to parse GraphQL SDL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate a GraphQL schema for Cascade compatibility.
 *
 * This function checks the schema against Cascade best practices:
 * 1. All entity types should have an 'id' field (or use @cascade directive)
 * 2. Mutations should return entities, not primitives like Boolean
 * 3. Circular references should be flagged for consideration
 */
export function validateCascadeCompatibility(schema: GraphQLSchema): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats = { totalChecks: 0, passedChecks: 0 };

  // Validate object types in the schema
  validateObjectTypes(schema, errors, warnings, stats);

  // Validate mutation return types
  validateMutationReturnTypes(schema, errors, stats);

  // Calculate compatibility percentage
  const compatibility = calculateCompatibility(stats);

  return {
    errors,
    warnings,
    compatibility
  };
}

/**
 * Validate all object types in the schema for Cascade compatibility.
 */
function validateObjectTypes(
  schema: GraphQLSchema,
  errors: string[],
  warnings: string[],
  stats: { totalChecks: number; passedChecks: number }
): void {
  const typeMap = schema.getTypeMap();

  for (const [typeName, type] of Object.entries(typeMap)) {
    // Skip built-in GraphQL types
    if (shouldSkipType(typeName, type)) {
      continue;
    }

    if (isObjectType(type)) {
      // Skip root operation types
      if (isRootOperationType(typeName)) {
        continue;
      }

      stats.totalChecks++;

      // Check if type has @cascade directive (exempts from id requirement)
      if (hasCascadeDirective(type)) {
        stats.passedChecks++;
        continue;
      }

      // Validate that type has an 'id' field
      const fields = type.getFields();
      if ('id' in fields) {
        stats.passedChecks++;
      } else {
        errors.push(
          `Type '${typeName}' is missing required 'id' field. ` +
          `Add 'id: ID!' to the type or use @cascade directive to exempt it.`
        );
      }

      // Check for circular references
      checkCircularReferences(type, typeName, warnings);
    }
  }
}

/**
 * Validate mutation return types to ensure they return entities.
 */
function validateMutationReturnTypes(
  schema: GraphQLSchema,
  errors: string[],
  stats: { totalChecks: number; passedChecks: number }
): void {
  const mutationType = schema.getMutationType();
  if (!mutationType) {
    return;
  }

  const mutations = mutationType.getFields();
  for (const [mutationName, mutation] of Object.entries(mutations)) {
    stats.totalChecks++;

    const returnType = getNamedType(mutation.type);
    const returnTypeName = returnType.name;

    // Mutations returning Boolean are discouraged
    if (returnTypeName === 'Boolean') {
      errors.push(
        `Mutation '${mutationName}' returns Boolean. ` +
        `Consider returning the affected entity instead for better cache updates.`
      );
    } else {
      stats.passedChecks++;
    }
  }
}

/**
 * Determine if a type should be skipped during validation.
 */
function shouldSkipType(typeName: string, type: GraphQLType): boolean {
  // Skip GraphQL introspection types
  if (typeName.startsWith('__')) {
    return true;
  }

  // Skip scalar, enum, interface, and union types
  if (isScalarType(type) || isEnumType(type) || isInterfaceType(type) || isUnionType(type)) {
    return true;
  }

  return false;
}

/**
 * Check if a type name is a root operation type.
 */
function isRootOperationType(typeName: string): boolean {
  return typeName === 'Query' || typeName === 'Mutation' || typeName === 'Subscription';
}

/**
 * Check if a type has the @cascade directive.
 */
function hasCascadeDirective(type: GraphQLObjectType): boolean {
  return type.astNode?.directives?.some(
    directive => directive.name.value === 'cascade'
  ) ?? false;
}

/**
 * Calculate compatibility percentage based on validation stats.
 */
function calculateCompatibility(stats: { totalChecks: number; passedChecks: number }): number {
  if (stats.totalChecks === 0) {
    return 100;
  }
  return Math.round((stats.passedChecks / stats.totalChecks) * 100);
}

/**
 * Check if a type has circular references (self-referential fields).
 */
function checkCircularReferences(
  type: GraphQLObjectType,
  typeName: string,
  warnings: string[]
): void {
  const fields = type.getFields();

  for (const [fieldName, field] of Object.entries(fields)) {
    const fieldType = getNamedType(field.type);

    // Check if field references the same type (circular reference)
    if (fieldType.name === typeName) {
      // Check if the field is a list (common pattern for self-referential relationships)
      if (isListType(field.type) || (isNonNullType(field.type) && isListType(field.type.ofType))) {
        warnings.push(
          `Type '${typeName}' has a circular reference in field '${fieldName}'. ` +
          `Consider using @cascade(depth: N) directive to limit query depth.`
        );
      }
    }
  }
}
