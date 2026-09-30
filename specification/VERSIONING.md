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

## Version Discovery and Compatibility

Clients learn which specification versions a server implements, and rely on compatibility rules instead of negotiating per request.

### Version Discovery

Servers SHOULD expose their capabilities through a `cascadeInfo` field on their `Query` type:

```graphql
"""
Cascade capabilities of a server, for version discovery. Servers expose it
as a `cascadeInfo: CascadeInfo!` field on their Query type.
"""
type CascadeInfo {
  """Specification version the server implements, e.g. "1.5.0"."""
  version: String!

  """Specification versions whose responses the server can produce."""
  supportedVersions: [String!]!

  """Experimental features the server has enabled."""
  experimentalFeatures: [String!]!

  """Deprecated features the server still provides."""
  deprecatedFeatures: [String!]!
}

type Query {
  cascadeInfo: CascadeInfo!
}
```

Clients query it like any other field:

```graphql
query CascadeInfo {
  cascadeInfo {
    version
    supportedVersions
    experimentalFeatures
    deprecatedFeatures
  }
}
```

Specifications before 1.5.0 named this query `__cascade`. GraphQL reserves names beginning with `__` for introspection, so no schema could define it.

**Response Example:**
```json
{
  "data": {
    "cascadeInfo": {
      "version": "1.5.0",
      "supportedVersions": ["1.3.0", "1.4.0", "1.5.0"],
      "experimentalFeatures": ["optimistic-updates"],
      "deprecatedFeatures": []
    }
  }
}
```

### Version Compatibility

Specification versions with the same MAJOR version are compatible. Within a MAJOR version, changes are additive or go through the [deprecation policy](#deprecation-policy), so a client written for one minor version can process responses from a server implementing another:

- Clients MUST ignore fields of cascade responses that they do not recognize.
- Clients MUST treat enum values they do not recognize as each enum's definition says, for example an unknown `CascadeErrorCode` as `INTERNAL_ERROR`.
- Clients that rely on a feature introduced in a MINOR version SHOULD check the server's `cascadeInfo.supportedVersions` before using it, and fall back to the behavior of the versions it lists.

There is no request header or per-response version: discovery through `cascadeInfo` is enough to choose features, and the compatibility rules make every response of the same MAJOR version readable. A server that implements a different MAJOR version is incompatible; clients detect it from `cascadeInfo.version`.

## Recording Changes

Every specification version is recorded in three places. `node scripts/check-spec.mjs` checks the history entry, the release notes and every version stamp against [`VERSION`](VERSION):

1. An entry in the [version history](#appendix-version-history) below, with **Changes**, **Backward Compatibility** and **Migration** sections.
2. Release notes in [`releases/spec-vMAJOR.MINOR.PATCH.md`](../releases/).
3. An entry in the repository [`CHANGELOG.md`](../CHANGELOG.md), which also records package changes.

Breaking changes and deprecations are called out in all three, each with a migration path.

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

### v1.7.0 (2026-09-30)

#### Changes
- Version compatibility: versions with the same MAJOR version are compatible; clients MUST ignore response fields they do not recognize and SHOULD check `cascadeInfo.supportedVersions` before relying on a MINOR-version feature
- Removed version negotiation requirements that nothing could implement: the `X-Cascade-Version` request header, a version in cascade metadata (which `CascadeMetadata` never had), and rejection of "incompatible" requests
- Replaced the changelog format and compatibility matrix templates with how changes are actually recorded

#### Backward Compatibility
Backward compatible: the removed requirements had no implementation, and ignoring unknown fields is how GraphQL clients already behave.

#### Migration
- None for servers. Clients that fail on unknown response fields must ignore them.

### v1.6.0 (2026-09-30)

#### Changes
- `CascadeResponse` no longer declares `data`. GraphQL lets an implementing field only narrow an interface field's type, so `data: MutationPayload` (a scalar) could not be implemented by any payload with a typed result
- Payload types SHOULD expose the mutation's result as a `data` field of its own type, e.g. `data: User`
- Removed the `MutationPayload` placeholder scalar from the reference schema

#### Backward Compatibility
Backward compatible: payload types keep their `data` fields, and queries select `data` on the payload type as before. Only a fragment on the `CascadeResponse` interface that selects `data` changes, and no schema with typed results could have supported it.

#### Migration
- Schemas: remove `data` from your copy of `CascadeResponse` and the `MutationPayload` scalar; keep `data: <ResultType>` on each payload type.

### v1.5.0 (2026-09-30)

#### Changes
- Version discovery uses a `cascadeInfo: CascadeInfo!` field on `Query`, with `CascadeInfo` defined in the reference schema. The former `__cascade` query used a name GraphQL reserves for introspection, so no server could provide it
- Version discovery is RECOMMENDED (SHOULD) rather than required, since no conforming server could have implemented the former requirement

#### Backward Compatibility
Backward compatible: `__cascade` could not exist in any schema, so no client depends on it.

#### Migration
- Servers: add `cascadeInfo: CascadeInfo!` to `Query`.
- Clients: query `cascadeInfo` instead of `__cascade`.

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