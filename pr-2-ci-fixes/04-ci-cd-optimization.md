# Phase 4: CI/CD Optimization

## Objective
Optimize CI pipeline performance and reliability by implementing caching improvements, fixing docs build issues, and adding performance monitoring.

## Current Issues Identified
- **Docs build failure**: Docs directory not in pnpm workspace, CI tries to install with pnpm but no pnpm-lock.yaml exists
- **Suboptimal caching**: Using basic pnpm caching instead of optimized store path caching
- **No performance monitoring**: No visibility into CI performance trends
- **Missing concurrency controls**: Multiple pushes can trigger overlapping runs

## Implementation Steps

### 1. Fix Docs Build Issue
- Add docs to pnpm workspace or create separate pnpm-lock.yaml for docs
- Update CI workflow to properly install docs dependencies
- Ensure docs build works consistently

### 2. Improve pnpm Caching
- Update all workflows to use optimized pnpm store path caching
- Add `--prefer-offline` flag for better cache utilization
- Remove unnecessary node_modules caching

### 3. Add Concurrency Controls
- Add concurrency groups to prevent overlapping runs
- Enable `cancel-in-progress: true` for faster feedback

### 4. Add Performance Monitoring
- Create CI metrics workflow to track performance
- Monitor cache effectiveness and build times
- Set up performance baselines

### 5. Optimize Test Parallelization
- Enable Jest parallel execution with `--maxWorkers=50%`
- Consider matrix strategy for package-level parallelization

## Files to Modify
- `pnpm-workspace.yaml` - Add docs to workspace
- `.github/workflows/ci.yml` - Update caching and add concurrency
- `.github/workflows/deploy-docs.yml` - Fix docs dependency installation
- `.github/workflows/validate-docs.yml` - Update caching
- `docs/package.json` - Ensure proper dependency management
- New: `.github/workflows/ci-metrics.yml` - Performance monitoring

## Verification Commands
```bash
# Test docs build
cd docs && pnpm install && pnpm run build

# Test optimized caching
pnpm install --frozen-lockfile --prefer-offline

# Check workspace includes docs
pnpm ls --depth -1

# Verify CI workflows
act --list
```

## Acceptance Criteria
- [x] Docs build passes consistently in CI
- [x] pnpm caching uses optimized store paths
- [x] Concurrency controls prevent overlapping runs
- [x] CI performance metrics are collected
- [x] Test parallelization improves execution time
- [x] All workflows use consistent caching strategy

## Summary of Changes
- **Fixed docs build**: Added docs to pnpm workspace, removed redundant CI steps, configured vitepress to ignore dead links
- **Optimized pnpm caching**: Updated all workflows to use `pnpm store path` with `--prefer-offline` flag
- **Added concurrency controls**: Implemented workflow-level concurrency to prevent overlapping runs
- **Created performance monitoring**: Added `ci-metrics.yml` workflow to track CI performance
- **Enabled test parallelization**: Updated all Jest test scripts to use `--maxWorkers=50%` for parallel execution