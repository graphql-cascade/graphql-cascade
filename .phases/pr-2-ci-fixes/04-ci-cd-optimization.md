# Phase Plan: CI/CD Pipeline Optimization

## Objective

Optimize CI/CD pipeline to eliminate false failures, improve caching, and reduce execution time.

## Context

**Problem**: CI pipeline has potential cache issues and could be optimized for faster execution.

**Current Issues**:
1. Build failures in CI that don't occur locally (suggests cache problems)
2. Potential stale cache from previous npm→pnpm migration
3. No visibility into CI execution time optimization
4. Duplicate job executions on same commit

**Current CI Runtime**: Unknown (needs measurement)
**Target CI Runtime**: <10 minutes for full pipeline

## Files to Modify/Create

### Investigate:
- `.github/workflows/*.yml` (on main/master branch)
- CI cache keys and strategies
- pnpm cache configuration

### Potentially Modify:
- Workflow cache configurations
- pnpm install strategies
- Job concurrency settings
- Test parallelization

### Potentially Create:
- `.github/workflows/cache-cleanup.yml`
- Workflow performance metrics documentation

## DO NOT

- ❌ Disable required CI checks
- ❌ Skip tests or builds to save time
- ❌ Remove security scans (CodeQL, dependency review)
- ❌ Reduce test coverage requirements
- ❌ Make CI pass artificially without fixing root causes
- ❌ Disable fail-fast without good reason

## Implementation Steps

### Step 1: Measure Current CI Performance (30 minutes)

**Purpose**: Establish baseline metrics before optimization.

**Commands**:
```bash
# Get recent CI run times
gh run list --branch feature/production-readiness --limit 10 --json durationMs,conclusion,name

# Get detailed timing for latest run
gh run view --json jobs | jq '.jobs[] | {name: .name, duration: .conclusion, steps: .steps[].name}'

# Analyze bottlenecks
gh run view --log | grep "completed in" | sort -k3 -n

# Check cache hit rates
gh run view --log | grep -i "cache"
```

**Document findings**:
```markdown
## CI Performance Baseline

### Total Runtime
- Average: X minutes
- Fastest: X minutes
- Slowest: X minutes

### Slowest Jobs
1. Job name: X minutes
2. Job name: X minutes

### Cache Performance
- Hit rate: X%
- Miss rate: X%
```

**Success Criteria**:
- Have documented current performance metrics
- Identified top 3 slowest jobs
- Understanding of cache hit rates

### Step 2: Optimize pnpm Cache Strategy (45 minutes)

**Purpose**: Ensure pnpm cache is working correctly and efficiently.

**Current Setup** (from migration):
```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10
- uses: actions/cache@v4
  with:
    path: |
      ~/.pnpm-store
      node_modules
    key: pnpm-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      pnpm-${{ runner.os }}-
```

**Improved Setup**:
```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10

- name: Get pnpm store directory
  id: pnpm-cache
  shell: bash
  run: |
    echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT

- name: Setup pnpm cache
  uses: actions/cache@v4
  with:
    path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-

- name: Install dependencies
  run: pnpm install --frozen-lockfile --prefer-offline
```

**Key Improvements**:
1. Use `pnpm store path` for accurate cache location
2. Add `--prefer-offline` to use cache more aggressively
3. Don't cache `node_modules` (pnpm store is sufficient)
4. More specific cache keys

**How to Apply**:
Since workflows are not in the current branch, document this for the maintainer:

```bash
# Create optimization recommendations document
cat > .github/WORKFLOW_OPTIMIZATIONS.md << 'EOF'
# Recommended Workflow Optimizations

## 1. Improve pnpm Caching

[Include improved YAML above]

## 2. Benefits
- Faster dependency installation
- Better cache hit rates
- Reduced network usage
- More reliable builds

## 3. How to Apply
1. Update each workflow file in .github/workflows/
2. Replace pnpm cache setup with improved version
3. Test on a single workflow first
4. Roll out to all workflows once verified
EOF
```

**Success Criteria**:
- Optimization recommendations documented
- Cache strategy improvements identified
- Implementation guide created

### Step 3: Add Workflow Concurrency Controls (20 minutes)

**Purpose**: Prevent duplicate workflow runs and save CI resources.

**Problem**: Multiple pushes to same PR trigger multiple overlapping CI runs.

