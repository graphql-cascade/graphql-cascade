# Versioning Strategy

This document defines the versioning strategy for the GraphQL Cascade specification, ensuring predictable evolution while maintaining backward compatibility.

## Version Numbering Scheme

GraphQL Cascade uses [Semantic Versioning 2.0.0](https://semver.org/) with Cascade-specific rules:

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

### Version Components

- **MAJOR**: Breaking changes that require implementation updates
- **MINOR**: New features that are backward compatible
- **PATCH**: Bug fixes and clarifications that are backward compatible
- **PRERELEASE**: Pre-release identifiers (`alpha`, `beta`, `rc`)
- **BUILD**: Build metadata (ignored for compatibility)

### Cascade-Specific Rules

1. **Pre-1.0 Versions**: All versions before 1.0.0 are considered unstable and MAY introduce breaking changes
2. **Experimental Features**: Features marked as experimental MAY be changed or removed in any version
3. **Extension Versions**: Extensions follow independent versioning from the core specification

### Specification and Package Versions

The specification and the reference packages are versioned independently:

- The **specification version** is recorded in [`VERSION`](VERSION) and is the only version an implementation claims conformance to (for example, "conforms to GraphQL Cascade 1.1.0").
- **Package versions** (`@graphql-cascade/*`) follow their own semver line and document which specification version they implement in their changelogs.

Every other specification version stamp (the specification README, the conformance manifest, the root README badge, and the history below) MUST match `VERSION`. CI enforces this with `node scripts/check-spec.mjs`.

## Breaking vs Non-Breaking Changes

### Breaking Changes (MAJOR version bump required)

Breaking changes alter the behavior of existing implementations and require updates:

#### Schema Changes
- Removing or renaming required fields from core interfaces
- Changing the structure of `CascadeResponse`
- Removing or changing required directives
- Changing entity identification requirements

#### Behavioral Changes
- Changing invalidation algorithm behavior
- Modifying tracking requirements
- Altering error handling semantics
- Changing performance requirements

#### Protocol Changes
- Modifying version negotiation mechanism
- Changing transport requirements
- Altering subscription integration

### Non-Breaking Changes (MINOR/PATCH versions)

#### Backward Compatible Additions
- Adding optional fields to existing structures
- Adding new optional directives
- Adding new mutation types
- Extending metadata structures

#### Clarifications and Fixes
- Fixing ambiguous specification language
- Adding missing requirement details
- Correcting examples or documentation
- Improving performance without changing behavior

#### Deprecations
- Marking features as deprecated (with migration path)
- Adding deprecation warnings
- Providing migration guides

## Deprecation Policy

### Deprecation Timeline

1. **Announcement**: Feature marked as deprecated in specification with:
   - Deprecation notice in relevant section
   - Migration path documentation
   - Timeline for removal

2. **Deprecation Period**: Minimum 12 months from announcement, or:
   - Two minor versions, whichever is longer
   - Until 90% of surveyed implementations have migrated

3. **Removal**: Feature removed in next MAJOR version

### Deprecation Requirements

Specifications MUST:

1. **Document Migration Path**
   ```markdown
   ## Deprecated: Field `oldField`

   **Deprecated in**: v1.2.0
   **Removal**: v2.0.0 (estimated Q1 2025)

   **Migration**: Use `newField` instead:
   ```graphql
   # Before
   mutation { updateEntity(oldField: "value") { id } }

   # After
   mutation { updateEntity(newField: "value") { id } }
   ```
   ```

2. **Provide Implementation Guidance**
   - Reference implementations showing migration
   - Testing strategies for migration
   - Rollback procedures

3. **Maintain Backward Compatibility**
   - Deprecated features continue to work during deprecation period
   - No breaking changes until removal

## Version Negotiation Mechanism

Clients and servers negotiate the Cascade version to ensure compatibility.

### Version Discovery

Clients discover server capabilities through the `__cascade` introspection query:

```graphql
query {
  __cascade {
    version                    # Current server implementation version
    supportedVersions         # Array of supported spec versions
    experimentalFeatures      # Array of enabled experimental features
    deprecatedFeatures        # Array of deprecated features in use
  }
}
```

**Response Example:**
```json
{
  "data": {
    "__cascade": {
      "version": "1.2.3",
      "supportedVersions": ["1.0", "1.1", "1.2"],
      "experimentalFeatures": ["optimistic-updates"],
      "deprecatedFeatures": []
    }
  }
}
```

### Version Compatibility Rules

1. **Client Version Declaration**
   - Clients SHOULD declare supported versions in request headers
   - Header: `X-Cascade-Version: 1.2`

2. **Server Version Response**
   - Servers MUST include version in all cascade responses
   - Response includes negotiated version in metadata

3. **Compatibility Matrix**
   - Clients MAY specify minimum/maximum supported versions
   - Servers MUST reject incompatible version requests

### Version Negotiation Flow

```
Client Request ──► Server
  ↓                    ↓
  X-Cascade-Version: 1.2
  ↓                    ↓
Server Validates ──► Compatible?
  ↓                    ↓
  Yes ──► Process with v1.2
  ↓                    ↓
  No ───► Error Response
              (version incompatible)
```

## Changelog Format Requirements

All specification changes MUST be documented in CHANGELOG.md following this format:

### Version Header
```markdown
## [1.2.0] - 2024-01-15

### Added
- New feature descriptions
- New capabilities

### Changed
- Modified behaviors
- Updated requirements

### Deprecated
- Features marked for removal
- Migration notices

### Removed
- Removed features
- Breaking changes

### Fixed
- Bug fixes
- Clarifications

### Security
- Security-related changes
```

### Changelog Requirements

1. **Version Links**: Each version links to diff and release notes
2. **Breaking Changes**: Clearly marked with ⚠️ emoji
3. **Migration Guides**: Links to migration documentation
4. **Implementation Impact**: Notes on implementation effort required

## Compatibility Matrix Template

### Implementation Compatibility Matrix

| Implementation | Cascade v1.0 | v1.1 | v1.2 | Notes |
|----------------|--------------|------|------|-------|
| Server-A (Node) | ✅ Full | ✅ Full | ⚠️ Partial | Missing optimistic updates |
| Server-B (Python) | ✅ Full | ✅ Full | ❌ None | Planned for v2.0 |
| Client-Apollo | ✅ Full | ✅ Full | ✅ Full | |
| Client-Relay | ⚠️ Partial | ✅ Full | ✅ Full | Limited subscription support |

**Legend:**
- ✅ **Full**: Complete implementation
- ⚠️ **Partial**: Missing some features
- ❌ **None**: Not implemented

### Feature Compatibility Matrix

| Feature | v1.0 | v1.1 | v1.2 | Breaking Change |
|---------|------|------|------|------------------|
| Basic Cascade | ✅ | ✅ | ✅ | No |
| Optimistic Updates | ❌ | ⚠️ Experimental | ✅ | No |
| Advanced Invalidation | ❌ | ✅ | ✅ | No |
| Subscription Integration | ❌ | ❌ | ✅ | No |

### Migration Compatibility

| From Version | To Version | Migration Effort | Breaking |
|--------------|------------|------------------|----------|
| v1.0 | v1.1 | Low | No |
| v1.1 | v1.2 | Medium | No |
| v1.0 | v1.2 | Medium | No |

## Implementation Guidelines

### For Specification Authors

1. **Version Planning**: Consider versioning impact during design
2. **Deprecation Strategy**: Plan deprecations 6+ months in advance
3. **Migration Support**: Provide tools and documentation for migrations

### For Implementers

1. **Version Discovery**: Always check server capabilities
2. **Graceful Degradation**: Handle version mismatches gracefully
3. **Migration Testing**: Test migrations in staging environments

### For Tooling Authors

1. **Version Validation**: Validate compatibility in development tools
2. **Migration Assistance**: Provide automated migration tools
3. **Compatibility Checking**: Warn about version incompatibilities

## Appendix: Version History

### v1.4.0 (2026-09-30)

#### Changes
- Requirements tested by the conformance suite are tagged **[REQ-NNN]** where the specification states them; `check-spec` requires every tag to be unique and tested, and every case to cite a tag
- Cascade Delivery: the payload `cascade` field is the normative location; with several mutation fields, each carries only its own changes, and a failed field leaves the others intact
- Optional `extensions.cascade` transport: one cascade for the whole operation, combining all mutation fields
- Clients SHOULD NOT invalidate or refetch a query only because it contains an updated entity
- Server tracking requirements spell out created, updated, deleted, relationship and cycle behavior; a failed mutation returns an empty cascade

#### Backward Compatibility
Backward compatible. The delivery rules describe how servers already behave; the extensions transport is optional; the no-refetch rule is a recommendation.

#### Migration
- Servers delivering cascades in `extensions`: combine all mutation fields into one cascade.
- Clients: stop invalidating queries solely because they contain an updated entity.

### v1.3.0 (2026-09-30)

#### Changes
- `UpdatedEntity` and `DeletedEntity` carry the entity's type name in `typename`. GraphQL reserves names beginning with `__`, so the former `__typename` field could not be declared in a schema, and selecting it returned the wrapper's own type
- Deprecated the `__typename` pseudo-field on `UpdatedEntity` and `DeletedEntity`, for removal in 2.0.0
- `reference/cascade_base.graphql` is the normative schema and is valid GraphQL; specification excerpts are checked against it in CI
- `CascadeErrorCode` in the reference schema lists all ten codes

#### Backward Compatibility
Backward compatible during the deprecation period: servers send `typename` and keep sending `__typename` in JSON cascades, and clients read `typename` with a fallback to `__typename`.

#### Migration
- Servers: add `typename` to every `updated` and `deleted` entry; keep `__typename` in JSON cascades until 2.0.0.
- Clients: read `typename`, falling back to `__typename`; select `typename` instead of `__typename` on `UpdatedEntity` and `DeletedEntity`.

### v1.2.0 (2026-09-30)

#### Changes
- Added optional `CascadeError.domainCode` for application-specific error conditions; `code` stays a closed set of categories
- Clients MUST treat unrecognized `code` values as `INTERNAL_ERROR`, so later minor versions can add codes
- Asynchronous mutations: the cascade describes only committed changes, and a persisted job entity appears in `cascade.updated`
- Cascade completeness: servers MUST NOT silently omit affected entities
- Added `CascadeUpdates.typeInvalidations` and `CascadeMetadata.truncated`; truncation moves whole types into type invalidations instead of cutting lists
- Size limits are configurable, with 500 / 100 / 5 MB as RECOMMENDED defaults; cascade pagination is no longer suggested
- Added Appendix G: Database-Derived Tracking (non-normative)

#### Backward Compatibility
Backward compatible for clients: `typeInvalidations` and `truncated` are new fields, and a client that ignores them keeps 1.1 behavior. Servers adopting 1.2 add both fields and replace list-cutting truncation with type invalidations.

#### Migration
- Servers: add `typeInvalidations` (empty unless truncating) and `metadata.truncated` to every cascade.
- Clients: apply `typeInvalidations` after the other cascade parts; without type-level support, invalidate every query.

### v1.1.0 (2025-12-04)

#### Changes
- Added TIMEOUT, RATE_LIMITED, SERVICE_UNAVAILABLE error codes
- Added error code selection guidelines
- Documented async operation patterns
- Extended error examples

#### Backward Compatibility
Fully backward compatible. All changes are additive.

#### Migration
No migration required. New error codes are optional.

### v1.0.0
- First stable release
- Core cascade functionality
- Basic invalidation support

### v0.x (Pre-1.0)
- Unstable, breaking changes allowed
- Core concepts development
- Reference implementation validation

### Future Versions
- v1.x: Backward compatible enhancements
- v2.0: Major architectural changes (if needed)
- Extensions: Independent versioning

---

*This versioning strategy ensures predictable evolution while maintaining ecosystem stability.*