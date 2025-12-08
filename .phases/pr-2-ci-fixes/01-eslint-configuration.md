# Phase Plan: ESLint Configuration Fixes

## Objective

Fix ESLint configuration errors causing lint failures across client packages.

## Context

**Problem**: Multiple client packages are missing ESLint configuration files, causing CI lint jobs to fail.

**Affected Packages**:
- `packages/client-apollo/apollo`
- `packages/client-react-query/react-query`
- `packages/client-relay/relay`

**Error Message**:
```
ESLint couldn't find a configuration file. To set up a configuration file for this project, please run:
    npm init @eslint/config
```

**Current State**:
- Packages have `lint` scripts in package.json that run `eslint src/**/*.ts`
- No `.eslintrc.json` or `.eslintrc.js` files exist
- ESLint dependencies are already installed in devDependencies

## Files to Modify/Create

### Create:
- `packages/client-apollo/apollo/.eslintrc.json`
- `packages/client-react-query/react-query/.eslintrc.json`
- `packages/client-relay/relay/.eslintrc.json`
- `packages/client-urql/urql/.eslintrc.json` (verify if needed)

### Reference (for configuration):
- `packages/server-node/.eslintrc.json` (if exists)
- Root `.eslintrc.json` (if exists)

## DO NOT

- ❌ Change existing lint scripts in package.json
- ❌ Remove or modify existing ESLint dependencies
- ❌ Fix linting errors at this stage (just get ESLint running)
- ❌ Update ESLint to v9+ (stay on v8 for compatibility)
- ❌ Add new ESLint plugins beyond what's already in devDependencies

## Implementation Steps

### Step 1: Investigate Existing ESLint Configuration (15 minutes)

**Purpose**: Understand the project's ESLint setup and standards.

**Commands**:
```bash
# Check for root ESLint config
cat .eslintrc.json 2>/dev/null || cat .eslintrc.js 2>/dev/null || echo "No root config"

# Check server-node package for reference
cat packages/server-node/.eslintrc.json 2>/dev/null || echo "No server config"

# List all existing ESLint configs
find packages -name ".eslintrc*" -o -name "eslint.config.*"

# Check what ESLint plugins are installed
grep -r "@typescript-eslint" packages/*/package.json
grep -r "eslint-plugin" packages/*/package.json
```

**Expected Output**:
- List of existing ESLint configurations (if any)
- Installed ESLint plugins and versions
- TypeScript ESLint parser version

**Success Criteria**:
- You have a reference configuration to work from, OR
- You understand the project needs a new standard configuration

### Step 2: Create Base ESLint Configuration (30 minutes)

**Purpose**: Create a standard ESLint configuration for TypeScript React packages.

**For each affected package**, create `.eslintrc.json`:

**File**: `packages/client-apollo/apollo/.eslintrc.json`
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    },
    "project": "./tsconfig.json"
  },
  "plugins": [
    "@typescript-eslint"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }]
  },
  "env": {
    "node": true,
    "es2020": true
  }
}
```

**File**: `packages/client-react-query/react-query/.eslintrc.json`
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    },
    "project": "./tsconfig.json"
  },
  "plugins": [
    "@typescript-eslint"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }]
  },
  "env": {
    "node": true,
    "es2020": true
  }
}
```

**File**: `packages/client-relay/relay/.eslintrc.json`
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    },
    "project": "./tsconfig.json"
  },
  "plugins": [
    "@typescript-eslint"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }]
  },
  "env": {
    "node": true,
    "es2020": true
  }
}
```

**Commands**:
```bash
# Create all ESLint configs
cat > packages/client-apollo/apollo/.eslintrc.json << 'EOF'
[paste JSON above]
EOF

cat > packages/client-react-query/react-query/.eslintrc.json << 'EOF'
[paste JSON above]
EOF

cat > packages/client-relay/relay/.eslintrc.json << 'EOF'
[paste JSON above]
EOF
```

**Success Criteria**:
- All three `.eslintrc.json` files created
- JSON is valid (use `jq . < file.json` to verify)

### Step 3: Verify ESLint Runs (15 minutes)

**Purpose**: Ensure ESLint can now execute without configuration errors.

**Commands**:
```bash
# Test each package individually
cd packages/client-apollo/apollo && pnpm lint 2>&1 | head -20
cd ../../../

cd packages/client-react-query/react-query && pnpm lint 2>&1 | head -20
cd ../../../

cd packages/client-relay/relay && pnpm lint 2>&1 | head -20
cd ../../../

# Test all at once from root
pnpm -r --filter "./packages/client-*" lint 2>&1 | grep -E "lint:|error|Error|warning|Warning|✓|✔"
```

**Expected Output**:
- ESLint runs without "couldn't find configuration" errors
- May show linting errors (that's okay for now)
- Should NOT show configuration file errors

**Success Criteria**:
- No "ESLint couldn't find a configuration file" errors
- ESLint executes and analyzes files
- Exit codes may be non-zero (linting errors are acceptable at this stage)

### Step 4: Check for urQL Package (10 minutes)

**Purpose**: Verify if client-urql also needs configuration.

**Commands**:
```bash
# Check if urql has lint script
grep "lint" packages/client-urql/urql/package.json

