# GraphQL Schema Conventions

This document defines the GraphQL schema conventions that servers must implement to be Cascade-compliant.

## Base Schema Requirements

All Cascade-compliant GraphQL schemas MUST include the base types and interfaces defined in `cascade_base.graphql`.

### Required Interfaces

#### Node Interface
```graphql
"""
Global object identification for GraphQL Cascade.
All domain entities MUST implement this interface.
"""
interface Node {
  """Globally unique identifier for this entity."""
  id: ID!
}
```

**Requirements:**
- All domain entities MUST implement `Node`
- `id` field MUST be unique within each entity type
- `id` SHOULD be stable (not change for the same entity)

#### CascadeResponse Interface
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

**Requirements:**
- All mutations MUST return types implementing `CascadeResponse`
- `success` indicates overall operation success
- `errors` contains structured error information
- `data` contains the primary mutation result
- `cascade` contains all affected entities

#### Timestamped Interface (Recommended)
```graphql
"""
Timestamped entities for version tracking.
"""
interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int  # Optional: for optimistic concurrency control
}
```

**Requirements:**
- Entities SHOULD implement `Timestamped` when possible
- `createdAt` and `updatedAt` enable cache invalidation strategies
- `version` field enables optimistic concurrency control

## Mutation Naming Conventions

### Verb-Based Naming (MUST)
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

**Pattern:** `{Verb}{EntityType}(input: {Verb}{EntityType}Input!): {Verb}{EntityType}Cascade!`

### Input Object Naming (MUST)
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

