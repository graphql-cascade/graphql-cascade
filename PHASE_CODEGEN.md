# Phase Plan: TypeScript Codegen for GraphQL Cascade

## Objective

Implement TypeScript code generation using GraphQL Code Generator to provide type-safe GraphQL operations with cascade support. This will dramatically improve DX by eliminating `any` types in mutations/queries and providing IDE autocomplete for cascade responses.

## Context

**Current State:**
- Manual type definitions in `packages/client-core/core/src/types.ts`
- Hooks and composables use `any` for data and cascade fields
- Union type extraction requires manual `successTypes`/`errorTypes` configuration
- Examples have untyped mutations
- No build-time type generation

**Problem:**
- Poor type safety in mutations/queries
- No autocomplete for cascade responses
- Manual union type configuration is error-prone
- Difficult to maintain types across schema changes

**Solution:**
- Add GraphQL Code Generator with custom cascade plugin
- Generate typed document nodes for queries/mutations
- Create cascade-aware types (`CascadeOf<T>`, `UpdatedEntity<T>`)
- Update hooks to use generated types
- Provide codegen CLI for users

## Architecture Decision

We'll use **GraphQL Code Generator** with a custom plugin because:

1. Industry standard - well-maintained, extensive ecosystem
2. Plugin architecture - easy to extend for cascade-specific needs
3. TypedDocumentNode support - integrates with Apollo, Relay, etc.
4. Mature tooling - good error messages, watch mode, etc.

**Package Structure:**
```
packages/
├── codegen/                    # NEW: Custom codegen plugin
│   ├── src/
│   │   ├── plugin.ts          # Custom cascade plugin
│   │   ├── visitor.ts         # AST visitor for cascade fields
│   │   └── templates/         # Type templates
│   ├── package.json
│   └── README.md
├── cli/                        # UPDATED: Add codegen commands
│   └── src/commands/codegen.ts
└── examples/
    └── todo-apollo/            # UPDATED: Use generated types
        ├── codegen.yml
        └── src/generated/
```

## Files to Create

1. **`packages/codegen/package.json`** - New codegen package
2. **`packages/codegen/src/plugin.ts`** - Custom GraphQL Code Generator plugin
3. **`packages/codegen/src/visitor.ts`** - AST visitor for cascade extraction
4. **`packages/codegen/src/templates/cascade-types.ts`** - Type template generators
5. **`packages/codegen/src/config.ts`** - Default codegen configuration
6. **`packages/codegen/README.md`** - Usage documentation
7. **`examples/todo-apollo/codegen.yml`** - Example codegen config
8. **`examples/todo-apollo/src/generated/graphql.ts`** - Generated types (example output)

## Files to Modify

1. **`packages/cli/src/index.ts`** - Add `codegen` command
2. **`packages/cli/package.json`** - Add codegen dependencies
3. **`packages/client-apollo/apollo/src/hooks.ts`** - Update hook types to use generics
4. **`packages/nuxt-module/module/src/runtime/composables.ts`** - Update composable types
5. **`examples/todo-apollo/src/mutations.ts`** - Use generated types
6. **`examples/todo-apollo/package.json`** - Add codegen scripts
7. **`pnpm-workspace.yaml`** - Register new codegen package
8. **`README.md`** - Add codegen section to main docs

## Implementation Steps

### Step 1: Create Codegen Package Foundation

**Create `packages/codegen/package.json`:**
```json
{
  "name": "@graphql-cascade/codegen",
  "version": "0.3.0",
  "description": "GraphQL Code Generator plugin for GraphQL Cascade type generation",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./preset": {
      "types": "./dist/preset.d.ts",
      "default": "./dist/preset.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@graphql-codegen/plugin-helpers": "^5.0.0",
    "@graphql-codegen/visitor-plugin-common": "^5.0.0",
    "@graphql-tools/utils": "^10.0.0",
    "graphql": "^16.8.1",
    "tslib": "^2.6.2"
  },
  "devDependencies": {
    "@graphql-codegen/testing": "^3.0.0",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3"
  },
  "peerDependencies": {
    "graphql": "^15.0.0 || ^16.0.0"
  },
  "keywords": ["graphql", "codegen", "cascade", "typescript"],
  "license": "MIT"
}
```

