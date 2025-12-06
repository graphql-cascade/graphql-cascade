# Phase Plan: TypeScript Build Fixes

## Objective

Fix TypeScript compilation errors in the CLI package causing build failures in CI.

## Context

**Problem**: The CLI package has module resolution failures in CI but builds successfully locally.

**Affected Package**:
- `packages/cli`

**Errors in CI**:
```
src/commands/doctor.ts(2,32): error TS2307: Cannot find module '../lib/diagnostics' or its corresponding type declarations.
src/commands/doctor.ts(15,32): error TS7006: Parameter 'check' implicitly has an 'any' type.
src/commands/doctor.ts(23,34): error TS7006: Parameter 'warning' implicitly has an 'any' type.
src/commands/doctor.ts(31,32): error TS7006: Parameter 'error' implicitly has an 'any' type.
src/commands/validate.ts(2,58): error TS2307: Cannot find module '../lib/schema-validator' or its corresponding type declarations.
```

**Local Build Status**: ✅ Builds successfully
**CI Build Status**: ❌ Fails

**Root Cause Hypothesis**:
1. CI cache issues causing stale module resolution
2. TypeScript strict mode differences between local and CI
3. Missing type annotations causing stricter CI checks to fail

## Already Completed

**Before starting this plan**, the following TypeScript issues were already fixed (commit `537d5c6`):

### ✅ Missing @types/react Dependencies
- Added `@types/react@^18.0.0` to:
  - `packages/client-apollo/apollo/package.json`
  - `packages/client-relay/relay/package.json`
- Updated `pnpm-lock.yaml` with new dependencies
- **Impact**: Resolves "Could not find declaration file for module 'react'" errors

**What This Plan Still Needs to Fix**:
- CLI package module resolution errors
- Implicit 'any' type errors in doctor.ts and validate.ts
- tsconfig.json exclude pattern issues

## Files to Modify/Create

### Investigate:
- `packages/cli/tsconfig.json`
- `packages/cli/package.json`
- `packages/cli/src/commands/doctor.ts`
- `packages/cli/src/commands/validate.ts`
- `packages/cli/src/lib/diagnostics.ts`
- `packages/cli/src/lib/schema-validator.ts`

### Potentially Modify:
- `packages/cli/tsconfig.json` (compiler options)
- `packages/cli/src/commands/doctor.ts` (type annotations)
- `packages/cli/src/commands/validate.ts` (type annotations)

## DO NOT

- ❌ Change the actual logic of doctor or validate commands
- ❌ Remove the lib files (they exist and are correct)
- ❌ Disable TypeScript strict mode globally
- ❌ Add `@ts-ignore` or `@ts-expect-error` comments
- ❌ Change the module system (keep CommonJS)
- ❌ Modify import paths (they are correct)

## Implementation Steps

### Step 1: Reproduce Issue Locally (20 minutes)

**Purpose**: Understand why CI fails but local builds succeed.

**Commands**:
```bash
# Clean build to simulate CI
cd packages/cli
rm -rf dist node_modules
pnpm install
pnpm build 2>&1 | tee build-output.txt

# Check if it fails
echo "Exit code: $?"

# Try with stricter TypeScript settings
cat tsconfig.json

# Try with CI-like environment (no cache)
rm -rf ../../node_modules/.cache
pnpm build
```

**Investigation Checklist**:
- [ ] Does clean build fail locally?
- [ ] Are lib files present in src/lib/?
- [ ] Does TypeScript resolve the modules?
- [ ] Are there any tsconfig differences?

**Success Criteria**:
- You can reproduce the issue locally OR
- You understand why it only fails in CI

### Step 2: Verify File Structure (10 minutes)

**Purpose**: Ensure all expected files exist and are in the correct locations.

**Commands**:
```bash
cd packages/cli

# Verify lib files exist
ls -la src/lib/diagnostics.ts
ls -la src/lib/schema-validator.ts

# Verify commands import correctly
head -5 src/commands/doctor.ts
head -5 src/commands/validate.ts

# Check if files are excluded from compilation
grep -A 5 "exclude\|include" tsconfig.json

# Verify TypeScript can find the files
npx tsc --noEmit --listFiles 2>&1 | grep -E "diagnostics|schema-validator"
```

**Expected Output**:
```
src/lib/diagnostics.ts exists
src/lib/schema-validator.ts exists
Both files should appear in TypeScript compilation list
```

**Success Criteria**:
- All lib files exist
- Files are not excluded from tsconfig
- TypeScript can see the files

### Step 3: Fix Type Annotations in doctor.ts (20 minutes)

**Purpose**: Add explicit type annotations to eliminate implicit 'any' errors.

**File**: `packages/cli/src/commands/doctor.ts`

**Current Code** (lines with errors):
```typescript
import { Command } from 'commander';
import { runDiagnostics } from '../lib/diagnostics';

export const doctorCommand = new Command('doctor')
  .description('Diagnose common GraphQL Cascade issues')
  .action(async () => {
    const results = await runDiagnostics();

    console.log('\n📋 GraphQL Cascade Diagnostics\n');

    const passed = results.filter((check) => check.status === 'pass');
    const warnings = results.filter((warning) => warning.status === 'warn');
    const errors = results.filter((error) => error.status === 'error');

    // ... rest of code
  });
```

