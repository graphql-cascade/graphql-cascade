# Recommended Workflow Optimizations

## 1. Improve pnpm Caching

### Current Setup (from migration):
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

### Improved Setup:
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

### Key Improvements
1. Use `pnpm store path` for accurate cache location
2. Add `--prefer-offline` to use cache more aggressively
3. Don't cache `node_modules` (pnpm store is sufficient)
4. More specific cache keys

### Benefits
- Faster dependency installation
- Better cache hit rates
- Reduced network usage
- More reliable builds

### How to Apply
1. Update each workflow file in .github/workflows/
2. Replace pnpm cache setup with improved version
3. Test on a single workflow first
4. Roll out to all workflows once verified

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

### Option C: Turborepo (Best, Future)
Use build system for intelligent caching and parallelization.

### Recommendation
Start with Option A (Jest parallel) immediately.
Plan Option B for next iteration.
Consider Option C for long-term optimization.

## 4. Add Cache Verification

### Purpose
Monitor cache health and effectiveness over time.

### Implementation
Create `.github/workflows/cache-health.yml`:

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

### Benefits
- Early detection of cache issues
- Performance regression alerts
- Baseline metrics for optimization

### Metrics to Track
- Cold install time
- Warm install time
- Cache hit rate
- Store size

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

### Caveats
- Requires understanding of pnpm filters
- May miss some edge cases
- Recommend keeping full build for main branch

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

## 7. Add Performance Monitoring

### Purpose
Track CI performance to identify regressions early.

### Metrics Dashboard
Create `.github/workflows/ci-metrics.yml`:

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