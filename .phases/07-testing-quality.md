# AXIS 7: Testing & Quality Assurance

**Engineer Persona**: QA Architect
**Status**: Analysis Complete
**Priority**: Critical (Ensures reliability)

---

## Executive Summary

A world-reference specification must be bulletproof. This axis establishes comprehensive testing infrastructure that ensures correctness, prevents regressions, and validates that all implementations conform to the specification. We employ multiple testing methodologies including conformance testing, property-based testing, mutation testing, and chaos engineering.

---

## Current State Assessment

### Existing Tests

| Component | Test Count | Coverage | Quality |
|-----------|------------|----------|---------|
| Python Server | ~450 | ~80% | Good |
| Apollo Client | 13 | Unknown | Basic |
| React Query Client | 12 | Unknown | Basic |
| Core Client | 13 | Unknown | Basic |
| Integration | 1 | N/A | Minimal |

### Testing Gaps

1. **No conformance test suite** - Can't verify implementations
2. **No property-based tests** - Missing edge case coverage
3. **No mutation testing** - Test quality unverified
4. **No cross-client tests** - Framework isolation
5. **No chaos testing** - Failure scenarios untested
6. **No load testing** - Scalability unproven

---

## Testing Strategy

### Test Pyramid

```
                    ┌─────────┐
                    │   E2E   │  5%
                   ─┼─────────┼─
                  ┌─┴─────────┴─┐
                  │ Integration │ 15%
                 ─┼─────────────┼─
               ┌──┴─────────────┴──┐
               │      Unit         │ 80%
              ─┴───────────────────┴─
```

### Test Categories

1. **Conformance Tests** - Specification compliance
2. **Unit Tests** - Individual component correctness
3. **Integration Tests** - Component interaction
4. **Property Tests** - Invariant verification
5. **Mutation Tests** - Test quality measurement
6. **Chaos Tests** - Failure resilience
7. **Performance Tests** - Speed and memory
8. **Cross-Platform Tests** - Framework compatibility

---

## 1. Conformance Test Suite

### Purpose
Verify that any implementation (server or client) correctly implements the GraphQL Cascade specification.

### Structure

```
conformance-tests/
├── spec-version.json           # Spec version this tests
├── README.md                   # How to run conformance tests
│
├── server/
│   ├── tracking/
│   │   ├── TC-S-001-entity-create.json
│   │   ├── TC-S-002-entity-update.json
│   │   ├── TC-S-003-entity-delete.json
│   │   ├── TC-S-004-relationship-tracking.json
│   │   ├── TC-S-005-cycle-detection.json
│   │   └── TC-S-006-depth-limiting.json
│   │
│   ├── response/
│   │   ├── TC-S-020-basic-response.json
│   │   ├── TC-S-021-nested-entities.json
│   │   ├── TC-S-022-invalidation-hints.json
│   │   ├── TC-S-023-metadata.json
│   │   └── TC-S-024-error-handling.json
│   │
│   └── directives/
│       ├── TC-S-040-cascade-id.json
│       ├── TC-S-041-cascade-skip.json
│       └── TC-S-042-cascade-depth.json
│
├── client/
│   ├── cache/
│   │   ├── TC-C-001-entity-update.json
│   │   ├── TC-C-002-entity-create.json
│   │   ├── TC-C-003-entity-delete.json
│   │   └── TC-C-004-relationship-update.json
│   │
│   ├── invalidation/
│   │   ├── TC-C-020-exact-match.json
│   │   ├── TC-C-021-pattern-match.json
│   │   ├── TC-C-022-prefix-match.json
│   │   └── TC-C-023-bulk-invalidation.json
│   │
│   └── optimistic/
│       ├── TC-C-040-basic-optimistic.json
│       ├── TC-C-041-optimistic-rollback.json
│       └── TC-C-042-conflict-resolution.json
│
└── runners/
    ├── typescript/           # TS test runner
    ├── python/               # Python test runner
    ├── go/                   # Go test runner
    └── rust/                 # Rust test runner
```

### Test Case Format

