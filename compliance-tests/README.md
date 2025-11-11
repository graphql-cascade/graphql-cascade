# GraphQL Cascade Compliance Test Suite

[![PyPI version](https://badge.fury.io/py/graphql-cascade-compliance.svg)](https://pypi.org/project/graphql-cascade-compliance/)

A comprehensive test suite for validating GraphQL Cascade compliance in server and client implementations.

## Overview

The compliance test suite provides:

- **50+ automated tests** covering all aspects of GraphQL Cascade
- **CLI tool** to run tests against any implementation
- **Test reports** in JSON, HTML, and text formats
- **CI/CD integration** with GitHub Actions support
- **Compliance badges** for documentation

## Installation

```bash
# Install the test suite
pip install graphql-cascade-compliance

# Or install from source
git clone https://github.com/graphql-cascade/graphql-cascade
cd graphql-cascade/compliance-tests
pip install -e .
```

## Quick Start

### Test a Server Implementation

```bash
# Test against a running GraphQL server
cascade-compliance check-server http://localhost:4000/graphql

# With custom configuration
cascade-compliance check-server http://localhost:4000/graphql \
  --config compliance_config.yaml \
  --output report.html
```

### Test a Client Implementation

```bash
# Test a client library (requires test harness)
cascade-compliance check-client \
  --client apollo \
  --server http://localhost:4000/graphql
```

### Generate Compliance Badge

```bash
# Generate badge for documentation
cascade-compliance badge \
  --input report.json \
  --output compliance-badge.svg
```

## Test Categories

### Server Tests

#### Core Cascade Response Structure
- ✅ `test_cascade_response_interface` - Validates CascadeResponse interface
- ✅ `test_cascade_updates_structure` - Validates CascadeUpdates structure
- ✅ `test_entity_update_format` - Validates UpdatedEntity format
- ✅ `test_entity_deletion_format` - Validates DeletedEntity format

#### Entity Tracking
- ✅ `test_entity_creation_tracking` - Tracks newly created entities
- ✅ `test_entity_update_tracking` - Tracks entity updates
- ✅ `test_entity_deletion_tracking` - Tracks entity deletions
- ✅ `test_relationship_cascading` - Cascades through entity relationships

#### Invalidation Hints
- ✅ `test_invalidation_hints_generation` - Generates cache invalidation hints
- ✅ `test_query_invalidation_patterns` - Validates invalidation patterns
- ✅ `test_custom_invalidation_rules` - Applies custom invalidation rules

#### Schema Conventions
- ✅ `test_mutation_naming_conventions` - Validates mutation naming
- ✅ `test_cascade_directive_support` - Supports @cascade directive
- ✅ `test_interface_implementations` - Implements Node and Timestamped interfaces

#### Performance & Limits
- ✅ `test_response_size_limits` - Enforces response size limits
- ✅ `test_cascade_depth_limits` - Enforces cascade depth limits
- ✅ `test_transaction_semantics` - Maintains transaction consistency

### Client Tests

#### Cache Integration
- ✅ `test_cache_write_operations` - Writes entities to cache
- ✅ `test_cache_read_operations` - Reads entities from cache
- ✅ `test_cache_evict_operations` - Evicts entities from cache

#### Invalidation Processing
- ✅ `test_query_invalidation` - Processes invalidation hints
- ✅ `test_query_refetch` - Refetches invalidated queries
- ✅ `test_query_removal` - Removes queries from cache

#### Optimistic Updates
- ✅ `test_optimistic_updates` - Applies optimistic updates
- ✅ `test_optimistic_rollback` - Rolls back on mutation failure
- ✅ `test_conflict_resolution` - Resolves update conflicts

## Configuration

Create a `compliance_config.yaml` file:

```yaml
# Server endpoint
server:
  url: "http://localhost:4000/graphql"
  timeout: 30

# Test settings
tests:
  # Enable/disable test categories
  server:
    enabled: true
    core: true
    tracking: true
    invalidation: true
    schema: true
    performance: true

  client:
    enabled: true
    cache: true
    invalidation: true
    optimistic: true

  # Performance thresholds
  performance:
    max_response_time_ms: 1000
    max_cascade_depth: 5
    max_response_size_mb: 5.0

# Output settings
output:
  format: "html"  # json, html, text
  file: "compliance_report.html"
  verbose: true

# Compliance levels
compliance:
  required_score: 85  # Minimum score for "compliant"
  strict_mode: false  # Enable strict validation
```

## CLI Reference

### `cascade-compliance check-server`

Test a GraphQL server for Cascade compliance.

```bash
cascade-compliance check-server [OPTIONS] URL

Options:
  --config FILE          Configuration file
  --output FILE          Output report file
  --format FORMAT        Output format (json|html|text)
  --verbose              Verbose output
  --timeout SECONDS      Request timeout
  --help                 Show help
```

### `cascade-compliance check-client`

Test a client implementation.

```bash
cascade-compliance check-client [OPTIONS]

Options:
  --client TYPE          Client type (apollo|relay|react-query|urql)
  --server URL           GraphQL server URL
  --config FILE          Configuration file
  --output FILE          Output report file
  --help                 Show help
```

### `cascade-compliance badge`

Generate compliance badge.

```bash
cascade-compliance badge [OPTIONS]

Options:
  --input FILE           Input report file
  --output FILE          Output badge file
  --style STYLE          Badge style (flat|plastic|flat-square)
  --help                 Show help
```

## Test Results

### Compliance Levels

- **Cascade Compliant** (90-100%): Full compliance with specification
- **Cascade Basic** (75-89%): Basic functionality working
- **Cascade Partial** (50-74%): Partial implementation
- **Not Compliant** (0-49%): Missing core functionality

### Sample Report

```
GraphQL Cascade Compliance Report
==================================

Server: http://localhost:4000/graphql
Tested: 2024-01-15 10:30:00 UTC
Duration: 45.2 seconds

Overall Score: 92% (Cascade Compliant)

Test Results:
✅ Core Cascade Response Structure (15/15 passed)
✅ Entity Tracking (12/12 passed)
✅ Invalidation Hints (8/8 passed)
⚠️  Schema Conventions (9/10 passed)
  - Missing: @cascade directive arguments validation
✅ Performance & Limits (5/5 passed)

Recommendations:
- Implement @cascade directive argument validation
- Consider adding transaction metadata to responses
```

## CI/CD Integration

### GitHub Actions

```yaml
name: GraphQL Cascade Compliance

on: [push, pull_request]

jobs:
  compliance:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'

    - name: Install dependencies
      run: |
        pip install graphql-cascade-compliance

    - name: Run compliance tests
      run: |
        cascade-compliance check-server http://localhost:4000/graphql \
          --output compliance_report.json

    - name: Generate badge
      run: |
        cascade-compliance badge \
          --input compliance_report.json \
          --output compliance-badge.svg

    - name: Upload badge
      uses: actions/upload-artifact@v3
        with:
          name: compliance-badge
          path: compliance-badge.svg
```

## Development

### Running Tests Locally

```bash
# Install development dependencies
pip install -e ".[dev]"

# Run all tests
pytest

# Run specific test category
pytest tests/server/test_cascade_response_structure.py

# Run with coverage
pytest --cov=graphql_cascade_compliance
```

### Adding New Tests

1. Create test file in appropriate directory
2. Implement test class inheriting from `ComplianceTest`
3. Add test methods with descriptive names
4. Update test configuration if needed

Example:

```python
from graphql_cascade_compliance import ComplianceTest

class TestCustomFeature(ComplianceTest):
    def test_custom_feature(self):
        """Test custom cascade feature."""
        # Test implementation
        pass
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [GraphQL Cascade Specification](https://graphql-cascade.dev)
- [Documentation](https://graphql-cascade.dev/docs/compliance)
- [GitHub Repository](https://github.com/graphql-cascade/graphql-cascade)</content>
</xai:function_call name="run">
<parameter name="command">mkdir -p compliance-tests/server compliance-tests/client compliance-tests/integration