**Create `packages/codegen/src/plugin.ts`:**
```typescript
import { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import { GraphQLSchema } from 'graphql';
import { CascadeVisitor } from './visitor';

export interface CascadePluginConfig {
  /**
   * Customize the import path for cascade core types
   * @default '@graphql-cascade/client-core'
   */
  cascadeImportFrom?: string;

  /**
   * Generate union type helpers
   * @default true
   */
  generateUnionHelpers?: boolean;

  /**
   * Generate type guards for cascade responses
   * @default true
   */
  generateTypeGuards?: boolean;
}

export const plugin: PluginFunction<CascadePluginConfig> = (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: CascadePluginConfig
) => {
  const visitor = new CascadeVisitor(schema, config);

  // Visit all documents and extract cascade patterns
  const operations = documents.flatMap(doc =>
    doc.document?.definitions || []
  );

  const content = visitor.buildContent(operations);

  return {
    prepend: visitor.getImports(),
    content,
  };
};

export const preset = {
  buildGeneratesSection: (options: any) => {
    return [
      {
        plugins: [
          { add: { content: '/* eslint-disable */' } },
          'typescript',
          'typescript-operations',
          '@graphql-cascade/codegen',
        ],
        config: {
          skipTypename: false,
          enumsAsTypes: true,
          ...options.config,
        },
      },
    ];
  },
};
```

**Create `packages/codegen/src/visitor.ts`:**
```typescript
import {
  OperationDefinitionNode,
  FieldNode,
  SelectionNode,
  GraphQLSchema,
  isObjectType,
  isUnionType,
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
    const typeGuards = this.config.generateTypeGuards
      ? this.generateTypeGuards()
      : '';
    const unionHelpers = this.config.generateUnionHelpers
      ? this.generateUnionHelpers()
      : '';

    return [helpers, typeGuards, unionHelpers].join('\n\n');
  }

  private visitOperation(operation: OperationDefinitionNode) {
    const operationName = operation.name?.value;
    if (!operationName) return;

    operation.selectionSet.selections.forEach(selection => {
      if (selection.kind === 'Field') {
        this.visitField(selection, operationName);
      }
    });
  }

  private visitField(field: FieldNode, operationName: string) {
    const fieldName = field.name.value;
    const fieldType = this.getFieldType(fieldName);

    if (!fieldType) return;

    // Check if field has cascade subfield
    const hasCascade = field.selectionSet?.selections.some(
      sel => sel.kind === 'Field' && sel.name.value === 'cascade'
    ) || false;

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

  private getFieldType(fieldName: string) {
    const queryType = this.schema.getQueryType();
    const mutationType = this.schema.getMutationType();

    const field =
      queryType?.getFields()[fieldName] ||
      mutationType?.getFields()[fieldName];

    if (!field) return null;

    let type = field.type;
    while ('ofType' in type && type.ofType) {
      type = type.ofType;
    }

    return isObjectType(type) || isUnionType(type) ? type : null;
  }

  getImports(): string[] {
    const importFrom = this.config.cascadeImportFrom || '@graphql-cascade/client-core';
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
`;
  }

  private generateTypeGuards(): string {
    const guards = this.cascadeFields
      .filter(f => f.isUnionType && f.unionTypes)
      .map(f => this.generateUnionTypeGuard(f))
      .join('\n\n');

    return guards;
  }

  private generateUnionTypeGuard(field: CascadeField): string {
    const { operationName, unionTypes = [] } = field;

    return unionTypes
      .map(typeName => `
/**
 * Type guard for ${typeName} in ${operationName}
 */
export function is${typeName}(
  result: ${operationName}Mutation
): result is ${operationName}Mutation & { __typename: '${typeName}' } {
  return result?.__typename === '${typeName}';
}`)
      .join('\n');
  }

  private generateUnionHelpers(): string {
    const helpers = this.cascadeFields
      .filter(f => f.isUnionType && f.hasCascadeField)
      .map(f => this.generateUnionCascadeConfig(f))
      .join('\n\n');

    return helpers;
  }

  private generateUnionCascadeConfig(field: CascadeField): string {
    const { operationName, unionTypes = [] } = field;

    // Heuristic: types with "Success" or ending in "Success" are success types
    const successTypes = unionTypes.filter(t =>
      t.includes('Success') || t.endsWith('Success')
    );
    const errorTypes = unionTypes.filter(t => !successTypes.includes(t));

    return `
/**
 * Pre-configured UnionCascadeConfig for ${operationName}
 */
export const ${operationName}CascadeConfig = {
  successTypes: [${successTypes.map(t => `'${t}'`).join(', ')}],
  errorTypes: [${errorTypes.map(t => `'${t}'`).join(', ')}],
} as const;
`;
  }
}
```

### Step 2: Add Codegen to CLI

**Update `packages/cli/src/commands/codegen.ts` (new file):**
```typescript
import { Command } from 'commander';
import { generate } from '@graphql-codegen/cli';
import { join } from 'path';
import { existsSync } from 'fs';