```json
{
  "id": "TC-S-001",
  "name": "Basic Entity Create Tracking",
  "description": "Server correctly tracks a single entity creation",
  "spec_section": "10_tracking_algorithm",
  "level": "MUST",
  "category": "server/tracking",

  "setup": {
    "schema": "type Todo { id: ID!, title: String!, completed: Boolean! }",
    "mutation": "mutation CreateTodo($title: String!) { createTodo(title: $title) { id title completed } }",
    "variables": { "title": "Test Todo" }
  },

  "execution": {
    "tracked_operations": [
      {
        "operation": "CREATE",
        "typename": "Todo",
        "id": "{{generated}}",
        "data": { "title": "Test Todo", "completed": false }
      }
    ]
  },

  "expected": {
    "cascade": {
      "updated": [
        {
          "__typename": "Todo",
          "id": "{{generated}}",
          "title": "Test Todo",
          "completed": false
        }
      ],
      "invalidations": [],
      "metadata": {
        "affectedCount": 1,
        "operationType": "CREATE"
      }
    }
  },

  "assertions": [
    { "path": "cascade.updated", "length": 1 },
    { "path": "cascade.updated[0].__typename", "equals": "Todo" },
    { "path": "cascade.metadata.affectedCount", "equals": 1 }
  ]
}
```

### Conformance Runner

```typescript
// TypeScript conformance test runner
interface ConformanceRunner {
  // Load all test cases
  loadTestCases(category?: string): TestCase[];

  // Run against an implementation
  runAgainst(implementation: CascadeImplementation): TestResults;

  // Generate compliance report
  generateReport(results: TestResults): ComplianceReport;
}

interface TestResults {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestCaseResult[];
}

interface ComplianceReport {
  specVersion: string;
  implementationVersion: string;
  timestamp: Date;
  overallCompliance: number;  // Percentage
  mustCompliance: number;     // MUST requirements
  shouldCompliance: number;   // SHOULD requirements
  categories: CategoryReport[];
  failures: FailureDetail[];
}
```

---

## 2. Property-Based Testing

### Purpose
Discover edge cases that example-based tests miss by generating random inputs.

### Framework
- **Python**: Hypothesis
- **TypeScript**: fast-check

### Properties to Test

```typescript
// Property: Cascade updates are idempotent
fc.property(
  fc.array(entityArb),
  (entities) => {
    const cache = new InMemoryCache();
    const cascade = { updated: entities };

    applyCascade(cache, cascade);
    applyCascade(cache, cascade); // Apply twice

    // Cache state should be same after both applications
    const state1 = cache.extract();
    const state2 = cache.extract();
    expect(state1).toEqual(state2);
  }
);

// Property: Entity order doesn't affect final state
fc.property(
  fc.array(entityArb),
  (entities) => {
    const cache1 = new InMemoryCache();
    const cache2 = new InMemoryCache();

    applyCascade(cache1, { updated: entities });
    applyCascade(cache2, { updated: shuffle(entities) });

    expect(cache1.extract()).toEqual(cache2.extract());
  }
);

// Property: Relationship tracking captures all related entities
fc.property(
  entityGraphArb,
  (graph) => {
    const tracker = new CascadeTracker();
    const root = graph.root;

    tracker.trackUpdate(root);
    const response = tracker.buildResponse();

    // All reachable entities should be in response
    const reachable = getAllReachable(root, graph.maxDepth);
    expect(response.updated).toContainAll(reachable);
  }
);

// Property: Optimistic rollback restores exact previous state
fc.property(
  fc.tuple(cacheStateArb, mutationArb),
  ([initialState, mutation]) => {
    const cache = createCacheWithState(initialState);
    const rollback = applyOptimistic(cache, mutation);

    rollback();

    expect(cache.extract()).toEqual(initialState);
  }
);
```

### Generators (Arbitraries)

```typescript
// Entity generator
const entityArb = fc.record({
  __typename: fc.constantFrom('User', 'Todo', 'Comment', 'Post'),
  id: fc.uuid(),
  // Dynamic fields based on typename
}).chain(base => {
  switch (base.__typename) {
    case 'Todo':
      return fc.record({
        ...base,
        title: fc.string({ minLength: 1, maxLength: 100 }),
        completed: fc.boolean(),
        userId: fc.uuid()
      });
    // ... other types
  }
});

// Entity graph generator (with relationships)
const entityGraphArb = fc.record({
  maxDepth: fc.integer({ min: 1, max: 5 }),
  entities: fc.array(entityArb, { minLength: 1, maxLength: 100 })
}).chain(({ maxDepth, entities }) => {
  // Add random relationships between entities
  return fc.constant(buildGraph(entities, maxDepth));
});
```

