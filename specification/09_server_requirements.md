# Server-Side Implementation Requirements

This document defines what GraphQL servers must implement to be GraphQL Cascade compliant.

## Overview

GraphQL Cascade requires servers to track entity changes during mutations and construct structured responses that enable automatic client-side cache updates. This document specifies the server-side requirements, algorithms, and integration patterns.

## Core Requirements

### Entity Change Tracking

Servers MUST track all entity changes that occur during mutation execution:

1. **Transaction-Level Tracking**: All changes within a mutation's database transaction must be captured
2. **Relationship Traversal**: Changes must cascade through entity relationships up to configured depth
3. **Operation Classification**: Each change must be classified as CREATED, UPDATED, or DELETED

### Response Construction

Servers MUST construct CascadeResponse objects containing:

1. **Success Status**: Boolean indicating overall mutation success
2. **Primary Result**: The main entity affected by the mutation
3. **Cascade Updates**: All affected entities with their changes
4. **Invalidation Hints**: Cache invalidation instructions for clients
5. **Error Information**: Structured error details if mutation failed

### Transaction Semantics

Cascade operations MUST maintain database consistency:

1. **Atomicity**: Cascade tracking and response construction must be atomic with the mutation
2. **Isolation**: Cascade data must reflect committed transaction state
3. **Consistency**: All entities in cascade must be consistent with each other

## Entity Tracking Requirements

### Tracking Mechanisms

Servers MUST implement one or more of the following tracking strategies:

#### ORM Hooks (Preferred)
```python
class CascadeTracker:
    def track_entity_change(self, entity, operation):
        """Track entity changes via ORM lifecycle hooks."""
        pass

    def track_relationship_change(self, entity, related_entity, operation):
        """Track changes to related entities."""
        pass
```

#### Database Triggers
```sql
CREATE TRIGGER cascade_track_update
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION track_entity_change('User', NEW.id, 'UPDATED');
```

#### Manual Tracking
```python
# Explicit tracking calls in mutation resolvers
tracker.track_create(user)
tracker.track_update(company)
tracker.track_delete(order)
```

### Tracking Scope

Servers MUST track:

1. **Primary Entities**: Direct subjects of the mutation
2. **Related Entities**: Entities affected through relationships (up to maxDepth)
3. **Cascade Depth**: Configurable relationship traversal depth
4. **Exclusion Rules**: Entity types to exclude from tracking

### Tracking Performance

Entity tracking MUST NOT significantly impact mutation performance:

- **Overhead Limit**: < 10% increase in mutation execution time
- **Memory Usage**: Stream processing to avoid loading all entities in memory
- **Database Queries**: Prefer JOINs over N+1 queries for relationship traversal

## Response Construction Algorithm

### Construction Steps

1. **Collect Primary Result**: Get the main entity affected by the mutation
2. **Gather Cascade Data**: Collect all tracked entity changes
3. **Generate Invalidation Hints**: Compute cache invalidation instructions
4. **Build Response Structure**: Assemble the complete CascadeResponse

### Algorithm Flow

```python
def construct_cascade_response(mutation_result, tracker, invalidator):
    """
    Construct a complete CascadeResponse from mutation execution.

    Args:
        mutation_result: Primary result of the mutation
        tracker: CascadeTracker with all entity changes
        invalidator: CascadeInvalidator for cache hints

    Returns:
        CascadeResponse: Complete cascade response
    """

    # 1. Primary result
    data = mutation_result

    # 2. Collect entity updates
    updated_entities = []
    for entity, operation in tracker.updated_entities:
        updated_entities.append({
            '__typename': entity.__typename__,
            'id': entity.id,
            'operation': operation.value,
            'entity': entity.to_dict()
        })

    # 3. Collect deletions
    deleted_entities = []
    for typename, entity_id in tracker.deleted_entities:
        deleted_entities.append({
            '__typename': typename,
            'id': entity_id,
            'deletedAt': tracker.transaction_timestamp
        })

    # 4. Generate invalidation hints
    invalidations = invalidator.compute_invalidations(
        updated_entities, deleted_entities, mutation_result
    )

    # 5. Build cascade structure
    cascade = {
        'updated': updated_entities,
        'deleted': deleted_entities,
        'invalidations': invalidations,
        'metadata': {
            'timestamp': tracker.transaction_timestamp,
            'transactionId': tracker.transaction_id,
            'depth': tracker.max_depth_reached,
            'affectedCount': len(updated_entities) + len(deleted_entities)
        }
    }

    return CascadeResponse(
        success=True,
        data=data,
        cascade=cascade,
        errors=[]
    )
```