export const codegenCommand = new Command('codegen')
  .description('Generate TypeScript types from GraphQL schema and operations')
  .option('-c, --config <path>', 'Path to codegen config file', 'codegen.yml')
  .option('-w, --watch', 'Watch for file changes')
  .action(async (options) => {
    const configPath = join(process.cwd(), options.config);

    if (!existsSync(configPath)) {
      console.error(`Config file not found: ${configPath}`);
      console.log('\nTo create a config file, run:');
      console.log('  graphql-cascade codegen init');
      process.exit(1);
    }

    try {
      await generate({
        config: configPath,
        watch: options.watch,
      });
      console.log('✅ Code generation complete!');
    } catch (error) {
      console.error('❌ Code generation failed:', error);
      process.exit(1);
    }
  });

export const codegenInitCommand = new Command('init')
  .description('Initialize codegen configuration')
  .action(async () => {
    const { writeFileSync } = await import('fs');
    const configContent = `
# GraphQL Cascade Codegen Configuration
schema: ./schema.graphql
documents: ./src/**/*.graphql
generates:
  ./src/generated/graphql.ts:
    plugins:
      - typescript
      - typescript-operations
      - '@graphql-cascade/codegen'
    config:
      skipTypename: false
      enumsAsTypes: true
      cascadeImportFrom: '@graphql-cascade/client-core'
      generateUnionHelpers: true
      generateTypeGuards: true
`;

    writeFileSync('codegen.yml', configContent.trim());
    console.log('✅ Created codegen.yml');
    console.log('\nNext steps:');
    console.log('  1. Update schema and documents paths in codegen.yml');
    console.log('  2. Run: graphql-cascade codegen');
  });

codegenCommand.addCommand(codegenInitCommand);
```

**Update `packages/cli/src/index.ts`:**
```typescript
// Add import
import { codegenCommand } from './commands/codegen';

// Add to program
program.addCommand(codegenCommand);
```

### Step 3: Update Examples with Generated Types

**Create `examples/todo-apollo/codegen.yml`:**
```yaml
schema: http://localhost:4000/graphql
documents: ./src/**/*.graphql
generates:
  ./src/generated/graphql.ts:
    plugins:
      - typescript
      - typescript-operations
      - '@graphql-cascade/codegen'
    config:
      skipTypename: false
      enumsAsTypes: true
      cascadeImportFrom: '@graphql-cascade/client-core'
      generateUnionHelpers: true
      generateTypeGuards: true
```

**Update `examples/todo-apollo/src/mutations.ts`:**
```typescript
import { gql } from '@apollo/client';

export const CREATE_TODO = gql`
  mutation CreateTodo($title: String!) {
    createTodo(title: $title) {
      success
      data {
        id
        title
        completed
      }
      cascade {
        updated {
          __typename
          id
          operation
          entity
          timestamp
        }
        deleted {
          __typename
          id
          timestamp
        }
        invalidations {
          query
          strategy
          scope
        }
      }
    }
  }
`;

// After codegen, use generated types:
// import { CreateTodoDocument, CreateTodoMutation } from './generated/graphql';
```

**Update `examples/todo-apollo/src/App.tsx`:**
```typescript
// Before codegen
const [createTodo] = useCascadeMutation(CREATE_TODO);
//    ^ any

// After codegen
import { CreateTodoDocument, CreateTodoMutation } from './generated/graphql';

const [createTodo] = useCascadeMutation<CreateTodoMutation>(CreateTodoDocument);
//    ^ Fully typed!
```

### Step 4: Update Hook Types

**Update `packages/client-apollo/apollo/src/hooks.ts`:**
```typescript
// Add generic type parameters
export function useCascadeMutation<
  TData = any,
  TVariables = OperationVariables
>(
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: UseCascadeMutationOptions<TData, TVariables>
): UseCascadeMutationResult<TData, TVariables> {
  // Implementation stays the same
}

// Update return type to use generics
export type UseCascadeMutationResult<TData, TVariables> = [
  (options?: MutationFunctionOptions<TData, TVariables>) => Promise<FetchResult<TData>>,
  {
    data: TData | null;
    loading: boolean;
    error: ApolloError | undefined;
    cascade: CascadeUpdates | null;
  }
];
```

**Update `packages/nuxt-module/module/src/runtime/composables.ts`:**
```typescript
export function useCascadeMutation<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>(
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: UseCascadeMutationOptions<TData, TVariables>
) {
  const { mutate, ...result } = apolloUseMutation<TData, TVariables>(mutation, options);

  const cascade = ref<CascadeUpdates | null>(null);

  const cascadeMutate = async (vars?: TVariables) => {
    const result = await mutate(vars);
    if (result?.data) {
      const extracted = extractCascade(result.data, options?.cascadeConfig);
      cascade.value = extracted;
    }
    return result;
  };

  return {
    mutate: cascadeMutate,
    cascade: readonly(cascade),
    ...result,
  };
}
```

## Verification Commands

After each step, run these commands to verify correctness:

### After Step 1 (Codegen Package):
```bash
cd packages/codegen
pnpm install
pnpm build
pnpm typecheck

