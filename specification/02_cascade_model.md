# Cascade Model

This document describes the core data model for GraphQL Cascade.

## Core Concepts

### Cascade
A **cascade** is the complete set of entities affected by a mutation, including:
- The primary result of the mutation
- All related entities that were updated as a consequence
- All entities that were deleted
- Metadata about the cascade operation

### Entity Identification
All entities in a cascade are identified using a **typename + id** strategy:
- `typename`: The GraphQL type name (e.g., "User", "Company")
- `id`: The globally unique identifier for the entity

This provides namespace isolation and prevents ID collisions between different entity types.

## Data Structures

### Cascade Data Model Overview

```mermaid
graph TD
    A[CascadeResponse] --> B[success: Boolean!]
    A --> C[errors: [CascadeError!]]
    A --> D[data: MutationPayload]
    A --> E[cascade: CascadeUpdates!]

    E --> F[updated: [UpdatedEntity!]!]
    E --> G[deleted: [DeletedEntity!]!]
    E --> H[invalidations: [QueryInvalidation!]!]
    E --> I[metadata: CascadeMetadata!]

    F --> J[UpdatedEntity]
    J --> K[typename: String!]
    J --> L[id: ID!]
    J --> M[operation: CascadeOperation!]
    J --> N[entity: Node!]

    G --> O[DeletedEntity]
    O --> P[typename: String!]
    O --> Q[id: ID!]
    O --> R[deletedAt: DateTime!]

    H --> S[QueryInvalidation]
    S --> T[queryName: String]
    S --> U[strategy: InvalidationStrategy!]
    S --> V[scope: InvalidationScope!]

    I --> W[CascadeMetadata]
    W --> X[timestamp: DateTime!]
    W --> Y[transactionId: ID]
    W --> Z[depth: Int!]
    W --> AA[affectedCount: Int!]
```

### Core Types
The core types are defined normatively in [`reference/cascade_base.graphql`](../reference/cascade_base.graphql) and specified in [Mutation Responses](04_mutation_responses.md):

| Type | Role | Definition |
|------|------|------------|
| `CascadeResponse` | Interface every Cascade mutation returns: `success`, `errors`, `data`, `cascade` | [CascadeResponse Interface](04_mutation_responses.md#cascaderesponse-interface) |
| `CascadeUpdates` | The changes from a mutation: `updated`, `deleted`, `invalidations`, `typeInvalidations`, `metadata` | [CascadeUpdates Structure](04_mutation_responses.md#complete-structure) |
| `UpdatedEntity` | A created or updated entity: `typename`, `id`, `operation`, `entity` | [UpdatedEntity Details](04_mutation_responses.md#updatedentity-details) |
| `DeletedEntity` | A deleted entity: `typename`, `id`, `deletedAt` | [DeletedEntity Details](04_mutation_responses.md#deletedentity-details) |
| `CascadeOperation` | `CREATED`, `UPDATED` or `DELETED` | [UpdatedEntity Details](04_mutation_responses.md#updatedentity-details) |
| `TypeInvalidation` | A type whose affected entities are not listed individually | [TypeInvalidation Details](04_mutation_responses.md#typeinvalidation-details) |
| `CascadeMetadata` | Timestamp, transaction, depth, affected count, truncation flag | [Cascade Metadata](04_mutation_responses.md#cascade-metadata) |

## Entity Update Semantics

### Full Entity Updates
Cascade uses **full entity updates** rather than partial updates:
- Each `UpdatedEntity` contains the complete entity data
- Clients MAY choose which fields to query via GraphQL selection
- Simplifies client logic and ensures consistency

### Operation Types
- **CREATED**: Entity was newly created
- **UPDATED**: Entity was modified (includes primary mutation result)
- **DELETED**: Entity was deleted (reported separately in `deleted` array)

### Nested Entity Handling
When an entity references other entities, the cascade includes all affected entities:

```graphql
type Company {
  id: ID!
  name: String!
  address: Address!
  owner: User!
}

# When updating a Company, the cascade includes:
# - Company (primary result)
# - Address (if address changed)
# - User (if owner changed)
```

## Cache Invalidation

### QueryInvalidation
Instructions for invalidating cached queries, defined in [QueryInvalidation Structure](05_invalidation.md#queryinvalidation-structure).

### Invalidation Strategies
- **INVALIDATE**: Mark query as stale, refetch on next access
- **REFETCH**: Immediately refetch the query
- **REMOVE**: Remove query from cache entirely

### Invalidation Scopes
- **EXACT**: Only invalidate queries with exact name and arguments
- **PREFIX**: Invalidate queries with names matching prefix
- **PATTERN**: Invalidate queries matching glob pattern
- **ALL**: Invalidate all queries

## Error Handling

Errors are reported as `CascadeError` objects. Each error carries a `code` from the closed `CascadeErrorCode` set, which drives generic client handling, and an optional application-defined `domainCode` for the specific condition. The normative definitions, error code selection guidelines and forward-compatibility rules are in [Mutation Responses](04_mutation_responses.md#error-handling).

## Cascade Depth Control

### Depth Limiting
Servers can limit how deep they traverse relationships:

```yaml
cascade:
  default_max_depth: 3
  exclude_types: ["AuditLog", "SystemEvent"]
```

### Depth Semantics
- **Depth 0**: Only primary mutation result
- **Depth 1**: Primary result + directly related entities
- **Depth 2**: Primary result + related entities + their relations
- **Depth N**: N levels of relationship traversal

## Transaction Semantics

### Atomicity
- Cascade responses reflect committed transaction state
- If a mutation fails, its cascade reports no entity changes (see [Server Requirements](09_server_requirements.md#transaction-semantics))
- All entities in cascade are consistent with each other

### Isolation
- Cascade computation happens within the mutation transaction
- No dirty reads or inconsistent state

### Consistency
- Every affected entity is either listed in the cascade or covered by a type invalidation ([Cascade Completeness](04_mutation_responses.md#cascade-completeness))
- No entities are silently omitted
- Related entities reflect the state after the mutation

## Performance Considerations

### Response Size Limits
Servers enforce configurable limits on cascade size (RECOMMENDED defaults: 500 updated entities, 100 deleted entities, 5 MB). When a cascade exceeds a limit, whole types move from the entity lists into `typeInvalidations` and `metadata.truncated` is set, so nothing is lost. See [Cascade Size Limits and Truncation](04_mutation_responses.md#cascade-size-limits-and-truncation).

### Memory Efficiency
- Stream entity processing rather than loading all in memory
- Use database cursors for large result sets

### Network Efficiency
- Compress cascade responses
- Use efficient serialization formats
- Batch entity fetches where possible