## Invalidation Hint Generation

### Automatic Invalidation Rules

Servers SHOULD generate invalidation hints automatically based on:

1. **Entity Type Changes**: When User entities change, invalidate user-related queries
2. **Field-Specific Rules**: Use @cascadeInvalidates directives for field-level rules
3. **Relationship Impact**: Invalidate queries affected by relationship changes

### Invalidation Strategies

Servers MUST support all invalidation strategies:

- **INVALIDATE**: Mark queries as stale for lazy refetch
- **REFETCH**: Immediately refetch affected queries
- **REMOVE**: Remove queries from cache entirely

### Performance Optimization

Invalidation generation MUST be optimized:

- **Deduplication**: Remove duplicate invalidation hints
- **Batching**: Group similar invalidations
- **Prioritization**: Apply custom rules before automatic rules

## Transaction Semantics

### Atomicity Requirements

Cascade operations MUST be atomic with the mutation:

```python
async def execute_cascade_mutation(mutation_fn, *args):
    async with database.transaction():
        try:
            # Execute the mutation
            result = await mutation_fn(*args)

            # Track cascade changes (happens within transaction)
            tracker.track_changes()

            # Generate response (within transaction)
            response = builder.build_response(result, tracker)

            # Commit transaction
            await transaction.commit()

            return response

        except Exception as e:
            # Rollback on any error
            await transaction.rollback()
            raise CascadeError(f"Mutation failed: {e}")
```

### Consistency Guarantees

Servers MUST ensure:

1. **Transaction Consistency**: All cascade data reflects committed state
2. **Entity Consistency**: Related entities are consistent with each other
3. **Temporal Consistency**: Timestamps and versions are consistent

### Isolation Levels

Cascade tracking works with standard database isolation:

- **READ COMMITTED**: Default for most applications
- **REPEATABLE READ**: Ensures consistent entity reads during cascade
- **SERIALIZABLE**: Maximum consistency for complex cascades

## Performance Requirements

### Response Size Limits

Servers MUST limit cascade response size:

- **Maximum Updates**: 500 updated entities per mutation
- **Maximum Deletions**: 100 deleted entities per mutation
- **Maximum Response Size**: 5MB total response payload
- **Automatic Truncation**: Reduce depth or paginate when limits exceeded

### Execution Overhead

Cascade processing MUST be lightweight:

- **Tracking Overhead**: < 10% of mutation execution time
- **Response Construction**: < 5% of mutation execution time
- **Memory Usage**: Stream processing, limit concurrent cascades

### Database Impact

Cascade queries MUST be efficient:

- **Query Optimization**: Use indexes for relationship traversal
- **Batch Loading**: Prefer JOINs over N+1 queries
- **Connection Pooling**: Reuse database connections

## Configuration Options

### Configuration Structure

Servers MUST support configuration via structured format:

```yaml
cascade:
  # Enable/disable cascade globally
  enabled: true

  # Default cascade depth
  default_max_depth: 3

  # Entity types to exclude
  exclude_types:
    - AuditLog
    - SystemEvent

  # Tracking strategy
  tracking:
    strategy: orm_hooks  # orm_hooks, triggers, manual
    track_events:
      - after_insert
      - after_update
      - after_delete

  # Response limits
  response:
    max_updates: 500
    max_deletions: 100
    max_response_size_mb: 5

  # Invalidation settings
  invalidation:
    auto_compute: true
    include_related: true
    max_depth: 3

  # Performance tuning
  performance:
    use_db_returning: true
    batch_fetches: true
    cache_metadata: true
```

### Configuration Validation

Servers MUST validate configuration:

- **Type Checking**: Ensure correct data types
- **Range Validation**: Check numeric limits
- **Dependency Validation**: Ensure required settings are present
- **Runtime Validation**: Validate against schema at startup

