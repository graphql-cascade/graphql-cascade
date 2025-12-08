# Cache Invalidation Protocol

This document defines the cache invalidation protocol for GraphQL Cascade.

## Overview

Cache invalidation tells clients which cached queries may be stale after a mutation. Instead of manually updating each affected query, servers provide hints that clients use to invalidate or refetch queries automatically.

## QueryInvalidation Structure

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
```

## Invalidation Strategies

### INVALIDATE
Mark the query as stale, refetch on next access.

**When to use:**
- When the query data has changed but isn't critical to refetch immediately
- For list queries that CAN tolerate slight staleness
- To reduce network requests

**Client behavior:**
```typescript
// Mark as stale
queryCache.invalidate(queryKey);
// Will refetch when next accessed
```

### REFETCH
Immediately refetch the query.

**When to use:**
- When the query data is currently visible to the user
- For critical data that SHOULD update immediately
- When the invalidation affects the active view

**Client behavior:**
```typescript
// Refetch immediately
await queryCache.refetch(queryKey);
```

### REMOVE
Remove the query from cache entirely.

**When to use:**
- When the query structure has changed fundamentally
- For queries that are no longer valid
- When cache size needs to be reduced

**Client behavior:**
```typescript
// Remove from cache
queryCache.remove(queryKey);
```

## Invalidation Scopes

### EXACT
Only invalidate queries with exact name and arguments.

**Example:**
```json
{
  "queryName": "getUser",
  "arguments": { "id": "123" },
  "strategy": "REFETCH",
  "scope": "EXACT"
}
```

**Matches:** `getUser(id: "123")`
**Doesn't match:** `getUser(id: "456")`, `listUsers`

### PREFIX
Invalidate all queries with names matching the prefix.

**Example:**
```json
{
  "queryName": "listUsers",
  "strategy": "INVALIDATE",
  "scope": "PREFIX"
}
```

**Matches:** `listUsers`, `listUsersByCompany`, `listUsersFiltered`
**Doesn't match:** `getUser`, `searchUsers`

### PATTERN
Invalidate queries matching a glob pattern.

**Example:**
```json
{
  "queryPattern": "list*",
  "strategy": "INVALIDATE",
  "scope": "PATTERN"
}
```

**Matches:** `listUsers`, `listCompanies`, `listOrders`
**Doesn't match:** `getUser`, `searchUsers`

### ALL
Invalidate all queries in the cache.

**Example:**
```json
{
  "strategy": "INVALIDATE",
  "scope": "ALL"
}
```

**Use sparingly** - only for major data changes or cache resets.

## Invalidation Rules

### Automatic Invalidation
Servers SHOULD generate invalidation hints automatically based on:

1. **Entity Type Changes**
   - When a `User` is updated, invalidate `listUsers`, `getUser`
   - When a `Company` is created, invalidate `listCompanies`

2. **Relationship Changes**
   - When a `User`'s `company` changes, invalidate queries for both entities
   - When an `Order` is deleted, invalidate related `listOrders` queries

3. **Field-Specific Rules**
   - When a `Company.name` changes, invalidate `searchCompanies`
   - When a `User.email` changes, MAY not need to invalidate lists

### Custom Invalidation Rules
Servers MAY define custom rules using directives:

```graphql
directive @cascadeInvalidates(
  """Queries to invalidate when this field changes."""
  queries: [String!]!

  """Invalidation strategy to use."""
  strategy: InvalidationStrategy = INVALIDATE
) on FIELD_DEFINITION

type Company {
  name: String! @cascadeInvalidates(queries: ["searchCompanies", "listCompanies"])
  address: Address!
}
```

## Invalidation Computation Algorithm

### Step 1: Track Changed Entities
```python
changed_entities = set()
for entity in cascade.updated:
    changed_entities.add((entity.__typename, entity.id))
for entity in cascade.deleted:
    changed_entities.add((entity.__typename, entity.id))
```

### Step 2: Generate Base Invalidations
```python
invalidations = []
for typename, entity_id in changed_entities:
    # List queries
    invalidations.append({
        "queryName": f"list{typename}s",
        "strategy": "INVALIDATE",
        "scope": "PREFIX"
    })

    # Get queries for specific entities
    invalidations.append({
        "queryName": f"get{typename}",
        "arguments": {"id": entity_id},
        "strategy": "REFETCH",
        "scope": "EXACT"
    })

    # Search queries
    invalidations.append({
        "queryPattern": f"search{typename}*",
        "strategy": "INVALIDATE",
        "scope": "PATTERN"
    })
