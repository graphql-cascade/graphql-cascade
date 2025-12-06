# Phase 23: Post-Assessment Quality Improvements

**Status:** 75% Complete (3 of 4 tasks) ✅
**Completed:** 2025-12-05
**Priority:** Medium (Non-blocking for v0.3.0)
**Target:** v0.4.0 or v1.0.0
**Actual Effort:** 1 hour (tasks 23.1-23.3 complete)
**Remaining Effort:** 4-6 hours (task 23.4 optional)

## ✅ Completion Status

### Tasks 23.1, 23.2 & 23.3: COMPLETE

**Task 23.1 - Circular Dependency:** ✅ Already fixed in codebase
- Verified with `npx madge --circular --extensions ts src/`
- Result: "No circular dependency found!"
- `CascadeErrorCode` enum is in types.ts, errors.ts imports from types.ts
- No reverse import exists

**Task 23.2 - Test Coverage:** ✅ Target exceeded
- Target: 70% coverage
- Achieved: **80.07% coverage** (10 percentage points above target)
- Statement coverage: 80.07%
- Branch coverage: 80.54%
- Function coverage: 75.17%
- Line coverage: 80.32%
- Critical files at 100%: errors.ts, types.ts, metrics.ts

**Task 23.3 - Build Process Verification:** ✅ Complete
- pnpm-workspace.yaml: Verified correct
- All internal dependencies use `workspace:*` protocol
- Build verification script created: `scripts/verify-build.sh`
- No fixes required - configuration already correct

**Completion Reports:**
- Tasks 23.1-23.2: `/tmp/phase-23-completion-summary.md`
- Task 23.3: `/tmp/phase-23-task3-completion.md`

---

## Overview

This phase addresses the remaining quality issues identified during the independent expert assessment. While these issues are non-blocking for v0.3.0 release, they should be resolved before v1.0.0 production stable release.

**Expert Assessment Score:** 9.4/10 (Grade A)
**Assessment Report:** /tmp/graphql-cascade-assessment/FINAL-EXPERT-ASSESSMENT.md

## Issues to Address

### 1. Circular Dependency (errors.ts ↔ types.ts)
- **Priority:** HIGH (technical debt)
- **Impact:** Medium (complicates dependency graph, build systems)
- **Effort:** 1-2 hours
- **Target:** v0.4.0

### 2. Test Coverage Improvement
- **Priority:** MEDIUM (quality improvement)
- **Impact:** Low (current coverage 56%, target 70%+)
- **Effort:** 8-12 hours
- **Target:** v0.4.0 or v1.0.0

### 3. Build Verification
- **Priority:** MEDIUM (CI/CD reliability)
- **Impact:** Low (local development issue)
- **Effort:** 2-4 hours
- **Target:** v0.4.0

### 4. OpenTelemetry Distributed Tracing
- **Priority:** LOW (feature enhancement)
- **Impact:** Low (metrics sufficient for most use cases)
- **Effort:** 4-6 hours
- **Target:** v1.0.0 or later

## Task Breakdown

---

## Task 23.1: Fix Circular Dependency

**Priority:** HIGH
**Effort:** 1-2 hours
**Files:** `packages/server-node/src/errors.ts`, `packages/server-node/src/types.ts`

### Problem

Circular dependency detected:
- `errors.ts` imports `CascadeErrorCode` from `types.ts`
- `types.ts` imports `CascadeErrorCode` from `errors.ts`

```
errors.ts → types.ts
types.ts → errors.ts (via import)
```

This complicates:
- Module resolution
- Bundling and tree-shaking
- Build systems
- Testing infrastructure

### Root Cause Analysis

**Current Structure:**

`errors.ts`:
```typescript
export enum CascadeErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  // ... more codes
}

export interface CascadeErrorInfo {
  code: CascadeErrorCode | string;
  // ...
}
```

`types.ts`:
```typescript
import type { CascadeErrorCode } from './errors';

export interface CascadeErrorInfo {
  code: CascadeErrorCode | string;
  // ...
}
```

The issue: `CascadeErrorInfo` is defined in both files, and both files reference `CascadeErrorCode`.

