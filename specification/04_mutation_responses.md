# Mutation Responses

This document defines the structure and requirements for GraphQL Cascade mutation responses.

## CascadeResponse Interface

All Cascade-compliant mutations MUST return a type that implements the `CascadeResponse` interface:

```graphql
"""
Standard GraphQL Cascade mutation response.
All Cascade-compliant mutations MUST return this interface.
"""
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

## Response Structure

### Success Responses
For successful mutations:

```json
{
  "success": true,
  "errors": null,
  "data": { /* primary mutation result */ },
  "cascade": {
    "updated": [ /* entities that were updated */ ],
    "deleted": [ /* entities that were deleted */ ],
    "invalidations": [ /* cache invalidation hints */ ],
    "metadata": { /* cascade metadata */ }
  }
}
```

### Error Responses
For failed mutations:

```json
{
  "success": false,
  "errors": [
    {
      "message": "Validation failed",
      "code": "VALIDATION_ERROR",
      "field": "email",
      "path": ["input", "email"]
    }
  ],
  "data": null,
  "cascade": {
    "updated": [],
    "deleted": [],
    "invalidations": [],
    "metadata": {
      "timestamp": "2023-11-11T10:00:00Z",
      "depth": 0,
      "affectedCount": 0
    }
  }
}
```

## Mutation Naming Conventions

### Verb-Based Naming
Mutations MUST use consistent verb-based naming:

```graphql
type Mutation {
  # Create operations
  createUser(input: CreateUserInput!): CreateUserCascade!
  createCompany(input: CreateCompanyInput!): CreateCompanyCascade!

  # Update operations
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserCascade!
  updateCompany(id: ID!, input: UpdateCompanyInput!): UpdateCompanyCascade!

  # Delete operations
  deleteUser(id: ID!): DeleteUserCascade!
  deleteCompany(id: ID!): DeleteCompanyCascade!

  # Custom operations
  sendPasswordReset(email: String!): SendPasswordResetCascade!
  archiveOrder(id: ID!): ArchiveOrderCascade!
}
```

### Response Type Naming
Response types MUST follow the pattern: `{Verb}{EntityType}Cascade`

```graphql
type CreateUserCascade implements CascadeResponse {
  success: Boolean!
  errors: [CascadeError!]
  data: User
  cascade: CascadeUpdates!
}

type UpdateCompanyCascade implements CascadeResponse {
  success: Boolean!
  errors: [CascadeError!]
  data: Company
  cascade: CascadeUpdates!
}

type DeleteOrderCascade implements CascadeResponse {
  success: Boolean!
  errors: [CascadeError!]
  data: Order
  cascade: CascadeUpdates!
}
```

## Input Object Naming

Input types MUST follow the pattern: `{Verb}{EntityType}Input`

```graphql
input CreateUserInput {
  email: String!
  name: String!
  password: String!
}

input UpdateUserInput {
  email: String
  name: String
  password: String
}
```

## CascadeUpdates Structure

### Complete Structure
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

### UpdatedEntity Details
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

### DeletedEntity Details
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

## Error Handling

### CascadeError Structure
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
```graphql
enum CascadeErrorCode {
  VALIDATION_ERROR     # Input validation failed
  NOT_FOUND           # Entity not found
  UNAUTHORIZED        # User not authenticated
  FORBIDDEN           # User lacks permission
  CONFLICT            # Version conflict or unique constraint violation
  INTERNAL_ERROR      # Server error
  TRANSACTION_FAILED  # Database transaction failed
}
```

### Error Examples
```json
{
  "errors": [
    {
      "message": "Email address is already in use",
      "code": "CONFLICT",
      "field": "email",
      "path": ["input", "email"],
      "extensions": {
        "constraint": "unique_email"
      }
    },
    {
      "message": "Password must be at least 8 characters",
      "code": "VALIDATION_ERROR",
      "field": "password",
      "path": ["input", "password"],
      "extensions": {
        "minLength": 8
      }
    }
  ]
}
```

## Cascade Metadata

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

## Example Mutation Response

### Create User Mutation
```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    success
    errors {
      message
      code
      field
      path
    }
    data {
      id
      email
      name
      createdAt
      updatedAt
    }
    cascade {
      updated {
        __typename
        id
        operation
        entity {
          ... on User {
            id
            email
            name
            createdAt
            updatedAt
          }
        }
      }
      deleted {
        __typename
        id
        deletedAt
      }
      invalidations {
        queryName
        strategy
        scope
      }
      metadata {
        timestamp
        depth
        affectedCount
      }
    }
  }
}
```

### Response Example
```json
{
  "data": {
    "createUser": {
      "success": true,
      "errors": null,
      "data": {
        "id": "123",
        "email": "john@example.com",
        "name": "John Doe",
        "createdAt": "2023-11-11T10:00:00Z",
        "updatedAt": "2023-11-11T10:00:00Z"
      },
      "cascade": {
        "updated": [
          {
            "__typename": "User",
            "id": "123",
            "operation": "CREATED",
            "entity": {
              "id": "123",
              "email": "john@example.com",
              "name": "John Doe",
              "createdAt": "2023-11-11T10:00:00Z",
              "updatedAt": "2023-11-11T10:00:00Z"
            }
          }
        ],
        "deleted": [],
        "invalidations": [
          {
            "queryName": "listUsers",
            "strategy": "INVALIDATE",
            "scope": "PREFIX"
          }
        ],
        "metadata": {
          "timestamp": "2023-11-11T10:00:00Z",
          "depth": 1,
          "affectedCount": 1
        }
      }
    }
  }
}
```

## Partial Success Handling

Mutations MAY succeed partially:

```json
{
  "success": true,  // Overall success
  "errors": [
    {
      "message": "Failed to send welcome email",
      "code": "INTERNAL_ERROR",
      "extensions": {
        "nonCritical": true
      }
    }
  ],
  "data": { /* primary result */ },
  "cascade": { /* cascade data */ }
}
```

## Client Processing

Clients MUST process cascade responses in this order:

1. **Check success status**
2. **Handle errors** (may be warnings even on success)
3. **Apply cascade updates** to cache
4. **Return primary data** to application code

### TypeScript Client Example
```typescript
async function mutate<T>(
  mutation: DocumentNode,
  variables: any
): Promise<T> {
  const result = await client.mutate({ mutation, variables });
  const response = result.data[Object.keys(result.data)[0]];

  if (!response.success) {
    throw new Error(`Mutation failed: ${response.errors?.[0]?.message}`);
  }

  // Apply cascade to cache
  applyCascade(response.cascade);

  // Handle non-critical errors
  if (response.errors?.length) {
    console.warn('Non-critical errors:', response.errors);
  }

  return response.data;
}
```