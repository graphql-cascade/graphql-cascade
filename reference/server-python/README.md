# GraphQL Cascade Server Reference Implementation

[![PyPI version](https://badge.fury.io/py/graphql-cascade.svg)](https://pypi.org/project/graphql-cascade/)
[![Python versions](https://img.shields.io/pypi/pyversions/graphql-cascade.svg)](https://pypi.org/project/graphql-cascade/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A Python reference implementation of GraphQL Cascade for server-side GraphQL frameworks.

## What is GraphQL Cascade?

GraphQL Cascade is a specification for automatic cache updates in GraphQL applications. When a mutation executes, the server tracks all affected entities and returns them in a structured format, enabling clients to automatically update their caches without manual logic.

## Features

- **Entity Change Tracking**: Automatically track entity creations, updates, and deletions during mutations
- **Relationship Traversal**: Follow entity relationships to cascade updates through your data graph
- **Invalidation Hints**: Generate cache invalidation instructions for client-side cache management
- **Framework Agnostic**: Works with any GraphQL server framework (Ariadne, Strawberry, Graphene, etc.)
- **Configurable**: Fine-tune cascade behavior with comprehensive configuration options
- **Performance Optimized**: Streaming builders and size limits for large datasets

## Installation

```bash
pip install graphql-cascade
```

## Quick Start

### Basic Usage

```python
from graphql_cascade import CascadeTracker, CascadeBuilder, CascadeInvalidator

# Create components
tracker = CascadeTracker(max_depth=3)
invalidator = CascadeInvalidator()
builder = CascadeBuilder(tracker, invalidator)

# Track changes during mutation
with tracker:
    # Your mutation logic here
    user = create_user(name="John", email="john@example.com")
    tracker.track_create(user)

    # Related entities are automatically tracked
    profile = create_profile(user=user, bio="Hello world")
    tracker.track_create(profile)

# Build cascade response
response = builder.build_response(primary_result=user)
print(response.cascade.updated)  # [{'__typename': 'User', 'id': '1', ...}]
```

### Ariadne Integration

```python
from ariadne import make_executable_schema
from graphql_cascade import create_cascade_middleware

# Create cascade middleware
middleware = create_cascade_middleware()

# Add to your Ariadne schema
schema = make_executable_schema(
    type_defs,
    resolvers,
    middleware=[middleware.get_middleware_for_ariadne()]
)
```

### Strawberry Integration

```python
import strawberry
from graphql_cascade import StrawberryCascadeExtension

# Create extension
extension = StrawberryCascadeExtension()

# Add to your Strawberry schema
@strawberry.type
class Mutation:
    @strawberry.mutation
    def create_user(self, input: CreateUserInput) -> UserCascade:
        # Your mutation logic with automatic cascade tracking
        pass

schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    extensions=[extension]
)
```

## Configuration

```python
from graphql_cascade import CascadeConfig

# Load from file
config = CascadeConfig.from_file('cascade_config.yaml')

# Or build programmatically
config = CascadeConfig.builder() \
    .max_depth(3) \
    .exclude_types(['AuditLog']) \
    .max_response_size(5.0) \
    .build()
```

Example `cascade_config.yaml`:

```yaml
cascade:
  enabled: true
  max_depth: 3
  exclude_types: ['AuditLog', 'SystemEvent']
  enable_relationship_tracking: true

response:
  max_response_size_mb: 5.0
  max_updated_entities: 500
  max_deleted_entities: 100
  max_invalidations: 50

invalidation:
  auto_compute: true
  include_related: true
```

## API Reference

### Core Classes

- **`CascadeTracker`**: Tracks entity changes during mutations
- **`CascadeBuilder`**: Builds GraphQL Cascade responses
- **`CascadeInvalidator`**: Generates cache invalidation hints
- **`CascadeMiddleware`**: Framework integration middleware
- **`CascadeConfig`**: Configuration management

### Key Methods

#### CascadeTracker

```python
tracker = CascadeTracker(max_depth=3, exclude_types=['AuditLog'])

# Track changes
tracker.track_create(entity)
tracker.track_update(entity)
tracker.track_delete('User', '123')

# Context manager
with tracker:
    # Mutation logic
    pass
```

#### CascadeBuilder

```python
builder = CascadeBuilder(tracker, invalidator)

# Build successful response
response = builder.build_response(primary_result=user)

# Build error response
response = builder.build_error_response([error])
```

## Examples

See the `examples/` directory for complete working examples:

- `basic_crud.py` - Simple create, read, update, delete operations
- `nested_entities.py` - Working with related entities (User → Profile)
- `many_to_many.py` - Order → Products relationships
- `custom_actions.py` - Password reset and other custom mutations

## Testing

```bash
# Install development dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run with coverage
pytest --cov=graphql_cascade

# Run specific test
pytest tests/test_tracker.py
```

## Performance Considerations

- **Memory Usage**: Use streaming builders for large datasets
- **Response Size**: Configure `max_response_size_mb` to prevent oversized responses
- **Depth Limits**: Set appropriate `max_depth` to control cascade scope
- **Entity Limits**: Use `max_updated_entities` and `max_deleted_entities` to prevent excessive tracking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [GraphQL Cascade Specification](https://graphql-cascade.dev)
- [Documentation](https://graphql-cascade.dev/docs)
- [GitHub Repository](https://github.com/graphql-cascade/graphql-cascade)
- [Issue Tracker](https://github.com/graphql-cascade/graphql-cascade/issues)</content>
</xai:function_call name="write">
<parameter name="filePath">reference/server-python/LICENSE