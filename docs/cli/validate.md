# cascade validate

Validate GraphQL schema for Cascade compliance.

## Usage

```bash
cascade validate <schema-file> [options]
```

## Options

- `--endpoint <url>` - Validate against a running server
- `--mutations-only` - Only check mutation responses
- `--strict` - Enable strict validation rules
- `--output <json|text>` - Output format (default: text)

## Examples

Validate a schema file:

```bash
cascade validate schema.graphql
```

Validate a running server:

```bash
cascade validate --endpoint http://localhost:4000/graphql
```

Strict validation with JSON output:

```bash
cascade validate schema.graphql --strict --output json
```

## Validation Rules

The validator checks:

1. **Cascade types are defined**
   ```graphql
   type Cascade { ... }
   type EntityRef { ... }
   type InvalidationRef { ... }
   ```

2. **Mutation responses include cascade**
   ```graphql
   type TodoMutationResponse {
     todo: Todo
     __cascade: Cascade! # Required
   }
   ```

3. **Entity identification**
   ```graphql
   type Todo {
     id: ID! # Required
   }
   ```

4. **Response type naming**
   ```graphql
   # Recommended: TypeMutationResponse pattern
   type TodoMutationResponse { ... }
   ```

## Exit Codes

- `0` - Schema is valid
- `1` - Validation errors found
- `2` - Invalid arguments

## Next Steps

- **[cascade doctor](/cli/doctor)** - Diagnose runtime issues
- **[Schema Conventions](/server/schema-conventions)** - Best practices