# Check if urql has ESLint config
ls packages/client-urql/urql/.eslintrc* 2>/dev/null || echo "No ESLint config"

# Try running urql lint
cd packages/client-urql/urql && pnpm lint 2>&1
```

**If urql needs configuration**:
Create `packages/client-urql/urql/.eslintrc.json` with the same content as above.

**Success Criteria**:
- urQL package status determined (has config OR doesn't need lint)

### Step 5: Address Common Linting Errors (Optional - 1-2 hours)

**Purpose**: Fix any critical linting errors that would block CI.

**Note**: This step is OPTIONAL. The goal is to get ESLint running, not to fix all errors.

**Commands**:
```bash
# Get summary of linting errors
pnpm -r --filter "./packages/client-*" lint 2>&1 | grep "error" | sort | uniq -c

# Fix auto-fixable issues only
pnpm -r --filter "./packages/client-*" run lint -- --fix
```

**Focus on**:
- Unused imports (auto-fixable)
- Simple formatting issues (auto-fixable)

**Ignore for now**:
- Complex refactoring needed
- Type-related errors (handle in Phase 2)

**Success Criteria**:
- Auto-fixable issues are fixed
- Manual fixes are documented for later

### Step 6: Verify Locally (10 minutes)

**Purpose**: Ensure all changes work before committing.

**Commands**:
```bash
# Full lint check from root
pnpm -r lint 2>&1 | tee lint-results.txt

# Check exit code
echo "Exit code: $?"

# Count errors
grep -c "error" lint-results.txt || echo "0 errors"
grep -c "warning" lint-results.txt || echo "0 warnings"
```

**Expected Output**:
- ESLint runs on all packages
- Configuration errors are gone
- May still have linting rule violations (acceptable)

**Success Criteria**:
- No "configuration file not found" errors
- ESLint executes successfully across all client packages

## Verification Commands

After completing all steps:

```bash
# Verify ESLint configs exist
ls -la packages/client-apollo/apollo/.eslintrc.json
ls -la packages/client-react-query/react-query/.eslintrc.json
ls -la packages/client-relay/relay/.eslintrc.json

# Verify ESLint can parse configs
cd packages/client-apollo/apollo && npx eslint --print-config src/index.ts | head -20

# Run lint across all packages
pnpm -r lint --if-present

# Check specific packages
pnpm --filter @graphql-cascade/apollo lint
pnpm --filter @graphql-cascade/react-query lint
pnpm --filter @graphql-cascade/relay lint
```

**Expected Verification Output**:
```
✓ All .eslintrc.json files exist
✓ ESLint can parse all configurations
✓ No "configuration not found" errors
⚠ May have linting rule violations (to be fixed separately)
```

## Acceptance Criteria

- [ ] ESLint configuration files created for all affected packages
- [ ] ESLint runs without configuration errors
- [ ] `pnpm -r lint` executes successfully (may have warnings/errors)
- [ ] No "couldn't find configuration file" messages
- [ ] All changes committed with clear commit message
- [ ] CI lint job progresses past configuration stage

## Rollback Procedure

If this plan causes issues:

```bash
# Remove all created ESLint configs
rm packages/client-apollo/apollo/.eslintrc.json
rm packages/client-react-query/react-query/.eslintrc.json
rm packages/client-relay/relay/.eslintrc.json
rm packages/client-urql/urql/.eslintrc.json  # if created

# Restore from git if modified
git checkout packages/*/package.json
```

## Commit Message Template

```
fix(lint): add ESLint configuration for client packages

## Problem
Client packages (apollo, react-query, relay) were missing .eslintrc.json
files, causing "couldn't find configuration file" errors in CI.

## Solution
- Added .eslintrc.json to client-apollo/apollo
- Added .eslintrc.json to client-react-query/react-query
- Added .eslintrc.json to client-relay/relay
- Configured TypeScript ESLint parser and plugins
- Set recommended rules for TypeScript projects

## Verification
- ESLint now runs successfully on all client packages
- pnpm -r lint executes without configuration errors
- Verified locally with pnpm -r lint

Fixes CI lint failures in PR #2

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Notes

- This plan focuses ONLY on getting ESLint running, not on fixing all linting errors
- Linting rule violations can be addressed in a follow-up phase
- The configuration is intentionally lenient to avoid blocking CI
- Some rules are set to "warn" instead of "error" for gradual improvement

## Estimated Time

- **Minimum**: 1.5 hours (just configuration files, no fixes)
- **Maximum**: 3 hours (with optional linting error fixes)
- **Recommended**: 2 hours (configuration + critical auto-fixes)

## Dependencies

- None (can start immediately)

## Next Steps

After this plan is complete:
- Proceed to Phase 2: TypeScript Build Fixes (02-typescript-build-fixes.md)
- Or work in parallel with Phase 2 if separate teams available
