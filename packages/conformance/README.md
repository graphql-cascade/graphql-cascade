# @graphql-cascade/conformance

Conformance test suite for validating GraphQL Cascade implementations against the specification.

## Installation

```bash
npm install @graphql-cascade/conformance
```

## Purpose

The conformance test suite ensures that your GraphQL Cascade implementation (server or client) correctly follows the specification. It validates:

- Schema structure and required types
- Response format compliance
- Entity tracking behavior
- Cache invalidation patterns

## Conformance Levels

The test suite supports three conformance levels:

| Level | Description |
|-------|-------------|
| **Basic** | Core cascade functionality - entity tracking and response format |
| **Standard** | Basic + relationship tracking and invalidation hints |
| **Complete** | Standard + optimistic updates, streaming, and advanced features |

## Usage

### CLI Usage

```bash
# Run conformance tests via CLI
npx cascade-conformance --target server --level standard

# Test a client implementation
npx cascade-conformance --target client --level basic
```

### Programmatic Usage

#### Server Conformance Testing

```typescript
import { runServerConformance, formatReport, printReport } from '@graphql-cascade/conformance';

const report = await runServerConformance({
  endpoint: 'http://localhost:4000/graphql',
  level: 'standard'
});

// Print formatted report
printReport(report);

// Check conformance level achieved
console.log(`Achieved level: ${report.level.achieved}`);
```

#### Client Conformance Testing

```typescript
import { runClientConformance, formatReport } from '@graphql-cascade/conformance';

const report = await runClientConformance({
  createClient: () => new YourCascadeClient(),
  level: 'standard'
});

// Format as string
const output = formatReport(report);
console.log(output);
```

### Schema Validation

```typescript
import { validateSchema } from '@graphql-cascade/conformance';

const result = validateSchema(schemaSDL);

if (result.valid) {
  console.log(`Schema conforms to: ${result.level}`);
} else {
  console.log('Validation errors:', result.errors);
}
```

### Response Validation

```typescript
import { validateResponse } from '@graphql-cascade/conformance';

const result = validateResponse(mutationResponse);

if (!result.valid) {
  console.log('Response validation errors:', result.errors);
}
```

## Test Categories

### Basic Level Tests

- Schema has required CascadeResponse type
- Mutations return cascade metadata
- Entity updates include `__typename` and `id`
- Deleted entities have proper structure

### Standard Level Tests

- All Basic tests
- Relationship tracking works correctly
- Invalidation hints are properly formatted
- Transaction IDs are unique and consistent

### Complete Level Tests

- All Standard tests
- Optimistic update support
- Streaming response handling
- Complex nested entity tracking
- Performance under load

## API Reference

### `runServerConformance(options)`

Run conformance tests against a server implementation.

**Options:**
- `endpoint`: URL of the GraphQL endpoint
- `level`: Target conformance level (`'basic'` | `'standard'` | `'complete'`)

**Returns:** `Promise<ConformanceReport>`

### `runClientConformance(options)`

Run conformance tests against a client implementation.

**Options:**
- `createClient`: Factory function returning your client instance
- `level`: Target conformance level

**Returns:** `Promise<ConformanceReport>`

### `validateSchema(schema)`

Validate a GraphQL schema against the Cascade specification.

**Returns:** `SchemaValidationResult`

### `validateResponse(response)`

Validate a mutation response against the Cascade specification.

**Returns:** `ResponseValidationResult`

### `formatReport(report, options?)`

Format a conformance report as a string.

### `printReport(report, options?)`

Print a conformance report to stdout.

### `getExitCode(report)`

Get an appropriate exit code based on report results.

## CI Integration

```yaml
# GitHub Actions example
- name: Run Conformance Tests
  run: npx cascade-conformance --target server --level standard
  env:
    CASCADE_ENDPOINT: http://localhost:4000/graphql
```

## Report Format

```typescript
interface ConformanceReport {
  timestamp: string;
  target: 'server' | 'client';
  level: {
    achieved: ConformanceLevel;  // Highest level passed
    tested: ConformanceLevel;    // Level that was tested
  };
  results: {
    basic: { passed: number; failed: number; skipped: number };
    standard: { passed: number; failed: number; skipped: number };
    complete: { passed: number; failed: number; skipped: number };
  };
  failures: Array<{
    test: string;
    level: ConformanceLevel;
    message: string;
  }>;
}
```

## License

MIT
