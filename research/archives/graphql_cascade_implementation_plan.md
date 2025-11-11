# Implementation Plan for GraphQL Cascade Specification

**Official Name**: GraphQL Cascade Specification (GCS)
**Version**: v0.1
**Tagline**: "Cascading cache updates for GraphQL"
**Inspired by**: Relay Modern, Apollo Client Cache protocols
**Goal**: Define a standardized GraphQL specification enabling automatic frontend cache updates from mutation responses

---

## 🌊 BRAND IDENTITY

**Name**: GraphQL Cascade
**Abbreviation**: GCS
**Domain**: `graphql-cascade.dev`
**GitHub Org**: `github.com/graphql-cascade`
**npm scope**: `@graphql-cascade`
**PyPI**: `graphql-cascade`

**Taglines**:
- Primary: "Cascading cache updates for GraphQL"
- Secondary: "One mutation, cascade through your cache"
- Technical: "Automatic cache coherence through cascading updates"

**Visual Identity**:
- Logo concept: Waterfall/cascade icon with interconnected nodes
- Color scheme: Blue/teal (water theme) with accent colors
- Typography: Modern, clean, technical

---

## 📋 EXECUTIVE SUMMARY

This specification will define:
1. **GraphQL schema conventions** for mutation responses that include cascading updates
2. **Server-side requirements** for FraiseQL and other GraphQL backends
3. **Client-side integration patterns** for cache libraries (Apollo, Relay, React Query, etc.)
4. **Validation and compliance** mechanisms
5. **Migration and adoption** strategy

The spec will be framework-agnostic but provide clear integration patterns for popular libraries.

**Core Concept**: When a mutation executes, the server tracks all affected entities (the "cascade") and returns them in a structured format, enabling clients to automatically update their caches without manual logic.

---

## 📦 PROJECT STRUCTURE

```
graphql-cascade/
├── specification/           # The canonical GraphQL Cascade spec
│   ├── 00_introduction.md
│   ├── 01_conformance.md
│   ├── 02_cascade_model.md
│   ├── 03_entity_identification.md
│   ├── 04_mutation_responses.md
│   ├── 05_schema_conventions.md
│   ├── 06_server_requirements.md
│   ├── 07_client_integration.md
│   ├── 08_invalidation.md
│   ├── 09_optimistic_updates.md
│   ├── 10_subscriptions.md
│   ├── 11_security.md
│   ├── 12_performance.md
│   └── appendices/
│       ├── A_comparison_with_relay.md
│       ├── B_comparison_with_apollo.md
│       ├── C_migration_guide.md
│       ├── D_glossary.md
│       └── E_examples.md
│
├── reference/server-python/        # Python/FraiseQL reference implementation
│   ├── graphql_cascade/
│   │   ├── __init__.py
│   │   ├── tracker.py       # Entity change tracking
│   │   ├── builder.py       # Cascade response builder
│   │   ├── invalidator.py   # Invalidation hint generator
│   │   └── middleware.py    # GraphQL middleware
│   ├── examples/
│   │   ├── basic_crud.py
│   │   ├── nested_entities.py
│   │   └── custom_actions.py
│   ├── tests/
│   └── README.md
│
├── client-reference/        # TypeScript reference implementation
│   ├── packages/
│   │   ├── core/           # @graphql-cascade/client
│   │   ├── apollo/         # @graphql-cascade/apollo
│   │   ├── relay/          # @graphql-cascade/relay
│   │   ├── react-query/    # @graphql-cascade/react-query
│   │   └── urql/           # @graphql-cascade/urql
│   ├── examples/
│   └── tests/
│
├── compliance-tests/        # Test suite for Cascade compliance
│   ├── server/
│   │   ├── test_entity_tracking.py
│   │   ├── test_cascade_structure.py
│   │   ├── test_invalidation.py
│   │   └── test_performance.py
│   ├── client/
│   │   ├── test_cache_updates.ts
│   │   ├── test_invalidation.ts
│   │   └── test_optimistic.ts
│   └── integration/
│       ├── test_roundtrip.ts
│       └── test_realtime.ts
│
├── examples/               # Example applications
│   ├── todo-app/          # Simple CRUD with Cascade
│   ├── blog-platform/     # Nested entities, comments
│   ├── ecommerce-dashboard/ # Complex relationships
│   └── realtime-chat/     # Subscriptions integration
│
├── tools/                  # Developer tools
│   ├── schema-generator/   # Generate Cascade-compliant schemas
│   ├── compliance-checker/ # Validate Cascade compliance
│   ├── devtools-extension/ # Browser extension
│   └── vscode-extension/   # VS Code extension
│
├── website/                # graphql-cascade.dev
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── content/
│   └── public/
│
└── docs/                   # Documentation
    ├── quickstart/
    ├── guides/
    ├── api-reference/
    └── examples/
```

---

## PHASES

### Phase 1: Research & Analysis (Estimated: 8-12 hours)

**Objective**: Deep understanding of existing specifications and identify GraphQL Cascade's unique value proposition

#### Tasks:

1. **Study Relay Specification**
   - [ ] Read Relay Modern cursor specification
   - [ ] Analyze Relay's object identification (`node` interface, global IDs)
   - [ ] Study Relay's mutation response patterns (`updater` functions)
   - [ ] Review Relay's cache normalization strategy
   - [ ] Document what Relay does well and limitations (manual `updater` logic)
   - [ ] Identify how Cascade improves on Relay's approach

2. **Study Apollo Client Specification**
   - [ ] Review Apollo's cache normalization (`__typename` + `id`)
   - [ ] Analyze Apollo's `@client` directives and cache policies
   - [ ] Study Apollo's optimistic response patterns
   - [ ] Review Apollo's cache eviction/garbage collection
   - [ ] Document Apollo's update logic patterns (manual `update` functions)
   - [ ] Identify how Cascade improves on Apollo's approach

3. **Study Other Protocols**
   - [ ] GraphQL Cursor Connections Specification
   - [ ] URQL's normalized cache approach (document cache vs normalized)
   - [ ] React Query's query invalidation patterns
   - [ ] JSON:API specifications (for comparison with REST approaches)
   - [ ] SWR (Vercel) mutation patterns

4. **Identify GraphQL Cascade Requirements**
   - [ ] List common patterns across all frameworks
   - [ ] Identify pain points in current approaches (manual update logic)
   - [ ] Define GraphQL Cascade's unique value proposition:
     * Automatic cascade tracking
     * Zero boilerplate cache updates
     * Framework-agnostic specification
   - [ ] Document compatibility requirements with existing tools

5. **Create Comparison Matrix**
   - [ ] Feature comparison: Relay vs Apollo vs Cascade
   - [ ] Developer experience comparison
   - [ ] Performance implications
   - [ ] Migration complexity

#### Deliverables:
- `research/relay_analysis.md`
- `research/apollo_analysis.md`
- `research/other_protocols.md`
- `research/comparison_matrix.md`
- `research/cascade_value_proposition.md`
- `research/requirements.md`

---

### Phase 2: Core Specification Architecture (Estimated: 12-16 hours)

**Objective**: Define the foundational structure of GraphQL Cascade

#### Tasks:

1. **Define Specification Scope**
   - [ ] Core features (MUST have):
     * CascadeResponse interface
     * Entity update tracking
     * Deletion tracking
     * Basic invalidation hints
   - [ ] Extended features (SHOULD have):
     * Cascade depth control
     * Relationship traversal
     * Transaction metadata
     * Error handling
   - [ ] Optional features (MAY have):
     * Optimistic updates protocol
     * Subscription integration
     * Conflict resolution
     * Analytics hooks
   - [ ] Non-goals (explicitly out of scope):
     * Client-side framework implementation details
     * Database-specific optimizations
     * Authentication/authorization

2. **Design Global Entity Identification**
   ```graphql
   """
   Global object identification for GraphQL Cascade.
   All domain entities MUST implement this interface.
   """
   interface Node {
     """Globally unique identifier for this entity."""
     id: ID!
   }

   """
   Timestamped entities for version tracking.
   """
   interface Timestamped {
     createdAt: DateTime!
     updatedAt: DateTime!
     version: Int  # Optional: for optimistic concurrency control
   }

   # Example entity
   type User implements Node & Timestamped {
     id: ID!
     email: String!
     name: String!
     createdAt: DateTime!
     updatedAt: DateTime!
     version: Int
   }
   ```
   - [ ] Choose ID strategy: Global IDs (Relay-style) vs typename+id (Apollo-style)
     * **Decision**: Use typename+id for simplicity and compatibility
   - [ ] Define ID generation requirements
   - [ ] Specify ID encoding format (no encoding required, use natural IDs)
   - [ ] Document ID collision prevention (typename provides namespace)

3. **Design Cascade Response Envelope**
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

   """
   The cascade of updates triggered by a mutation.
   """
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

   """
   Metadata about a cascade operation.
   """
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

   """
   An entity that was updated in the cascade.
   """
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

   """
   An entity that was deleted in the cascade.
   """
   type DeletedEntity {
     """Type name of the deleted entity."""
     __typename: String!

     """ID of the deleted entity."""
     id: ID!

     """When the entity was deleted."""
     deletedAt: DateTime!
   }

   """
   Type of cascade operation.
   """
   enum CascadeOperation {
     CREATED
     UPDATED
     DELETED
   }

   """
   Error in a cascade mutation.
   """
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

   """
   Standard error codes for Cascade mutations.
   """
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
   - [ ] Define mandatory vs optional fields
   - [ ] Specify polymorphism strategy for `data` field (union type per mutation)
   - [ ] Define error structure and error codes
   - [ ] Specify metadata requirements

4. **Design Entity Update Mechanisms**
   - [ ] **Flat event stream approach** (chosen for simplicity):
     * All updates in single `updated` array
     * Each update includes typename + operation + full entity
   - [ ] **Partial vs full updates**:
     * Decision: Always return full entity data for simplicity
     * Clients can choose what fields to query via GraphQL selection
   - [ ] **Timestamp/version handling**:
     * Include `updatedAt` timestamp on all entities
     * Optional `version` field for optimistic concurrency control
   - [ ] **Nested entity update semantics**:
     * If Company.address changes, both Company and Address appear in cascade
     * Relationships resolved to depth limit