---

## 3. Mutation Testing

### Purpose
Verify that our tests actually catch bugs by introducing mutations.

### Tool
- **Python**: mutmut
- **TypeScript**: Stryker

### Configuration

```json
// stryker.conf.json
{
  "mutator": {
    "name": "typescript",
    "excludedMutations": ["StringLiteral"]
  },
  "testRunner": "jest",
  "reporters": ["clear-text", "html", "dashboard"],
  "coverageAnalysis": "perTest",
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": 50
  }
}
```

### Mutation Score Targets

| Component | Target Score |
|-----------|--------------|
| Server tracking | >80% |
| Server builder | >80% |
| Client cache | >75% |
| Client invalidation | >75% |

---

## 4. Integration Tests

### Cross-Framework Tests

```typescript
// Test all client libraries produce same result
describe('Cross-client consistency', () => {
  const clients = [
    createApolloClient(),
    createReactQueryClient(),
    createRelayEnvironment(),
    createURQLClient()
  ];

  const cascadeResponse: CascadeResponse = {
    updated: [
      { __typename: 'Todo', id: '1', title: 'Test', completed: false }
    ],
    invalidations: [],
    metadata: { affectedCount: 1 }
  };

  it('all clients apply same entity update', async () => {
    const results = await Promise.all(
      clients.map(client =>
        client.applyCascade(cascadeResponse)
          .then(() => client.readEntity('Todo', '1'))
      )
    );

    // All clients should have same entity state
    const [first, ...rest] = results;
    rest.forEach(result => {
      expect(result).toEqual(first);
    });
  });
});
```

### Server-Client Integration

```typescript
describe('Full cascade flow', () => {
  let server: TestServer;
  let client: ApolloClient;

  beforeAll(async () => {
    server = await startTestServer();
    client = createApolloClient({ uri: server.url });
  });

  it('mutation cascade updates client cache', async () => {
    // Create initial data
    await client.mutate({
      mutation: CREATE_TODO,
      variables: { title: 'Initial' }
    });

    // Update should cascade
    const { data } = await client.mutate({
      mutation: UPDATE_TODO,
      variables: { id: '1', title: 'Updated' }
    });

    // Cache should be updated via cascade
    const cached = client.readFragment({
      id: 'Todo:1',
      fragment: TODO_FRAGMENT
    });

    expect(cached.title).toBe('Updated');
  });
});
```

---

## 5. Chaos Testing

### Purpose
Verify system behaves correctly under failure conditions.

### Scenarios

```typescript
describe('Chaos testing', () => {
  describe('Network failures', () => {
    it('handles mutation timeout gracefully', async () => {
      // Simulate slow network
      server.setLatency(5000);
      client.setTimeout(1000);

      await expect(
        client.mutate({ mutation: CREATE_TODO })
      ).rejects.toThrow('Timeout');

      // Optimistic update should be rolled back
      expect(client.cache.extract()).toEqual(initialState);
    });

    it('handles intermittent failures', async () => {
      server.setFailureRate(0.5); // 50% failure

      const results = await Promise.allSettled(
        Array(10).fill(null).map(() =>
          client.mutate({ mutation: CREATE_TODO })
        )
      );

      // Some should succeed, some fail
      // No cache corruption regardless
      expect(validateCacheIntegrity(client.cache)).toBe(true);
    });
  });

  describe('Concurrent mutations', () => {
    it('handles race conditions', async () => {
      // Simultaneous updates to same entity
      const [result1, result2] = await Promise.all([
        client.mutate({
          mutation: UPDATE_TODO,
          variables: { id: '1', title: 'Update A' }
        }),
        client.mutate({
          mutation: UPDATE_TODO,
          variables: { id: '1', title: 'Update B' }
        })
      ]);

      // Last write wins, cache consistent
      const cached = client.cache.readFragment({
        id: 'Todo:1',
        fragment: TODO_FRAGMENT
      });

      expect(['Update A', 'Update B']).toContain(cached.title);
    });
  });

  describe('Malformed responses', () => {
    it('handles missing cascade data', async () => {
      server.setCascadeEnabled(false);

      // Should not crash, just no cascade updates
      await client.mutate({ mutation: CREATE_TODO });

      // Manual cache update would be needed
    });

    it('handles corrupted cascade data', async () => {
      server.setCascadeData({ invalid: 'data' });

      await expect(
        client.mutate({ mutation: CREATE_TODO })
      ).resolves.not.toThrow();

      // Cache should be unchanged
    });
  });
});
```