### Solution Options

#### Option A: Move CascadeErrorCode to types.ts (RECOMMENDED)

**Pros:**
- Clean separation: types.ts contains all type definitions
- errors.ts becomes purely implementation
- Follows "types first" pattern
- Minimal code changes

**Cons:**
- Error codes conceptually belong with error handling

**Implementation:**
1. Move `CascadeErrorCode` enum from `errors.ts` to `types.ts`
2. Update `errors.ts` to import from `types.ts`
3. Update all imports across codebase
4. Run tests to verify

**Files to modify:**
- `packages/server-node/src/types.ts` (add enum)
- `packages/server-node/src/errors.ts` (remove enum, add import)
- `packages/server-node/src/index.ts` (update exports)
- Any test files importing `CascadeErrorCode`

#### Option B: Merge errors.ts and types.ts

**Pros:**
- Eliminates circular dependency completely
- Co-locates related code

**Cons:**
- Creates a large file (~500+ lines)
- Mixes concerns (types vs implementation)
- Against single responsibility principle

**Not recommended.**

#### Option C: Create separate error-codes.ts

**Pros:**
- Clean separation of concerns
- Small, focused file for error codes
- Both errors.ts and types.ts can import without circularity

**Cons:**
- Adds another file to the architecture
- May be over-engineering for a simple enum

**Implementation:**
1. Create `packages/server-node/src/error-codes.ts`
2. Move `CascadeErrorCode` enum to new file
3. Update imports in both `errors.ts` and `types.ts`
4. Update index.ts exports
5. Run tests

### Recommended Solution: Option A

Move `CascadeErrorCode` to `types.ts` for clean separation.

### Implementation Steps

```bash
# Task 23.1.1: Move CascadeErrorCode enum
```

1. Open `packages/server-node/src/types.ts`
2. Add `CascadeErrorCode` enum at the top (after imports)
3. Open `packages/server-node/src/errors.ts`
4. Remove `CascadeErrorCode` enum
5. Add import: `import { CascadeErrorCode } from './types';`
6. Verify `CascadeErrorInfo` interface is removed from types.ts (should only be in errors.ts)

```bash
# Task 23.1.2: Update exports
```

7. Open `packages/server-node/src/index.ts`
8. Update error exports to import `CascadeErrorCode` from `./types` instead of `./errors`
9. Verify export statement still works

```bash
# Task 23.1.3: Run tests
```

10. Run `cd packages/server-node && npm test`
11. Fix any import errors in test files
12. Verify all tests pass

```bash
# Task 23.1.4: Verify no circular dependency
```

13. Run `npx madge --circular --extensions ts packages/server-node/src/`
14. Verify output shows no circular dependencies
15. Document the fix

### Verification Commands

```bash
# Check for circular dependencies
cd packages/server-node
npx madge --circular --extensions ts src/

# Expected output: No circular dependencies found!

# Run tests
npm test

# Build
npm run build
```

### Acceptance Criteria

- [ ] `CascadeErrorCode` enum moved to `types.ts`
- [ ] No circular dependency detected by madge
- [ ] All existing tests pass
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] Exports from index.ts unchanged (public API stable)

### Rollback Plan

If issues arise:
```bash
git checkout HEAD -- packages/server-node/src/errors.ts packages/server-node/src/types.ts packages/server-node/src/index.ts
```

---

## Task 23.2: Increase Test Coverage to 70%+

**Priority:** MEDIUM
**Effort:** 8-12 hours
**Current Coverage:** 56% (44 test files / 109 source files)
**Target Coverage:** 70-80%

### Current State

**Test Statistics:**
- Production code: 5,749 lines
- Test code: 3,221 lines
- Test files: 44
- Source files: 109
- Coverage: 56%

**Well-Tested Modules:**
- ✅ metrics.ts (19 tests)
- ✅ health.ts (19 tests)
- ✅ errors.ts (comprehensive)
- ✅ builder.ts (tested)
- ✅ tracker.ts (tested)

