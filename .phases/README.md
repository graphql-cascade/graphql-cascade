# Production Readiness Phase Plan

## Overview
This directory contains detailed phase plans for fixing the final two CI failures blocking production readiness:

1. **CodeQL Security Vulnerability**: TOCTOU race condition in CLI init command
2. **Apollo Test Coverage**: Below 70% threshold (error-handling.ts and hooks.ts untested)

## Phase Execution Order

Execute phases sequentially. Each phase depends on the previous phase completing successfully.

### Phase 01: Fix CodeQL TOCTOU Vulnerability
**File**: `01-fix-codeql-toctou.md`
**Estimated Time**: 30-45 minutes
**Complexity**: Medium

**What**: Refactor `packages/cli/src/commands/init.ts` to use atomic file operations
**Why**: Eliminate Time-Of-Check-Time-Of-Use security vulnerability
**Impact**: Fixes high-severity CodeQL alert, no user-facing changes

**Success Criteria**:
- [ ] CodeQL scan passes
- [ ] All existing CLI tests pass
- [ ] Manual testing confirms functionality preserved

---

### Phase 02: Add error-handling.ts Tests
**File**: `02-add-error-handling-tests.md`
**Estimated Time**: 2-3 hours
**Complexity**: High

**What**: Write comprehensive tests for Apollo error handling and retry logic
**Success Criteria**:
- [ ] error-handling.ts coverage ≥ 70%
- [ ] All error-handling tests pass

---

### Phase 03: Add hooks.ts Tests
**File**: `03-add-hooks-tests.md`
**Estimated Time**: 2-3 hours
**Complexity**: High

**What**: Write comprehensive tests for cascade mutation hooks
**Success Criteria**:
- [ ] hooks.ts coverage ≥ 70%
- [ ] Combined Apollo coverage ≥ 70%

---

### Phase 04: Final Verification
**File**: `04-final-verification.md`
**Estimated Time**: 30-45 minutes
**Complexity**: Low

**What**: Verify all fixes, run full CI, commit changes
**Success Criteria**:
- [ ] All CI jobs green
- [ ] Production ready

---

## Quick Start

Read each phase file for detailed implementation steps, verification commands, and acceptance criteria.

**Recommended execution**: Follow phases 01 → 02 → 03 → 04 sequentially.