# Should output: No errors, dist/ folder created
```

### After Step 2 (CLI Update):
```bash
cd packages/cli
pnpm build
node dist/index.js codegen init

# Should output: ✅ Created codegen.yml
# Verify file exists with correct content
cat codegen.yml
```

### After Step 3 (Example Update):
```bash
cd examples/todo-apollo
pnpm install
pnpm codegen  # Add this script to package.json

# Should generate src/generated/graphql.ts
ls -la src/generated/
cat src/generated/graphql.ts | head -50
```

### After Step 4 (Hook Types):
```bash
cd packages/client-apollo/apollo
pnpm typecheck

# Should pass with no errors
# Test with example app
cd ../../../examples/todo-apollo
pnpm dev

# Verify TypeScript autocomplete works in IDE
```

### Integration Test:
```bash
# From repository root
pnpm install
pnpm build
pnpm test

# All tests should pass
# Run example app to verify runtime behavior
cd examples/todo-apollo
pnpm dev
# Open http://localhost:3000 and test mutations
```

## Acceptance Criteria

- [ ] `@graphql-cascade/codegen` package created and builds successfully
- [ ] Custom plugin generates cascade helper types (`CascadeOf<T>`, `DataOf<T>`)
- [ ] Plugin generates union type guards when configured
- [ ] Plugin generates `UnionCascadeConfig` presets for union responses
- [ ] CLI has `codegen` and `codegen init` commands
- [ ] Example todo-apollo app uses generated types with full autocomplete
- [ ] `useCascadeMutation` hook accepts generic type parameters
- [ ] All TypeScript type checks pass across repository
- [ ] Generated types work correctly at runtime (no type-only errors)
- [ ] Documentation updated with codegen setup instructions

## DO NOT

- ❌ DO NOT break existing API - hooks must work with and without codegen
- ❌ DO NOT require codegen for library to function (it's optional DX improvement)
- ❌ DO NOT generate runtime code - only types and interfaces
- ❌ DO NOT modify core library types in client-core (they're the source of truth)
- ❌ DO NOT add codegen as a peer dependency to client packages
- ❌ DO NOT over-engineer - keep plugin simple and focused on cascade patterns

## Expected Output

**Generated file example (`src/generated/graphql.ts`):**
```typescript
/* eslint-disable */
import type {
  CascadeResponse,
  CascadeUpdates,
  UpdatedEntity,
  DeletedEntity,
  QueryInvalidation,
} from '@graphql-cascade/client-core';

// Standard codegen output
export type CreateTodoMutationVariables = {
  title: Scalars['String'];
};

export type CreateTodoMutation = {
  createTodo: {
    success: boolean;
    data: { id: string; title: string; completed: boolean };
    cascade: CascadeUpdates;
  };
};

export const CreateTodoDocument: TypedDocumentNode<
  CreateTodoMutation,
  CreateTodoMutationVariables
> = ...;

// Cascade-specific helpers
export type CascadeOf<T> = T extends { cascade: infer C }
  ? C extends CascadeUpdates ? C : never
  : never;

export type DataOf<T> = T extends { data: infer D } ? D : never;

// Extracted types
export type CreateTodoCascade = CascadeOf<CreateTodoMutation['createTodo']>;
export type CreateTodoData = DataOf<CreateTodoMutation['createTodo']>;
```

## Success Metrics

- TypeScript autocomplete works in example apps (verify in IDE)
- Zero `any` types in mutation/query results when using codegen
- Plugin generates correct types for 100% of test cases
- Documentation clear enough for users to set up in < 5 minutes
- No runtime performance impact (codegen is build-time only)

## Notes

- This is an optional DX feature - library works without it
- Users can choose to use codegen or not
- Generated types should feel natural, not alien
- Plugin should be published separately so users can install only if needed
- Consider upstreaming to @graphql-codegen if it's generic enough

## Related Issues

- Part of Phase 2 - DX Improvements
- Complements union type support (Phase 1)
- Enables better IDE experience for Vue composables
- Foundation for future DevTools integration
