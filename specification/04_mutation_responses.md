# Mutation Responses

This document defines the structure and requirements for GraphQL Cascade mutation responses.

The type definitions in this chapter are excerpts of [`reference/cascade_base.graphql`](../reference/cascade_base.graphql), the normative schema. If an excerpt anywhere in the specification disagrees with it, the reference schema is authoritative; CI checks that they agree.

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
    "typeInvalidations": [ /* types invalidated wholesale, usually empty */ ],
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
    "typeInvalidations": [],
    "metadata": {
      "timestamp": "2023-11-11T10:00:00Z",
      "depth": 0,
      "affectedCount": 0,
      "truncated": false
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

  """
  Types whose affected entities are not listed individually.
  Clients treat every cached entity of each type, and every cached
  query that may contain one, as stale.
  """
  typeInvalidations: [TypeInvalidation!]!

  """Metadata about the cascade."""
  metadata: CascadeMetadata!
}
```

### UpdatedEntity Details
```graphql
type UpdatedEntity {
  """
  Type name of the entity (e.g., "User", "Company").
  Replaces the deprecated `__typename` pseudo-field.
  """
  typename: String!

  """ID of the entity."""
  id: ID!

  """The operation performed."""
  operation: CascadeOperation!

  """The full entity data."""
  entity: Node!
}

"""
Type of cascade operation.
"""
enum CascadeOperation {
  CREATED
  UPDATED
  DELETED
}
```

### DeletedEntity Details
```graphql
type DeletedEntity {
  """
  Type name of the deleted entity.
  Replaces the deprecated `__typename` pseudo-field.
  """
  typename: String!

  """ID of the deleted entity."""
  id: ID!

  """When the entity was deleted."""
  deletedAt: DateTime!
}
```

### Deprecated: `__typename` on UpdatedEntity and DeletedEntity

**Deprecated in**: 1.3.0
**Removal**: 2.0.0

Specifications before 1.3.0 named the entity's type `__typename`. GraphQL reserves names beginning with `__`, so a schema cannot declare that field, and selecting `__typename` on an `UpdatedEntity` returns `"UpdatedEntity"`, not the entity's type.

- Servers MUST provide `typename`. Until 2.0.0, servers that serialize cascades as JSON outside GraphQL execution (for example in `extensions.cascade`) SHOULD also include `__typename` with the same value, for clients written against earlier versions.
- Clients MUST read `typename`, and SHOULD fall back to `__typename` when `typename` is absent, to work with servers written against earlier versions.

**Migration**:
```graphql
# Before
fragment CascadeFields on CascadeUpdates {
  updated { __typename id operation entity { id } }
  deleted { __typename id }
}

