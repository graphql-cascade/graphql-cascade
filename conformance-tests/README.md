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
├── test-case-schema.json    # JSON Schema for test cases
├── README.md               # This file
├── server/                 # Server-side conformance tests
│   ├── tracking/          # Entity tracking tests
│   │   ├── entity-creation.json
│   │   ├── entity-update.json
│   │   ├── entity-deletion.json
│   │   ├── relationship-tracking.json
│   │   └── cycle-detection.json
│   ├── response-building/  # Response construction tests
│   └── error-handling/     # Error handling tests
├── client/                 # Client-side conformance tests
│   ├── cache-updates/     # Cache update tests
│   │   ├── normalized-cache.json
│   │   └── document-cache.json
│   └── invalidation/      # Cache invalidation tests
│       ├── exact-match.json
│       ├── pattern-match.json
│       └── prefix-match.json
└── transport/              # Transport layer tests
    ├── http.json
    └── websocket.json
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

### Using the Python Test Runner

The compliance test suite includes a Python-based test runner that can execute these JSON test cases:

```bash
# Install the test runner
pip install -e compliance-tests/

# Run all server tests against your implementation
cascade-compliance check-server http://localhost:4000/graphql

# Run specific test categories
cascade-compliance check-server http://localhost:4000/graphql \
  --categories server/tracking

# Run individual test cases
cascade-compliance check-server http://localhost:4000/graphql \
  --tests TC-S-001,TC-S-002
```

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

#### Tracking Tests (`server/tracking/`)
- **TC-S-001**: Entity Creation Tracking
- **TC-S-002**: Entity Update Tracking
- **TC-S-003**: Entity Deletion Tracking
- **TC-S-004**: Relationship Cascade Tracking
- **TC-S-005**: Cycle Detection

#### Response Building Tests (`server/response-building/`)
- Basic cascade response structure
- Nested entity handling
- Invalidation hint generation

#### Error Handling Tests (`server/error-handling/`)
- Transaction rollback scenarios
- Partial failure handling

### Client Tests

#### Cache Updates (`client/cache-updates/`)
- **TC-C-001**: Normalized Cache Updates
- **TC-C-002**: Document Cache Updates

#### Invalidation (`client/invalidation/`)
- **TC-C-003**: Exact Match Invalidation
- Pattern-based invalidation
- Prefix-based invalidation

### Transport Tests (`transport/`)
- HTTP transport requirements
- WebSocket transport requirements

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

2. **Define Test**: Create JSON file following the schema

3. **Validate**: Ensure it passes JSON schema validation

4. **Document**: Update this README with the new test

## Requirements Mapping

| Requirement | Test Cases |
|-------------|------------|
| REQ-001 | TC-S-001 |
| REQ-002 | TC-S-002 |
| REQ-003 | TC-S-003 |
| REQ-004 | TC-S-004 |
| REQ-005 | TC-S-005 |
| REQ-101 | TC-C-001 |
| REQ-102 | TC-C-002 |
| REQ-103 | TC-C-003 |

## Contributing

1. Fork the repository
2. Add test cases following the established patterns
3. Ensure tests validate real specification requirements
4. Submit a pull request with test runner updates if needed

## License

MIT License - see project LICENSE file.