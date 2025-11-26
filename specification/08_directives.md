# GraphQL Cascade Directives

This document defines the GraphQL directives used to configure Cascade behavior.

## @cascade Directive

The `@cascade` directive marks a mutation as Cascade-compliant and configures cascade behavior.

### Definition
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
  If false, server MUST manually specify invalidations.
  """
  autoInvalidate: Boolean = true

  """
  Entity types to exclude from cascade (e.g., don't cascade to audit logs).
  """
  excludeTypes: [String!]
) on FIELD_DEFINITION
```

### Usage Examples

#### Basic Usage
```graphql
type Mutation {
  createUser(input: CreateUserInput!): CreateUserCascade!
    @cascade
}
```

#### Configured Cascade
```graphql
type Mutation {
  updateCompany(id: ID!, input: UpdateCompanyInput!): UpdateCompanyCascade!
    @cascade(
      maxDepth: 2,
      excludeTypes: ["AuditLog"]
    )
}
```

#### Deep Cascade
```graphql
type Mutation {
  processOrder(id: ID!): ProcessOrderCascade!
    @cascade(
      maxDepth: 5,
      includeRelated: true
    )
}
```

### Parameters

#### maxDepth
- **Type:** `Int`
- **Default:** `3`
- **Description:** Maximum relationship depth to traverse when building cascade
- **Examples:**
  - `maxDepth: 1` - Only direct relationships
  - `maxDepth: 3` - Relationships up to 3 levels deep
  - `maxDepth: 0` - Only the primary entity

#### includeRelated
- **Type:** `Boolean`
- **Default:** `true`
- **Description:** Whether to include related entities in the cascade
- **Use cases:**
  - `false` - Only track the primary mutation result
  - `true` - Include all affected related entities

#### autoInvalidate
- **Type:** `Boolean`
- **Default:** `true`
- **Description:** Whether to automatically compute invalidation hints
- **Use cases:**
  - `false` - Manually specify all invalidations (advanced)
  - `true` - Let server auto-compute invalidations

#### excludeTypes
- **Type:** `[String!]`
- **Default:** `[]`
- **Description:** Entity types to exclude from cascade tracking
- **Examples:**
  - `excludeTypes: ["AuditLog"]` - Don't track audit log changes
  - `excludeTypes: ["SystemEvent", "Metrics"]` - Exclude system entities

## @cascadeInvalidates Directive

The `@cascadeInvalidates` directive marks a field as triggering cascade invalidation when changed.

### Definition
```graphql
"""
Marks a field as triggering cascade invalidation when this field changes.
"""
directive @cascadeInvalidates(
  """Queries to invalidate when this field changes."""
  queries: [String!]!

  """Invalidation strategy to use."""
  strategy: InvalidationStrategy = INVALIDATE
) on FIELD_DEFINITION
```

### Usage Examples

#### Field-Level Invalidation
```graphql
type Company {
  name: String! @cascadeInvalidates(queries: ["searchCompanies", "listCompanies"])
  address: Address!
}
```

#### Multiple Queries
```graphql
type User {
  email: String!
    @cascadeInvalidates(
      queries: ["getUser", "listUsers", "searchUsers"],
      strategy: REFETCH
    )
  role: UserRole!
    @cascadeInvalidates(
      queries: ["listUsersByRole"],
      strategy: INVALIDATE
    )
}
```

#### Relationship Invalidation
```graphql
type Company {
  owner: User!
    @cascadeInvalidates(
      queries: ["getUser", "listUsers"],
      strategy: INVALIDATE
    )
}
```

### Parameters

#### queries
- **Type:** `[String!]`
- **Required:** Yes
- **Description:** List of query names to invalidate when this field changes
- **Examples:**
  - `queries: ["listUsers"]` - Single query
  - `queries: ["getUser", "listUsers", "searchUsers"]` - Multiple queries

#### strategy
- **Type:** `InvalidationStrategy`
- **Default:** `INVALIDATE`
- **Description:** How to handle the invalidation
- **Options:**
  - `INVALIDATE` - Mark as stale, refetch on next access
  - `REFETCH` - Immediately refetch the query
  - `REMOVE` - Remove from cache entirely

## Directive Processing

### Server-Side Processing

#### @cascade Directive
1. **Parse directive arguments**
   - Extract `maxDepth`, `includeRelated`, `autoInvalidate`, `excludeTypes`
   - Apply defaults for missing arguments

2. **Configure cascade tracker**
   - Set maximum traversal depth
   - Configure entity type exclusions
   - Enable/disable automatic invalidation

3. **Runtime behavior**
   - Track entity changes within depth limits
   - Exclude specified entity types
   - Generate invalidation hints if auto-invalidate enabled

#### @cascadeInvalidates Directive
1. **Collect field rules**
   - Build mapping of `(entityType, fieldName) -> invalidation rules`
   - Store rules for runtime lookup

2. **Runtime invalidation**
   - When entity field changes, lookup rules
   - Generate invalidation hints based on rules
   - Apply specified strategies

### Client-Side Processing

Directives are server-side only and don't affect client behavior. Clients consume the cascade response as normal.

## Advanced Usage Patterns

### Conditional Cascade
```graphql
type Mutation {
  # Shallow cascade for simple updates
  updateUserProfile(id: ID!, input: ProfileInput!): UpdateUserCascade!
    @cascade(maxDepth: 1)

  # Deep cascade for complex business operations
  mergeCompanies(sourceId: ID!, targetId: ID!): MergeCompaniesCascade!
    @cascade(maxDepth: 5, excludeTypes: ["AuditLog"])
}
```

### Selective Invalidation
```graphql
type Product {
  name: String!
    @cascadeInvalidates(queries: ["searchProducts", "listProducts"])

  price: Float!
    @cascadeInvalidates(
      queries: ["getProduct", "listProducts"],
      strategy: REFETCH  # Price changes are critical
    )

  inventory: Int!
    @cascadeInvalidates(
      queries: ["getProduct"],
      strategy: INVALIDATE  # Inventory changes less critical
    )
}
```

### Relationship-Based Invalidation
```graphql
type Order {
  status: OrderStatus!
    @cascadeInvalidates(
      queries: ["listOrders", "getOrder", "listOrdersByStatus"]
    )

  customer: User!
    @cascadeInvalidates(
      queries: ["getUser", "listUserOrders"]
    )
}
```

## Schema Validation

### Directive Validation Rules

#### @cascade Directive
- **Location:** Only on mutation field definitions
- **Arguments:** All optional, but validated if present
- **maxDepth:** Must be >= 0
- **excludeTypes:** Must be valid entity type names

#### @cascadeInvalidates Directive
- **Location:** Only on field definitions of entity types
- **Arguments:**
  - `queries`: Required, non-empty array
  - `strategy`: Must be valid `InvalidationStrategy` value
- **Query validation:** Referenced queries MUST exist in schema

### Runtime Validation
- **Directive parsing:** Server MUST parse directives at schema load time
- **Rule storage:** Invalidation rules MUST be efficiently accessible
- **Error handling:** Invalid directives SHOULD fail schema validation

## Implementation Examples

### Apollo Server Integration
```typescript
import { makeExecutableSchema } from '@graphql-tools/schema';
import { cascadeDirectiveTransformer } from '@graphql-cascade/server';

const typeDefs = `
  directive @cascade(...) on FIELD_DEFINITION
  directive @cascadeInvalidates(...) on FIELD_DEFINITION

  type Mutation {
    createUser(input: CreateUserInput!): CreateUserCascade!
      @cascade(maxDepth: 2)
  }

  type User {
    name: String! @cascadeInvalidates(queries: ["listUsers"])
  }
`;

const schema = makeExecutableSchema({ typeDefs });
const transformedSchema = cascadeDirectiveTransformer(schema);
```

### FraiseQL Integration
```python
from graphql_cascade import CascadeDirectiveVisitor

# Apply cascade directives to schema
visitor = CascadeDirectiveVisitor()
transformed_schema = visitor.visit(schema)

# Directives are now available for runtime processing
cascade_config = visitor.get_cascade_config()
invalidation_rules = visitor.get_invalidation_rules()
```

## Best Practices

### Directive Usage
1. **Use @cascade on all mutations** - Ensures consistent cascade behavior
2. **Configure maxDepth appropriately** - Balance completeness vs performance
3. **Use excludeTypes for system entities** - Prevent cascade pollution
4. **Apply @cascadeInvalidates selectively** - Only on fields that affect queries

### Performance Considerations
1. **Lower maxDepth for frequent operations** - Reduces cascade computation
2. **Use excludeTypes for audit/logging entities** - Reduces cascade size
3. **Prefer INVALIDATE over REFETCH** - Reduces immediate network requests
4. **Batch invalidation rules** - Minimize rule lookup overhead

### Schema Design
1. **Document directive usage** - Explain why certain configurations are chosen
2. **Test cascade behavior** - Validate that directives produce expected cascades
3. **Monitor cascade performance** - Track cascade size and computation time
4. **Version directive changes** - Treat directive modifications as breaking changes

## Migration Guide

### Adding Directives to Existing Schemas

1. **Identify mutations**
   ```graphql
   # Before
   type Mutation {
     createUser(input: CreateUserInput!): User!
   }

   # After
   type Mutation {
     createUser(input: CreateUserInput!): CreateUserCascade!
       @cascade(maxDepth: 2)
   }
   ```

2. **Add field invalidations**
   ```graphql
   # Before
   type User {
     name: String!
   }

   # After
   type User {
     name: String! @cascadeInvalidates(queries: ["listUsers"])
   }
   ```

3. **Configure cascade behavior**
   ```graphql
   type Mutation {
     # Simple operations
     updateProfile(input: ProfileInput!): UpdateProfileCascade!
       @cascade(maxDepth: 1)

     # Complex operations
     processOrder(id: ID!): ProcessOrderCascade!
       @cascade(maxDepth: 4, excludeTypes: ["AuditLog"])
   }
   ```

Directives provide fine-grained control over cascade behavior while maintaining sensible defaults.