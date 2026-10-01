# GraphQL Cascade Conformance Test Suite

This directory contains the official GraphQL Cascade conformance test suite, providing machine-readable test cases for validating implementations against the specification.

## Overview

The conformance test suite consists of JSON test case files that define specific behaviors implementations must exhibit to be compliant with the GraphQL Cascade specification. Each test case includes:

- **Input**: Mutation/query and initial state
- **Expected Output**: Required cascade response or client state changes
- **Requirements**: Links to specification requirements
- **Metadata**: Test categorization and priority

## Directory Structure

```
conformance-tests/
├── test-case-schema.json   # JSON Schema for test cases
├── spec-version.json       # Specification version the cases target
├── README.md
├── client/
│   ├── cache-updates/
│   │   ├── document-cache.json
│   │   ├── in-place-updates.json
│   │   ├── normalized-cache.json
│   │   ├── result-union-failure.json
│   │   └── result-union-payload.json
│   └── invalidation/
│       ├── exact-match.json
│       ├── prefix-match.json
│       └── type-invalidation.json
├── server/
│   ├── error-handling/
│   │   ├── partial-failure.json
│   │   └── transaction-rollback.json
│   ├── response-building/
│   │   ├── basic-response.json
│   │   ├── batch-mutations.json
│   │   ├── nested-entities.json
│   │   └── truncation.json
│   └── tracking/
│       ├── cycle-detection.json
│       ├── entity-creation.json
│       ├── entity-deletion.json
│       ├── entity-update.json
│       └── relationship-tracking.json
└── transport/
    └── http.json
```

## Test Case Format

Each test case is a JSON file following the schema defined in `test-case-schema.json`. The format includes:

```json
{
  "id": "TC-S-001",
  "name": "Entity Creation Tracking",
  "description": "Servers MUST track newly created entities...",
  "category": "server",
  "requirement": "REQ-001",
  "input": {
    "mutation": "mutation { ... }",
    "context": { "entities": [...] }
  },
  "expected": {
    "cascade": {
      "updated": [...],
      "invalidations": [...],
      "metadata": {...}
    }
  }
}
```

## Running Conformance Tests

The cases are not yet executed by a runner: `@graphql-cascade/conformance` is being rebuilt to run them against a server endpoint or a client cache ([#65](https://github.com/graphql-cascade/graphql-cascade/issues/65)). Until then, run them in your implementation's own test suite.

### Manual Test Execution

For custom test runners or manual validation:

1. **Load Test Case**: Parse the JSON test case file
2. **Setup State**: Initialize your system with the `input.context.entities`
3. **Execute Mutation**: Run the `input.mutation` against your implementation
4. **Compare Results**: Verify the cascade response matches `expected.cascade`
5. **Validate Requirements**: Ensure all specification requirements are met

### Test Runner Implementation

To implement a custom test runner:

```typescript
interface TestCase {
  id: string;
  input: TestInput;
  expected: TestExpected;
}

interface TestResult {
  testId: string;
  passed: boolean;
  actual: any;
  error?: string;
}

// Load and execute test cases
async function runConformanceTests(serverUrl: string): Promise<TestResult[]> {
  const testFiles = glob('conformance-tests/**/*.json');
  const results: TestResult[] = [];

  for (const file of testFiles) {
    if (file === 'test-case-schema.json') continue;

    const testCase: TestCase = JSON.parse(fs.readFileSync(file, 'utf8'));
    const result = await executeTest(testCase, serverUrl);
    results.push(result);
  }

  return results;
}
```

## Test Categories

### Server Tests

#### Tracking (`server/tracking/`)
- **TC-S-001** (REQ-001): Entity Creation Tracking
- **TC-S-002** (REQ-002): Entity Update Tracking
- **TC-S-003** (REQ-003): Entity Deletion Tracking
- **TC-S-004** (REQ-004): Relationship Cascade Tracking
- **TC-S-005** (REQ-005): Cycle Detection in Entity Relationships

#### Response Building (`server/response-building/`)
- **TC-S-010** (REQ-010): Basic Cascade Response Structure
- **TC-S-011** (REQ-004): Nested Entity Response
- **TC-S-012** (REQ-012): One Cascade per Mutation Field
- **TC-S-030** (REQ-050): Truncation Collapses Types Into Type Invalidations

#### Error Handling (`server/error-handling/`)
- **TC-S-020** (REQ-020): Transaction Rollback on Error
- **TC-S-021** (REQ-021): Failed Field Leaves Other Cascades Intact

### Client Tests

#### Cache Updates (`client/cache-updates/`)
- **TC-C-001** (REQ-101): Normalized Cache Updates
- **TC-C-002** (REQ-102): Document Cache Updates
- **TC-C-021** (REQ-031): Updated Entities Apply In Place
- **TC-C-005** (REQ-105): Result Union Success Payload
- **TC-C-006** (REQ-105): Result Union Failure

#### Invalidation (`client/invalidation/`)
- **TC-C-003** (REQ-103): Exact Match Invalidation
- **TC-C-004** (REQ-104): Type Invalidation
- **TC-C-020** (REQ-030): Prefix-Based Query Invalidation

### Transport Tests

#### Transport (`transport/`)
- **TC-T-001** (REQ-040): HTTP Response Extensions

## Compliance Levels

### Cascade Compliant (90-100%)
- All critical and high priority tests pass
- Full specification compliance
- Eligible for official compliance badge

### Cascade Basic (75-89%)
- Core functionality working
- Minor specification deviations allowed
- Suitable for development use

### Cascade Partial (50-74%)
- Basic cascade responses working
- Missing advanced features
- Not recommended for production

### Not Compliant (0-49%)
- Missing core cascade functionality
- Requires significant implementation work

## Adding New Test Cases

1. **Choose ID**: Use format `TC-{CATEGORY}-{NUMBER}`
   - Server: `TC-S-XXX`
   - Client: `TC-C-XXX`
   - Transport: `TC-T-XXX`
   - Integration: `TC-I-XXX`

2. **Define Test**: Create JSON file following the schema, citing the specification requirement it tests. Tag a new requirement **[REQ-NNN]** where the specification states it

3. **Validate**: `pnpm --filter @graphql-cascade/conformance test` checks every case against `test-case-schema.json` and for unique ids; CI runs it too

4. **Document**: Add the case to the lists above

## Requirements

Each case cites the requirement it tests in `requirement`. Requirements are tagged **[REQ-NNN]** where the specification states them, for example in [Server Requirements](../specification/09_server_requirements.md#core-requirements) and [Cascade Delivery](../specification/04_mutation_responses.md#cascade-delivery). `node scripts/check-spec.mjs` fails if a case cites an undefined requirement, a requirement is defined twice, or a tagged requirement has no case.

## Contributing

1. Fork the repository
2. Add test cases following the established patterns
3. Ensure tests validate real specification requirements
4. Submit a pull request with test runner updates if needed

## License

MIT License - see project LICENSE file.