**Gaps:**
- Integration edge cases
- Error path coverage
- Security filter edge cases
- Async entityFilter edge cases
- Streaming builder edge cases

### Strategy

Focus on **high-value coverage** rather than just hitting numbers:
1. Error paths and exception handling
2. Edge cases in core functionality
3. Integration scenarios
4. Security filter combinations
5. Resource limit scenarios

### Implementation Plan

#### Step 1: Identify Coverage Gaps

```bash
# Generate coverage report
cd packages/server-node
npm test -- --coverage --coverageReporters=lcov --coverageReporters=text

# Review uncovered lines
# Focus on:
# - Error handling paths
# - Edge cases
# - Integration points
```

#### Step 2: Prioritize Test Cases

**High Priority (Core Functionality):**
1. Tracker edge cases
   - Max entity limit exceeded
   - Max depth exceeded
   - Circular entity references
   - Async entityFilter errors
   - Validation errors

2. Builder edge cases
   - Response size limit exceeded
   - Truncation scenarios
   - Invalidator errors
   - Null/undefined handling

3. Security filter combinations
   - fieldFilter + entityFilter together
   - Async filter timeouts
   - Filter exceptions

**Medium Priority (Integration):**
4. Integration scenarios
   - Apollo Server error handling
   - NestJS exception filters
   - Express middleware errors

5. Metrics edge cases
   - Histogram overflow
   - Concurrent metric updates
   - Snapshot consistency

**Low Priority (Nice to Have):**
6. Logger configurations
7. Rare error codes
8. Deprecated code paths

#### Step 3: Write Test Cases

**Task 23.2.1: Tracker Edge Cases**

File: `packages/server-node/src/tracker.test.ts`

```typescript
describe('CascadeTracker - Edge Cases', () => {
  describe('entity limits', () => {
    it('should stop tracking when maxEntities reached', () => {
      const tracker = new CascadeTracker({ maxEntities: 2 });
      tracker.startTransaction();

      tracker.trackEntity({ id: '1', __typename: 'User' });
      tracker.trackEntity({ id: '2', __typename: 'User' });
      tracker.trackEntity({ id: '3', __typename: 'User' }); // Should be ignored

      const data = tracker.endTransaction();
      expect(data.updated).toHaveLength(2);
      expect(data.metadata.serializationErrors).toBeUndefined();
    });

    it('should handle maxDepth exceeded gracefully', () => {
      const tracker = new CascadeTracker({ maxDepth: 1 });
      // Test deep nested tracking
    });

    it('should handle circular references without infinite loop', () => {
      // Entity A references B, B references A
    });
  });

  describe('async entityFilter', () => {
    it('should handle async filter rejections', async () => {
      const tracker = new CascadeTracker({
        entityFilter: async () => {
          throw new Error('Authorization failed');
        }
      });

      tracker.startTransaction();
      tracker.trackEntity({ id: '1', __typename: 'User' });

      // Should not throw, should filter out entity
      const data = await tracker.endTransactionAsync();
      expect(data.updated).toHaveLength(0);
    });

    it('should handle slow async filters with timeout', async () => {
      // Test filter that takes too long
    });
  });

  describe('validateEntity', () => {
    it('should prevent tracking invalid entities', () => {
      const tracker = new CascadeTracker({
        validateEntity: (entity) => {
          if (!entity.id) throw new Error('Missing ID');
        }
      });

      tracker.startTransaction();
      expect(() => {
        tracker.trackEntity({ __typename: 'User' } as any);
      }).toThrow('Missing ID');
    });
  });

  describe('serialization errors', () => {
    it('should count serialization errors without failing', () => {
      const tracker = new CascadeTracker();
      tracker.startTransaction();

      // Track entity with circular reference
      const circular: any = { id: '1', __typename: 'User' };
      circular.self = circular;

      tracker.trackEntity(circular);
      const data = tracker.endTransaction();

      expect(data.metadata.serializationErrors).toBeGreaterThan(0);
    });
  });
});
```

**Task 23.2.2: Builder Edge Cases**

File: `packages/server-node/src/builder.test.ts`