### Response Type Naming (MUST)
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
```

**Requirements:**
- All response types MUST implement `CascadeResponse`
- The `data` field type SHOULD be the entity being mutated (or appropriate payload type)
- Response types MUST include all required fields from `CascadeResponse`

## Query Naming Conventions

### List Queries (SHOULD)
List queries SHOULD follow the pattern: `list{EntityType}s`

```graphql
type Query {
  listUsers(
    first: Int
    after: String
    filter: UserFilter
    orderBy: UserOrderBy
  ): UserConnection!

  listCompanies(
    first: Int
    after: String
    filter: CompanyFilter
  ): CompanyConnection!
}
```

### Get Queries (SHOULD)
Get queries SHOULD follow the pattern: `get{EntityType}`

```graphql
type Query {
  getUser(id: ID!): User
  getCompany(id: ID!): Company
  getOrder(id: ID!): Order
}
```

### Search Queries (MAY)
Search queries MAY follow the pattern: `search{EntityType}s`

```graphql
type Query {
  searchUsers(query: String!, first: Int, after: String): UserConnection!
  searchCompanies(query: String!, filters: CompanyFilters): CompanyConnection!
}
```

**Requirements:**
- Query names SHOULD be consistent for invalidation purposes
- Queries SHOULD include filtering arguments that match mutation invalidation hints
- Connection types SHOULD implement cursor-based pagination

## Entity Definition Patterns

### Basic Entity Structure
```graphql
type User implements Node & Timestamped {
  id: ID!
  email: String!
  name: String!
  role: UserRole!
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int
}
```

### Relationship Patterns

#### One-to-One Relationships
```graphql
type Company implements Node & Timestamped {
  id: ID!
  name: String!
  address: Address!  # One-to-one relationship
  owner: User!       # One-to-one relationship
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Address implements Node {
  id: ID!
  street: String!
  city: String!
  country: String!
  postalCode: String!
}
```

#### One-to-Many Relationships
```graphql
type Company implements Node & Timestamped {
  id: ID!
  name: String!
  employees: [User!]!  # One-to-many relationship
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

#### Many-to-Many Relationships
```graphql
type Order implements Node & Timestamped {
  id: ID!
  customer: User!
  items: [OrderItem!]!  # Many-to-many through OrderItem
  total: Float!
  status: OrderStatus!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type OrderItem {
  product: Product!
  quantity: Int!
  price: Float!
}

type Product implements Node {
  id: ID!
  name: String!
  price: Float!
  category: ProductCategory!
}
```

## Cascade Updates Structure

### UpdatedEntity Structure
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

**Requirements:**
- `entity` field MUST contain full entity data (not partial updates)
- `__typename` enables type discrimination in client code
- `operation` indicates whether entity was CREATED, UPDATED, or DELETED

### DeletedEntity Structure
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

**Requirements:**
- Only ID and deletion timestamp are included (entity data is gone)
- `__typename` enables proper cache eviction

### CascadeOperation Enum
```graphql
enum CascadeOperation {
  CREATED
  UPDATED
  DELETED
}
```

## Error Handling Structure

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

### CascadeErrorCode Enum
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

**Requirements:**
- Error codes MUST be from the standard enum
- `field` and `path` help clients highlight problematic input fields
- `extensions` MAY contain additional context (constraint names, etc.)

## Pagination Requirements

### Cursor-Based Pagination (SHOULD)
```graphql
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int  # Optional
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

**Requirements:**
- `edges` contains the actual data with cursors
- `pageInfo` provides pagination metadata
- Cursors MUST be opaque and stable

### Offset-Based Pagination (MAY)
```graphql
type UserList {
  users: [User!]!
  totalCount: Int!
  offset: Int!
  limit: Int!
}
```

**Requirements:**
- SHOULD include total count for UI purposes
- MAY be used for simple use cases where cursor pagination is overkill

## Custom Scalars

### Required Scalars
```graphql
scalar DateTime
scalar JSON
```

### DateTime Scalar
- MUST represent date/time values
- SHOULD use ISO 8601 format
- MUST include timezone information

### JSON Scalar
- MUST accept arbitrary JSON values
- Used for flexible metadata (extensions, arguments, etc.)
- Clients SHOULD validate JSON structure when possible

## Schema Organization

### File Structure
```
schema/
├── cascade_base.graphql     # Base types and interfaces
├── entities/                # Domain entity definitions
│   ├── user.graphql
│   ├── company.graphql
│   └── order.graphql
├── mutations/               # Mutation definitions
│   ├── user_mutations.graphql
│   ├── company_mutations.graphql
│   └── order_mutations.graphql
└── queries/                 # Query definitions
    ├── user_queries.graphql
    ├── company_queries.graphql
    └── order_queries.graphql
```

### Import Strategy
Schemas SHOULD use a modular structure with imports:

```graphql
# user.graphql
type User implements Node & Timestamped {
  id: ID!
  email: String!
  name: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

```graphql
# user_mutations.graphql
input CreateUserInput {
  email: String!
  name: String!
}

type CreateUserCascade implements CascadeResponse {
  success: Boolean!
  errors: [CascadeError!]
  data: User
  cascade: CascadeUpdates!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserCascade!
}
```

## Validation Rules

### Schema Validation
Cascade-compliant schemas MUST pass these validation rules:

1. **All mutations return CascadeResponse**
   - Every `Mutation` field MUST return a type implementing `CascadeResponse`

2. **All entities implement Node**
   - Every domain entity type MUST implement the `Node` interface

3. **Consistent naming conventions**
   - Mutations, inputs, and responses MUST follow naming patterns
   - Queries SHOULD follow naming patterns for invalidation

4. **Required fields present**
   - All required fields from base interfaces MUST be present
   - No optional fields marked as required

### Runtime Validation
Servers SHOULD validate:

1. **Response structure**
   - All CascadeResponse fields are present
   - Cascade data is correctly structured

2. **Entity identification**
   - All entities have valid `__typename` and `id`
   - IDs are unique within entity types

3. **Invalidation hints**
   - Query names match actual schema queries
   - Arguments are valid for the named queries

## Migration Guide

### From Non-Cascade Schemas

1. **Add base imports**
   ```graphql
   # Add to schema
   interface Node { id: ID! }
   interface CascadeResponse { ... }
   # ... other base types
   ```

2. **Update entity definitions**
   ```graphql
   # Before
   type User {
     id: ID!
     email: String!
   }

   # After
   type User implements Node {
     id: ID!
     email: String!
   }
   ```

3. **Update mutations**
   ```graphql
   # Before
   type Mutation {
     createUser(input: CreateUserInput!): User!
   }

   # After
   type CreateUserCascade implements CascadeResponse {
     success: Boolean!
     errors: [CascadeError!]
     data: User
     cascade: CascadeUpdates!
   }

   type Mutation {
     createUser(input: CreateUserInput!): CreateUserCascade!
   }
   ```

4. **Add cascade directives** (optional)
   ```graphql
   type Mutation {
     createUser(input: CreateUserInput!): CreateUserCascade!
       @cascade(maxDepth: 2)
   }
   ```

This ensures backward compatibility while adding Cascade capabilities.