5. **Design Cache Invalidation Protocol**
   ```graphql
   """
   Instructions for cache invalidation after a mutation.
   """
   type QueryInvalidation {
     """
     Query name to invalidate (e.g., "listUsers", "getCompany").
     If null, use queryPattern.
     """
     queryName: String

     """
     Hash of the query for exact matching.
     """
     queryHash: String

     """
     Arguments that identify the query to invalidate.
     Example: { "companyId": "123" }
     """
     arguments: JSON

     """
     Pattern to match queries (e.g., "list*", "get*").
     """
     queryPattern: String

     """
     Strategy for handling the invalidation.
     """
     strategy: InvalidationStrategy!

     """
     Scope of the invalidation.
     """
     scope: InvalidationScope!
   }

   """
   Strategy for cache invalidation.
   """
   enum InvalidationStrategy {
     """Mark the query as stale, refetch on next access."""
     INVALIDATE

     """Immediately refetch the query."""
     REFETCH

     """Remove the query from cache entirely."""
     REMOVE
   }

   """
   Scope of cache invalidation.
   """
   enum InvalidationScope {
     """Only invalidate the exact query with exact arguments."""
     EXACT

     """Invalidate all queries with names matching the prefix."""
     PREFIX

     """Invalidate all queries matching the pattern (glob-style)."""
     PATTERN

     """Invalidate all queries."""
     ALL
   }
   ```
   - [ ] Define invalidation hint generation rules
   - [ ] Document how servers determine what to invalidate
   - [ ] Performance considerations (don't over-invalidate)

6. **Design Subscription Integration**
   ```graphql
   """
   Subscription that emits cascade updates in real-time.
   """
   type Subscription {
     """
     Subscribe to cascade updates for specific entity types.
     """
     cascadeUpdates(
       """Entity types to subscribe to (e.g., ["User", "Company"])."""
       entityTypes: [String!]

       """Optional filter by entity IDs."""
       entityIds: [ID!]
     ): CascadeUpdateEvent!
   }

   """
   Real-time cascade update event.
   """
   type CascadeUpdateEvent {
     """Type of event."""
     eventType: CascadeEventType!

     """The updated or deleted entity."""
     entity: UpdatedEntity

     """Timestamp of the event."""
     timestamp: DateTime!

     """Transaction that caused this update."""
     transactionId: ID
   }

   """
   Type of cascade event.
   """
   enum CascadeEventType {
     ENTITY_CREATED
     ENTITY_UPDATED
     ENTITY_DELETED
   }
   ```
   - [ ] How mutations relate to subscriptions
   - [ ] Real-time update delivery format (matches CascadeUpdates structure)
   - [ ] Conflict resolution between mutation response and subscription
   - [ ] Subscription filtering and scoping

#### Deliverables:
- `specification/00_overview.md`
- `specification/01_conformance.md`
- `specification/02_cascade_model.md`
- `specification/03_entity_identification.md`
- `specification/04_mutation_responses.md`
- `specification/05_invalidation.md`
- `specification/06_subscriptions.md`
- `schemas/cascade_base.graphql` (base schema definitions)

---

### Phase 3: GraphQL Schema Conventions (Estimated: 10-14 hours)

**Objective**: Define specific GraphQL schema patterns that servers must implement to be Cascade-compliant

#### Tasks:

1. **Define Standard Interfaces**
   ```graphql
   """
   cascade_base.graphql - Base schema that all Cascade-compliant servers must implement
   """

   """Global object identification."""
   interface Node {
     id: ID!
   }

   """Base mutation response."""
   interface CascadeResponse {
     success: Boolean!
     errors: [CascadeError!]
     data: MutationPayload
     cascade: CascadeUpdates!
   }

   """Timestamped entities (optional but recommended)."""
   interface Timestamped {
     createdAt: DateTime!
     updatedAt: DateTime!
     version: Int
   }

   """Custom scalar for date/time."""
   scalar DateTime

   """Custom scalar for JSON data."""
   scalar JSON
   ```

2. **Define Mutation Naming Conventions**
   - [ ] **Verb-based naming** (MUST):
     * Create: `createUser`, `createCompany`
     * Update: `updateUser`, `updateCompany`
     * Delete: `deleteUser`, `deleteCompany`
     * Custom: `sendPasswordReset`, `archiveOrder`
   - [ ] **Input object naming** (MUST):
     * Create: `CreateUserInput`, `CreateCompanyInput`
     * Update: `UpdateUserInput`, `UpdateCompanyInput`
     * Pattern: `{Verb}{EntityType}Input`
   - [ ] **Response type naming** (MUST):
     * Create: `CreateUserCascade`, `CreateCompanyCascade`
     * Update: `UpdateUserCascade`, `UpdateCompanyCascade`
     * Delete: `DeleteUserCascade`, `DeleteCompanyCascade`
     * Pattern: `{Verb}{EntityType}Cascade`
   - [ ] **Response type requirements**:
     * All mutation responses MUST implement `CascadeResponse`
     * The `data` field type should be the entity being mutated

   Example:
   ```graphql
   type Mutation {
     createUser(input: CreateUserInput!): CreateUserCascade!
     updateCompany(id: ID!, input: UpdateCompanyInput!): UpdateCompanyCascade!
     deleteOrder(id: ID!): DeleteOrderCascade!
   }

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

3. **Define Cascade Directives**
   ```graphql
   """
   Marks a mutation as Cascade-compliant and configures cascade behavior.
   """
   directive @cascade(
     """Maximum relationship depth to cascade through."""
     maxDepth: Int = 3

     """Whether to include related entities in the cascade."""
     includeRelated: Boolean = true

     """
     Whether to automatically compute invalidation hints.
     If false, server must manually specify invalidations.
     """
     autoInvalidate: Boolean = true

     """
     Entity types to exclude from cascade (e.g., don't cascade to audit logs).
     """
     excludeTypes: [String!]
   ) on FIELD_DEFINITION

   """
   Marks a field as triggering cascade invalidation when changed.
   """
   directive @cascadeInvalidates(
     """Queries to invalidate when this field changes."""
     queries: [String!]!

     """Invalidation strategy to use."""
     strategy: InvalidationStrategy = INVALIDATE
   ) on FIELD_DEFINITION

   # Usage examples:
   type Mutation {
     updateCompany(id: ID!, input: UpdateCompanyInput!): UpdateCompanyCascade!
       @cascade(maxDepth: 2, excludeTypes: ["AuditLog"])
   }

   type Company {
     name: String! @cascadeInvalidates(queries: ["searchCompanies", "listCompanies"])
     address: Address!
   }
   ```

4. **Define Query Naming Conventions** (for invalidation)
   - [ ] **List queries**: `listUsers`, `listCompanies`, `listOrders`
   - [ ] **Get queries**: `getUser`, `getCompany`, `getOrder`
   - [ ] **Search queries**: `searchUsers`, `searchCompanies`
   - [ ] **Custom queries**: Descriptive names, camelCase
   - [ ] Queries SHOULD include filtering arguments that match mutation invalidation hints

5. **Define Entity Update Set Structure**
   ```graphql
   """
   All updates triggered by a cascade.
   Structure: Flat array with type discrimination.
   """
   type CascadeUpdates {
     updated: [UpdatedEntity!]!
     deleted: [DeletedEntity!]!
     invalidations: [QueryInvalidation!]!
     metadata: CascadeMetadata!
   }

   """
   An updated entity with operation metadata.
   """
   type UpdatedEntity {
     __typename: String!
     id: ID!
     operation: CascadeOperation!
     entity: Node!  # The actual entity (User, Company, etc.)
   }
   ```
   - [ ] Document why flat structure chosen over grouped-by-type
   - [ ] Explain how clients can group updates if needed
   - [ ] Performance implications of flat structure

6. **Define Deletion Structure**
   ```graphql
   """
   Deleted entities (only ID since entity no longer exists).
   """
   type DeletedEntity {
     __typename: String!
     id: ID!
     deletedAt: DateTime!
   }
   ```

7. **Define Error Structure**
   ```graphql
   """
   Error in a cascade mutation.
   """
   type CascadeError {
     message: String!
     code: CascadeErrorCode!
     field: String  # Which input field caused the error
     path: [String!]  # Path in nested input structure
     extensions: JSON  # Additional context
   }

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

8. **Define Pagination Requirements**
   - [ ] **Cursor-based pagination** (SHOULD):
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
   - [ ] **Offset-based pagination** (MAY):
     ```graphql
     type UserList {
       users: [User!]!
       totalCount: Int!
       offset: Int!
       limit: Int!
     }
     ```
   - [ ] **Cascade invalidation of paginated queries**:
     * When entity changes, invalidate relevant list queries
     * Include pagination arguments in invalidation hints

9. **Create Example Schemas**
   - [ ] **Simple CRUD** (User management):
     ```graphql
     type User implements Node & Timestamped {
       id: ID!
       email: String!
       name: String!
       createdAt: DateTime!
       updatedAt: DateTime!
     }

     input CreateUserInput {
       email: String!
       name: String!
     }

     type Mutation {
       createUser(input: CreateUserInput!): CreateUserCascade!
       updateUser(id: ID!, input: UpdateUserInput!): UpdateUserCascade!
       deleteUser(id: ID!): DeleteUserCascade!
     }
     ```

   - [ ] **Complex nested** (Company with Address and Users):
     ```graphql
     type Company implements Node & Timestamped {
       id: ID!
       name: String!
       address: Address!
       owner: User!
       employees: [User!]!
       createdAt: DateTime!
       updatedAt: DateTime!
     }

     type Address implements Node {
       id: ID!
       street: String!
       city: String!
       country: String!
     }

     input UpdateCompanyInput {
       name: String
       addressId: ID
       ownerId: ID
     }

     type Mutation {
       updateCompany(id: ID!, input: UpdateCompanyInput!): UpdateCompanyCascade!
     }

     # When Company is updated:
     # - cascade.updated includes: Company, Address (if changed), User (owner, if changed)
     # - cascade.invalidations includes: listCompanies, searchCompanies, getCompany
     ```

   - [ ] **Many-to-many** (Order with Products):
     ```graphql
     type Order implements Node & Timestamped {
       id: ID!
       customer: User!
       items: [OrderItem!]!
       total: Float!
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
     }

     type Mutation {
       addProductToOrder(orderId: ID!, productId: ID!, quantity: Int!): AddProductToOrderCascade!
     }

     # When product added to order:
     # - cascade.updated includes: Order, OrderItem (new), Product
     # - cascade.invalidations includes: getOrder, listOrders (for customer)
     ```

   - [ ] **Custom action** (Password reset):
     ```graphql
     type Mutation {
       sendPasswordReset(email: String!): SendPasswordResetCascade!
     }

     type SendPasswordResetCascade implements CascadeResponse {
       success: Boolean!
       errors: [CascadeError!]
       data: PasswordResetResult
       cascade: CascadeUpdates!  # May include PasswordResetToken entity
     }

     type PasswordResetResult {
       emailSent: Boolean!
       expiresAt: DateTime!
     }
     ```

#### Deliverables:
- `specification/07_schema_conventions.md`
- `specification/08_directives.md`
- `schemas/cascade_base.graphql` (updated with all base types)
- `examples/schema_simple_crud.graphql`
- `examples/schema_nested_entities.graphql`
- `examples/schema_many_to_many.graphql`
- `examples/schema_custom_actions.graphql`

---

### Phase 4: Server-Side Implementation Requirements (Estimated: 12-16 hours)

**Objective**: Define what FraiseQL and other GraphQL backends must implement to be Cascade-compliant

#### Tasks:

1. **Define Entity Tracking Requirements**
   - [ ] **Transaction-level tracking**: All entity changes within a mutation must be tracked
   - [ ] **Tracking mechanisms**:
     * **ORM hooks** (preferred for FraiseQL): Hook into ORM's change tracking
     * **Database triggers**: Fallback for non-ORM systems
     * **Manual tracking**: Explicit `cascade.track(entity)` calls
   - [ ] **What to track**:
     * Primary mutation result (always)
     * Related entities (based on `maxDepth` setting)
     * Cascade through relationships (Company → Address → City)
   - [ ] **Performance requirements**:
     * Tracking overhead < 10% of mutation execution time
     * Memory efficient (stream updates, don't accumulate all in memory)

   Example tracking API:
   ```python
   class CascadeTracker:
       """Tracks all entities modified during a mutation transaction."""

       def __init__(self, max_depth: int = 3, exclude_types: Set[str] = None):
           self.max_depth = max_depth
           self.exclude_types = exclude_types or set()
           self.updated: Dict[Tuple[str, str], Entity] = {}  # (typename, id) -> entity
           self.deleted: Set[Tuple[str, str]] = set()  # (typename, id)
           self.current_depth = 0
           self.visited: Set[Tuple[str, str]] = set()  # Prevent cycles

       def track_create(self, entity: Entity):
           """Track a newly created entity."""
           self._track(entity, CascadeOperation.CREATED)

       def track_update(self, entity: Entity):
           """Track an updated entity."""
           self._track(entity, CascadeOperation.UPDATED)

       def track_delete(self, typename: str, entity_id: str):
           """Track a deleted entity."""
           self.deleted.add((typename, entity_id))

       def _track(self, entity: Entity, operation: CascadeOperation):
           """Internal tracking with cascade logic."""
           typename = entity.__typename__
           entity_id = entity.id

           # Skip if excluded or already visited
           if typename in self.exclude_types:
               return
           if (typename, entity_id) in self.visited:
               return

           self.visited.add((typename, entity_id))
           self.updated[(typename, entity_id)] = (entity, operation)

           # Cascade to related entities if within depth limit
           if self.current_depth < self.max_depth:
               self._cascade_to_related(entity)

       def _cascade_to_related(self, entity: Entity):
           """Recursively track related entities."""
           self.current_depth += 1
           try:
               for related_entity in entity.get_related_entities():
                   self._track(related_entity, CascadeOperation.UPDATED)
           finally:
               self.current_depth -= 1
   ```

2. **Define Response Construction Algorithm**
   ```python
   from typing import List, Dict, Any
   from dataclasses import dataclass
   from datetime import datetime

   @dataclass
   class CascadeResponse:
       success: bool
       data: Any
       cascade: Dict[str, Any]
       errors: List[Dict[str, Any]] = None

   class CascadeBuilder:
       """Builds Cascade-compliant mutation responses."""

       def __init__(self, tracker: CascadeTracker, invalidator: CascadeInvalidator):
           self.tracker = tracker
           self.invalidator = invalidator

       def build(self, primary_result: Any, success: bool = True, errors: List = None) -> CascadeResponse:
           """
           Build a complete Cascade response.

           Steps:
           1. Collect primary result
           2. Collect all tracked entities
           3. Compute invalidation hints
           4. Assemble response
           """
           # 1. Primary result
           data = primary_result

           # 2. Collect updates
           updated_entities = []
           for (typename, entity_id), (entity, operation) in self.tracker.updated.items():
               updated_entities.append({
                   '__typename': typename,
                   'id': entity_id,
                   'operation': operation.value,
                   'entity': entity.to_dict()
               })

           # 3. Collect deletions
           deleted_entities = []
           for typename, entity_id in self.tracker.deleted:
               deleted_entities.append({
                   '__typename': typename,
                   'id': entity_id,
                   'deletedAt': datetime.utcnow().isoformat()
               })

           # 4. Compute invalidation hints
           invalidations = self.invalidator.compute_invalidations(
               updated=self.tracker.updated,
               deleted=self.tracker.deleted,
               primary_result=primary_result
           )

           # 5. Assemble cascade response
           cascade = {
               'updated': updated_entities,
               'deleted': deleted_entities,
               'invalidations': invalidations,
               'metadata': {
                   'timestamp': datetime.utcnow().isoformat(),
                   'depth': self.tracker.current_depth,
                   'affectedCount': len(updated_entities) + len(deleted_entities)
               }
           }

           return CascadeResponse(
               success=success,
               data=data,
               cascade=cascade,
               errors=errors or []
           )
   ```

3. **Define Invalidation Hint Generation**
   ```python
   from typing import List, Dict, Set, Tuple

   class CascadeInvalidator:
       """Generates query invalidation hints based on entity changes."""

       def __init__(self, schema: GraphQLSchema):
           self.schema = schema
           self.invalidation_rules = self._load_rules()

       def compute_invalidations(
           self,
           updated: Dict[Tuple[str, str], Entity],
           deleted: Set[Tuple[str, str]],
           primary_result: Any
       ) -> List[Dict[str, Any]]:
           """
           Compute which queries should be invalidated.

           Rules:
           1. List queries for affected entity types
           2. Get queries for specific entity IDs
           3. Search queries (if search indexes exist)
           4. Custom rules based on @cascadeInvalidates directives
           """
           invalidations = []

           # Track which entity types were affected
           affected_types = set()
           for typename, _ in updated.keys():
               affected_types.add(typename)
           for typename, _ in deleted:
               affected_types.add(typename)

           # 1. Invalidate list queries for affected types
           for typename in affected_types:
               invalidations.append({
                   'queryName': f'list{typename}s',  # e.g., listUsers
                   'strategy': 'INVALIDATE',
                   'scope': 'PREFIX'
               })

           # 2. Invalidate get queries for specific entities
           for typename, entity_id in updated.keys():
               invalidations.append({
                   'queryName': f'get{typename}',
                   'arguments': {'id': entity_id},
                   'strategy': 'REFETCH',
                   'scope': 'EXACT'
               })

           # 3. Invalidate search queries
           for typename in affected_types:
               invalidations.append({
                   'queryPattern': f'search{typename}*',
                   'strategy': 'INVALIDATE',
                   'scope': 'PATTERN'
               })

           # 4. Apply custom rules from directives
           custom_invalidations = self._apply_custom_rules(updated, deleted)
           invalidations.extend(custom_invalidations)

           return invalidations

       def _apply_custom_rules(self, updated, deleted) -> List[Dict]:
           """Apply custom invalidation rules from @cascadeInvalidates directives."""
           invalidations = []

           for (typename, entity_id), entity in updated.items():
               # Check which fields changed
               changed_fields = entity.get_changed_fields()

               # Look up directive rules for these fields
               for field_name in changed_fields:
                   rules = self.invalidation_rules.get(typename, {}).get(field_name, [])
                   for rule in rules:
                       invalidations.append({
                           'queryName': rule['query'],
                           'strategy': rule['strategy'],
                           'scope': rule.get('scope', 'PREFIX')
                       })

           return invalidations
   ```

   - [ ] Document rule priorities (custom rules override defaults)
   - [ ] Performance optimization (deduplicate invalidations)
   - [ ] Configurable invalidation strategies per deployment

4. **Define Transaction Semantics**
   - [ ] **Atomic operations**: Mutation + tracking + response construction must be atomic
   - [ ] **Rollback behavior**: If mutation fails, no cascade updates should be returned
   - [ ] **Consistency guarantees**:
     * All entities in cascade.updated reflect committed state
     * No phantom reads (entity deleted but in cascade.updated)
   - [ ] **Isolation levels**: Use database's default isolation (usually READ COMMITTED)

   Example transaction wrapper:
   ```python
   class CascadeMutation:
       """Wrapper for Cascade-compliant mutations."""

       async def execute(self, mutation_fn, **kwargs):
           """Execute mutation within Cascade transaction."""
           tracker = CascadeTracker(
               max_depth=kwargs.get('max_depth', 3),
               exclude_types=kwargs.get('exclude_types', set())
           )
           invalidator = CascadeInvalidator(self.schema)
           builder = CascadeBuilder(tracker, invalidator)

           async with self.db.transaction():
               try:
                   # Execute the actual mutation
                   result = await mutation_fn(tracker=tracker, **kwargs)

                   # Build cascade response
                   response = builder.build(result, success=True)

                   # Commit transaction
                   return response

               except Exception as e:
                   # Rollback on error
                   raise CascadeError(
                       message=str(e),
                       code='TRANSACTION_FAILED'
                   )
   ```

5. **Define Performance Requirements**
   - [ ] **Response payload size**:
     * Maximum 500 updated entities per mutation
     * Maximum 5MB total response size
     * If exceeded, paginate cascade.updated or reduce maxDepth
   - [ ] **Execution overhead**:
     * Cascade tracking < 10% of mutation time
     * Response construction < 5% of mutation time
   - [ ] **Memory usage**:
     * Stream entities to response (don't accumulate all in memory)
     * Limit concurrent cascade operations
   - [ ] **Database queries**:
     * Prefer single query to fetch related entities (JOIN) over N+1 queries
     * Use database's change tracking if available (PostgreSQL RETURNING, etc.)

6. **Define Configuration Options**
   ```yaml
   # cascade_config.yaml - Server configuration for GraphQL Cascade

   cascade:
     # Enable or disable Cascade globally
     enabled: true

     # Default cascade depth (can be overridden per mutation)
     default_max_depth: 3

     # Entity types to always exclude from cascade
     exclude_types:
       - AuditLog
       - SystemEvent

     # Entity tracking strategy
     tracking:
       # Strategy: "orm_hooks", "triggers", "manual"
       strategy: "orm_hooks"

       # For ORM hooks: which ORM events to track
       track_events:
         - after_insert
         - after_update
         - after_delete

     # Response limits
     response:
       max_updates: 500
       max_deletions: 100
       max_invalidations: 50
       max_response_size_mb: 5

     # Invalidation settings
     invalidation:
       # Auto-compute invalidations
       auto_compute: true

       # Include related entity invalidations
       include_related: true

       # Maximum relationship depth for invalidation computation
       max_depth: 3

       # Custom invalidation rules (supplement auto-computed)
       custom_rules:
         - entity: "Company"
           field: "name"
           invalidates: ["searchCompanies", "listCompanies"]
           strategy: "INVALIDATE"

     # Performance tuning
     performance:
       # Use database RETURNING clause (PostgreSQL)
       use_db_returning: true

       # Batch entity fetches
       batch_fetches: true

       # Cache entity metadata
       cache_metadata: true
   ```

7. **Create Server-Side Integration Guide**
   - [ ] **FraiseQL-specific integration**:
     * How to hook into FraiseQL's ORM
     * Configuration in SpecQL YAML
     * Example mutations
   - [ ] **Generic GraphQL server integration**:
     * Apollo Server
     * GraphQL Yoga
     * Strawberry GraphQL
     * Ariadne
   - [ ] **PostgreSQL-specific patterns**:
     * Using RETURNING clause
     * Listening to NOTIFY events
     * Trigger-based tracking
   - [ ] **Testing requirements**:
     * Unit tests for tracker, builder, invalidator
     * Integration tests for full mutations
     * Performance benchmarks

#### Deliverables:
- `specification/09_server_requirements.md`
- `specification/10_tracking_algorithm.md`
- `specification/11_invalidation_algorithm.md`
- `specification/12_performance_requirements.md`
- `reference/server-python/graphql_cascade/tracker.py`
- `reference/server-python/graphql_cascade/builder.py`
- `reference/server-python/graphql_cascade/invalidator.py`
- `reference/server-python/graphql_cascade/middleware.py`
- `reference/server-python/graphql_cascade/config.py`
- `docs/server-integration-guide.md`
- `docs/fraiseql-integration.md`
- `examples/server_apollo.ts`
- `examples/server_strawberry.py`

---

### Phase 5: Client-Side Integration Patterns (Estimated: 14-20 hours)

**Objective**: Define how frontend frameworks consume GraphQL Cascade responses

#### Tasks:

1. **Define Generic Cache Interface**
   ```typescript
   /**
    * Generic cache interface for GraphQL Cascade.
    * Implement this interface to integrate with any cache system.
    */
   export interface CascadeCache {
     /**
      * Write an entity to the cache.
      */
     write(typename: string, id: string, data: any): void;

     /**
      * Read an entity from the cache.
      */
     read(typename: string, id: string): any | null;

     /**
      * Evict (remove) an entity from the cache.
      */
     evict(typename: string, id: string): void;

     /**
      * Invalidate queries matching the pattern.
      */
     invalidate(invalidation: QueryInvalidation): void;

     /**
      * Refetch queries matching the pattern.
      */
     refetch(invalidation: QueryInvalidation): Promise<void>;

     /**
      * Remove queries from cache.
      */
     remove(invalidation: QueryInvalidation): void;

     /**
      * Identify an entity (get cache key).
      */
     identify(entity: any): string;
   }

   /**
    * Query invalidation instruction.
    */
   export interface QueryInvalidation {
     queryName?: string;
     queryHash?: string;
     arguments?: Record<string, any>;
     queryPattern?: string;
     strategy: InvalidationStrategy;
     scope: InvalidationScope;
   }

   export enum InvalidationStrategy {
     INVALIDATE = 'INVALIDATE',
     REFETCH = 'REFETCH',
     REMOVE = 'REMOVE'
   }

   export enum InvalidationScope {
     EXACT = 'EXACT',
     PREFIX = 'PREFIX',
     PATTERN = 'PATTERN',
     ALL = 'ALL'
   }
   ```

2. **Define Generic Cascade Client**
   ```typescript
   import { DocumentNode } from 'graphql';

   /**
    * GraphQL Cascade response structure.
    */
   export interface CascadeResponse<T = any> {
     success: boolean;
     errors?: CascadeError[];
     data: T;
     cascade: CascadeUpdates;
   }

   export interface CascadeUpdates {
     updated: UpdatedEntity[];
     deleted: DeletedEntity[];
     invalidations: QueryInvalidation[];
     metadata: CascadeMetadata;
   }

   export interface UpdatedEntity {
     __typename: string;
     id: string;
     operation: 'CREATED' | 'UPDATED' | 'DELETED';
     entity: any;
   }

   export interface DeletedEntity {
     __typename: string;
     id: string;
     deletedAt: string;
   }

   export interface CascadeMetadata {
     timestamp: string;
     transactionId?: string;
     depth: number;
     affectedCount: number;
   }

   export interface CascadeError {
     message: string;
     code: string;
     field?: string;
     path?: string[];
     extensions?: any;
   }

   /**
    * Generic GraphQL Cascade client.
    */
   export class CascadeClient {
     constructor(
       private cache: CascadeCache,
       private executor: (query: DocumentNode, variables: any) => Promise<any>
     ) {}

     /**
      * Apply a cascade response to the cache.
      */
     applyCascade(response: CascadeResponse): void {
       const { data, cascade } = response;

       // 1. Write primary result
       if (data && typeof data === 'object' && '__typename' in data && 'id' in data) {
         this.cache.write(data.__typename, data.id, data);
       }

       // 2. Apply all updates
       cascade.updated.forEach(({ __typename, id, entity }) => {
         this.cache.write(__typename, id, entity);
       });

       // 3. Handle deletions
       cascade.deleted.forEach(({ __typename, id }) => {
         this.cache.evict(__typename, id);
       });

       // 4. Process invalidations
       cascade.invalidations.forEach(invalidation => {
         switch (invalidation.strategy) {
           case InvalidationStrategy.INVALIDATE:
             this.cache.invalidate(invalidation);
             break;
           case InvalidationStrategy.REFETCH:
             this.cache.refetch(invalidation);
             break;
           case InvalidationStrategy.REMOVE:
             this.cache.remove(invalidation);
             break;
         }
       });
     }

     /**
      * Execute a mutation and apply the cascade automatically.
      */
     async mutate<T = any>(
       mutation: DocumentNode,
       variables?: any
     ): Promise<T> {
       const result = await this.executor(mutation, variables);

       // Extract the mutation result (first field in data)
       const mutationName = Object.keys(result.data)[0];
       const cascadeResponse = result.data[mutationName] as CascadeResponse<T>;

       // Apply cascade
       this.applyCascade(cascadeResponse);

       // Return the primary data
       return cascadeResponse.data;
     }
   }
   ```

3. **Define Apollo Client Integration**
   ```typescript
   import { ApolloClient, InMemoryCache, gql, DocumentNode } from '@apollo/client';
   import { CascadeClient, CascadeCache, QueryInvalidation } from '@graphql-cascade/client';

   /**
    * Apollo Client cache adapter for GraphQL Cascade.
    */
   export class ApolloCascadeCache implements CascadeCache {
     constructor(private cache: InMemoryCache) {}

     write(typename: string, id: string, data: any): void {
       const cacheId = this.cache.identify({ __typename: typename, id });

       // Write using cache.writeFragment
       this.cache.writeFragment({
         id: cacheId,
         fragment: gql`
           fragment _ on ${typename} {
             ${Object.keys(data).join('\n')}
           }
         `,
         data
       });
     }

     read(typename: string, id: string): any | null {
       const cacheId = this.cache.identify({ __typename: typename, id });
       return this.cache.readFragment({
         id: cacheId,
         fragment: gql`fragment _ on ${typename} { id }`
       });
     }

     evict(typename: string, id: string): void {
       const cacheId = this.cache.identify({ __typename: typename, id });
       this.cache.evict({ id: cacheId });
       this.cache.gc(); // Garbage collect
     }

     invalidate(invalidation: QueryInvalidation): void {
       // Apollo doesn't have direct invalidation API
       // Use evict with broadcast: false
       if (invalidation.queryName) {
         this.cache.evict({ fieldName: invalidation.queryName });
       }
     }

     async refetch(invalidation: QueryInvalidation): Promise<void> {
       // Trigger refetch via Apollo's refetchQueries
       // (requires access to ApolloClient, not just cache)
       this.invalidate(invalidation);
     }

     remove(invalidation: QueryInvalidation): void {
       this.invalidate(invalidation);
     }

     identify(entity: any): string {
       return this.cache.identify(entity) || `${entity.__typename}:${entity.id}`;
     }
   }

   /**
    * Apollo Client integration for GraphQL Cascade.
    */
   export class ApolloCascadeClient extends CascadeClient {
     constructor(private apollo: ApolloClient<any>) {
       super(
         new ApolloCascadeCache(apollo.cache as InMemoryCache),
         (query, variables) => apollo.query({ query, variables })
       );
     }

     /**
      * Execute a mutation with automatic cascade application.
      */
     async mutate<T = any>(
       mutation: DocumentNode,
       variables?: any
     ): Promise<T> {
       const result = await this.apollo.mutate({
         mutation,
         variables
       });

       const mutationName = Object.keys(result.data!)[0];
       const cascadeResponse = result.data![mutationName];

       this.applyCascade(cascadeResponse);

       return cascadeResponse.data;
     }
   }

   // Usage:
   const client = new ApolloClient({ /* ... */ });
   const cascade = new ApolloCascadeClient(client);

   const updatedUser = await cascade.mutate(
     gql`
       mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
         updateUser(id: $id, input: $input) {
           success
           errors { message code }
           data { id name email }
           cascade {
             updated { __typename id operation entity }
             deleted { __typename id }
             invalidations { queryName strategy scope }
             metadata { timestamp affectedCount }
           }
         }
       }
     `,
     { id: '123', input: { name: 'New Name' } }
   );
   ```

4. **Define Relay Integration**
   ```typescript
   import {
     Environment,
     RecordSource,
     Store,
     RecordProxy,
     commitLocalUpdate
   } from 'relay-runtime';
   import { CascadeClient, CascadeCache } from '@graphql-cascade/client';

   /**
    * Relay cache adapter for GraphQL Cascade.
    */
   export class RelayCascadeCache implements CascadeCache {
     constructor(private environment: Environment) {}

     write(typename: string, id: string, data: any): void {
       commitLocalUpdate(this.environment, store => {
         const record = store.get(id) || store.create(id, typename);

         Object.entries(data).forEach(([key, value]) => {
           record.setValue(value as any, key);
         });
       });
     }

     read(typename: string, id: string): any | null {
       const snapshot = this.environment.lookup({
         dataID: id,
         node: { kind: 'Fragment', /* ... */ } as any,
         variables: {}
       });
       return snapshot.data;
     }

     evict(typename: string, id: string): void {
       commitLocalUpdate(this.environment, store => {
         store.delete(id);
       });
     }

     invalidate(invalidation: QueryInvalidation): void {
       // Relay doesn't have query invalidation
       // Instead, we'd need to refetch queries manually
     }

     async refetch(invalidation: QueryInvalidation): Promise<void> {
       // Would need to track active queries and refetch them
     }

     remove(invalidation: QueryInvalidation): void {
       this.invalidate(invalidation);
     }

     identify(entity: any): string {
       return entity.id;
     }
   }

   /**
    * Relay integration for GraphQL Cascade.
    */
   export class RelayCascadeClient extends CascadeClient {
     constructor(environment: Environment) {
       super(
         new RelayCascadeCache(environment),
         (query, variables) => environment.execute({ operation: query as any, variables })
       );
     }
   }
   ```

5. **Define React Query Integration**
   ```typescript
   import { QueryClient, useMutation } from '@tanstack/react-query';
   import { CascadeClient, CascadeCache } from '@graphql-cascade/client';

   /**
    * React Query cache adapter for GraphQL Cascade.
    *
    * Note: React Query doesn't have normalized cache,
    * so we focus on query invalidation.
    */
   export class ReactQueryCascadeCache implements CascadeCache {
     constructor(private queryClient: QueryClient) {}

     write(typename: string, id: string, data: any): void {
       // React Query stores data by query key, not by entity
       // We update all queries that might contain this entity
       this.queryClient.setQueriesData(
         { predicate: query => this.queryContainsEntity(query, typename, id) },
         oldData => this.updateEntityInData(oldData, typename, id, data)
       );
     }

     read(typename: string, id: string): any | null {
       // Can't directly read entities from React Query
       return null;
     }

     evict(typename: string, id: string): void {
       // Remove entity from all queries
       this.queryClient.setQueriesData(
         { predicate: query => this.queryContainsEntity(query, typename, id) },
         oldData => this.removeEntityFromData(oldData, typename, id)
       );
     }

     invalidate(invalidation: QueryInvalidation): void {
       const queryKey = this.invalidationToQueryKey(invalidation);
       this.queryClient.invalidateQueries(queryKey);
     }

     async refetch(invalidation: QueryInvalidation): Promise<void> {
       const queryKey = this.invalidationToQueryKey(invalidation);
       await this.queryClient.refetchQueries(queryKey);
     }

     remove(invalidation: QueryInvalidation): void {
       const queryKey = this.invalidationToQueryKey(invalidation);
       this.queryClient.removeQueries(queryKey);
     }

     identify(entity: any): string {
       return `${entity.__typename}:${entity.id}`;
     }

     private invalidationToQueryKey(invalidation: QueryInvalidation): any {
       if (invalidation.scope === 'EXACT') {
         return [invalidation.queryName, invalidation.arguments];
       } else if (invalidation.scope === 'PREFIX') {
         return { queryKey: [invalidation.queryName] };
       } else {
         return { predicate: () => true }; // Invalidate all
       }
     }

     private queryContainsEntity(query: any, typename: string, id: string): boolean {
       // Check if query data contains this entity
       const data = query.state.data;
       return this.searchForEntity(data, typename, id);
     }

     private searchForEntity(data: any, typename: string, id: string): boolean {
       if (!data) return false;
       if (Array.isArray(data)) {
         return data.some(item => this.searchForEntity(item, typename, id));
       }
       if (typeof data === 'object') {
         if (data.__typename === typename && data.id === id) return true;
         return Object.values(data).some(value => this.searchForEntity(value, typename, id));
       }
       return false;
     }

     private updateEntityInData(data: any, typename: string, id: string, newData: any): any {
       if (!data) return data;
       if (Array.isArray(data)) {
         return data.map(item => this.updateEntityInData(item, typename, id, newData));
       }
       if (typeof data === 'object') {
         if (data.__typename === typename && data.id === id) {
           return { ...data, ...newData };
         }
         const updated: any = {};
         for (const [key, value] of Object.entries(data)) {
           updated[key] = this.updateEntityInData(value, typename, id, newData);
         }
         return updated;
       }
       return data;
     }

     private removeEntityFromData(data: any, typename: string, id: string): any {
       if (!data) return data;
       if (Array.isArray(data)) {
         return data
           .filter(item => !(item?.__typename === typename && item?.id === id))
           .map(item => this.removeEntityFromData(item, typename, id));
       }
       if (typeof data === 'object') {
         const updated: any = {};
         for (const [key, value] of Object.entries(data)) {
           updated[key] = this.removeEntityFromData(value, typename, id);
         }
         return updated;
       }
       return data;
     }
   }

   /**
    * React Query integration for GraphQL Cascade.
    */
   export class ReactQueryCascadeClient extends CascadeClient {
     constructor(
       queryClient: QueryClient,
       executor: (query: any, variables: any) => Promise<any>
     ) {
       super(new ReactQueryCascadeCache(queryClient), executor);
     }
   }

   /**
    * React Hook for GraphQL Cascade mutations with React Query.
    */
   export function useCascadeMutation<T = any>(
     cascadeClient: ReactQueryCascadeClient,
     mutation: DocumentNode
   ) {
     return useMutation({
       mutationFn: (variables: any) => cascadeClient.mutate<T>(mutation, variables)
     });
   }
   ```

6. **Define URQL Integration**
   ```typescript
   import { Client, cacheExchange } from '@urql/core';
   import { CascadeClient, CascadeCache } from '@graphql-cascade/client';

   /**
    * URQL cache adapter for GraphQL Cascade.
    */
   export class UrqlCascadeCache implements CascadeCache {
     constructor(private client: Client) {}

     write(typename: string, id: string, data: any): void {
       // URQL's cache is more complex, would need to use cache.updateQuery
       // This is a simplified version
     }

     read(typename: string, id: string): any | null {
       return null;
     }

     evict(typename: string, id: string): void {
       // URQL doesn't have direct eviction
     }

     invalidate(invalidation: QueryInvalidation): void {
       // Use URQL's cache invalidation
     }

     async refetch(invalidation: QueryInvalidation): Promise<void> {
       // Refetch via URQL
     }

     remove(invalidation: QueryInvalidation): void {
       this.invalidate(invalidation);
     }

     identify(entity: any): string {
       return `${entity.__typename}:${entity.id}`;
     }
   }

   /**
    * URQL integration for GraphQL Cascade.
    */
   export class UrqlCascadeClient extends CascadeClient {
     constructor(client: Client, executor: any) {
       super(new UrqlCascadeCache(client), executor);
     }
   }
   ```

7. **Define Optimistic Updates Pattern**
   ```typescript
   import { CascadeClient, CascadeResponse } from '@graphql-cascade/client';

   /**
    * Optimistic update manager for GraphQL Cascade.
    */
   export class OptimisticCascadeClient extends CascadeClient {
     private optimisticUpdates = new Map<string, OptimisticUpdate>();

     /**
      * Execute a mutation with optimistic update.
      */
     async mutateOptimistic<T = any>(
       mutation: DocumentNode,
       variables: any,
       optimisticResponse: CascadeResponse<T>
     ): Promise<T> {
       const mutationId = this.generateMutationId();

       // 1. Apply optimistic update
       this.applyOptimistic(mutationId, optimisticResponse);

       try {
         // 2. Execute real mutation
         const result = await this.mutate<T>(mutation, variables);

         // 3. Confirm optimistic update
         this.confirmOptimistic(mutationId);

         return result;

       } catch (error) {
         // 4. Rollback on error
         this.rollbackOptimistic(mutationId);
         throw error;
       }
     }

     private applyOptimistic(mutationId: string, response: CascadeResponse): void {
       // Store rollback information
       const rollback = this.captureRollbackInfo(response);
       this.optimisticUpdates.set(mutationId, { response, rollback });

       // Apply optimistic cascade
       this.applyCascade(response);
     }

     private confirmOptimistic(mutationId: string): void {
       // Remove rollback info (real data already applied)
       this.optimisticUpdates.delete(mutationId);
     }

     private rollbackOptimistic(mutationId: string): void {
       const optimistic = this.optimisticUpdates.get(mutationId);
       if (!optimistic) return;

       // Revert optimistic changes
       optimistic.rollback();

       this.optimisticUpdates.delete(mutationId);
     }

     private captureRollbackInfo(response: CascadeResponse): () => void {
       // Capture current state for rollback
       const previousState = new Map<string, any>();

       response.cascade.updated.forEach(({ __typename, id }) => {
         const current = this.cache.read(__typename, id);
         previousState.set(`${__typename}:${id}`, current);
       });

       return () => {
         // Restore previous state
         previousState.forEach((data, key) => {
           const [typename, id] = key.split(':');
           if (data === null) {
             this.cache.evict(typename, id);
           } else {
             this.cache.write(typename, id, data);
           }
         });
       };
     }

     private generateMutationId(): string {
       return `optimistic_${Date.now()}_${Math.random()}`;
     }
   }

   interface OptimisticUpdate {
     response: CascadeResponse;
     rollback: () => void;
   }
   ```

8. **Define Conflict Resolution**
   ```typescript
   /**
    * Conflict resolution for GraphQL Cascade.
    */
   export class CascadeConflictResolver {
     /**
      * Detect conflicts between local and server versions.
      */
     detectConflicts(
       localEntity: any,
       serverEntity: any
     ): ConflictDetection {
       // Version-based conflict detection
       if (localEntity.version && serverEntity.version) {
         if (localEntity.version !== serverEntity.version) {
           return {
             hasConflict: true,
             conflictType: 'VERSION_MISMATCH',
             localEntity,
             serverEntity
           };
         }
       }

       // Timestamp-based conflict detection
       if (localEntity.updatedAt && serverEntity.updatedAt) {
         const localTime = new Date(localEntity.updatedAt).getTime();
         const serverTime = new Date(serverEntity.updatedAt).getTime();

         if (localTime > serverTime) {
           return {
             hasConflict: true,
             conflictType: 'TIMESTAMP_MISMATCH',
             localEntity,
             serverEntity
           };
         }
       }

       return { hasConflict: false };
     }

     /**
      * Resolve conflicts using specified strategy.
      */
     resolveConflict(
       detection: ConflictDetection,
       strategy: ConflictStrategy = 'SERVER_WINS'
     ): any {
       if (!detection.hasConflict) {
         return detection.serverEntity;
       }

       switch (strategy) {
         case 'SERVER_WINS':
           return detection.serverEntity;

         case 'CLIENT_WINS':
           return detection.localEntity;

         case 'MERGE':
           return this.mergeEntities(detection.localEntity!, detection.serverEntity!);

         case 'MANUAL':
           // Throw error for manual resolution
           throw new CascadeConflictError(detection);

         default:
           return detection.serverEntity;
       }
     }

     private mergeEntities(local: any, server: any): any {
       // Simple merge: server wins for conflicts, keep non-conflicting local changes
       return { ...server, ...local, version: server.version, updatedAt: server.updatedAt };
     }
   }

   interface ConflictDetection {
     hasConflict: boolean;
     conflictType?: 'VERSION_MISMATCH' | 'TIMESTAMP_MISMATCH';
     localEntity?: any;
     serverEntity?: any;
   }

   type ConflictStrategy = 'SERVER_WINS' | 'CLIENT_WINS' | 'MERGE' | 'MANUAL';

   class CascadeConflictError extends Error {
     constructor(public detection: ConflictDetection) {
       super('Cascade conflict detected - manual resolution required');
     }
   }
   ```

9. **Create Client Integration Examples**
   - [ ] Complete Apollo Client example app
   - [ ] Complete Relay Modern example app
   - [ ] Complete React Query example app
   - [ ] Complete URQL example app
   - [ ] Vanilla JavaScript example (no framework)

#### Deliverables:
- `specification/13_client_integration.md`
- `specification/14_optimistic_updates.md`
- `specification/15_conflict_resolution.md`
- `packages/client-core/` (core library)
- `packages/client-apollo/` (@graphql-cascade/apollo)
- `packages/client-relay/` (@graphql-cascade/relay)
- `packages/client-react-query/` (@graphql-cascade/react-query)
- `packages/client-urql/` (@graphql-cascade/urql)
- `examples/apollo-cascade-app/`
- `examples/relay-cascade-app/`
- `examples/react-query-cascade-app/`
- `examples/urql-cascade-app/`
- `examples/vanilla-cascade-app/`

---

### Phase 6: Formal Specification Document (Estimated: 16-24 hours)

**Objective**: Create the canonical GraphQL Cascade Specification document

#### Tasks:

1. **Structure Specification Document**
   ```
   GraphQL_Cascade_Specification_v0.1/
   ├── 00_introduction.md
   ├── 01_conformance.md
   ├── 02_cascade_model.md
   ├── 03_entity_identification.md
   ├── 04_mutation_responses.md
   ├── 05_invalidation.md
   ├── 06_subscriptions.md
   ├── 07_schema_conventions.md
   ├── 08_directives.md
   ├── 09_server_requirements.md
   ├── 10_tracking_algorithm.md
   ├── 11_invalidation_algorithm.md
   ├── 12_performance_requirements.md
   ├── 13_client_integration.md
   ├── 14_optimistic_updates.md
   ├── 15_conflict_resolution.md
   ├── 16_security.md
   ├── 17_performance.md
   └── appendices/
       ├── A_comparison_with_relay.md
       ├── B_comparison_with_apollo.md
       ├── C_migration_guide.md
       ├── D_glossary.md
       └── E_examples.md
   ```

2. **Write Introduction Section** (00_introduction.md)
   - [ ] **Problem statement**:
     * Manual cache updates are error-prone
     * Boilerplate code for every mutation
     * Framework-specific patterns don't transfer
   - [ ] **Solution**: GraphQL Cascade automatically tracks and returns affected entities
   - [ ] **Goals**:
     * Zero-boilerplate cache updates
     * Framework-agnostic specification
     * Backward compatible with existing GraphQL
   - [ ] **Non-goals**:
     * Replace existing cache libraries
     * Dictate client-side implementation details
     * Solve all distributed systems problems
   - [ ] **Audience**:
     * Server developers implementing backends
     * Client developers building frontends
     * Library authors creating integrations
   - [ ] **Relationship to GraphQL spec**:
     * Builds on standard GraphQL
     * Additive (doesn't break existing queries/mutations)
   - [ ] **Relationship to other specs**:
     * Inspired by Relay (entity identification)
     * Inspired by Cursor Connections (pagination)
     * Complements Apollo cache protocol

3. **Write Conformance Section** (01_conformance.md)
   - [ ] **Conformance levels**:
     * **MUST**: Required for compliance (e.g., CascadeResponse interface)
     * **SHOULD**: Strongly recommended (e.g., Timestamped interface)
     * **MAY**: Optional features (e.g., optimistic updates)
   - [ ] **Version compatibility**:
     * Semantic versioning (v0.1, v1.0, etc.)
     * Backward compatibility guarantees
     * Deprecation policy
   - [ ] **Feature detection**:
     * Schema introspection to detect Cascade support
     * Version field in CascadeMetadata
   - [ ] **Compliance testing**:
     * Official compliance test suite
     * How to certify implementations

4. **Write Core Cascade Model Section** (02_cascade_model.md)
   - [ ] **The cascade concept**:
     * What is a cascade?
     * Why cascades matter for cache updates
   - [ ] **Propagation rules**:
     * Depth-first traversal of relationships
     * Cycle detection
     * Max depth limits
   - [ ] **Entity tracking**:
     * What entities are tracked
     * When tracking starts/stops
   - [ ] **Cascade lifecycle**:
     1. Mutation begins
     2. Tracker activated
     3. Entities modified
     4. Cascade computed
     5. Response constructed
     6. Client applies cascade

5. **Write Technical Sections** (consolidate work from Phases 2-5)
   - [ ] Entity identification (03) - from Phase 2 Task 2
   - [ ] Mutation responses (04) - from Phase 2 Task 3
   - [ ] Invalidation (05) - from Phase 2 Task 5
   - [ ] Subscriptions (06) - from Phase 2 Task 6
   - [ ] Schema conventions (07) - from Phase 3
   - [ ] Directives (08) - from Phase 3 Task 3
   - [ ] Server requirements (09) - from Phase 4
   - [ ] Tracking algorithm (10) - from Phase 4 Task 1
   - [ ] Invalidation algorithm (11) - from Phase 4 Task 3
   - [ ] Performance requirements (12) - from Phase 4 Task 5
   - [ ] Client integration (13) - from Phase 5
   - [ ] Optimistic updates (14) - from Phase 5 Task 7
   - [ ] Conflict resolution (15) - from Phase 5 Task 8

6. **Write Security Section** (16_security.md)
   - [ ] **Authorization considerations**:
     * Never return entities user can't access
     * Filter cascade based on permissions
     * Audit logging for sensitive operations
   - [ ] **Sensitive data in cascades**:
     * Redact sensitive fields
     * Use field-level permissions
   - [ ] **Query invalidation security**:
     * Prevent cache poisoning
     * Validate invalidation hints
     * Rate limiting
   - [ ] **Denial of service prevention**:
     * Limit cascade depth
     * Limit cascade size
     * Timeout long-running mutations

7. **Write Performance Section** (17_performance.md)
   - [ ] **Response size optimization**:
     * Compress cascade data
     * Paginate large cascades
     * Client-side filtering of fields
   - [ ] **Execution overhead**:
     * Benchmark tracking overhead
     * Optimize entity fetching
     * Cache metadata
   - [ ] **Network optimization**:
     * Use HTTP/2 multiplexing
     * Compress responses (gzip, brotli)
   - [ ] **Client-side performance**:
     * Batch cache updates
     * Debounce invalidations
     * Background refetching

8. **Write Appendices**
   - [ ] **Appendix A**: Comparison with Relay
     * What Relay does well
     * What Cascade improves
     * Migration path
   - [ ] **Appendix B**: Comparison with Apollo
     * What Apollo does well
     * What Cascade improves
     * Migration path
   - [ ] **Appendix C**: Migration guide
     * From manual cache updates
     * From Relay updater functions
     * From Apollo update functions
   - [ ] **Appendix D**: Glossary
     * Cascade, Propagation, Invalidation, etc.
   - [ ] **Appendix E**: Examples
     * Simple CRUD
     * Complex relationships
     * Real-world use cases

9. **Create Diagrams**
   - [ ] **Mutation flow diagram**:
     ```
     Client                Server               Database
       |                     |                     |
       |-- mutation -------->|                     |
       |                     |-- begin txn ------->|
       |                     |<-- start tracking --|
       |                     |-- write data ------>|
       |                     |-- fetch related --->|
       |                     |<-- entities --------|
       |                     |-- commit txn ------>|
       |                     |-- build cascade --->|
       |<-- response --------|                     |
       |-- apply cascade --->|                     |
       |                  (cache)                  |
     ```
   - [ ] **Cache update sequence diagram**
   - [ ] **Entity relationship tracking diagram**
   - [ ] **Invalidation decision tree**

10. **Write Examples Throughout**
    - [ ] Minimum 3 examples per major section
    - [ ] Simple, intermediate, and advanced examples
    - [ ] Real-world use cases:
      * E-commerce (orders, products, inventory)
      * CRM (companies, contacts, deals)
      * Social network (users, posts, comments, likes)

11. **Create Executive Summary**
    - [ ] One-page overview of GraphQL Cascade
    - [ ] Key benefits
    - [ ] Quick start links

12. **Create PDF Version**
    - [ ] Convert markdown to PDF
    - [ ] Professional formatting
    - [ ] Table of contents with page numbers
    - [ ] Code syntax highlighting

#### Deliverables:
- `GraphQL_Cascade_Specification_v0.1.pdf`
- `specification/` (markdown source, 17 chapters + appendices)
- `diagrams/` (Mermaid or PlantUML source)
- `specification/examples/` (all code examples)

---

### Phase 7: Reference Implementations (Estimated: 24-40 hours)

**Objective**: Provide working reference implementations to validate the spec

#### Tasks:

1. **Server Reference Implementation (Python/FraiseQL)**
   ```
   graphql-cascade-server/
   ├── pyproject.toml
   ├── README.md
   ├── graphql_cascade/
   │   ├── __init__.py
   │   ├── tracker.py         # Entity change tracking (from Phase 4)
   │   ├── builder.py         # Cascade response builder
   │   ├── invalidator.py     # Invalidation hint generator
   │   ├── middleware.py      # GraphQL middleware
   │   ├── config.py          # Configuration
   │   └── directives.py      # @cascade directive
   ├── examples/
   │   ├── basic_crud.py
   │   ├── nested_entities.py
   │   ├── many_to_many.py
   │   └── custom_actions.py
   ├── tests/
   │   ├── test_tracker.py
   │   ├── test_builder.py
   │   ├── test_invalidator.py
   │   └── test_compliance.py
   └── docs/
       └── integration.md
   ```

   - [ ] Implement CascadeTracker class
   - [ ] Implement CascadeBuilder class
   - [ ] Implement CascadeInvalidator class
   - [ ] Implement GraphQL middleware
   - [ ] Create configuration system
   - [ ] Write comprehensive tests (80%+ coverage)
   - [ ] Publish to PyPI as `graphql-cascade`

2. **Client Reference Implementation (TypeScript)**
   ```
   graphql-cascade-client/
   ├── package.json
   ├── README.md
   ├── packages/
   │   ├── core/              # @graphql-cascade/client
   │   │   ├── src/
   │   │   │   ├── CascadeClient.ts
   │   │   │   ├── CascadeCache.ts
   │   │   │   ├── types.ts
   │   │   │   └── index.ts
   │   │   ├── tests/
   │   │   └── package.json
   │   ├── apollo/            # @graphql-cascade/apollo
   │   │   ├── src/
   │   │   │   ├── ApolloCascadeClient.ts
   │   │   │   ├── ApolloCascadeCache.ts
   │   │   │   └── index.ts
   │   │   └── package.json
   │   ├── relay/             # @graphql-cascade/relay
   │   ├── react-query/       # @graphql-cascade/react-query
   │   └── urql/              # @graphql-cascade/urql
   ├── examples/
   │   ├── apollo-app/
   │   ├── relay-app/
   │   ├── react-query-app/
   │   └── vanilla-app/
   └── tests/
       └── integration/
   ```

   - [ ] Implement core CascadeClient
   - [ ] Implement Apollo integration
   - [ ] Implement Relay integration
   - [ ] Implement React Query integration
   - [ ] Implement URQL integration
   - [ ] Write comprehensive tests
   - [ ] Publish to npm (@graphql-cascade/*)

3. **Compliance Test Suite**
   ```
   graphql-cascade-compliance/
   ├── README.md
   ├── server/
   │   ├── test_cascade_response_structure.py
   │   ├── test_entity_tracking.py
   │   ├── test_cascade_depth.py
   │   ├── test_invalidation_hints.py
   │   ├── test_error_handling.py
   │   └── test_performance.py
   ├── client/
   │   ├── test_cache_updates.ts
   │   ├── test_invalidation.ts
   │   ├── test_optimistic_updates.ts
   │   └── test_conflict_resolution.ts
   ├── integration/
   │   ├── test_roundtrip.ts
   │   ├── test_apollo_integration.ts
   │   ├── test_relay_integration.ts
   │   └── test_realtime.ts
   └── cli.py  # CLI to run compliance tests
   ```

   - [ ] Create 50+ compliance tests
   - [ ] CLI tool to run tests against any implementation
   - [ ] Test report generator (JSON, HTML)
   - [ ] Publish as `graphql-cascade-compliance`

4. **Build Example Applications**

   **TODO App** (demonstrates basic CRUD):
   ```
   examples/todo-app/
   ├── backend/              # Python + GraphQL Cascade
   │   ├── schema.graphql
   │   └── server.py
   ├── frontend-apollo/      # React + Apollo + Cascade
   ├── frontend-relay/       # React + Relay + Cascade
   └── frontend-react-query/ # React + React Query + Cascade
   ```
   - [ ] Implement backend with Cascade
   - [ ] Implement 3 frontend variants
   - [ ] Compare with non-Cascade versions

   **Blog Platform** (demonstrates nested entities):
   ```
   examples/blog-platform/
   ├── backend/
   │   └── schema: User, Post, Comment, Like
   └── frontend/
       └── Features: Create post, add comment, like, nested updates
   ```
   - [ ] Implement full CRUD for blog entities
   - [ ] Demonstrate cascade through relationships
   - [ ] Show comment threads with cascading updates

   **E-commerce Dashboard** (demonstrates complex relationships):
   ```
   examples/ecommerce-dashboard/
   ├── backend/
   │   └── schema: Customer, Order, Product, Inventory
   └── frontend/
       └── Features: Create order, update inventory, customer management
   ```
   - [ ] Implement order management
   - [ ] Demonstrate many-to-many (Order ↔ Product)
   - [ ] Show inventory cascade

   **Real-time Chat** (demonstrates subscriptions):
   ```
   examples/realtime-chat/
   ├── backend/
   │   └── schema: User, Channel, Message + subscriptions
   └── frontend/
       └── Features: Send message, real-time updates, online presence
   ```
   - [ ] Implement Cascade subscriptions
   - [ ] Real-time message delivery
   - [ ] Optimistic message sending

5. **Create Compliance Badge/Checker**
   ```bash
   # Install compliance checker
   npm install -g @graphql-cascade/compliance-checker
   # OR
   pip install graphql-cascade-compliance

   # Run against your server
   cascade-compliance check http://localhost:4000/graphql

   # Output:
   ✅ CascadeResponse interface implemented
   ✅ Entity tracking working
   ✅ Invalidation hints generated
   ⚠️  Max depth not enforced (should be 3, got 10)
   ❌ Timestamp field missing on entities

   Compliance: 85% (17/20 tests passed)
   Level: Cascade Basic (need 90% for Cascade Compliant)
   ```

   - [ ] CLI tool implementation
   - [ ] Badge generation (SVG)
   - [ ] HTML report generator
   - [ ] CI/CD integration guide

#### Deliverables:
- `graphql-cascade-server/` repository (Python)
- `graphql-cascade-client/` repository (TypeScript monorepo)
- `graphql-cascade-compliance/` repository
- `examples/todo-app/`
- `examples/blog-platform/`
- `examples/ecommerce-dashboard/`
- `examples/realtime-chat/`
- `@graphql-cascade/compliance-checker` package
- All packages published to npm/PyPI

---

### Phase 8: Documentation & Tooling (Estimated: 12-16 hours)

**Objective**: Make GraphQL Cascade easy to adopt and use

#### Tasks:

1. **Create Official Website** (graphql-cascade.dev)
   ```
   website/
   ├── src/
   │   ├── pages/
   │   │   ├── index.tsx              # Homepage
   │   │   ├── docs/                  # Documentation
   │   │   │   ├── introduction.mdx
   │   │   │   ├── quickstart.mdx
   │   │   │   ├── server-guide.mdx
   │   │   │   ├── client-guide.mdx
   │   │   │   └── api-reference.mdx
   │   │   ├── examples/              # Live examples
   │   │   ├── playground/            # Interactive playground
   │   │   ├── ecosystem/             # Compatible libraries
   │   │   └── blog/                  # Announcements
   │   ├── components/
   │   │   ├── Hero.tsx
   │   │   ├── CodeExample.tsx
   │   │   └── ComparisonTable.tsx
   │   └── styles/
   └── public/
   ```

   **Homepage Hero:**
   ```jsx
   <Hero>
     <h1>GraphQL Cascade</h1>
     <p>Cascading cache updates for GraphQL</p>
     <p>One mutation. Automatic cache updates. Zero boilerplate.</p>

     <CodeExample>
       // Before: Manual cache updates
       const [updateUser] = useMutation(UPDATE_USER, {
         update(cache, { data }) {
           // 20+ lines of manual cache logic...
         }
       });

       // After: Automatic cascade
       const [updateUser] = useCascadeMutation(UPDATE_USER);
       // That's it! Cache updates automatically.
     </CodeExample>

     <Buttons>
       <Button href="/docs/quickstart">Get Started</Button>
       <Button href="/docs/introduction">Read the Spec</Button>
       <Button href="https://github.com/graphql-cascade">GitHub</Button>
     </Buttons>
   </Hero>
   ```

   - [ ] Set up Next.js or Docusaurus site
   - [ ] Design homepage with hero, features, examples
   - [ ] Create documentation pages (from spec)
   - [ ] Add interactive code examples
   - [ ] Deploy to Vercel/Netlify

2. **Write Quick Start Guides**

   **Server Quick Start** (< 15 minutes):
   ```markdown
   # Server Quick Start

   Install GraphQL Cascade for your server:

   ```bash
   pip install graphql-cascade
   ```

   Add to your GraphQL schema:

   ```python
   from graphql_cascade import CascadeMiddleware

   # 1. Add Cascade middleware
   app.add_middleware(CascadeMiddleware)

   # 2. That's it! Your mutations now return cascades.
   ```

   Test it:

   ```graphql
   mutation {
     updateUser(id: "123", input: { name: "New Name" }) {
       success
       data { id name }
       cascade {
         updated { __typename id }
         invalidations { queryName strategy }
       }
     }
   }
   ```
   ```

   **Client Quick Start** (< 15 minutes):
   ```markdown
   # Client Quick Start (Apollo)

   Install GraphQL Cascade for Apollo:

   ```bash
   npm install @graphql-cascade/apollo
   ```

   Wrap your Apollo client:

   ```typescript
   import { ApolloCascadeClient } from '@graphql-cascade/apollo';
   import { ApolloClient, InMemoryCache } from '@apollo/client';

   const apollo = new ApolloClient({ cache: new InMemoryCache() });
   const cascade = new ApolloCascadeClient(apollo);

   // Use cascade.mutate instead of apollo.mutate
   await cascade.mutate(UPDATE_USER, { id: '123', input: { name: 'New Name' } });
   // Cache updated automatically!
   ```

   Or use the React hook:

   ```tsx
   import { useCascadeMutation } from '@graphql-cascade/apollo';

   function UserProfile() {
     const [updateUser] = useCascadeMutation(UPDATE_USER);

     return (
       <button onClick={() => updateUser({ variables: { id, input } })}>
         Update
       </button>
     );
   }
   ```
   ```

3. **Create Code Generators**

   **Schema Generator** (from SpecQL types):
   ```bash
   npm install -g @graphql-cascade/schema-generator

   cascade-schema generate specql.yaml --output schema.graphql

   # Output: GraphQL schema with Cascade types
   ```

   **TypeScript Types Generator**:
   ```bash
   cascade-codegen --schema schema.graphql --output types.ts

   # Output: TypeScript types for Cascade responses
   ```

   **React Hooks Generator**:
   ```bash
   cascade-hooks --schema schema.graphql --output hooks.ts

   # Output: React hooks for all mutations
   # useCascadeCreateUser, useCascadeUpdateCompany, etc.
   ```

   - [ ] Implement schema generator
   - [ ] Implement TypeScript codegen
   - [ ] Implement React hooks generator
   - [ ] Publish to npm

4. **Create Developer Tools**

   **Browser Extension** (Chrome/Firefox DevTools):
   ```
   graphql-cascade-devtools/
   ├── manifest.json
   ├── src/
   │   ├── panel/             # DevTools panel
   │   │   ├── CascadeInspector.tsx
   │   │   └── NetworkTab.tsx
   │   └── background/
   └── icons/
   ```
   - [ ] Inspect Cascade responses in network tab
   - [ ] Visualize entity updates
   - [ ] Show cache state before/after
   - [ ] Timeline of mutations and cascades

   **GraphiQL/Apollo Studio Plugin**:
   ```typescript
   // GraphiQL plugin to format Cascade responses
   import { GraphiQLPlugin } from 'graphiql';
   import { CascadeResponseFormatter } from '@graphql-cascade/devtools';

   const cascadePlugin: GraphiQLPlugin = {
     title: 'Cascade',
     icon: WaveIcon,
     content: <CascadeResponseFormatter />
   };
   ```

   **VS Code Extension**:
   ```
   vscode-graphql-cascade/
   ├── package.json
   ├── src/
   │   ├── extension.ts
   │   ├── validation.ts      # Validate Cascade schemas
   │   └── snippets.ts        # Code snippets
   └── snippets/
       └── cascade.json
   ```
   - [ ] Schema validation
   - [ ] Autocomplete for Cascade types
   - [ ] Snippets for mutations
   - [ ] Inline documentation

5. **Write Migration Guides**

   **From Apollo Manual Updates**:
   ```markdown
   # Migrating from Apollo Manual Cache Updates

   ## Before

   ```typescript
   const [updateUser] = useMutation(UPDATE_USER, {
     update(cache, { data }) {
       // Read existing data
       const existingUsers = cache.readQuery({ query: LIST_USERS });

       // Update the specific user
       cache.writeQuery({
         query: LIST_USERS,
         data: {
           listUsers: existingUsers.listUsers.map(u =>
             u.id === data.updateUser.id ? data.updateUser : u
           )
         }
       });

       // Invalidate related queries
       cache.evict({ fieldName: 'searchUsers' });

       // Update related entities
       if (data.updateUser.company) {
         cache.writeFragment({
           id: `Company:${data.updateUser.company.id}`,
           fragment: COMPANY_FRAGMENT,
           data: data.updateUser.company
         });
       }
     }
   });
   ```

   ## After

   ```typescript
   const [updateUser] = useCascadeMutation(UPDATE_USER);
   // That's it! All cache updates happen automatically.
   ```

   ## Migration Steps

   1. Install @graphql-cascade/apollo
   2. Replace useMutation with useCascadeMutation
   3. Remove update functions
   4. Update GraphQL queries to include cascade fields
   5. Test thoroughly
   ```

   **From Relay Updater Functions**:
   Similar guide for Relay users.

6. **Create Video Tutorials**
   - [ ] **"What is GraphQL Cascade?"** (5 min)
     * Problem: manual cache updates
     * Solution: automatic cascades
     * Quick demo
   - [ ] **"Implementing Cascade on the Server"** (15 min)
     * Install graphql-cascade
     * Add middleware
     * Configure cascades
     * Test with GraphiQL
   - [ ] **"Integrating Cascade with Apollo Client"** (15 min)
     * Install @graphql-cascade/apollo
     * Wrap Apollo client
     * Migrate existing mutations
     * Demo live updates

#### Deliverables:
- `graphql-cascade.dev` website (live)
- Quick start guides (server, Apollo, Relay, React Query)
- Code generators (@graphql-cascade/schema-generator, etc.)
- Browser extension (Chrome/Firefox)
- VS Code extension
- Migration guides (Apollo, Relay)
- Video tutorials (YouTube)

---

### Phase 9: Community & Launch (Estimated: 8-12 hours)

**Objective**: Launch GraphQL Cascade to the community

#### Tasks:

1. **Set Up Governance**
   ```markdown
   # GOVERNANCE.md

   ## Steering Committee

   The GraphQL Cascade specification is governed by a steering committee:

   - [Your Name] (Creator)
   - [Expert 1] (GraphQL Foundation)
   - [Expert 2] (Apollo/Relay team)
   - [Expert 3] (Community representative)

   ## RFC Process

   Changes to the specification follow this process:

   1. Open RFC issue on GitHub
   2. Discussion period (2 weeks minimum)
   3. Steering committee review
   4. Vote (requires majority)
   5. Implementation in reference implementations
   6. Documentation updates

   ## Versioning

   GraphQL Cascade follows semantic versioning:

   - v0.x: Pre-release, breaking changes allowed
   - v1.x: Stable, backward compatible additions only
   - v2.x: Next major version with breaking changes

   ## Backward Compatibility

   Once v1.0 is released:
   - All v1.x versions are backward compatible
   - Deprecated features supported for 2 major versions
   - Migration guides provided for breaking changes
   ```

   - [ ] Create GOVERNANCE.md
   - [ ] Recruit steering committee
   - [ ] Set up RFC process (GitHub Discussions)
   - [ ] Define versioning policy

2. **Create Community Resources**
   - [ ] **Discord Server**: discord.gg/graphql-cascade
     * Channels: #general, #help, #showcase, #spec-discussion
   - [ ] **GitHub Discussions**: github.com/graphql-cascade/spec/discussions
     * Categories: Announcements, Q&A, Show and Tell, RFCs
   - [ ] **Stack Overflow Tag**: [graphql-cascade]
     * Create tag, seed with questions
   - [ ] **Awesome-GraphQL-Cascade**: Curated list of resources
     ```markdown
     # Awesome GraphQL Cascade

     ## Official Resources
     - [Specification](https://graphql-cascade.dev/spec)
     - [Reference Implementations](https://github.com/graphql-cascade)

     ## Server Implementations
     - graphql-cascade (Python) - Official reference
     - graphql-cascade-js (Node.js) - Community

     ## Client Integrations
     - @graphql-cascade/apollo - Official
     - @graphql-cascade/relay - Official

     ## Tools
     - Browser DevTools Extension
     - VS Code Extension

     ## Examples
     - [TODO App](...)
     - [Blog Platform](...)

     ## Articles
     - "Introducing GraphQL Cascade" - Blog
     - "Migrating from Manual Cache Updates" - Tutorial

     ## Videos
     - "What is GraphQL Cascade?" - YouTube
     ```

3. **Write Contributing Guide**
   ```markdown
   # CONTRIBUTING.md

   ## How to Contribute

   ### Reporting Bugs

   Open an issue with:
   - GraphQL Cascade version
   - Server/client implementation
   - Steps to reproduce
   - Expected vs actual behavior

   ### Proposing Changes

   For specification changes:
   1. Open RFC in GitHub Discussions
   2. Describe problem and proposed solution
   3. Gather feedback (2+ weeks)
   4. Steering committee reviews

   For implementation changes:
   1. Open issue describing change
   2. Fork repository
   3. Make changes with tests
   4. Submit pull request

   ### Code Standards

   - Python: Follow PEP 8, use Black formatter
   - TypeScript: Follow Google style guide, use Prettier
   - Tests: 80%+ coverage required
   - Documentation: Update docs with code changes

   ## Code of Conduct

   We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

   Be respectful, inclusive, and collaborative.

   ## License

   By contributing, you agree to license your contributions under MIT.
   ```

   - [ ] Create CONTRIBUTING.md
   - [ ] Create CODE_OF_CONDUCT.md
   - [ ] Set up PR templates
   - [ ] Set up issue templates

4. **Establish Compliance Program**
   ```markdown
   # COMPLIANCE.md

   ## Compliance Levels

   ### Cascade Basic (70%+)
   - CascadeResponse interface implemented
   - Basic entity tracking
   - Simple invalidation hints

   ### Cascade Compliant (90%+)
   - All MUST requirements
   - Most SHOULD requirements
   - Passes compliance test suite

   ### Cascade Advanced (100%)
   - All requirements including MAY
   - Optimistic updates
   - Conflict resolution
   - Real-time subscriptions

   ## Self-Certification

   1. Run compliance tests:
      ```bash
      cascade-compliance check http://your-server/graphql
      ```
   2. Add badge to README:
      ```markdown
      ![Cascade Compliant](https://img.shields.io/badge/GraphQL%20Cascade-Compliant-blue)
      ```

   ## Official Certification

   For official listing on graphql-cascade.dev:
   1. Submit implementation to registry
   2. Automated compliance tests run
   3. Manual review by steering committee
   4. Listed in ecosystem page
   ```

   - [ ] Create compliance program
   - [ ] Build implementation registry
   - [ ] Automate compliance testing
   - [ ] Create badges (SVG)

5. **Plan Marketing/Outreach**

   **Blog Post**: "Introducing GraphQL Cascade"
   ```markdown
   # Introducing GraphQL Cascade: Automatic Cache Updates for GraphQL

   ## The Problem

   Every GraphQL developer has written this code hundreds of times:

   [Manual cache update example]

   It's tedious, error-prone, and doesn't scale.

   ## The Solution

   GraphQL Cascade automatically tracks which entities change during a mutation
   and returns them in a structured format. Your cache updates itself.

   [Cascade example]

   ## How It Works

   [Diagram of cascade flow]

   ## Get Started

   [Quick start links]

   ## What's Next

   GraphQL Cascade is v0.1 (pre-release). We're looking for:
   - Early adopters to test with real apps
   - Feedback on the specification
   - Contributions to reference implementations

   Join us: [links]
   ```

   **Conference Talks**:
   - [ ] Submit to GraphQL Conf
   - [ ] Submit to React Conf (client integrations)
   - [ ] Submit to PyCon (server implementation)
   - [ ] Submit to local meetups

   **Podcast Appearances**:
   - [ ] GraphQL Radio
   - [ ] JS Party
   - [ ] Python Bytes

   **Social Media**:
   - [ ] Twitter/X announcement thread
   - [ ] Reddit r/graphql post
   - [ ] HackerNews submission
   - [ ] Dev.to article
   - [ ] LinkedIn post

   **Outreach**:
   - [ ] Email GraphQL Foundation
   - [ ] Contact Apollo team
   - [ ] Contact Relay team
   - [ ] Reach out to influencers

#### Launch Day Checklist:
- [ ] Specification v0.1 published at graphql-cascade.dev
- [ ] Reference implementations on GitHub (with v0.1.0 tags)
- [ ] npm packages published (@graphql-cascade/*)
- [ ] PyPI package published (graphql-cascade)
- [ ] Website live and tested
- [ ] Blog post published
- [ ] Social media posts scheduled
- [ ] HackerNews post submitted
- [ ] Discord server open
- [ ] GitHub Discussions enabled
- [ ] Documentation complete and reviewed

#### Deliverables:
- `GOVERNANCE.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `COMPLIANCE.md`
- Discord server (live)
- GitHub Discussions (enabled)
- Stack Overflow tag (created)
- awesome-graphql-cascade repo
- Blog post (published)
- Social media content (posted)
- Conference talk submissions (submitted)

---

## 🎯 SUCCESS CRITERIA

### Specification Quality
- [ ] Clearly defines conformance requirements (MUST/SHOULD/MAY)
- [ ] Includes 30+ worked examples across all sections
- [ ] Zero ambiguous requirements (validated by 5+ reviewers)
- [ ] Reviewed by 5+ GraphQL experts before v1.0

### Implementation Viability
- [ ] Reference server implementation complete and tested (80%+ coverage)
- [ ] Reference client implementations for 4+ frameworks
- [ ] 100% test coverage on compliance test suite
- [ ] All example apps working end-to-end

### Adoption Readiness
- [ ] Documentation site live and accessible
- [ ] Quick start guide completable in < 15 minutes
- [ ] At least 4 working example applications
- [ ] Migration guides from Apollo and Relay

### Community Traction (6 months)
- [ ] 5+ companies expressing interest or early adoption
- [ ] 2+ community implementations (beyond reference)
- [ ] 1+ conference talk accepted or presented
- [ ] 1,000+ GitHub stars across repos
- [ ] 100+ Discord/community members

### Technical Validation (12 months)
- [ ] 10+ production implementations
- [ ] Performance benchmarks showing < 10% overhead
- [ ] Zero critical security issues
- [ ] Positive feedback from adopters

---

## ⏱️ TIMELINE ESTIMATE

| Phase | Estimated Duration | Dependencies | Personnel |
|-------|-------------------|--------------|-----------|
| 1. Research & Analysis | 1-2 weeks | None | 1 engineer |
| 2. Core Architecture | 2 weeks | Phase 1 | 1 engineer |
| 3. GraphQL Schema | 1-2 weeks | Phase 2 | 1 engineer |
| 4. Server Requirements | 2 weeks | Phase 2, 3 | 1 engineer |
| 5. Client Integration | 2-3 weeks | Phase 2, 3 | 1-2 engineers |
| 6. Formal Specification | 2-3 weeks | Phase 2-5 | 1 writer + 1 engineer |
| 7. Reference Implementations | 3-5 weeks | Phase 6 | 2-3 engineers |
| 8. Documentation & Tooling | 2 weeks | Phase 6, 7 | 1 engineer + 1 writer |
| 9. Community & Launch | 1-2 weeks | Phase 6 | 1 PM/community manager |

**Total Estimated Time**: 16-24 weeks (4-6 months)

**Recommended Team**:
- 2-3 full-time engineers (server, client, tooling)
- 1 technical writer (documentation, spec)
- 1 part-time PM/community manager (launch, governance)

**Critical Path**: Phase 1 → 2 → 6 → 7 (core spec and implementations)

---

## 🚨 RISK MITIGATION

### Risk: Specification complexity too high
- **Mitigation**: Start with minimal viable spec (v0.1), add features incrementally (v0.2, v0.3)
- **Validation**: Get feedback from developers every 2 weeks, iterate on design

### Risk: Incompatibility with existing frameworks
- **Mitigation**: Build reference integrations early in Phase 5, test with real apps
- **Validation**: Integrate with at least 3 popular frameworks, get buy-in from maintainers

### Risk: Performance overhead unacceptable
- **Mitigation**: Define performance benchmarks in Phase 4, test continuously
- **Validation**: Measure < 10% overhead on mutation response time, < 5MB response size

### Risk: Low adoption
- **Mitigation**: Solve real pain points (validated in Phase 1), provide clear migration path
- **Validation**: Early adopter program (5+ companies), gather feedback before v1.0

### Risk: Spec divergence (multiple incompatible implementations)
- **Mitigation**: Strong governance, compliance test suite, reference implementations
- **Validation**: All implementations must pass compliance tests for certification

### Risk: Security vulnerabilities
- **Mitigation**: Security review in Phase 6, authorization filtering in spec
- **Validation**: Penetration testing, bug bounty program after v1.0

---

## 📊 METRICS TO TRACK

### Development Metrics
- Lines of code (server, client implementations)
- Test coverage percentage
- Compliance test pass rate
- Documentation completeness

### Adoption Metrics
- GitHub stars/forks/contributors
- npm/PyPI downloads per month
- Number of production implementations
- Number of companies using in production

### Community Metrics
- Discord/Slack members
- GitHub Discussions posts
- Stack Overflow questions
- Conference talks/blog posts

### Quality Metrics
- Open issues vs closed issues
- Time to close issues
- Security vulnerabilities (target: 0)
- Performance regression tests

---

## 🚀 NEXT STEPS

1. **Approve this plan** and allocate resources (team, budget, time)
2. **Kick off Phase 1** (Research & Analysis)
   - Assign engineer to study Relay, Apollo, other specs
   - Set up project tracking (Linear, GitHub Projects, or Jira)
   - Schedule weekly sync meetings
3. **Set up project infrastructure**:
   - Create GitHub organization: `github.com/graphql-cascade`
   - Set up repositories:
     * `graphql-cascade/spec` (specification)
     * `graphql-cascade/graphql-cascade-server` (Python reference)
     * `graphql-cascade/graphql-cascade-client` (TypeScript reference)
   - Reserve domain: `graphql-cascade.dev`
   - Set up project tracking and milestones
4. **Recruit advisors** from GraphQL community
   - Reach out to GraphQL Foundation
   - Contact maintainers of Apollo, Relay, etc.
   - Recruit 3-5 advisors for steering committee
5. **Begin weekly progress updates**
   - Share progress in team meetings
   - Blog about development (build in public)
   - Gather early feedback from advisors

---

## 📝 DECISION LOG

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2025-11-11 | Name: GraphQL Cascade | Clear, memorable, conveys cascading update concept |
| TBD | Entity ID: typename+id | Simpler than global IDs, compatible with Apollo |
| TBD | Flat update array | Easier to process than grouped-by-type |
| TBD | Python for server reference | Aligns with FraiseQL (Python-based) |
| TBD | TypeScript for client reference | Dominant language for frontend GraphQL |

---

## 📚 APPENDIX: RELATED WORK

### Specifications to Study
- [Relay Cursor Connections Specification](https://relay.dev/graphql/connections.htm)
- [GraphQL Spec](https://spec.graphql.org/)
- [JSON:API](https://jsonapi.org/)
- [Apollo Client Cache documentation](https://www.apollographql.com/docs/react/caching/cache-configuration/)

### Implementations to Study
- Relay Modern's `updater` functions
- Apollo Client's `update` functions
- URQL's normalized cache
- React Query's query invalidation

### Academic Papers
- "Optimistic Concurrency Control" (H.T. Kung, John T. Robinson)
- "Consistency Models in Distributed Systems"

---

**End of GraphQL Cascade Implementation Plan v1.0**

---

*This plan is a living document and will be updated as the project progresses.*
