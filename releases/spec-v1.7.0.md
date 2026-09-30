# GraphQL Cascade Specification v1.7.0 Release Notes

**Release Date**: 2026-09-30
**Type**: Minor version (backward compatible)

## Overview

Version 1.7 replaces version negotiation rules that no implementation could follow with compatibility rules that every implementation can.

## What's New

### Compatibility Instead of Negotiation

- Versions with the same MAJOR version are compatible. Clients MUST ignore response fields they do not recognize, and treat unknown enum values as each enum defines.
- Clients that rely on a feature added in a MINOR version SHOULD check `cascadeInfo.supportedVersions` first ([Version Discovery](../specification/VERSIONING.md#version-discovery), since 1.5.0).
- Removed: the `X-Cascade-Version` header, a MUST to put the version in cascade metadata (`CascadeMetadata` has no such field), and a MUST to reject "incompatible" requests without a definition of compatibility or an error to return.

See [Version Compatibility](../specification/VERSIONING.md#version-compatibility).

### How Changes Are Recorded

VERSIONING.md now describes the actual process: a version history entry, release notes in `releases/`, and a CHANGELOG entry. `check-spec` now also fails when the current version has no release notes. The changelog format and compatibility matrix templates, which described a process the project does not use, are gone.

## Backward Compatibility

Backward compatible: the removed requirements had no implementation.