**Problem**: Parameters `check`, `warning`, `error` have implicit 'any' type.

**Solution**: Add type import and annotations.

**Check the diagnostics.ts file first**:
```bash
# Find the type definition
grep -A 10 "export.*interface\|export.*type" packages/cli/src/lib/diagnostics.ts | head -20
```

**Expected Fix** (adjust based on actual types found):
```typescript
import { Command } from 'commander';
import { runDiagnostics, DiagnosticResult } from '../lib/diagnostics';

export const doctorCommand = new Command('doctor')
  .description('Diagnose common GraphQL Cascade issues')
  .action(async () => {
    const results = await runDiagnostics();

    console.log('\n📋 GraphQL Cascade Diagnostics\n');

    const passed = results.filter((check: DiagnosticResult) => check.status === 'pass');
    const warnings = results.filter((warning: DiagnosticResult) => warning.status === 'warn');
    const errors = results.filter((error: DiagnosticResult) => error.status === 'error');

    // ... rest of code
  });
```

**OR** (if DiagnosticResult is exported):
```typescript
import { Command } from 'commander';
import { runDiagnostics } from '../lib/diagnostics';
import type { DiagnosticResult } from '../lib/diagnostics';

export const doctorCommand = new Command('doctor')
  .description('Diagnose common GraphQL Cascade issues')
  .action(async () => {
    const results = await runDiagnostics();

    console.log('\n📋 GraphQL Cascade Diagnostics\n');

    const passed = results.filter((check: DiagnosticResult) => check.status === 'pass');
    const warnings = results.filter((warning: DiagnosticResult) => warning.status === 'warn');
    const errors = results.filter((error: DiagnosticResult) => error.status === 'error');

    // ... rest of code
  });
```

**Commands**:
```bash
# Read current diagnostics.ts to find type name
cat packages/cli/src/lib/diagnostics.ts | grep -A 5 "export.*type\|export.*interface"

# Edit doctor.ts to add type annotations
# Use your preferred editor or Edit tool
```

**Success Criteria**:
- Type annotations added to all filter callback parameters
- Type is imported from '../lib/diagnostics'
- No implicit 'any' types remain

### Step 4: Fix Module Import Issues (30 minutes)

**Purpose**: Ensure TypeScript can properly resolve module imports in CI.

**Hypothesis**: The tsconfig might be excluding test files which confuses module resolution.

**Current tsconfig.json**:
```json
{
  "compilerOptions": {
    // ... options
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Problem**: Test files (`diagnostics.test.ts`, `schema-validator.test.ts`) are in `src/lib/` but excluded.

**Solution Option 1 - More Specific Exclude**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "src/**/*.test.ts", "src/**/*.spec.ts"]
}
```

**Solution Option 2 - Separate Test Config**:
Keep main tsconfig clean and create `tsconfig.test.json` for tests.

**Commands**:
```bash
cd packages/cli

# Backup current tsconfig
cp tsconfig.json tsconfig.json.backup

# Update tsconfig (use Edit tool or direct edit)
# Apply Solution Option 1 above

# Test the build
pnpm build

# Verify module resolution
npx tsc --noEmit --listFiles | grep -E "doctor|validate|diagnostics|schema-validator"
```

**Success Criteria**:
- TypeScript compiles without module resolution errors
- Test files are properly excluded
- Source files are properly included

### Step 5: Add Explicit Return Types (Optional - 15 minutes)

**Purpose**: Improve type safety and avoid CI/local differences.

**Files to enhance**:
- `packages/cli/src/lib/diagnostics.ts`
- `packages/cli/src/lib/schema-validator.ts`

**Check if functions have return types**:
```bash
grep -n "export.*function" packages/cli/src/lib/diagnostics.ts
grep -n "export.*function" packages/cli/src/lib/schema-validator.ts
```

**If missing, add explicit return types**:
```typescript
// Before
export async function runDiagnostics() {
  // ...
}

// After
export async function runDiagnostics(): Promise<DiagnosticResult[]> {
  // ...
}
```

**Success Criteria**:
- All exported functions have explicit return types
- TypeScript inference is not relied upon for public API

### Step 6: Test Build Locally (15 minutes)

**Purpose**: Verify all changes work correctly.

**Commands**:
```bash
cd packages/cli

# Clean and rebuild
rm -rf dist
pnpm build

# Check exit code
echo "Build exit code: $?"

# Verify output files
ls -la dist/

# Check for any warnings
pnpm build 2>&1 | grep -i "warning\|error"

# Test from root (simulates CI)
cd ../..
pnpm -r --filter @graphql-cascade/cli build
```

**Expected Output**:
```
✓ TypeScript compilation successful
✓ No errors or warnings
✓ dist/ directory contains compiled files
✓ .d.ts declaration files generated
```