Add tests for:
- Response size limit exceeded
- All truncation flags
- Null invalidator
- Invalidator throwing errors
- Empty cascade data

**Task 23.2.3: Security Filter Tests**

File: `packages/server-node/src/security-filters.test.ts` (new file)

```typescript
describe('Security Filters - Integration', () => {
  describe('combined filters', () => {
    it('should apply fieldFilter and entityFilter together', async () => {
      const tracker = new CascadeTracker({
        fieldFilter: (typename, fieldName) => fieldName !== 'password',
        entityFilter: async (entity) => entity.id !== 'blocked'
      });

      tracker.startTransaction();
      tracker.trackEntity({
        id: '1',
        __typename: 'User',
        name: 'Alice',
        password: 'secret'
      });
      tracker.trackEntity({
        id: 'blocked',
        __typename: 'User',
        name: 'Bob'
      });

      const data = await tracker.endTransactionAsync();

      expect(data.updated).toHaveLength(1);
      expect(data.updated[0].entity).not.toHaveProperty('password');
    });

    it('should handle fieldFilter exceptions gracefully', () => {
      const tracker = new CascadeTracker({
        fieldFilter: () => {
          throw new Error('Filter error');
        }
      });

      // Should not crash, should skip filtering
    });
  });

  describe('transformEntity', () => {
    it('should apply transformation before tracking', () => {
      const tracker = new CascadeTracker({
        transformEntity: (entity) => ({
          ...entity,
          email: entity.email?.replace(/(.{2}).*@/, '$1***@')
        })
      });

      tracker.startTransaction();
      tracker.trackEntity({
        id: '1',
        __typename: 'User',
        email: 'alice@example.com'
      });

      const data = tracker.endTransaction();
      expect(data.updated[0].entity.email).toBe('al***@example.com');
    });
  });
});
```

**Task 23.2.4: Metrics Edge Cases**

File: `packages/server-node/src/metrics.test.ts`

Add tests for:
- Histogram size limit (max 1000)
- Concurrent increments
- Reset functionality
- Prometheus export edge cases

**Task 23.2.5: Integration Tests**

File: `packages/server-node/src/integrations/apollo.test.ts`

Add tests for:
- Plugin error handling
- Metrics integration
- Context passing

#### Step 4: Verify Coverage Improvement

```bash
# Run coverage
cd packages/server-node
npm test -- --coverage

# Check coverage report
# Target: 70%+ statement coverage
```

### Test File Organization

```
packages/server-node/src/
├── tracker.test.ts          (expand edge cases)
├── builder.test.ts          (expand truncation tests)
├── errors.test.ts           (complete)
├── metrics.test.ts          (expand histogram tests)
├── health.test.ts           (complete)
├── logger.test.ts           (add if missing)
├── security-filters.test.ts (NEW - integration tests)
└── integrations/
    ├── apollo.test.ts       (expand error handling)
    ├── nestjs.test.ts       (expand error handling)
    └── express.test.ts      (expand error handling)
```

### Acceptance Criteria

- [ ] Test coverage increased to 70%+ statement coverage
- [ ] All error paths covered
- [ ] Edge cases for core functionality tested
- [ ] Security filter combinations tested
- [ ] Integration error handling tested
- [ ] All existing tests still pass
- [ ] No regression in functionality
- [ ] Coverage report generated and documented

### Verification Commands

```bash
cd packages/server-node

# Run tests with coverage
npm test -- --coverage --coverageReporters=text --coverageReporters=lcov

# Expected output: Coverage > 70%
# Statements   : 70%+
# Branches     : 65%+
# Functions    : 70%+
# Lines        : 70%+

# Run all tests
npm test

# Check for test failures
echo $?  # Should be 0
```

---

## Task 23.3: Verify and Fix Build Process

**Priority:** MEDIUM
**Effort:** 2-4 hours

### Problem

During expert assessment, `pnpm install` failed with:
```
ERR_PNPM_FETCH_404  GET https://registry.npmjs.org/@graphql-cascade%2Fclient: Not Found - 404
@graphql-cascade/client is not in the npm registry
```