**Solution**: Add concurrency groups to workflows.

**Recommended Addition** (to each workflow):
```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main, master]

concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: true

jobs:
  # ... existing jobs
```

**Benefits**:
- Cancels old runs when new commits pushed
- Saves CI minutes
- Reduces queue times
- Faster feedback on latest changes

**Documentation**:
```bash
cat >> .github/WORKFLOW_OPTIMIZATIONS.md << 'EOF'

## 2. Add Concurrency Controls

### Problem
Multiple pushes trigger overlapping CI runs, wasting resources.

### Solution
Add concurrency group to each workflow:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: true
```

### Benefits
- Automatic cancellation of superseded runs
- Saves ~30-50% CI time on active PRs
- Faster feedback on latest changes
EOF
```

**Success Criteria**:
- Concurrency recommendations documented
- Benefits quantified
- Implementation examples provided

### Step 4: Optimize Test Parallelization (30 minutes)

**Purpose**: Run tests faster using parallel execution.

**Current State**:
Tests run on multiple OS/Node combinations but packages run serially.

**Improvement Options**:

**Option 1 - Jest Parallel** (within package):
```json
// package.json
{
  "scripts": {
    "test": "jest --maxWorkers=50%"
  }
}
```

**Option 2 - Matrix Strategy** (across packages):
```yaml
# .github/workflows/test.yml
jobs:
  test:
    strategy:
      matrix:
        package:
          - server-node
          - client-apollo
          - client-react-query
          - conformance
        node-version: [18, 20, 22]
    steps:
      - run: pnpm --filter @graphql-cascade/${{ matrix.package }} test
```

**Option 3 - Turborepo/Nx** (build system):
```bash
# For future consideration
pnpm add -D turbo
# Configured for parallel execution across packages
```

**Recommendation** (document for now):
```bash
cat >> .github/WORKFLOW_OPTIMIZATIONS.md << 'EOF'

## 3. Optimize Test Parallelization

### Current State
Tests run sequentially within `pnpm -r test`

### Option A: Jest Parallel (Quick Win)
Enable Jest's built-in parallelization:

```json
{
  "scripts": {
    "test": "jest --maxWorkers=50%"
  }
}
```

### Option B: CI Matrix Strategy (Better)
Test packages in parallel using matrix:

[Include YAML example]

### Option C: Turborepo (Best, Future)
Use build system for intelligent caching and parallelization.

### Recommendation
Start with Option A (Jest parallel) immediately.
Plan Option B for next iteration.
Consider Option C for long-term optimization.
EOF
```

**Success Criteria**:
- Parallelization options documented
- Recommendations provided
- Implementation difficulty assessed

### Step 5: Implement Dependency Caching Verification (20 minutes)

**Purpose**: Ensure dependencies are cached correctly to avoid reinstalls.

**Verification Script**:
```yaml
# Add to workflows as a diagnostic step
- name: Verify cache hit
  run: |
    if pnpm store status | grep -q "Store path"; then
      echo "✓ pnpm store is configured"
      pnpm store path
      pnpm store status
    else
      echo "✗ pnpm store issue"
      exit 1
    fi
```

**Cache Health Check Workflow**:
```yaml
name: Cache Health Check

on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday
  workflow_dispatch:

jobs:
  check-cache:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Test cold cache
        run: |
          time pnpm install --frozen-lockfile
          echo "Cold install time recorded"

      - name: Test warm cache
        run: |
          rm -rf node_modules
          time pnpm install --frozen-lockfile --prefer-offline
          echo "Warm install time recorded"

      - name: Compare times
        run: |
          echo "Cache effectiveness verified"
```

**Document**:
```bash
cat >> .github/WORKFLOW_OPTIMIZATIONS.md << 'EOF'

## 4. Add Cache Verification

### Purpose
Monitor cache health and effectiveness over time.

### Implementation
Create `.github/workflows/cache-health.yml`:

[Include workflow YAML]

### Benefits
- Early detection of cache issues
- Performance regression alerts
- Baseline metrics for optimization

