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
    J --> K[__typename: String!]
    J --> L[id: ID!]
    J --> M[operation: CascadeOperation!]
    J --> N[entity: Node!]

    G --> O[DeletedEntity]
    O --> P[__typename: String!]
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

### CascadeResponse
The root interface that all Cascade-compliant mutations must return:

```graphql
interface CascadeResponse {
  """Whether the mutation succeeded."""
  success: Boolean!

  """List of errors if mutation failed or partially succeeded."""
  errors: [CascadeError!]

  """The primary result of the mutation."""
  data: MutationPayload

  """The cascade of updates triggered by this mutation."""
  cascade: CascadeUpdates!
}
```

### CascadeUpdates
The complete set of changes from a mutation:

```graphql
type CascadeUpdates {
  """All entities updated by this mutation (including the primary result)."""
  updated: [UpdatedEntity!]!

  """All entities deleted by this mutation."""
  deleted: [DeletedEntity!]!

  """Query invalidation hints for cache management."""
  invalidations: [QueryInvalidation!]!

  """Metadata about the cascade."""
  metadata: CascadeMetadata!
}
```

### UpdatedEntity
Represents an entity that was created or updated:

```graphql
type UpdatedEntity {
  """Type name of the entity (e.g., "User", "Company")."""
  __typename: String!

  """ID of the entity."""
  id: ID!

  """The operation performed."""
  operation: CascadeOperation!

  """The full entity data."""
  entity: Node!
}
```

### DeletedEntity
Represents an entity that was deleted:

```graphql
type DeletedEntity {
  """Type name of the deleted entity."""
  __typename: String!

  """ID of the deleted entity."""
  id: ID!

  """When the entity was deleted."""
  deletedAt: DateTime!
}
```

### CascadeOperation
The type of operation performed on an entity:

```graphql
enum CascadeOperation {
  CREATED
  UPDATED
  DELETED
}
```

### CascadeMetadata
Information about the cascade operation:

```graphql
type CascadeMetadata {
  """Server timestamp when mutation executed."""
  timestamp: DateTime!

  """Transaction ID for tracking (optional)."""
  transactionId: ID

  """Maximum relationship depth traversed."""
  depth: Int!

  """Total number of entities affected."""
  affectedCount: Int!
}
```

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
Instructions for invalidating cached queries:

```graphql
type QueryInvalidation {
  """Query name to invalidate (e.g., "listUsers", "getCompany")."""
  queryName: String

  """Hash of the query for exact matching."""
  queryHash: String

  """Arguments that identify the query to invalidate."""
  arguments: JSON

  """Pattern to match queries (e.g., "list*", "get*")."""
  queryPattern: String

  """Strategy for handling the invalidation."""
  strategy: InvalidationStrategy!

  """Scope of the invalidation."""
  scope: InvalidationScope!
}
```

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

### CascadeError
Structured error information:

```graphql
type CascadeError {
  """Human-readable error message."""
  message: String!

  """Machine-readable error code."""
  code: CascadeErrorCode!

  """Field that caused the error (if applicable)."""
  field: String

  """Path to the error in the input."""
  path: [String!]

  """Additional error metadata."""
  extensions: JSON
}
```

### Error Codes
Standard error codes for consistent error handling:

```graphql
enum CascadeErrorCode {
  VALIDATION_ERROR
  NOT_FOUND
  UNAUTHORIZED
  FORBIDDEN
  CONFLICT
  INTERNAL_ERROR
  TRANSACTION_FAILED
}
```

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
- If mutation fails, no cascade data is returned
- All entities in cascade are consistent with each other

### Isolation
- Cascade computation happens within the mutation transaction
- No dirty reads or inconsistent state

### Consistency
- Cascade includes all entities affected by the transaction
- No entities are missing from the cascade
- Related entities reflect the state after the mutation

## Performance Considerations

### Response Size Limits
- Maximum 500 updated entities per cascade
- Maximum 5MB total response size
- Servers MAY truncate cascades that exceed limits

### Memory Efficiency
- Stream entity processing rather than loading all in memory
- Use database cursors for large result sets

### Network Efficiency
- Compress cascade responses
- Use efficient serialization formats
- Batch entity fetches where possible