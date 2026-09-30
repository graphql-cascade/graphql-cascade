# GraphQL Cascade Specification v1.5.0 Release Notes

**Release Date**: 2026-09-30
**Type**: Minor version (backward compatible)

## Overview

Version 1.5 makes version discovery possible. Earlier versions asked servers to answer a `__cascade` query, but GraphQL reserves names beginning with `__` for introspection, so no schema could define it.

## What's New

### `cascadeInfo` Version Discovery

- **`CascadeInfo`** is defined in the [reference schema](../reference/cascade_base.graphql): `version`, `supportedVersions`, `experimentalFeatures` and `deprecatedFeatures`.
- Servers SHOULD add `cascadeInfo: CascadeInfo!` to their `Query` type, and clients query it like any other field.
- The requirement is a recommendation rather than a MUST: the former MUST could never be met, so making discovery mandatory now would change every server's conformance at once.

See [Version Discovery](../specification/VERSIONING.md#version-discovery).

## Backward Compatibility

Backward compatible: no schema could define `__cascade`, so no client depends on it.