**Success Criteria**:
- Build completes successfully with exit code 0
- No TypeScript errors
- No TypeScript warnings
- dist/ contains all expected files

### Step 7: Test Type Checking Separately (10 minutes)

**Purpose**: Ensure type checking passes independently of build.

**Commands**:
```bash
cd packages/cli

# Run type check only (no emit)
npx tsc --noEmit

# Check specific files
npx tsc --noEmit src/commands/doctor.ts
npx tsc --noEmit src/commands/validate.ts

# Run from root
cd ../..
pnpm -r --filter @graphql-cascade/cli exec tsc --noEmit
```

**Success Criteria**:
- Type checking passes with no errors
- No implicit 'any' errors
- No module resolution errors

## Verification Commands

After completing all steps:

```bash
# Full clean build test
cd packages/cli
rm -rf dist node_modules
pnpm install
pnpm build
echo "Exit code: $?"

# Type check
pnpm exec tsc --noEmit

# Check from root
cd ../..
pnpm -r --filter @graphql-cascade/cli build

# Simulate CI environment
rm -rf packages/cli/dist
rm -rf node_modules/.cache
pnpm -r build 2>&1 | grep -A 5 "packages/cli"
```

**Expected Verification Output**:
```
✓ Clean build succeeds
✓ Type check passes
✓ No module resolution errors
✓ No implicit 'any' errors
✓ dist/ directory populated correctly
```

## Acceptance Criteria

- [ ] TypeScript compiles without errors in packages/cli
- [ ] No "Cannot find module" errors for lib files
- [ ] No implicit 'any' type errors in doctor.ts or validate.ts
- [ ] `pnpm build` succeeds in packages/cli
- [ ] `pnpm -r build` succeeds from root
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] dist/ directory contains all expected output files
- [ ] All changes committed with clear commit message

## Troubleshooting

### Issue: "Cannot find module '../lib/diagnostics'"

**Check**:
```bash
# Verify file exists
ls packages/cli/src/lib/diagnostics.ts

# Check tsconfig includes it
grep -A 3 "include\|exclude" packages/cli/tsconfig.json

# Check TypeScript can see it
cd packages/cli && npx tsc --listFiles | grep diagnostics
```

**Solution**: Ensure test files exclusion doesn't break module graph.

### Issue: "Parameter has implicit 'any' type"

**Check**:
```bash
# Find the type definition
grep "export.*interface\|export.*type" packages/cli/src/lib/diagnostics.ts
```

**Solution**: Import and use the exported type explicitly.

### Issue: Build succeeds locally but fails in CI

**Check**:
```bash
# Compare TypeScript versions
cat package.json | grep typescript
cat packages/cli/package.json | grep typescript

# Check Node version
node --version

# Clean all caches
rm -rf node_modules packages/*/node_modules
rm -rf packages/*/dist
pnpm install
pnpm -r build
```

**Solution**: Ensure no cache dependencies, explicit types everywhere.

## Rollback Procedure

If this plan causes issues:

```bash
# Restore tsconfig
cd packages/cli
cp tsconfig.json.backup tsconfig.json

# Restore source files
git checkout src/commands/doctor.ts
git checkout src/commands/validate.ts

# Clean and rebuild
rm -rf dist
pnpm build
```

## Commit Message Template

```
fix(cli): resolve TypeScript module resolution and type errors

## Problem
CLI package failed to build in CI with two types of errors:
1. "Cannot find module '../lib/diagnostics'" errors
2. "Parameter has implicit 'any' type" errors

These errors only appeared in CI, not locally, indicating
environment-specific TypeScript configuration issues.

## Solution
- Fixed tsconfig.json to properly exclude test files without breaking module resolution
- Added explicit type annotations to doctor.ts filter callbacks
- Imported DiagnosticResult type from diagnostics module
- Added explicit return types to exported functions (type safety)

## Changes
- packages/cli/tsconfig.json: Updated exclude pattern for test files
- packages/cli/src/commands/doctor.ts: Added type annotations
- packages/cli/src/lib/diagnostics.ts: Added explicit return types (optional)

## Verification
- Clean build succeeds: `pnpm build`
- Type check passes: `npx tsc --noEmit`
- Module resolution works correctly
- No implicit 'any' errors

Fixes TypeScript build failures in PR #2

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Notes

- The issue likely stems from test file exclusion affecting module resolution
- TypeScript's module resolution can be sensitive to include/exclude patterns
- CI environments often have stricter checks than local development
- Explicit types are always preferred over relying on inference

## Estimated Time

- **Minimum**: 1 hour (if issue is simple type annotations)
- **Maximum**: 2.5 hours (if tsconfig changes needed + comprehensive type additions)
- **Recommended**: 1.5 hours (type annotations + tsconfig fix)

## Dependencies

- None (can run in parallel with Phase 1: ESLint Configuration)

## Next Steps

After this plan is complete:
- Proceed to Phase 3: Test Infrastructure (03-test-infrastructure.md)
- Verify both Phase 1 and Phase 2 changes work together
- Run full build: `pnpm -r build`
