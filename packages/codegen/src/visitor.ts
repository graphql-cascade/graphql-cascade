import {
  OperationDefinitionNode,
  FieldNode,
  GraphQLSchema,
  isObjectType,
  isUnionType,
  GraphQLOutputType,
  getNullableType,
} from 'graphql';
import { CascadePluginConfig } from './plugin';

interface CascadeField {
  operationName: string;
  typeName: string;
  hasCascadeField: boolean;
  isUnionType: boolean;
  unionTypes?: string[];
}

export class CascadeVisitor {
  private cascadeFields: CascadeField[] = [];

  constructor(
    private schema: GraphQLSchema,
    private config: CascadePluginConfig
  ) {}

  buildContent(operations: any[]): string {
    // Analyze operations for cascade patterns
    operations.forEach(op => {
      if (op.kind === 'OperationDefinition') {
        this.visitOperation(op as OperationDefinitionNode);
      }
    });

    // Generate type helpers
    const helpers = this.generateHelpers();
    const typeGuards = this.config.generateTypeGuards !== false
      ? this.generateTypeGuards()
      : '';
    const unionHelpers = this.config.generateUnionHelpers !== false
      ? this.generateUnionHelpers()
      : '';

    return [helpers, typeGuards, unionHelpers].filter(Boolean).join('\n\n');
  }

  private visitOperation(operation: OperationDefinitionNode) {
    const operationName = operation.name?.value;
    if (!operationName) return;

    operation.selectionSet.selections.forEach(selection => {
      if (selection.kind === 'Field') {
        this.visitField(selection, operationName, operation.operation);
      }
    });
  }

  private visitField(
    field: FieldNode,
    operationName: string,
    operationType: 'query' | 'mutation' | 'subscription'
  ) {
    const fieldName = field.name.value;
    const fieldType = this.getFieldType(fieldName, operationType);

    if (!fieldType) return;

    // Check if field has cascade subfield (direct or in inline fragments)
    let hasCascade = false;

    if (field.selectionSet) {
      for (const selection of field.selectionSet.selections) {
        if (selection.kind === 'Field' && selection.name.value === 'cascade') {
          hasCascade = true;
          break;
        }
        // Check inline fragments (for union types)
        if (selection.kind === 'InlineFragment' && selection.selectionSet) {
          for (const innerSelection of selection.selectionSet.selections) {
            if (innerSelection.kind === 'Field' && innerSelection.name.value === 'cascade') {
              hasCascade = true;
              break;
            }
          }
          if (hasCascade) break;
        }
      }
    }

    const isUnion = isUnionType(fieldType);
    const unionTypes = isUnion && isUnionType(fieldType)
      ? fieldType.getTypes().map(t => t.name)
      : undefined;

    this.cascadeFields.push({
      operationName,
      typeName: fieldType.name,
      hasCascadeField: hasCascade,
      isUnionType: isUnion,
      unionTypes,
    });
  }

  private getFieldType(
    fieldName: string,
    operationType: 'query' | 'mutation' | 'subscription'
  ) {
    let rootType;
    if (operationType === 'query') {
      rootType = this.schema.getQueryType();
    } else if (operationType === 'mutation') {
      rootType = this.schema.getMutationType();
    } else {
      rootType = this.schema.getSubscriptionType();
    }

    if (!rootType) return null;

    const field = rootType.getFields()[fieldName];
    if (!field) return null;

    let type: GraphQLOutputType = field.type;
    type = getNullableType(type);

    return isObjectType(type) || isUnionType(type) ? type : null;
  }

  getImports(): string[] {
    const importFrom = this.config.cascadeImportFrom || '@graphql-cascade/client';
    return [
      `import type {`,
      `  CascadeResponse,`,
      `  CascadeUpdates,`,
      `  UpdatedEntity,`,
      `  DeletedEntity,`,
      `  QueryInvalidation,`,
      `} from '${importFrom}';`,
    ];
  }