# After
fragment CascadeFields on CascadeUpdates {
  updated { typename id operation entity { id } }
  deleted { typename id }
}
```

### TypeInvalidation Details
```graphql
type TypeInvalidation {
  """GraphQL type name, e.g. "Post"."""
  typename: String!

  """Number of affected entities of this type, when known."""
  affectedCount: Int
}
```

A type invalidation states that entities of `typename` were affected but are not all listed in `updated` or `deleted`. Servers emit type invalidations when [limits force entities out of the response](#cascade-size-limits-and-truncation). They MAY also emit them when they know a type was affected but cannot enumerate the entities, for example after a bulk `UPDATE` statement. Clients process them as described in [Type Invalidation](05_invalidation.md#type-invalidation).

## Error Handling

### CascadeError Structure
```graphql
type CascadeError {
  """Human-readable error message."""
  message: String!

  """Machine-readable error category. Drives generic client handling."""
  code: CascadeErrorCode!

  """
  Application-defined code identifying the specific condition,
  e.g. "INSUFFICIENT_FUNDS". Refines `code`; never replaces it.
  """
  domainCode: String

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
  TIMEOUT             # Operation timed out
  RATE_LIMITED        # Rate limit exceeded
  SERVICE_UNAVAILABLE # Service temporarily unavailable
}
```

### Error Code Selection Guidelines

Implementations SHOULD select error codes according to these guidelines:

#### Input and Validation Errors

- **`VALIDATION_ERROR`**: Use for input format, type, or constraint violations
  - Missing required fields
  - Invalid email format
  - Value out of range (e.g., age < 0)
  - Field length violations
  - Pattern mismatches (e.g., phone number format)

  **Example:**
  ```json
  {
    "message": "Email address format is invalid",
    "code": "VALIDATION_ERROR",
    "field": "email",
    "path": ["input", "email"]
  }
  ```

#### Entity and Permission Errors

- **`NOT_FOUND`**: Use when a referenced entity does not exist
  - Entity lookup by ID fails
  - Related entity referenced in mutation doesn't exist

  **Example:**
  ```json
  {
    "message": "User with ID '123' not found",
    "code": "NOT_FOUND",
    "field": "userId",
    "path": ["updateUser", "id"]
  }
  ```

- **`UNAUTHORIZED`**: Use when authentication is required or has failed
  - No authentication token provided
  - Authentication token expired or invalid
  - User session terminated

  **Example:**
  ```json
  {
    "message": "Authentication required",
    "code": "UNAUTHORIZED",
    "extensions": {
      "reason": "token_expired"
    }
  }
  ```

- **`FORBIDDEN`**: Use when user is authenticated but lacks permission
  - User lacks role/permission for operation
  - Resource access denied by policy
  - Operation restricted to owner only

  **Example:**
  ```json
  {
    "message": "Insufficient permissions to delete user",
    "code": "FORBIDDEN",
    "extensions": {
      "requiredRole": "admin",
      "currentRole": "user"
    }
  }
  ```

#### Conflict and Consistency Errors

- **`CONFLICT`**: Use for uniqueness violations and consistency conflicts
  - Unique constraint violation (duplicate email, username)
  - Optimistic locking failure (version mismatch)
  - Concurrent modification detected
  - Resource already in requested state

  **Example:**
  ```json
  {
    "message": "Email address already in use",
    "code": "CONFLICT",
    "field": "email",
    "path": ["input", "email"],
    "extensions": {
      "constraint": "unique_email"
    }
  }
  ```

- **`TRANSACTION_FAILED`**: Use when database transaction fails
  - Transaction rollback due to constraint violation
  - Deadlock detected
  - Serialization failure

  **Example:**
  ```json
  {
    "message": "Transaction failed due to deadlock",
    "code": "TRANSACTION_FAILED",
    "extensions": {
      "retryable": true
    }
  }
  ```

#### Operational Errors

- **`TIMEOUT`**: Use when operation exceeds time limit
  - Database query timeout
  - External service call timeout
  - Long-running operation exceeded deadline

  **Example:**
  ```json
  {
    "message": "Payment provider did not respond within 30 seconds",
    "code": "TIMEOUT",
    "extensions": {
      "timeoutMs": 30000,
      "service": "payment-gateway",
      "retryable": true
    }
  }
  ```

- **`RATE_LIMITED`**: Use when client exceeds request quota
  - Too many requests in time window
  - API rate limit exceeded
  - Concurrent request limit reached

  **Note**: When using this code, include retry timing information in `extensions`:

  **Example:**
  ```json
  {
    "message": "Rate limit exceeded: 100 requests per minute",
    "code": "RATE_LIMITED",
    "extensions": {
      "retryAfter": 45,
      "limit": 100,
      "window": "1m",
      "remaining": 0,
      "resetAt": "2023-11-11T10:01:00Z"
    }
  }
  ```

- **`SERVICE_UNAVAILABLE`**: Use when upstream service is unavailable
  - External service temporarily down
  - Database connection pool exhausted
  - Dependency health check failed
  - Temporary maintenance mode

  **Note**: This error is typically retryable. Include retry guidance in `extensions`:

  **Example:**
  ```json
  {
    "message": "Email service temporarily unavailable",
    "code": "SERVICE_UNAVAILABLE",
    "extensions": {
      "service": "email-provider",
      "retryable": true,
      "retryAfter": 60,
      "healthCheckUrl": "https://status.email-provider.com"
    }
  }
  ```

- **`INTERNAL_ERROR`**: Use for unexpected server errors
  - Unhandled exceptions
  - Bugs in server code
  - Configuration errors
  - Any error not covered by other codes

  **Example:**
  ```json
  {
    "message": "An unexpected error occurred",
    "code": "INTERNAL_ERROR",
    "extensions": {
      "errorId": "err_abc123",
      "timestamp": "2023-11-11T10:00:00Z"
    }
  }
  ```

#### Decision Tree

When selecting an error code, use this decision tree:

1. **Is it a client input problem?**
   - Invalid format/type → `VALIDATION_ERROR`
   - Entity doesn't exist → `NOT_FOUND`
   - Uniqueness violation → `CONFLICT`

2. **Is it an authentication/authorization problem?**
   - Not authenticated → `UNAUTHORIZED`
   - Authenticated but no permission → `FORBIDDEN`

3. **Is it an operational issue?**
   - Operation took too long → `TIMEOUT`
   - Too many requests → `RATE_LIMITED`
   - Dependency unavailable → `SERVICE_UNAVAILABLE`
   - Database transaction issue → `TRANSACTION_FAILED`

4. **Is it unexpected?**
   - Everything else → `INTERNAL_ERROR`

### Domain-Specific Error Codes

`CascadeErrorCode` is a closed set of **categories** that tell clients how to react generically: retry, re-authenticate, highlight a field, or report a failure. Applications also have **specific conditions** that clients need to recognize, such as insufficient funds, exhausted inventory, or a locked account. These are carried in `domainCode`, alongside the category, never in place of it.

Servers:

- MUST set `code` to the standard category that best describes the error, following the selection guidelines above. `code` MUST NOT carry application-specific values.
- MAY set `domainCode` to an application-defined string identifying the specific condition.
- MUST format `domainCode` as one or more `UPPER_SNAKE_CASE` segments separated by `.`, matching `^[A-Z][A-Z0-9_]*(\.[A-Z][A-Z0-9_]*)*$`.
- SHOULD prefix `domainCode` with a namespace they own (for example `BILLING.INSUFFICIENT_FUNDS`) when the code is emitted by a reusable library or a shared service, so codes from different sources cannot collide.
- MUST treat a published `domainCode` as part of the API contract: its meaning MUST NOT change, and removing it is a breaking API change.

Clients:

- MUST base generic handling (retry, authentication, field display) on `code` alone.
- MAY branch on `domainCode` for condition-specific behavior, such as showing a dedicated dialog.
- MUST tolerate `domainCode` values they do not recognize, falling back to handling based on `code`.

| Condition | `code` | `domainCode` |
|-----------|--------|--------------|
| Business rule rejects the input | `VALIDATION_ERROR` | `ORDER_BELOW_MINIMUM` |
| Balance too low for the operation | `CONFLICT` | `INSUFFICIENT_FUNDS` |
| Stock exhausted during checkout | `CONFLICT` | `INVENTORY_EXHAUSTED` |
| Account locked after failed logins | `FORBIDDEN` | `ACCOUNT_LOCKED` |
| Identity verification not completed | `FORBIDDEN` | `KYC_INCOMPLETE` |
| Plan quota used up until next billing cycle | `FORBIDDEN` | `QUOTA_EXCEEDED` |
| Coupon already redeemed (code from a shared promotions service) | `CONFLICT` | `PROMOTIONS.COUPON_ALREADY_REDEEMED` |

`QUOTA_EXCEEDED` maps to `FORBIDDEN` rather than `RATE_LIMITED`: waiting briefly will not help, so the client must not retry automatically.

**Example:**
```json
{
  "message": "Your balance is too low to complete this transfer",
  "code": "CONFLICT",
  "domainCode": "INSUFFICIENT_FUNDS",
  "field": "amount",
  "path": ["input", "amount"],
  "extensions": {
    "available": "12.50",
    "requested": "40.00"
  }
}
```

Implementations that previously placed domain codes in `extensions` SHOULD move them to `domainCode`.

> **Design note (non-normative).** Two alternatives were rejected. Letting servers add values to `CascadeErrorCode` does not work in GraphQL: enums are closed in the schema, so extra values would require changing `code` to `String`, which breaks every typed client. A structured `"CLASS.SUBCLASS"` code would break clients that compare `code` for equality. Keeping the category and the specific condition in separate fields is additive and keeps generic handling type-safe. The same split appears in gRPC (`Status` plus `ErrorInfo.reason`).

### Forward Compatibility

Later minor versions of this specification MAY add values to `CascadeErrorCode`. Clients MUST handle a `code` value they do not recognize as `INTERNAL_ERROR`: not retryable, not an authentication error, and shown as a generic failure. Clients that generate code from the schema SHOULD make sure an unknown enum value is not a runtime error.

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

  """
  Total number of entities affected, including those covered by
  type invalidations.
  """
  affectedCount: Int!

  """
  Whether limits forced entities or invalidation hints out of this
  response. Everything omitted is covered by typeInvalidations.
  """
  truncated: Boolean!
}
```

