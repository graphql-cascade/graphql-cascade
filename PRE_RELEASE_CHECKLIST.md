# Pre-Release Checklist for v0.3.0

**Target Release**: v0.3.0 "Production Readiness"
**Current Version**: v0.2.0
**Branch**: feature/production-readiness

---

## Status Overview

Based on current state analysis:
- ✅ Error codes enhancement (v0.2.0) - COMPLETE
- ✅ Version alignment cleanup - COMPLETE
- 🟡 Production hardening (Phase 22) - PARTIAL
- ⏳ Release preparation - TODO

---

## 1. Code Quality & Completeness

### 1.1 Remove TODOs/FIXMEs
**Status**: ⚠️ 1 TODO found

```bash
# Check for remaining TODOs
grep -r "TODO\|FIXME\|XXX\|HACK" packages/*/src packages/*/*/src \
  --include="*.ts" --include="*.js" \
  | grep -v node_modules
```

**Action Items**:
- [ ] Review `packages/client-urql/urql/src/client.ts` - appears to be just example code
- [ ] Remove or document any critical TODOs
- [ ] Convert valid concerns to GitHub issues

---

### 1.2 Phase 22: Production Hardening
**Status**: 🟡 Partially complete (OpenTelemetry added)

**Remaining Tasks**:

#### Task 22.1: Observability / Metrics
- [ ] Implement `MetricsCollector` interface
- [ ] Add `DefaultMetricsCollector` implementation
- [ ] Add OpenTelemetry integration (already started in c1e0ea0)
- [ ] Add Prometheus export function
- [ ] Instrument tracker with metrics
- [ ] Add metrics tests
- [ ] Document metrics API

**Estimated Effort**: 3-4 hours

#### Task 22.2: Security Best Practices
- [ ] Add `fieldFilter` option to CascadeTrackerConfig
- [ ] Add `entityFilter` option (sync/async)
- [ ] Add `validateEntity` option
- [ ] Add `transformEntity` option
- [ ] Add metadata control options to CascadeBuilderConfig
- [ ] Create `docs/guide/security.md`
- [ ] Add security examples

**Estimated Effort**: 2-3 hours

#### Task 22.3: SBOM Generation
- [ ] Create `.github/workflows/sbom.yml`
- [ ] Add `pnpm sbom` script to root package.json
- [ ] Test SBOM generation locally
- [ ] Update SECURITY.md with SBOM info

**Estimated Effort**: 1 hour

#### Task 22.4: Operational Runbook
- [ ] Create `docs/operations/runbook.md`
- [ ] Add monitoring metrics section
- [ ] Add Prometheus alert rules examples
- [ ] Add troubleshooting guide
- [ ] Add emergency procedures
- [ ] Add capacity planning guide

**Estimated Effort**: 2-3 hours

#### Task 22.5: Health Check Endpoint
- [ ] Implement `createHealthCheck` function
- [ ] Add `CascadeHealthStatus` interface
- [ ] Add health check tests
- [ ] Add Express integration example
- [ ] Add Kubernetes probe examples
- [ ] Document in API reference

**Estimated Effort**: 2 hours

#### Task 22.6: Platform Compatibility Documentation
- [ ] Create `docs/guide/compatibility.md`
- [ ] Document Node.js version support
- [ ] Document browser compatibility
- [ ] Document TypeScript version requirements
- [ ] Document bundle sizes
- [ ] Document tree shaking support

**Estimated Effort**: 1 hour

**Total Phase 22 Effort**: 11-16 hours

**Decision Point**: Do we want to complete all of Phase 22 or release 0.3.0 with current features?

---

## 2. Documentation

### 2.1 Package READMEs
**Status**: ✅ All packages have READMEs

```bash
# Verify all packages have READMEs
ls packages/*/README.md
```

**Action Items**:
- [ ] Review each README for accuracy
- [ ] Ensure examples work with v0.2.0
- [ ] Add migration notes if needed
- [ ] Update badges (version, build status)

---

### 2.2 API Documentation
**Status**: 🟡 Needs review

**Action Items**:
- [ ] Verify TypeDoc comments are complete
- [ ] Generate API docs: `pnpm run docs`
- [ ] Review generated docs for accuracy
- [ ] Check all public APIs are documented

---

### 2.3 Migration Guide
**Status**: ⏳ TODO

**Action Items**:
- [ ] Create `docs/migration/v0.1-to-v0.2.md` (if exists)
- [ ] Create `docs/migration/v0.2-to-v0.3.md`
- [ ] Document breaking changes (if any)
- [ ] Provide migration examples
- [ ] Add deprecation notices

---

### 2.4 CHANGELOG
**Status**: ✅ Updated for 0.2.0, needs 0.3.0 entry

**Action Items**:
- [ ] Add `## [0.3.0] - TBD` section
- [ ] List all features added since 0.2.0
- [ ] List any breaking changes
- [ ] List deprecations
- [ ] Update date when ready to release