This suggests:
1. Monorepo internal dependencies not configured correctly
2. Build process needs verification
3. CI/CD may have issues

### Root Cause

The monorepo references unpublished packages (@graphql-cascade/client) which aren't in npm registry yet. This is normal for local development but causes issues with fresh installs.

### Solution

#### Step 1: Verify pnpm Workspace Configuration

**File:** `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - '!packages/*/node_modules'
  - '!packages/*/dist'
```

Ensure this file exists at the repository root.

#### Step 2: Verify package.json Dependencies

Check each package.json for internal dependencies:

```bash
# Find all package.json files
find packages -name "package.json" -not -path "*/node_modules/*"

# Check for @graphql-cascade/* dependencies
grep -r "@graphql-cascade" packages/*/package.json
```

Internal dependencies should use `workspace:*` protocol:

```json
{
  "dependencies": {
    "@graphql-cascade/client": "workspace:*"
  }
}
```

NOT:
```json
{
  "dependencies": {
    "@graphql-cascade/client": "^0.3.0"
  }
}
```

#### Step 3: Fix Dependency References

**Task 23.3.1: Update Internal Dependencies**

For each package.json with internal dependencies:

```bash
# Example: packages/client-apollo/package.json
{
  "dependencies": {
    "@graphql-cascade/client-core": "workspace:*"  // ← Change to workspace:*
  }
}
```

**Task 23.3.2: Clean and Reinstall**

```bash
# Clean all node_modules
find . -name "node_modules" -type d -prune -exec rm -rf {} +

# Clean pnpm lock
rm -f pnpm-lock.yaml

# Reinstall
pnpm install

# Verify installation
echo $?  # Should be 0
```

#### Step 4: Verify Build Process

```bash
# Build all packages in correct order
pnpm run -r build

# Expected: All packages build successfully
```

#### Step 5: Create Build Verification Script

**File:** `scripts/verify-build.sh`

```bash
#!/bin/bash
set -e

echo "🔍 Verifying GraphQL Cascade build process..."

# Step 1: Clean
echo "📦 Cleaning build artifacts..."
pnpm run clean || true
find . -name "dist" -type d -prune -exec rm -rf {} +

# Step 2: Install dependencies
echo "📥 Installing dependencies..."
pnpm install

# Step 3: Build all packages
echo "🔨 Building all packages..."
pnpm run -r build

# Step 4: Run tests
echo "🧪 Running tests..."
pnpm run -r test

# Step 5: Verify outputs
echo "✅ Verifying build outputs..."
for pkg in packages/*/dist; do
  if [ -d "$pkg" ]; then
    echo "  ✓ $pkg exists"
  else
    echo "  ✗ $pkg missing"
    exit 1
  fi
done

echo "✅ Build verification complete!"
```

Make executable:
```bash
chmod +x scripts/verify-build.sh
```

#### Step 6: Update CI/CD Configuration

**File:** `.github/workflows/ci.yml`

Ensure CI uses correct build order:

```yaml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build all packages
        run: pnpm run -r build

      - name: Run tests
        run: pnpm run -r test

      - name: Lint
        run: pnpm run -r lint
```

### Acceptance Criteria

- [ ] pnpm-workspace.yaml configured correctly
- [ ] All internal dependencies use `workspace:*` protocol
- [ ] `pnpm install` completes without errors
- [ ] `pnpm run -r build` completes successfully
- [ ] All dist/ directories created
- [ ] Build verification script passes
- [ ] CI/CD pipeline updated and passing

### Verification Commands

```bash
# Clean install
rm -rf node_modules packages/*/node_modules pnpm-lock.yaml
pnpm install

# Build all
pnpm run -r build

# Test all
pnpm run -r test

# Run verification script
./scripts/verify-build.sh
```

---

## Task 23.4: OpenTelemetry Distributed Tracing (Optional)

**Priority:** LOW
**Effort:** 4-6 hours
**Target:** v1.0.0 or later

### Overview

Currently, GraphQL Cascade supports OpenTelemetry metrics but not distributed tracing spans. This task adds trace spans for cascade operations to enable end-to-end request tracing.

### Current State