## Cascade Completeness

Every entity the server identified as affected by the mutation MUST appear in the response in one of two ways:

- listed individually in `updated` or `deleted`, or
- covered by a `typeInvalidations` entry for its type.

Servers MUST NOT silently omit affected entities. A client that applies a cascade can therefore rely on it: anything not listed is covered by a type invalidation, so nothing stale survives in its cache. Entities of a type listed in `typeInvalidations` MAY still appear in `updated` or `deleted`; clients apply them first and then invalidate the type.

The completeness rule is relative to what the server's tracker identifies. A tracker that walks relationships to a fixed depth only finds entities within that depth (see [Entity Tracking Algorithm](10_tracking_algorithm.md)). A tracker driven by the database's own dependency graph finds every affected entity (see [Appendix G: Database-Derived Tracking](appendices/G_database_derived_tracking.md)).

## Cascade Size Limits and Truncation

Servers MUST enforce limits on cascade size to bound response size and server memory. Limits MUST be configurable. The RECOMMENDED defaults are:

| Limit | Default |
|-------|---------|
| Updated entities | 500 |
| Deleted entities | 100 |
| Serialized cascade size | 5 MB |

When a cascade exceeds a limit, the server MUST truncate it as follows:

1. Choose a type whose entities are listed. Servers SHOULD choose the type with the most entries in the list that exceeds its limit, breaking ties by type name so the output is deterministic.
2. Remove every entity of that type from `updated` and `deleted`, and add a `typeInvalidations` entry for the type. `affectedCount` SHOULD be the number of entities of the type that were affected.
3. Repeat until every limit is met.
4. Set `metadata.truncated` to `true`.