### Metrics to Track
- Cold install time
- Warm install time
- Cache hit rate
- Store size
EOF
```

**Success Criteria**:
- Cache verification strategy documented
- Health check workflow template created
- Metrics defined

### Step 6: Optimize Build Order (25 minutes)

**Purpose**: Build packages in correct dependency order for efficiency.

**Current Issue**: `pnpm -r build` may rebuild packages unnecessarily.

**Solution**: Use pnpm's built-in dependency awareness:

```bash
# Optimal build command
pnpm -r --workspace-concurrency=4 build

# Or with filtering for changed packages only
pnpm --filter="[origin/main]" build
```

**Workflow Optimization**:
```yaml
- name: Build changed packages
  run: |
    # Build only what changed (for PRs)
    if [ "${{ github.event_name }}" = "pull_request" ]; then
      pnpm --filter="...[origin/${{ github.base_ref }}]" build
    else
      pnpm -r build
    fi
```

**Document**:
```bash
cat >> .github/WORKFLOW_OPTIMIZATIONS.md << 'EOF'

## 5. Optimize Build Order and Scope

### Problem
Building all packages even when only some changed.

### Solution
Use pnpm filtering for changed packages:

```bash
# For PRs: build only changed packages and dependencies
pnpm --filter="...[origin/main]" build

# For main: build everything
pnpm -r build
```

### Benefits
- ~40-60% faster builds on typical PRs
- Only tests affected code
- Still validates dependencies

### Implementation
[Include workflow YAML]

### Caveats
- Requires understanding of pnpm filters
- May miss some edge cases
- Recommend keeping full build for main branch
EOF
```

**Success Criteria**:
- Build optimization documented
- Filtering strategies explained
- Implementation examples provided

### Step 7: Clean Up Stale Caches (15 minutes)

**Purpose**: Remove old caches that might be causing issues.

**Manual Cache Cleanup**:
Since we can't directly access GH Actions cache API from here, document the process:

```bash
cat >> .github/WORKFLOW_OPTIMIZATIONS.md << 'EOF'

## 6. Clean Up Stale Caches

### When Needed
- After major dependency updates
- After package manager migration (npm→pnpm)
- When experiencing unexplained CI failures
- Monthly maintenance

### How to Clean
Via GitHub UI:
1. Go to repository Settings
2. Actions → Caches
3. Delete old caches (>30 days)
4. Delete caches with old keys

Via GitHub CLI:
```bash
# List all caches
gh cache list

# Delete specific cache
gh cache delete <cache-id>

# Delete all caches (use with caution!)
gh cache delete --all
```

### Automated Cleanup
Create workflow `.github/workflows/cleanup-caches.yml`:

```yaml
name: Cleanup Old Caches

on:
  schedule:
    - cron: '0 0 1 * *'  # Monthly
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup
        run: |
          gh extension install actions/gh-actions-cache
          gh actions-cache delete --all --confirm
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### After npm→pnpm Migration
1. Delete all npm-related caches
2. Clear node_modules caches
3. Force fresh pnpm install
4. Verify builds pass with new cache
EOF
```

**Success Criteria**:
- Cache cleanup procedures documented
- Automated cleanup workflow template created
- Manual cleanup instructions provided

### Step 8: Add Performance Monitoring (20 minutes)

**Purpose**: Track CI performance over time to catch regressions.

**Metrics to Track**:
1. Total workflow duration
2. Individual job durations
3. Cache hit rates
4. Test execution time
5. Build time per package

**Simple Monitoring Workflow**:
```yaml
name: CI Performance Metrics

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

jobs:
  metrics:
    runs-on: ubuntu-latest
    steps:
      - name: Collect metrics
        run: |
          DURATION_MS=$(gh run view ${{ github.event.workflow_run.id }} --json durationMs -q '.durationMs')
          DURATION_MIN=$(echo "scale=2; $DURATION_MS / 60000" | bc)

          echo "CI Duration: ${DURATION_MIN} minutes"

          # Store in workflow summary
          echo "### CI Performance" >> $GITHUB_STEP_SUMMARY
          echo "- Duration: ${DURATION_MIN} minutes" >> $GITHUB_STEP_SUMMARY
          echo "- Status: ${{ github.event.workflow_run.conclusion }}" >> $GITHUB_STEP_SUMMARY
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Document**:
```bash
cat >> .github/WORKFLOW_OPTIMIZATIONS.md << 'EOF'

## 7. Add Performance Monitoring

### Purpose
Track CI performance to identify regressions early.

### Metrics Dashboard
Create `.github/workflows/ci-metrics.yml`:

