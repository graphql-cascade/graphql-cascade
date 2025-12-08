# @graphql-cascade/codegen

GraphQL Code Generator plugin for generating TypeScript types with GraphQL Cascade support.

## Installation

```bash
npm install --save-dev @graphql-cascade/codegen @graphql-codegen/cli
# or
pnpm add -D @graphql-cascade/codegen @graphql-codegen/cli
```

## Usage

### 1. Create a codegen configuration file

Create `codegen.yml` in your project root:

```yaml
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
      cascadeImportFrom: '@graphql-cascade/client'
      generateUnionHelpers: true
      generateTypeGuards: true
```

### 2. Run codegen

```bash
npx graphql-codegen
# or
pnpm graphql-codegen
```

### 3. Use generated types

```typescript
import { useCascadeMutation } from '@graphql-cascade/client-apollo';
import { CreateTodoDocument, CreateTodoMutation, CreateTodoCascadeConfig } from './generated/graphql';

// Fully typed mutation with cascade support
const [createTodo] = useCascadeMutation<CreateTodoMutation>(
  CreateTodoDocument,
  {
    cascadeConfig: CreateTodoCascadeConfig, // Auto-generated config
  }
);

const result = await createTodo({ variables: { title: 'New Todo' } });

// Full type safety on cascade data
result.data?.createTodo.cascade.updated.forEach(entity => {
  console.log(`Updated ${entity.__typename} with ID ${entity.id}`);
});
```

## Configuration Options

### `cascadeImportFrom`

Customize the import path for cascade core types.

- **Type**: `string`
- **Default**: `'@graphql-cascade/client'`

```yaml
config:
  cascadeImportFrom: '@graphql-cascade/client'
```

### `generateUnionHelpers`

Generate pre-configured `UnionCascadeConfig` objects for union type responses.

- **Type**: `boolean`
- **Default**: `true`

```yaml
config:
  generateUnionHelpers: true
```

When enabled, the plugin generates configurations like:

```typescript
export const CreateTodoCascadeConfig = {
  successTypes: ['CreateTodoSuccess'],
  errorTypes: ['CreateTodoError'],
} as const;
```

### `generateTypeGuards`

Generate type guard functions for union type responses.

- **Type**: `boolean`
- **Default**: `true`

```yaml
config:
  generateTypeGuards: true
```

When enabled, the plugin generates type guards like:

```typescript
export function isCreateTodoSuccess(
  result: CreateTodoMutation | null | undefined
): result is Extract<CreateTodoMutation, { __typename: 'CreateTodoSuccess' }> {
  return result?.__typename === 'CreateTodoSuccess';
}
```

## Generated Types

The plugin generates several utility types:

### `CascadeOf<T>`

Extract cascade updates from a mutation response.

```typescript
type TodoCascade = CascadeOf<CreateTodoMutation['createTodo']>;
```

### `DataOf<T>`

Extract the data payload from a cascade response.

```typescript
type TodoData = DataOf<CreateTodoMutation['createTodo']>;
```

### `UpdatedEntitiesOf<T>`

Extract updated entities from cascade updates.

```typescript
type UpdatedTodos = UpdatedEntitiesOf<CreateTodoMutation['createTodo']>;
```

### `DeletedEntitiesOf<T>`

Extract deleted entities from cascade updates.

```typescript
type DeletedTodos = DeletedEntitiesOf<CreateTodoMutation['createTodo']>;
```

### `InvalidationsOf<T>`

Extract query invalidations from cascade updates.

```typescript
type TodoInvalidations = InvalidationsOf<CreateTodoMutation['createTodo']>;
```

## Example Output

Given this GraphQL mutation:

```graphql
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
```

The plugin generates:

```typescript
import type {
  CascadeResponse,
  CascadeUpdates,
  UpdatedEntity,
  DeletedEntity,
  QueryInvalidation,
} from '@graphql-cascade/client';

// Standard types from typescript-operations plugin
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

// Cascade utility types
export type CascadeOf<T> = T extends { cascade: infer C }
  ? C extends CascadeUpdates ? C : never
  : never;

export type DataOf<T> = T extends { data: infer D } ? D : never;

export type UpdatedEntitiesOf<T> = CascadeOf<T> extends { updated: infer U }
  ? U extends UpdatedEntity<any>[] ? U : never
  : never;

export type DeletedEntitiesOf<T> = CascadeOf<T> extends { deleted: infer D }
  ? D extends DeletedEntity[] ? D : never
  : never;

export type InvalidationsOf<T> = CascadeOf<T> extends { invalidations: infer I }
  ? I extends QueryInvalidation[] ? I : never
  : never;
```

## Integration with Other Plugins

This plugin works seamlessly with other GraphQL Code Generator plugins:

- **`typescript`** - Base TypeScript types
- **`typescript-operations`** - Operation types and TypedDocumentNode
- **`typescript-react-apollo`** - React Apollo hooks with cascade types
- **`typescript-vue-apollo`** - Vue Apollo composables with cascade types

## License

MIT
