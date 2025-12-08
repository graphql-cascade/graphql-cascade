# Version Alignment Cleanup

**Priority**: HIGH
**Estimated Time**: 2-3 hours
**Status**: NOT STARTED

---

## Problem Statement

During development, version references drifted creating inconsistency:

1. **Specification references**: Documentation refers to "v1.1" error codes
2. **Actual package versions**: All packages are at `0.2.0`
3. **Git tags**: There's a `v1.1.0` tag but it doesn't align with package versions
4. **Directory naming**: `.phases/error-codes-v1.1/` implies specification version, not package version

This creates confusion about:
- What version users should expect
- What the next release version should be
- Whether "v1.1" refers to spec version or package version

---

## Current State

### Package Versions (Actual)
```json
@graphql-cascade/server@0.2.0
@graphql-cascade/client@0.2.0
@graphql-cascade/apollo@0.2.0
@graphql-cascade/react-query@0.2.0
@graphql-cascade/relay@0.2.0
@graphql-cascade/urql@0.2.0
```

### Git Tags
```
v1.1.0                                    (confusing - doesn't match package versions)
@graphql-cascade/client-core@0.2.0
@graphql-cascade/server@0.2.0
```

### Documentation References
- `.phases/error-codes-v1.1/` directory
- Multiple references to "v1.1 error codes" in documentation
- Commit messages referencing "v1.1"

---

## Desired State

### Clear Separation of Concerns

1. **Specification Version**: Can evolve independently (e.g., spec v1.1, v2.0)
2. **Package Version**: Follows semver based on package changes (0.x.y for pre-1.0)
3. **Error Codes Version**: Part of specification, not package version

### Naming Convention

- **Specification versions**: `spec-v1.1`, `spec-v2.0` (in docs)
- **Package versions**: `0.1.0`, `0.2.0`, `0.3.0`, `1.0.0` (semver)
- **Feature names**: "error-codes-enhancement", "production-readiness" (descriptive)

---

## Implementation Plan

### Phase 1: Audit Current References

**Goal**: Find all "v1.1" references in codebase

**Commands**:
```bash
# Search for v1.1 references
grep -r "v1\.1" --include="*.md" --include="*.ts" --include="*.js" \
  specification docs packages .phases \
  | grep -v node_modules

# Search for version references in code comments
grep -r "version.*1\.1" --include="*.ts" --include="*.js" \
  packages reference \
  | grep -v node_modules

# List all git tags
git tag --list | sort -V
```

**Acceptance Criteria**:
- [ ] Complete list of files with "v1.1" references
- [ ] Complete list of git tags
- [ ] Understanding of what each reference means

---

### Phase 2: Rename Phase Directories

**Goal**: Rename confusing directory names to be feature-based

**Actions**:
```bash
# Rename error-codes-v1.1 to error-codes-enhancement
git mv .phases/error-codes-v1.1 .phases/error-codes-enhancement

# Update any references to the old path
grep -r "error-codes-v1.1" .phases --include="*.md" \
  | cut -d: -f1 \
  | sort -u \
  | xargs sed -i 's/error-codes-v1\.1/error-codes-enhancement/g'
```

**Files to Update**:
- `.phases/error-codes-v1.1/` → `.phases/error-codes-enhancement/`
- Any files referencing this path
- INDEX.md files

**Acceptance Criteria**:
- [ ] Directory renamed
- [ ] All internal references updated
- [ ] No broken links in documentation

---

### Phase 3: Update Documentation Language

**Goal**: Change "v1.1 error codes" to "enhanced error codes" or "production error codes"

**Search and Replace Patterns**:

```bash
# In .phases directory
find .phases -name "*.md" -type f -exec sed -i \
  's/v1\.1 error codes/enhanced error codes/g' {} \;

find .phases -name "*.md" -type f -exec sed -i \
  's/Error Codes v1\.1/Error Codes Enhancement/g' {} \;

# In specification directory
find specification -name "*.md" -type f -exec sed -i \
  's/added in v1\.1/added in spec v1.1/g' {} \;
```

**Key Changes**:
- "v1.1 error codes" → "enhanced error codes" (in implementation docs)
- "added in v1.1" → "added in spec v1.1" (in specification)
- "GraphQL Cascade v1.1" → "GraphQL Cascade specification v1.1" (when referring to spec)

**Files to Update**:
- All markdown files in `.phases/error-codes-enhancement/`
- Specification files that mention version
- README files
- CHANGELOG files

**Acceptance Criteria**:
- [ ] No ambiguous "v1.1" references without context
- [ ] Clear distinction between spec version and package version
- [ ] Documentation reads naturally

---

### Phase 4: Clean Up Git Tags

**Goal**: Remove confusing tags and establish clear tagging strategy

**Analysis**:
```bash
# Check what's at v1.1.0 tag
git show v1.1.0 --stat | head -20

# Check for any published packages at that version
npm view @graphql-cascade/server versions
```

**Decision Tree**:

1. **If v1.1.0 was never published to npm**:
   ```bash
   # Safe to delete local tag
   git tag -d v1.1.0

   # If it was pushed to remote
   git push origin :refs/tags/v1.1.0
   ```