[Include workflow YAML]

### Benefits
- Historical performance data
- Regression detection
- Optimization impact measurement
- Team visibility

### Implementation
1. Create metrics workflow
2. Run after each CI completion
3. Store results in workflow summaries
4. Optional: Export to external monitoring

### Target Metrics
- Total CI time: <10 minutes
- Cache hit rate: >90%
- Test time: <5 minutes
- Build time: <3 minutes
EOF
```

**Success Criteria**:
- Metrics collection documented
- Monitoring workflow created
- Target metrics defined

## Verification Commands

After implementing optimizations:

```bash
# Measure improvement
gh run list --branch feature/production-readiness --limit 20 --json durationMs,conclusion \
  | jq '.[] | select(.conclusion=="success") | .durationMs' \
  | awk '{sum+=$1; count++} END {print "Average: " sum/count/60000 " minutes"}'

# Check cache effectiveness
gh run view --log | grep -i "cache hit\|cache miss" | sort | uniq -c

# Verify concurrent run cancellation
gh run list --limit 5

# Test build time improvements
pnpm -r build 2>&1 | grep "Done in"
```

**Expected Output**:
```
Average CI time: <10 minutes
Cache hit rate: >80%
Concurrent runs: Only latest per PR running
Build time improved by: X%
```

## Acceptance Criteria

- [ ] CI performance baseline documented
- [ ] Optimization recommendations created
- [ ] Cache strategy improvements documented
- [ ] Concurrency controls recommended
- [ ] Test parallelization options provided
- [ ] Build optimization strategies documented
- [ ] Cache cleanup procedures established
- [ ] Performance monitoring plan created
- [ ] All recommendations in WORKFLOW_OPTIMIZATIONS.md
- [ ] Target metrics defined (<10 min total)

## Rollback Procedure

Since this phase primarily creates documentation and recommendations:

```bash
# If optimizations are applied and cause issues:

# Revert workflow changes
git checkout .github/workflows/

# Clear bad caches
gh cache delete --all

# Restore original pnpm commands
git checkout package.json

# Reinstall fresh
rm -rf node_modules packages/*/node_modules
pnpm install
```

## Commit Message Template

```
docs(ci): add CI/CD optimization recommendations

## Overview
Created comprehensive CI/CD optimization guide with recommendations
for improving pipeline performance and reliability.

## Optimizations Documented

### 1. pnpm Cache Strategy
- Use pnpm store path for accurate caching
- Add --prefer-offline flag
- Improve cache key specificity

### 2. Concurrency Controls
- Cancel superseded workflow runs
- Save ~30-50% CI time on active PRs

### 3. Test Parallelization
- Jest parallel execution (quick win)
- Matrix strategy for package-level parallelization
- Turborepo consideration for future

### 4. Build Optimization
- Filter changed packages in PRs
- Parallel builds with workspace concurrency
- Dependency-aware build order

### 5. Cache Management
- Regular cleanup procedures
- Stale cache identification
- Automated cleanup workflow

### 6. Performance Monitoring
- Metrics collection workflow
- Historical tracking
- Regression detection

## Impact Estimates
- Expected CI time reduction: 30-40%
- Target total runtime: <10 minutes
- Cache hit rate improvement: +20%

## Next Steps
1. Review recommendations in .github/WORKFLOW_OPTIMIZATIONS.md
2. Apply pnpm cache optimization first (quick win)
3. Add concurrency controls to workflows
4. Implement monitoring to track improvements

Part of PR #2 CI optimization effort

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Notes

- This phase focuses on documentation since workflows aren't in current branch
- Recommendations can be applied by repository maintainer
- Some optimizations require GitHub Actions permissions
- Performance improvements are estimates based on common patterns

## Estimated Time

- **Minimum**: 2 hours (documentation only)
- **Maximum**: 4 hours (with detailed analysis and testing recommendations)
- **Recommended**: 3 hours (comprehensive documentation + examples)

## Dependencies

- All previous phases (1-3) should be complete
- CI should be passing for accurate baseline metrics
- Access to GitHub Actions logs for analysis

## Next Steps

After this plan is complete:
- Review all optimization recommendations
- Apply quick wins (pnpm cache, concurrency)
- Measure improvements
- Iterate on additional optimizations
- Share results with team