```

### Step 3: Apply Custom Rules
```python
# Check field-specific directives
for entity in cascade.updated:
    changed_fields = entity.get_changed_fields()
    for field_name in changed_fields:
        rules = get_invalidation_rules(entity.__typename, field_name)
        for rule in rules:
            invalidations.append({
                "queryName": rule.query,
                "strategy": rule.strategy,
                "scope": rule.scope
            })
```

### Step 4: Deduplicate
```python
# Remove duplicates and conflicting rules
deduplicated = deduplicate_invalidations(invalidations)
```

## Client Invalidation Processing

### Generic Cache Interface
```typescript
interface CascadeCache {
  invalidate(invalidation: QueryInvalidation): void;
  refetch(invalidation: QueryInvalidation): Promise<void>;
  remove(invalidation: QueryInvalidation): void;
}
```

### Apollo Client Implementation
```typescript
class ApolloCascadeCache implements CascadeCache {
  constructor(private cache: InMemoryCache) {}

  invalidate(invalidation: QueryInvalidation): void {
    // Apollo doesn't have direct invalidation
    // Use evict with broadcast: false
    if (invalidation.scope === 'EXACT') {
      this.cache.evict({
        fieldName: invalidation.queryName,
        args: invalidation.arguments,
        broadcast: false
      });
    }
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    // Would need access to ApolloClient for refetchQueries
    // This is simplified
    this.invalidate(invalidation);
  }
}
```

### React Query Implementation
```typescript
class ReactQueryCascadeCache implements CascadeCache {
  constructor(private queryClient: QueryClient) {}

  invalidate(invalidation: QueryInvalidation): void {
    let queryKey: any;

    switch (invalidation.scope) {
      case 'EXACT':
        queryKey = [invalidation.queryName, invalidation.arguments];
        break;
      case 'PREFIX':
        queryKey = [invalidation.queryName];
        break;
      case 'PATTERN':
        // Convert pattern to predicate
        queryKey = { predicate: (query) => this.matchesPattern(query, invalidation.queryPattern) };
        break;
      case 'ALL':
        queryKey = undefined; // All queries
        break;
    }

    this.queryClient.invalidateQueries(queryKey);
  }

  async refetch(invalidation: QueryInvalidation): Promise<void> {
    const queryKey = this.getQueryKey(invalidation);
    await this.queryClient.refetchQueries(queryKey);
  }

  remove(invalidation: QueryInvalidation): void {
    const queryKey = this.getQueryKey(invalidation);
    this.queryClient.removeQueries(queryKey);
  }
}
```

## Performance Considerations

### Invalidation Overhead
- Limit invalidation hints to prevent excessive cache operations
- Use appropriate scopes to avoid over-invalidation
- Batch invalidation operations where possible

### Network Efficiency
- Prefer `INVALIDATE` over `REFETCH` for non-visible queries
- Use `PREFIX` and `PATTERN` scopes to batch operations
- Avoid `ALL` scope unless absolutely necessary

### Memory Management
- Remove unused queries from cache with `REMOVE` strategy
- Implement cache size limits
- Garbage collect stale queries

## Examples

### User Creation
```json
{
  "invalidations": [
    {
      "queryName": "listUsers",
      "strategy": "INVALIDATE",
      "scope": "PREFIX"
    },
    {
      "queryPattern": "searchUser*",
      "strategy": "INVALIDATE",
      "scope": "PATTERN"
    }
  ]
}
```

### Company Update
```json
{
  "invalidations": [
    {
      "queryName": "getCompany",
      "arguments": { "id": "123" },
      "strategy": "REFETCH",
      "scope": "EXACT"
    },
    {
      "queryName": "listCompanies",
      "strategy": "INVALIDATE",
      "scope": "PREFIX"
    },
    {
      "queryName": "searchCompanies",
      "strategy": "INVALIDATE",
      "scope": "EXACT"
    }
  ]
}
```

### Order Deletion
```json
{
  "invalidations": [
    {
      "queryName": "getOrder",
      "arguments": { "id": "456" },
      "strategy": "REMOVE",
      "scope": "EXACT"
    },
    {
      "queryName": "listOrders",
      "strategy": "INVALIDATE",
      "scope": "PREFIX"
    }
  ]
}
```

## Best Practices

### Server-Side
- Generate invalidations automatically when possible
- Use custom rules sparingly (prefer automatic rules)
- Test invalidation logic thoroughly
- Monitor invalidation performance

### Client-Side
- Implement invalidation processing efficiently
- Handle invalidation errors gracefully
- Provide debugging tools for invalidation behavior
- Test with various invalidation scenarios

### Schema Design
- Use consistent query naming conventions
- Design queries to work well with invalidation scopes
- Document invalidation behavior for each mutation