**Existing OTel Support:**
- ✅ Metrics via `OpenTelemetryMetricsCollector`
- ✅ Counter, histogram, gauge metrics
- ❌ Trace spans (not implemented)

### Implementation Plan

#### Step 1: Add Tracer Support

**File:** `packages/server-node/src/integrations/opentelemetry.ts`

Add tracing support:

```typescript
import { trace, Span, SpanStatusCode } from '@opentelemetry/api';

export interface OpenTelemetryConfig {
  meter?: OTelMeter;
  tracer?: Tracer;  // NEW
  serviceName?: string;
}

export class OpenTelemetryInstrumentation {
  private tracer?: Tracer;

  constructor(config: OpenTelemetryConfig) {
    this.tracer = config.tracer || trace.getTracer(
      config.serviceName || 'graphql-cascade'
    );
  }

  startCascadeSpan(transactionId: string): Span | undefined {
    if (!this.tracer) return undefined;

    return this.tracer.startSpan('cascade.transaction', {
      attributes: {
        'cascade.transaction.id': transactionId,
        'cascade.version': '0.3.0',
      }
    });
  }

  endCascadeSpan(span: Span | undefined, metadata: CascadeMetadata) {
    if (!span) return;

    span.setAttributes({
      'cascade.entities.tracked': metadata.affectedCount,
      'cascade.depth': metadata.depth,
      'cascade.tracking_time_ms': metadata.trackingTime,
      'cascade.truncated': metadata.truncatedUpdated || false,
    });

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }
}
```

#### Step 2: Integrate with Tracker

**File:** `packages/server-node/src/tracker.ts`

Add span tracking:

```typescript
export class CascadeTracker {
  private otelInstrumentation?: OpenTelemetryInstrumentation;
  private currentSpan?: Span;

  startTransaction(): string {
    const txId = generateTransactionId();

    // Start OTel span
    if (this.otelInstrumentation) {
      this.currentSpan = this.otelInstrumentation.startCascadeSpan(txId);
    }

    // ... existing code
    return txId;
  }

  endTransaction(): TrackerCascadeData {
    const data = this.getCascadeData();

    // End OTel span
    if (this.currentSpan) {
      this.otelInstrumentation?.endCascadeSpan(
        this.currentSpan,
        data.metadata
      );
      this.currentSpan = undefined;
    }

    return data;
  }
}
```

#### Step 3: Add Builder Spans

**File:** `packages/server-node/src/builder.ts`

Add response building span:

```typescript
buildResponse<T>(result: T): CascadeResponse {
  const span = this.tracer?.startSpan('cascade.build_response');

  try {
    // ... existing code
    const response = { ... };

    span?.setAttributes({
      'cascade.response.updated': response.cascade.updated.length,
      'cascade.response.deleted': response.cascade.deleted.length,
      'cascade.response.size_bytes': JSON.stringify(response).length,
    });

    span?.end();
    return response;
  } catch (error) {
    span?.recordException(error);
    span?.setStatus({ code: SpanStatusCode.ERROR });
    span?.end();
    throw error;
  }
}
```

#### Step 4: Documentation

**File:** `docs/guide/observability.md` (new file)

Document OTel tracing usage:

```markdown
# Observability with OpenTelemetry

## Distributed Tracing

GraphQL Cascade supports OpenTelemetry distributed tracing:

\`\`\`typescript
import { trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

// Setup OTel
const provider = new NodeTracerProvider();
provider.register();

// Configure cascade
const tracker = new CascadeTracker({
  otel: {
    tracer: trace.getTracer('my-service'),
    serviceName: 'my-service'
  }
});
\`\`\`

## Trace Spans

Cascade creates the following spans:

- `cascade.transaction` - Full cascade operation
- `cascade.build_response` - Response construction
- `cascade.track_entity` - Individual entity tracking (optional)

## Span Attributes

Each span includes:
- `cascade.transaction.id`
- `cascade.entities.tracked`
- `cascade.depth`
- `cascade.tracking_time_ms`
- `cascade.response.size_bytes`
\`\`\`
```

