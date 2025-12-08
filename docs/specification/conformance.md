# Conformance Requirements

What it means to be GraphQL Cascade compliant.

## Overview

This document defines the conformance requirements for GraphQL Cascade implementations. A compliant implementation MUST follow these requirements to ensure interoperability.

## Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Server Requirements

### MUST: Return Cascade Metadata

Mutation responses MUST include cascade metadata in the `__cascade` field:

```json
{
  "data": {
    "createTodo": {
      "todo": { ... },
      "__cascade": {
        "created": [],
        "updated": [],
        "deleted": [],
        "invalidated": []
      }
    }
  }
}
```

### MUST: Track Entity Changes

Servers MUST accurately track entities that are:
- Created during the mutation
- Updated during the mutation
- Deleted during the mutation

### MUST: Use Standard Entity Format

Entity references MUST include `__typename` and `id`:

```json
{
  "__typename": "Todo",
  "id": "123"
}
```

### SHOULD: Provide Invalidation Hints

Servers SHOULD include invalidation hints for queries affected by the mutation:

```json
{
  "invalidated": [
    { "__typename": "Query", "field": "todos" }
  ]
}
```

## Client Requirements

### MUST: Process Cascade Metadata

Clients MUST process cascade metadata from mutation responses and update their cache accordingly.

### MUST: Handle All Cascade Operations

Clients MUST handle:
- Created entities (add to cache)
- Updated entities (merge into cache)
- Deleted entities (remove from cache)
- Invalidated queries (mark for refetch)

### SHOULD: Support Optimistic Updates

Clients SHOULD support optimistic updates with cascade prediction.

### SHOULD: Provide Error Recovery

Clients SHOULD roll back optimistic updates when mutations fail.

## Schema Requirements

### MUST: Define Cascade Types

Schemas MUST define these types:

```graphql
type Cascade {
  created: [EntityRef!]!
  updated: [EntityRef!]!
  deleted: [EntityRef!]!
  invalidated: [InvalidationRef!]!
}

type EntityRef {
  __typename: String!
  id: ID!
}

type InvalidationRef {
  __typename: String!
  field: String
}
```

### MUST: Include Cascade in Mutation Responses

All mutations MUST include cascade in their response type:

```graphql
type TodoMutationResponse {
  todo: Todo
  __cascade: Cascade!
}
```

## Compliance Levels

### Level 1: Basic Compliance

- Implement entity tracking (created, updated, deleted)
- Return standard cascade format
- Process cascades on client

### Level 2: Standard Compliance

All Level 1 requirements plus:
- Invalidation hints
- Optimistic updates
- Error handling

### Level 3: Complete Compliance

All Level 2 requirements plus:
- Relationship propagation
- Conflict resolution
- Performance optimizations

## Testing Compliance

Use the compliance test suite:

```bash
npm install @graphql-cascade/compliance-tests
cascade-test --endpoint http://localhost:4000/graphql
```

## Certification

- Official compliance tests available
- Self-certification process
- Badge for compliant implementations

## Next Steps

- **[Cascade Model](/specification/cascade-model)** - Data structures
- **[Full Specification](/specification/full)** - Complete requirements
- **[Implementation Guide](/server/)** - Build compliant servers
