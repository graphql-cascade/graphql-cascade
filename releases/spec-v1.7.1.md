# GraphQL Cascade Specification v1.7.1 Release Notes

**Release Date**: 2026-09-30
**Type**: Patch version (corrections)

## Overview

Version 1.7.1 corrects examples that were not valid GraphQL.

## Fixes

### Entity Selections

`UpdatedEntity.entity` is typed `Node!`, an interface. GraphQL requires a selection set on interface fields, so examples such as `updated { typename id operation entity }` were rejected by any server. They now select through a fragment, `entity { ...CascadeEntity }`, and [Selecting Entities](../specification/04_mutation_responses.md#selecting-entities) explains the pattern: select, for each type, the fields the client's cached queries read.

### Checked Selections

`node scripts/check-spec.mjs` validates every `cascade { … }` selection, and every subscription on `cascadeUpdates`, against the reference schema: selected fields exist, object fields have a selection set, and scalars do not. It covers the specification's GraphQL blocks and GraphQL in code examples in the checked documentation.

## Backward Compatibility

No normative change.