2. **If v1.1.0 WAS published to npm**:
   - Leave tag as-is (can't unpublish)
   - Document it as a legacy tag
   - Start fresh with 0.3.0 for next release

**Acceptance Criteria**:
- [ ] Clear tagging strategy documented
- [ ] No confusing orphan tags
- [ ] Decision documented for future releases

---

### Phase 5: Establish Next Version Number

**Goal**: Determine and document next release version

**Decision Factors**:

1. **Has 0.2.0 been published to npm?**
   ```bash
   npm view @graphql-cascade/server versions
   ```

2. **What changes are in current branch?**
   - Error codes enhancement (breaking? no - backward compatible)
   - New features added (minor bump)
   - Bug fixes only (patch bump)

**Recommendation**:

Given that error codes were added in backward-compatible way:

- **Current**: `0.2.0` (has enhanced error codes)
- **Next release**: `0.3.0` (production readiness features)
- **After stabilization**: `1.0.0` (first stable release)

**Acceptance Criteria**:
- [ ] Next version number decided: `0.3.0`
- [ ] Versioning strategy documented in CONTRIBUTING.md
- [ ] Team aligned on version semantics

---

### Phase 6: Update VERSION Constants

**Goal**: Update any hardcoded VERSION constants in code

**Files to Check**:
```bash
# Find VERSION exports
grep -r "export.*VERSION" packages --include="*.ts" | grep -v node_modules

# Find version strings in code
grep -r '"version".*:' packages --include="*.ts" | grep -v node_modules
```

**Updates Needed**:
```typescript
// packages/server-node/src/index.ts
export const VERSION = '0.2.0';  // Already correct

// Any other VERSION constants should match package.json
```

**Acceptance Criteria**:
- [ ] All VERSION constants match package.json
- [ ] No hardcoded "1.1" version strings
- [ ] Build succeeds after changes

---

### Phase 7: Update CHANGELOG

**Goal**: Clarify version history in CHANGELOG

**Add Section**:
```markdown
## Version Numbering Clarification

This project uses **semantic versioning** for package versions:
- Package versions: 0.x.y (pre-1.0), 1.x.y (stable)
- Specification versions: Referenced as "spec vX.Y" in docs
- Feature names: Descriptive (e.g., "error-codes-enhancement")

### Historical Notes
- **v1.1.0 tag**: Early tag that doesn't follow our semver convention.
  Ignore this tag - actual package versions are 0.2.0.
- **"v1.1 error codes"**: Refers to specification v1.1, not package version.
  These are included in package version 0.2.0.

## [0.2.0] - 2025-12-04

### Added
- Enhanced error codes (spec v1.1 compliance)
  - TIMEOUT, RATE_LIMITED, SERVICE_UNAVAILABLE
  - VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, FORBIDDEN
  - CONFLICT, TRANSACTION_FAILED, INTERNAL_ERROR
- Error handling utilities in all client packages
- Convenience functions for error creation
- Comprehensive error tests

### Changed
- Renamed CascadeError type to CascadeErrorInfo for clarity
- Bumped all packages to 0.2.0

## [0.1.0] - Previous Release
...
```

**Acceptance Criteria**:
- [ ] CHANGELOG clarifies version numbering
- [ ] Historical confusion documented
- [ ] 0.2.0 entry is accurate

---

## Verification Checklist

After completing all phases:

```bash
# No "v1.1" without "spec" qualifier in docs
grep -r "v1\.1" specification docs .phases --include="*.md" \
  | grep -v "spec v1.1" \
  | grep -v "specification v1.1"
# Should return: nothing or only acceptable references

# No orphan v1.1 tags
git tag --list | grep "v1.1"
# Should return: nothing (or documented legacy tag)

# All packages at same version
grep '"version"' packages/*/package.json packages/*/*/package.json \
  | grep -v node_modules
# Should all show: 0.2.0

# VERSION constants match
grep "VERSION.*=" packages/*/src/index.ts \
  | grep -v node_modules
# Should all show: 0.2.0

# Build succeeds
pnpm build
# Should succeed without errors

# Tests pass
pnpm test
# Should pass
```

---

## Documentation Updates Needed

1. **CONTRIBUTING.md** - Add versioning strategy section
2. **README.md** - Update version badges if present
3. **docs/releases/** - Add version numbering guide
4. **.phases/README.md** - Update phase naming convention

---

## Communication Plan

1. **Update GitHub Issues**:
   - Close any referencing "v1.1" incorrectly
   - Update milestones to use 0.3.0, 1.0.0, etc.

2. **Update PRs**:
   - Review open PRs for version references
   - Update descriptions if needed

3. **Team Communication**:
   - Announce version numbering clarification
   - Share updated CONTRIBUTING.md
   - Explain spec version vs package version

---

## Next Release Planning

After this cleanup, the next release should be:

**Version**: `0.3.0`
**Codename**: "Production Readiness"
**Branch**: `feature/production-readiness` (current)
**Contents**:
- All error codes enhancement work (from 0.2.0)
- Production hardening features
- Observability improvements
- Security best practices
- Health checks

**Timeline**: After Phase 22 completion

---

## Success Criteria

✅ All "v1.1" references are qualified (e.g., "spec v1.1") or removed
✅ Directory names reflect features, not versions
✅ Git tags align with package versions
✅ Next version number is clear: `0.3.0`
✅ Documentation is consistent and unambiguous
✅ CHANGELOG clarifies version history
✅ Versioning strategy is documented
✅ All tests pass
✅ All packages build

---

## Related Documentation

- `.phases/error-codes-enhancement/README.md` (after rename)
- `CONTRIBUTING.md` (to be updated)
- `CHANGELOG.md` (to be updated)
- `specification/VERSIONING.md` (to be created)

---

## Notes for Future

**Versioning Best Practices**:
1. Use semver for package versions (0.x.y before 1.0.0)
2. Use "spec vX.Y" for specification versions
3. Use descriptive names for features/phases
4. Tag releases only when published to npm
5. Keep CHANGELOG.md accurate and up-to-date
6. Document version decisions in commit messages

**Avoid**:
- Mixing spec version and package version
- Creating tags before publishing
- Using version numbers in phase/directory names
- Ambiguous version references in docs
