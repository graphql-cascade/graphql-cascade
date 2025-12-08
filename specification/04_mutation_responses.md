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

## Asynchronous Operations

Some mutations may be accepted for asynchronous processing rather than completing synchronously. The GraphQL Cascade specification supports this pattern without requiring additional fields.

### Recommended Pattern

Mutations accepted for async processing SHOULD return:

- `success: true` - Operation was accepted successfully
- `data: null` or partial result object with job/operation ID
- `errors: []` - No immediate errors
- `cascade: { updated: [], deleted: [], invalidations: [] }` - Empty until completion

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
      updated { __typename id }
      deleted { __typename id }
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
      updated { __typename id entity }
      deleted { __typename id }
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
- Consider adding a `status` enum to differentiate sync vs async responses:
  ```graphql
  enum MutationStatus {
    COMPLETED  # Synchronous operation completed
    PENDING    # Asynchronous operation accepted
    FAILED     # Operation failed
  }
  ```

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
            "__typename": "User",
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