## Integration Patterns

### Middleware Integration

Servers SHOULD provide middleware for automatic cascade handling:

```python
# GraphQL middleware
class CascadeMiddleware:
    def __init__(self, tracker, builder):
        self.tracker = tracker
        self.builder = builder

    async def resolve(self, next_resolver, root, info, **args):
        # Check if mutation has @cascade directive
        if has_cascade_directive(info.field_definition):
            # Execute with cascade tracking
            with self.tracker.track_transaction():
                result = await next_resolver(root, info, **args)
                return self.builder.build_response(result, self.tracker)
        else:
            # Normal execution
            return await next_resolver(root, info, **args)
```

### Framework-Specific Integration

#### Apollo Server
```typescript
import { ApolloServer } from '@apollo/server';
import { CascadePlugin } from '@graphql-cascade/apollo';

const server = new ApolloServer({
  schema,
  plugins: [CascadePlugin({
    tracker: cascadeTracker,
    builder: cascadeBuilder
  })]
});
```

#### GraphQL Yoga
```typescript
import { createYoga } from 'graphql-yoga';
import { useCascade } from '@graphql-cascade/yoga';

const yoga = createYoga({
  schema,
  plugins: [useCascade({
    tracker: cascadeTracker,
    builder: cascadeBuilder
  })]
});
```

#### Strawberry (Python)
```python
import strawberry
from graphql_cascade.strawberry import CascadeExtension

schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    extensions=[CascadeExtension(
        tracker=cascade_tracker,
        builder=cascade_builder
    )]
)
```

## Error Handling

### Cascade-Specific Errors

Servers MUST handle cascade-specific errors:

```python
class CascadeError(Exception):
    def __init__(self, message, code, field=None, path=None, extensions=None):
        self.message = message
        self.code = code
        self.field = field
        self.path = path
        self.extensions = extensions or {}

# Usage
raise CascadeError(
    "Entity not found",
    "NOT_FOUND",
    field="userId",
    path=["input", "userId"]
)
```

### Error Propagation

Cascade errors MUST be included in response:

```python
def build_error_response(error):
    return CascadeResponse(
        success=False,
        errors=[{
            'message': error.message,
            'code': error.code,
            'field': error.field,
            'path': error.path,
            'extensions': error.extensions
        }],
        data=None,
        cascade={
            'updated': [],
            'deleted': [],
            'invalidations': [],
            'metadata': {
                'timestamp': datetime.utcnow().isoformat(),
                'depth': 0,
                'affectedCount': 0
            }
        }
    )
```

## Testing Requirements

### Unit Testing

Servers MUST provide testable components:

```python
def test_cascade_tracking():
    tracker = CascadeTracker()

    # Simulate entity changes
    user = User(id="123", name="John")
    tracker.track_create(user)

    # Verify tracking
    assert len(tracker.updated_entities) == 1
    assert tracker.updated_entities[0][1] == CascadeOperation.CREATED

def test_response_construction():
    tracker = CascadeTracker()
    builder = CascadeBuilder(tracker)

    result = User(id="123", name="John")
    response = builder.build_response(result)

    assert response.success == True
    assert response.data == result
    assert len(response.cascade.updated) == 1
```

### Integration Testing

End-to-end cascade testing:

```python
def test_full_cascade_mutation():
    # Execute mutation
    response = await mutate(createUserMutation, {input: userData})

    # Verify response structure
    assert response.success == True
    assert response.data.id == "123"
    assert len(response.cascade.updated) == 1

    # Verify cache invalidation
    assert len(response.cascade.invalidations) > 0
    assert any(inv.queryName == "listUsers" for inv in response.cascade.invalidations)
```

### Performance Testing

Servers MUST test cascade performance:

```python
def test_cascade_performance():
    # Measure tracking overhead
    start_time = time.time()
    # Execute mutation with cascade
    end_time = time.time()

    overhead = (end_time - start_time) / baseline_time
    assert overhead < 0.1  # < 10% overhead
```

This comprehensive server-side specification ensures that GraphQL Cascade implementations are performant, reliable, and maintain data consistency across different GraphQL server frameworks.