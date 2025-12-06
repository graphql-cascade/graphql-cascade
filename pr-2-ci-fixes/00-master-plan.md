# PR-2 CI Fixes Master Plan

## Overview
Fix CI pipeline failures by implementing consistent ESLint configuration across all TypeScript packages in the monorepo.

## Issues Identified
- Multiple packages missing ESLint configuration files (.eslintrc.js)
- Inconsistent linting setup across workspaces
- CI linting fails due to missing configs in client-apollo, client-react-query, client-relay packages

## Phases

### Phase 1: ESLint Configuration ✅ COMPLETED
- Create consistent .eslintrc.js files for all TypeScript packages
- Ensure all packages have proper lint scripts
- Test linting works across all workspaces

### Phase 2: TypeScript Build Fixes
- Fix any TypeScript compilation errors
- Update tsconfig.json files if needed
- Ensure all packages build successfully

### Phase 3: Test Infrastructure
- Fix any test configuration issues
- Ensure Jest configs are consistent
- Run test suites to verify functionality

### Phase 4: CI/CD Optimization
- Update GitHub Actions workflows
- Optimize build times
- Add caching for dependencies

## Success Criteria
- `npm run lint` passes across all workspaces
- `npm run build` completes successfully
- `npm run test` runs without configuration errors
- CI pipeline passes all checks

## Files to Modify
- packages/client-apollo/apollo/.eslintrc.js (create)
- packages/client-react-query/react-query/.eslintrc.js (create)
- packages/client-relay/relay/.eslintrc.js (create)
- packages/client-urql/urql/.eslintrc.js (create)
- packages/server-node/.eslintrc.js (create)
- Various package.json files for lint script consistency