---

## 6. Performance Tests

See Axis 4 for detailed performance testing strategy.

Integration with test suite:

```typescript
describe('Performance regression tests', () => {
  it('entity tracking stays under 1ms for 10 entities', async () => {
    const start = performance.now();

    for (let i = 0; i < 10; i++) {
      tracker.trackCreate({ __typename: 'Todo', id: String(i) });
    }

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(1);
  });

  it('cache update stays under 50ms for 100 entities', async () => {
    const entities = generateEntities(100);
    const cascade = { updated: entities };

    const start = performance.now();
    applyCascade(cache, cascade);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [server-python, client-core, client-apollo, client-react-query]
    steps:
      - uses: actions/checkout@v4
      - name: Run unit tests
        run: npm test -- --coverage
        working-directory: packages/${{ matrix.package }}
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - name: Start test server
        run: docker-compose up -d
      - name: Run integration tests
        run: npm run test:integration
      - name: Stop test server
        run: docker-compose down

  conformance-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    strategy:
      matrix:
        implementation: [python, typescript, go]
    steps:
      - uses: actions/checkout@v4
      - name: Run conformance tests
        run: npm run test:conformance -- --impl=${{ matrix.implementation }}
      - name: Upload compliance report
        uses: actions/upload-artifact@v3
        with:
          name: compliance-${{ matrix.implementation }}
          path: reports/compliance-*.json

  property-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - name: Run property tests
        run: npm run test:property -- --numRuns=1000

  mutation-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - name: Run mutation tests
        run: npx stryker run
      - name: Check mutation score
        run: |
          score=$(cat reports/mutation/mutation-score.json | jq '.score')
          if (( $(echo "$score < 75" | bc -l) )); then
            echo "Mutation score too low: $score"
            exit 1
          fi

  chaos-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Run chaos tests
        run: npm run test:chaos
```

---

## Implementation Roadmap

### Phase 1: Conformance Test Suite (Weeks 1-4)

- [ ] Design test case format
- [ ] Write server tracking tests (20+)
- [ ] Write server response tests (15+)
- [ ] Write client cache tests (20+)
- [ ] Write client invalidation tests (15+)
- [ ] Build TypeScript test runner
- [ ] Build Python test runner

### Phase 2: Property Testing (Weeks 5-6)

- [ ] Set up fast-check/Hypothesis
- [ ] Design property generators
- [ ] Write idempotency properties
- [ ] Write ordering properties
- [ ] Write relationship properties
- [ ] Integrate into CI

### Phase 3: Integration & Chaos (Weeks 7-8)

- [ ] Build cross-client test harness
- [ ] Write server-client integration tests
- [ ] Implement chaos test scenarios
- [ ] Set up test containers

### Phase 4: Mutation Testing (Weeks 9-10)

- [ ] Configure Stryker/mutmut
- [ ] Establish baseline scores
- [ ] Improve test quality to meet thresholds
- [ ] Integrate into PR checks

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Conformance tests | 100+ |
| Unit test coverage | >90% |
| Integration tests | 50+ |
| Property tests | 20+ |
| Mutation score | >75% |
| CI pass rate | >99% |
| Zero regressions | 100% |

---

## Dependencies

| Dependency | Source |
|------------|--------|
| Specification stable | Axis 1 |
| Server implementation | Axis 2 |
| Client implementations | Axis 3 |

---

*Axis 7 Plan v1.0 - QA Architect Analysis*
