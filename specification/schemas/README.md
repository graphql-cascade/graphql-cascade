# GraphQL Cascade JSON Schemas

This directory contains JSON Schema definitions for GraphQL Cascade data structures, providing machine-readable specifications for runtime validation and code generation.

## Overview

All schemas follow JSON Schema draft-07 and are designed for:
- Runtime validation of cascade responses
- Type generation for multiple programming languages
- Documentation and tooling support
- Conformance testing

## Schema Files

### Core Schemas

#### [`cascade-response.schema.json`](cascade-response.schema.json)
The root schema for complete GraphQL Cascade responses. Validates the entire `CascadeResponse` structure including success status, errors, data, and cascade updates.

**References:**
- `error.schema.json` - Error structures
- `entity.schema.json` - Entity updates/deletions
- `invalidation.schema.json` - Cache invalidation hints
- `metadata.schema.json` - Operation metadata

#### [`entity.schema.json`](entity.schema.json)
Defines entity structures used in cascade responses:
- `UpdatedEntity` - Entities that were created or modified
- `DeletedEntity` - Entities that were deleted

#### [`invalidation.schema.json`](invalidation.schema.json)
Schema for query invalidation hints that tell clients which cached queries may be stale after mutations.

#### [`metadata.schema.json`](metadata.schema.json)
Metadata about cascade operations including timestamps, transaction IDs, and operation statistics.

#### [`error.schema.json`](error.schema.json)
Structured error information with machine-readable error codes and detailed context.

## Usage

### Runtime Validation

```javascript
const Ajv = require('ajv');
const ajv = new Ajv();

const cascadeSchema = require('./cascade-response.schema.json');
const validate = ajv.compile(cascadeSchema);

// Validate a cascade response
const isValid = validate(cascadeResponse);
if (!isValid) {
  console.log(validate.errors);
}
```

### Type Generation

#### TypeScript
```bash
# Using json-schema-to-typescript
npx json-schema-to-typescript cascade-response.schema.json > cascade-response.d.ts
```

#### Python
```bash
# Using datamodel-code-generator
datamodel-codegen --input cascade-response.schema.json --output cascade_response.py
```

### Testing

```javascript
const testData = require('./test-cascade-response.json');
const validate = ajv.compile(require('./cascade-response.schema.json'));

describe('Cascade Response Validation', () => {
  it('should validate successful responses', () => {
    expect(validate(testData.successResponse)).toBe(true);
  });

  it('should validate error responses', () => {
    expect(validate(testData.errorResponse)).toBe(true);
  });
});
```

## Schema Design Principles

### JSON Schema Draft-07
All schemas use JSON Schema draft-07 for maximum compatibility with validation libraries and tooling.

### Comprehensive Validation
Schemas include:
- Required fields validation
- Type constraints
- Enum restrictions
- Format validation (e.g., date-time)
- Length constraints

### Examples
Each schema includes practical examples demonstrating valid usage patterns.

### Cross-References
Schemas reference each other using `$ref` to maintain consistency and reduce duplication.

### Extensibility
Schemas are designed to be extensible while maintaining backward compatibility.

## Validation Rules

### CascadeResponse
- Must have `success`, `errors`, `data`, and `cascade` fields
- `errors` must be an array of valid `CascadeError` objects
- `data` can be any JSON value or null (schema-defined mutation result)
- `cascade` must contain `updated`, `deleted`, `invalidations`, and `metadata`

### Entity Structures
- `__typename` must be a non-empty string
- `id` must be a non-empty string
- `operation` must be one of: "CREATED", "UPDATED", "DELETED"
- `entity` can be any JSON value (schema-defined entity interface)

### Invalidation Hints
- Either `queryName` or `queryPattern` should be provided (not enforced in schema)
- `strategy` must be one of: "INVALIDATE", "REFETCH", "REMOVE"
- `scope` must be one of: "EXACT", "PREFIX", "PATTERN", "ALL"
- `arguments` can be any JSON value

### Metadata
- `timestamp` must be a valid ISO 8601 date-time string
- `transactionId` is optional (can be null)
- `depth` and `affectedCount` must be non-negative integers

### Errors
- `message` must be a non-empty string
- `code` must be one of the defined error codes
- `field` is optional (can be null)
- `path` must be an array of strings
- `extensions` can be any JSON value

## Conformance

These schemas define the normative structure for GraphQL Cascade implementations. Compliant implementations must:

1. Produce responses that validate against `cascade-response.schema.json`
2. Accept and process all valid structures defined by these schemas
3. Reject invalid structures with appropriate errors

## Versioning

Schemas follow semantic versioning:
- **Major version**: Breaking changes to required fields or validation rules
- **Minor version**: New optional fields or expanded validation
- **Patch version**: Bug fixes, documentation improvements

## Contributing

When modifying schemas:
1. Ensure backward compatibility for minor/patch versions
2. Update examples to reflect changes
3. Run validation tests against existing implementations
4. Update this README with any new usage patterns

## Related Documents

- [GraphQL Cascade Specification](../../README.md)
- [EBNF Grammar](../grammar.ebnf)
- [Conformance Test Suite](../../conformance-tests/)
- [TypeScript Types](../../client-core/)