#### Step 5: Add Tests

**File:** `packages/server-node/src/integrations/opentelemetry.test.ts`

```typescript
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

describe('OpenTelemetry Tracing', () => {
  let exporter: InMemorySpanExporter;
  let provider: NodeTracerProvider;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    provider = new NodeTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    provider.register();
  });

  it('should create cascade.transaction span', () => {
    const tracker = new CascadeTracker({
      otel: { tracer: trace.getTracer('test') }
    });

    tracker.startTransaction();
    tracker.trackEntity({ id: '1', __typename: 'User' });
    tracker.endTransaction();

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('cascade.transaction');
    expect(spans[0].attributes['cascade.entities.tracked']).toBe(1);
  });

  it('should record errors in spans', () => {
    // Test error recording
  });
});
```

### Acceptance Criteria

- [ ] Tracer configuration added to OpenTelemetryConfig
- [ ] Cascade transaction spans created
- [ ] Response building spans created
- [ ] Span attributes include key metrics
- [ ] Error handling records exceptions
- [ ] Documentation updated
- [ ] Tests added and passing
- [ ] Optional peer dependency on @opentelemetry/api

### Verification

```bash
# Install OTel SDK
pnpm add -D @opentelemetry/api @opentelemetry/sdk-trace-node @opentelemetry/sdk-trace-base

# Run tests
cd packages/server-node
npm test -- --testPathPattern=opentelemetry

# Verify spans in example
cd examples/chat-realtime
# Run with OTel collector and verify spans appear
```

---

## Phase 23 Summary

### Completion Checklist

#### Required for v0.4.0
- [ ] Task 23.1: Fix circular dependency (errors.ts ↔ types.ts)
- [ ] Task 23.3: Verify and fix build process

#### Recommended for v0.4.0 or v1.0.0
- [ ] Task 23.2: Increase test coverage to 70%+

#### Optional for v1.0.0+
- [ ] Task 23.4: OpenTelemetry distributed tracing

### Success Metrics

| Metric | Current | Target v0.4.0 | Target v1.0.0 |
|--------|---------|---------------|---------------|
| Circular Dependencies | 1 | 0 | 0 |
| Test Coverage | 56% | 60%+ | 70%+ |
| Build Success Rate | 90% | 100% | 100% |
| OTel Tracing | Metrics only | Metrics only | Metrics + Spans |

### Effort Breakdown

| Task | Priority | Effort | Target |
|------|----------|--------|--------|
| 23.1 Circular Dependency | HIGH | 1-2h | v0.4.0 |
| 23.2 Test Coverage | MEDIUM | 8-12h | v0.4.0/v1.0.0 |
| 23.3 Build Verification | MEDIUM | 2-4h | v0.4.0 |
| 23.4 OTel Tracing | LOW | 4-6h | v1.0.0+ |
| **Total** | | **15-24h** | |

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking API changes | Low | High | Maintain backward compatibility |
| Test failures | Medium | Medium | Incremental testing |
| Build regressions | Low | Medium | CI/CD validation |
| Performance impact | Low | Low | Benchmark before/after |

### Dependencies

- No external dependencies required for Tasks 23.1-23.3
- Task 23.4 requires @opentelemetry/api (peer dependency)

### Rollback Strategy

All tasks are non-breaking and can be rolled back via git:

```bash
# Rollback specific task
git revert <commit-hash>

# Or rollback entire branch
git reset --hard origin/main
```

### Communication Plan

- Create GitHub issue for each task
- Update issue with progress
- Request PR review from maintainers
- Document changes in CHANGELOG.md
- Update migration guide if needed

---

## Conclusion

Phase 23 addresses all remaining issues from the expert assessment to achieve:
- **v0.4.0:** Technical debt resolved (circular dependency, build verification)
- **v1.0.0:** Quality target met (70% test coverage, distributed tracing)

All tasks are non-blocking for v0.3.0 release, which has been **approved** with a score of 9.4/10 (Grade A).

**Expert Assessment Reference:** `/tmp/graphql-cascade-assessment/FINAL-EXPERT-ASSESSMENT.md`