Removing whole types instead of cutting lists at an arbitrary position keeps every remaining entry precise, and each removed entity stays covered.

If invalidation hints in `invalidations` exceed a limit, servers MUST NOT drop hints without covering them. They either replace the omitted hints with broader ones (`PREFIX`, `PATTERN` or `ALL` scope), or add a `typeInvalidations` entry for every type in the cascade and set `metadata.truncated` to `true`.

`metadata.truncated` is `true` exactly when the server removed entities or hints and covered them with type invalidations, so `typeInvalidations` MUST NOT be empty when it is `true`. It MUST be `false` otherwise.

Type invalidations are subject to the same authorization rules as entities (see [Security](16_security.md)): servers MUST NOT emit a type invalidation for entities the client could not have seen.

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
        typename
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
        typename
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
            "typename": "User",
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

## Asynchronous Operations

Some mutations may be accepted for asynchronous processing rather than completing synchronously. The GraphQL Cascade specification supports this pattern without requiring additional fields.

### Recommended Pattern

Mutations accepted for async processing SHOULD return:

- `success: true` - Operation was accepted successfully
- `data: null` or partial result object with job/operation ID
- `errors: []` - No immediate errors
- `cascade` - Only the changes committed when the mutation returns

The cascade MUST NOT describe effects that have not been committed yet. If the accepted work is represented by a persisted entity (for example a job record), that entity is the primary result and appears in `cascade.updated` with operation `CREATED`, like any other created entity. Changes made later by the background work are delivered as described in [Cascade Updates After Completion](#cascade-updates-after-completion).

### Example: Async Job Acceptance

**Mutation:**
```graphql
mutation ProcessLargeDataset($input: ProcessDatasetInput!) {
  processDataset(input: $input) {
    success
    errors { message code }
    data {
      id
      status
      estimatedCompletionTime
    }
    cascade {
      updated { typename id }
      deleted { typename id }
      invalidations { queryName }
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "processDataset": {
      "success": true,
      "errors": [],
      "data": {
        "id": "job-123",
        "status": "pending",
        "estimatedCompletionTime": "2023-11-11T10:05:00Z"
      },
      "cascade": {
        "updated": [
          {
            "typename": "DatasetJob",
            "id": "job-123",
            "operation": "CREATED",
            "entity": {
              "id": "job-123",
              "status": "pending",
              "estimatedCompletionTime": "2023-11-11T10:05:00Z"
            }
          }
        ],
        "deleted": [],
        "invalidations": [],
        "metadata": {
          "timestamp": "2023-11-11T10:00:00Z",
          "depth": 0,
          "affectedCount": 1
        }
      }
    }
  }
}
```

### Completion Detection

Clients SHOULD use one of these strategies to detect completion:

#### 1. Polling Strategy

Query the job/operation status periodically:

```graphql
query GetJobStatus($id: ID!) {
  job(id: $id) {
    id
    status
    result {
      ... on ProcessDatasetSuccess {
        recordsProcessed
        outputUrl
      }
      ... on ProcessDatasetError {
        message
        code
      }
    }
  }
}
```

#### 2. Subscription Strategy

Subscribe to job completion events:

```graphql
subscription JobCompleted($id: ID!) {
  jobCompleted(id: $id) {
    id
    status
    result {
      ... on ProcessDatasetSuccess {
        recordsProcessed
        outputUrl
      }
    }
  }
}
```

#### 3. Webhook Strategy

Provide a callback URL in the mutation input:

```graphql
mutation ProcessDataset($input: ProcessDatasetInput!) {
  processDataset(input: $input) {
    success
    data { id }
  }
}

# Input includes:
# {
#   "datasetUrl": "https://...",
#   "callbackUrl": "https://myapp.com/webhooks/job-completed"
# }
```

### Cascade Updates After Completion

When an async operation completes, the server SHOULD:

1. Make the result available via query (job status, result entity)
2. Emit cascade updates if the operation modifies entities
3. Trigger appropriate invalidations for affected queries

If using subscriptions, the completion event SHOULD include cascade information:

```graphql
subscription JobCompleted($id: ID!) {
  jobCompleted(id: $id) {
    id
    status
    cascade {
      updated { typename id entity }
      deleted { typename id }
      invalidations { queryName }
    }
  }
}
```

### Error Handling for Async Operations

If an async operation fails during processing:

1. The job/operation entity SHOULD reflect the error state
2. Querying the job SHOULD return error details
3. If using subscriptions, emit a completion event with error information

**Example query response for failed job:**
```json
{
  "data": {
    "job": {
      "id": "job-123",
      "status": "failed",
      "error": {
        "message": "Dataset file is corrupted",
        "code": "VALIDATION_ERROR"
      }
    }
  }
}
```

### Implementation Notes

- Async operations are **optional** - not all mutations need async support
- This pattern is a **recommendation**, not a requirement
- Implementations MAY use different patterns suited to their architecture
- Represent progress on the job entity itself (for example a `status` field), not on the Cascade response

## Comprehensive Error Examples

### Example 1: Timeout Error

**Scenario**: Payment provider does not respond within timeout period

```json
{
  "data": {
    "createOrder": {
      "success": false,
      "errors": [
        {
          "message": "Payment provider did not respond within 30 seconds",
          "code": "TIMEOUT",
          "field": null,
          "path": ["createOrder"],
          "extensions": {
            "timeoutMs": 30000,
            "service": "payment-gateway",
            "retryable": true
          }
        }
      ],
      "data": null,
      "cascade": {
        "updated": [],
        "deleted": [],
        "invalidations": [],
        "metadata": {
          "timestamp": "2023-11-11T10:00:30Z",
          "depth": 0,
          "affectedCount": 0
        }
      }
    }
  }
}
```

### Example 2: Rate Limited

**Scenario**: Client exceeds API rate limit

```json
{
  "data": {
    "sendEmail": {
      "success": false,
      "errors": [
        {
          "message": "Rate limit exceeded: 100 requests per minute",
          "code": "RATE_LIMITED",
          "field": null,
          "path": ["sendEmail"],
          "extensions": {
            "retryAfter": 45,
            "limit": 100,
            "window": "1m",
            "remaining": 0,
            "resetAt": "2023-11-11T10:01:00Z"
          }
        }
      ],
      "data": null,
      "cascade": {
        "updated": [],
        "deleted": [],
        "invalidations": [],
        "metadata": {
          "timestamp": "2023-11-11T10:00:15Z",
          "depth": 0,
          "affectedCount": 0
        }
      }
    }
  }
}
```

### Example 3: Service Unavailable

**Scenario**: Upstream email service is down

```json
{
  "data": {
    "createUser": {
      "success": false,
      "errors": [
        {
          "message": "Email service temporarily unavailable",
          "code": "SERVICE_UNAVAILABLE",
          "field": null,
          "path": ["createUser"],
          "extensions": {
            "service": "email-provider",
            "retryable": true,
            "retryAfter": 60,
            "healthCheckUrl": "https://status.email-provider.com"
          }
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
  }
}
```

### Example 4: Multiple Validation Errors

**Scenario**: Multiple input fields fail validation

```json
{
  "data": {
    "createUser": {
      "success": false,
      "errors": [
        {
          "message": "Email address format is invalid",
          "code": "VALIDATION_ERROR",
          "field": "email",
          "path": ["input", "email"],
          "extensions": {
            "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
          }
        },
        {
          "message": "Password must be at least 8 characters",
          "code": "VALIDATION_ERROR",
          "field": "password",
          "path": ["input", "password"],
          "extensions": {
            "minLength": 8,
            "actualLength": 5
          }
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
  }
}
```

### Example 5: Partial Success with Non-Critical Error

**Scenario**: User created successfully but welcome email failed to send

```json
{
  "data": {
    "createUser": {
      "success": true,
      "errors": [
        {
          "message": "Failed to send welcome email",
          "code": "SERVICE_UNAVAILABLE",
          "field": null,
          "path": ["createUser", "sendWelcomeEmail"],
          "extensions": {
            "nonCritical": true,
            "service": "email-provider",
            "willRetry": true
          }
        }
      ],
      "data": {
        "id": "123",
        "email": "john@example.com",
        "name": "John Doe",
        "createdAt": "2023-11-11T10:00:00Z"
      },
      "cascade": {
        "updated": [
          {
            "typename": "User",
            "id": "123",
            "operation": "CREATED",
            "entity": {
              "id": "123",
              "email": "john@example.com",
              "name": "John Doe"
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

## Client Processing

Clients MUST process cascade responses in this order:

1. **Check success status**
2. **Handle errors** (MAY be warnings even on success)
3. **Apply cascade updates** to cache: `updated`, then `deleted`, then `invalidations`, then `typeInvalidations`
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