---

## 3. Testing

### 3.1 Unit Tests
**Status**: ✅ Passing

```bash
# Run all tests
pnpm test

# Check coverage
pnpm run test:coverage
```

**Action Items**:
- [ ] Verify all tests pass
- [ ] Check coverage is acceptable (>80% recommended)
- [ ] Add missing test cases for new features
- [ ] Review and fix flaky tests

---

### 3.2 Integration Tests
**Status**: ✅ Exists in packages/integration-tests

**Action Items**:
- [ ] Run integration tests: `pnpm test --filter integration-tests`
- [ ] Verify E2E scenarios work
- [ ] Test with real GraphQL servers
- [ ] Test all client integrations

---

### 3.3 Manual Testing
**Status**: ⏳ TODO

**Test Scenarios**:
- [ ] Test Apollo Client integration
- [ ] Test React Query integration
- [ ] Test Relay integration
- [ ] Test URQL integration
- [ ] Test error handling with all new error codes
- [ ] Test retry logic
- [ ] Test rate limiting scenarios
- [ ] Test timeout handling

---

## 4. Build & Distribution

### 4.1 Build All Packages
**Status**: ✅ Builds successfully

```bash
pnpm build
```

**Action Items**:
- [ ] Verify build completes without errors
- [ ] Check build artifacts are correct
- [ ] Verify type definitions (.d.ts) are generated
- [ ] Check bundle sizes are reasonable

---

### 4.2 Package Versions
**Status**: ✅ All at 0.2.0, ready to bump to 0.3.0

**Action Items**:
- [ ] Update all package.json versions to 0.3.0
- [ ] Update peer dependencies if needed
- [ ] Update internal dependencies (e.g., @graphql-cascade/client@^0.3.0)
- [ ] Verify version consistency

**Script to help**:
```bash
# Bump all packages to 0.3.0
find packages -name "package.json" -not -path "*/node_modules/*" \
  -exec sed -i 's/"version": "0.2.0"/"version": "0.3.0"/g' {} \;
```

---

### 4.3 npm Publishing Readiness
**Status**: ⚠️ Needs verification

**Action Items**:
- [ ] Check npm registry accounts/access
- [ ] Verify package.json metadata:
  - [ ] `name` is correct
  - [ ] `version` is correct
  - [ ] `description` is accurate
  - [ ] `keywords` are relevant
  - [ ] `repository` URL is correct
  - [ ] `homepage` is set
  - [ ] `bugs` URL is set
  - [ ] `license` is specified
  - [ ] `author` is set
- [ ] Verify `files` array includes all necessary files
- [ ] Check `.npmignore` or files whitelist
- [ ] Test local install: `npm pack` → `npm install ./package.tgz`

---

## 5. Security

### 5.1 Dependency Audit
**Status**: ⏳ TODO

```bash
# Check for vulnerabilities
pnpm audit

# Check for outdated dependencies
pnpm outdated
```

**Action Items**:
- [ ] Run security audit
- [ ] Fix high/critical vulnerabilities
- [ ] Update outdated dependencies (cautiously)
- [ ] Test after updates

---

### 5.2 Code Security Review
**Status**: ⏳ TODO

**Action Items**:
- [ ] Review error handling for information disclosure
- [ ] Check for SQL injection vulnerabilities
- [ ] Verify XSS prevention
- [ ] Review authentication/authorization logic
- [ ] Check for prototype pollution risks
- [ ] Review dependency security

---

### 5.3 SECURITY.md
**Status**: ✅ Exists, needs update for 0.3.0

**Action Items**:
- [ ] Update supported versions table
- [ ] Verify security contact is correct
- [ ] Add SBOM section (if Task 22.3 completed)
- [ ] Review security policies

---

## 6. Licensing & Legal

### 6.1 License Files
**Status**: ✅ MIT License present

**Action Items**:
- [ ] Verify LICENSE file is in root
- [ ] Check all packages reference correct license
- [ ] Ensure license headers in source files (if required)
- [ ] Verify third-party license compliance

---

### 6.2 Copyright Notices
**Status**: ⏳ Needs review

**Action Items**:
- [ ] Check copyright years are current
- [ ] Verify attribution for third-party code
- [ ] Update NOTICE file if required

---

## 7. Release Assets

### 7.1 Release Notes
**Status**: ⏳ TODO

**Action Items**:
- [ ] Create `releases/v0.3.0.md`
- [ ] Write comprehensive release notes:
  - [ ] Overview
  - [ ] What's new
  - [ ] Breaking changes (if any)
  - [ ] Migration guide link
  - [ ] Known issues
  - [ ] Contributors
- [ ] Include upgrade instructions
- [ ] Add examples for new features

---

### 7.2 GitHub Release
**Status**: ⏳ TODO

**Action Items**:
- [ ] Draft GitHub release
- [ ] Write user-friendly release description
- [ ] Attach binaries/artifacts if needed
- [ ] Tag release with proper version
- [ ] Mark as pre-release if appropriate