  private generateHelpers(): string {
    return `
/**
 * Extract cascade updates from a mutation response
 */
export type CascadeOf<T> = T extends { cascade: infer C }
  ? C extends CascadeUpdates ? C : never
  : never;

/**
 * Extract the data payload from a cascade response
 */
export type DataOf<T> = T extends { data: infer D } ? D : never;

/**
 * Extract updated entities from cascade updates
 */
export type UpdatedEntitiesOf<T> = CascadeOf<T> extends { updated: infer U }
  ? U extends UpdatedEntity<any>[] ? U : never
  : never;

/**
 * Extract deleted entities from cascade updates
 */
export type DeletedEntitiesOf<T> = CascadeOf<T> extends { deleted: infer D }
  ? D extends DeletedEntity[] ? D : never
  : never;

/**
 * Extract query invalidations from cascade updates
 */
export type InvalidationsOf<T> = CascadeOf<T> extends { invalidations: infer I }
  ? I extends QueryInvalidation[] ? I : never
  : never;
`.trim();
  }

  private generateTypeGuards(): string {
    const guards = this.cascadeFields
      .filter(f => f.isUnionType && f.unionTypes)
      .flatMap(f => this.generateUnionTypeGuard(f))
      .join('\n\n');

    return guards ? `\n// Type Guards\n${guards}` : '';
  }

  private generateUnionTypeGuard(field: CascadeField): string[] {
    const { operationName, unionTypes = [] } = field;

    // Generate capitalized operation name for type reference
    const capitalizedOpName = operationName.charAt(0).toUpperCase() + operationName.slice(1);
    const operationTypeName = `${capitalizedOpName}Mutation`;

    return unionTypes.map(typeName => `
/**
 * Type guard for ${typeName} in ${operationName}
 */
export function is${typeName}(
  result: ${operationTypeName} | null | undefined
): result is Extract<${operationTypeName}, { __typename: '${typeName}' }> {
  return result?.__typename === '${typeName}';
}`.trim());
  }

  private generateUnionHelpers(): string {
    const helpers = this.cascadeFields
      .filter(f => f.isUnionType && f.hasCascadeField)
      .map(f => this.generateUnionCascadeConfig(f))
      .join('\n\n');

    return helpers ? `\n// Union Cascade Configurations\n${helpers}` : '';
  }

  private generateUnionCascadeConfig(field: CascadeField): string {
    const { operationName, unionTypes = [] } = field;

    // Heuristic: types with "Success" or ending in "Success" are success types
    const successTypes = unionTypes.filter(t =>
      t.includes('Success') || t.endsWith('Success')
    );
    const errorTypes = unionTypes.filter(t => !successTypes.includes(t));

    // If heuristic fails, make educated guess based on naming
    if (successTypes.length === 0 && errorTypes.length === 0) {
      // Look for Result, Response, Error patterns
      successTypes.push(...unionTypes.filter(t =>
        t.includes('Result') || t.includes('Response') && !t.includes('Error')
      ));
      errorTypes.push(...unionTypes.filter(t =>
        t.includes('Error') || t.includes('Failure')
      ));
    }

    // If still nothing, take first as success, rest as errors
    if (successTypes.length === 0 && unionTypes.length > 0) {
      successTypes.push(unionTypes[0]);
      errorTypes.push(...unionTypes.slice(1));
    }

    const capitalizedOpName = operationName.charAt(0).toUpperCase() + operationName.slice(1);

    return `
/**
 * Pre-configured UnionCascadeConfig for ${operationName}
 * Success types: ${successTypes.join(', ') || 'none'}
 * Error types: ${errorTypes.join(', ') || 'none'}
 */
export const ${capitalizedOpName}CascadeConfig = {
  successTypes: [${successTypes.map(t => `'${t}'`).join(', ')}],
  errorTypes: [${errorTypes.map(t => `'${t}'`).join(', ')}],
} as const;`.trim();
  }
}