---

## 8. CI/CD

### 8.1 CI Pipeline
**Status**: ✅ Exists (Phase 15 completed)

**Action Items**:
- [ ] Verify CI passes on main branch
- [ ] Check all workflows run successfully
- [ ] Review test results
- [ ] Check linting passes
- [ ] Verify build artifacts are created

---

### 8.2 CD Pipeline
**Status**: ⏳ Needs setup for npm

**Action Items**:
- [ ] Set up automated npm publishing workflow
- [ ] Configure npm authentication tokens
- [ ] Test publish workflow on test registry
- [ ] Add release automation
- [ ] Document release process

---

## 9. Communication

### 9.1 Pre-Release Communication
**Status**: ⏳ TODO

**Action Items**:
- [ ] Draft announcement blog post/tweet
- [ ] Notify beta testers
- [ ] Update project roadmap
- [ ] Prepare demo/walkthrough

---

### 9.2 Post-Release Communication
**Status**: ⏳ TODO (for after release)

**Action Items**:
- [ ] Publish announcement
- [ ] Update website (if exists)
- [ ] Post to relevant communities
- [ ] Update documentation site
- [ ] Send newsletter (if exists)

---

## 10. Rollback Plan

### 10.1 Rollback Strategy
**Status**: ⏳ Document

**Action Items**:
- [ ] Document how to unpublish if critical bug found
- [ ] Prepare patch release process
- [ ] Keep old version documentation available
- [ ] Have rollback communication plan

---

## Quick-Start Minimal Release Checklist

If time is limited, these are the **absolute minimum** requirements:

### Critical Path (Must-Have)
- [ ] All tests pass
- [ ] Build succeeds
- [ ] CHANGELOG updated with 0.3.0 entry
- [ ] All package.json versions bumped to 0.3.0
- [ ] README examples verified
- [ ] Security audit clean (no high/critical)
- [ ] Release notes created
- [ ] Git tag created
- [ ] Published to npm

### Recommended (Should-Have)
- [ ] API documentation generated
- [ ] Migration guide created
- [ ] Phase 22 Tasks 22.3-22.6 completed (docs-focused)
- [ ] GitHub release published
- [ ] Announcement prepared

### Nice-to-Have (Can defer to 0.3.1)
- [ ] Phase 22 Tasks 22.1-22.2 (metrics & security features)
- [ ] Comprehensive manual testing
- [ ] Demo applications updated

---

## Decision Points

### Option A: Full 0.3.0 Release (Recommended)
**Timeline**: 2-3 weeks
**Includes**:
- All Phase 22 tasks
- Comprehensive testing
- Full documentation
- Production-ready features

**Benefits**:
- Feature-complete "Production Readiness" release
- Strong foundation for 1.0.0
- Comprehensive observability & security

### Option B: Minimal 0.3.0 Release
**Timeline**: 1 week
**Includes**:
- Current features (error codes, cleanup)
- Essential documentation
- Core testing
- npm publication

**Benefits**:
- Faster release cycle
- Get features to users sooner
- Can do 0.3.x patches for Phase 22 tasks

**Drawbacks**:
- Less "production ready"
- May need 0.4.0 for full Phase 22

### Option C: Split Release
**Timeline**: Varies
**Strategy**:
- Release 0.3.0 with current state (1 week)
- Release 0.4.0 with Phase 22 (2-3 weeks later)

---

## Recommendation

**Suggested Approach**: **Option B (Minimal 0.3.0) + Immediate 0.4.0 Planning**

**Reasoning**:
1. Current features (error codes, client integrations) are solid
2. Version alignment cleanup is done
3. Users would benefit from error handling now
4. Phase 22 tasks are all additive (no breaking changes)
5. Can release metrics/security as 0.4.0 in 2-3 weeks

**Action Plan**:
1. **Week 1**: Minimal 0.3.0 release
   - Critical path items only
   - Focus on quality of current features
   - Get feedback from users
2. **Weeks 2-3**: Complete Phase 22
   - Implement remaining tasks
   - Full testing
3. **Week 4**: Release 0.4.0 "Production Hardening"
   - Metrics & observability
   - Security features
   - Operational guides

---

## Next Steps

1. **Decide** which release option to pursue
2. **Execute** the critical path checklist
3. **Test** thoroughly
4. **Release** with confidence
5. **Communicate** to users
6. **Monitor** for issues
7. **Iterate** based on feedback

---

## Useful Commands

```bash
# Run full verification
pnpm build && pnpm test && pnpm lint

# Check versions
grep '"version"' packages/*/package.json packages/*/*/package.json | grep -v node_modules

# Generate API docs
pnpm run docs

# Test publish (dry-run)
npm publish --dry-run

# Create git tag
git tag -a v0.3.0 -m "Release v0.3.0: Production Readiness"

# Push tag
git push origin v0.3.0
```
