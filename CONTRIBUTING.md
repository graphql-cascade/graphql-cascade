# Contributing to GraphQL Cascade

Thank you for your interest in contributing to GraphQL Cascade! We welcome contributions from everyone. This document provides guidelines and information for contributors.

## Ways to Contribute

### Code Contributions
- **Bug fixes** - Fix issues in the issue tracker
- **Features** - Implement new functionality (check existing issues first)
- **Performance improvements** - Optimize existing code
- **Refactoring** - Improve code structure and maintainability

### Documentation
- **Guides and tutorials** - Help new users get started
- **API documentation** - Document functions, classes, and modules
- **Examples** - Create working examples for common use cases
- **Specification** - Improve the technical specification

### Other Contributions
- **Issue reports** - Report bugs or request features
- **Testing** - Write tests or help test new features
- **Design feedback** - Share your experience and suggestions
- **Community support** - Help other users in discussions

## Development Setup

### Prerequisites
- **Python 3.8+** for server implementation
- **Node.js 16+** for client packages
- **Git** for version control

### Clone and Setup
```bash
# Clone the repository
git clone https://github.com/your-org/graphql-cascade.git
cd graphql-cascade

# Set up Python environment (for server)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -e reference/server-python/

# Set up Node.js environment (for clients)
cd packages
npm install
```

### Development Workflow
```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... edit files ...

# Run tests
./scripts/validate_docs.sh
python scripts/test_docs_coverage.py

# Commit your changes
git add .
git commit -m "Add: brief description of your changes"
```

## Testing Requirements

### Running Tests
```bash
# Run all tests
python -m pytest

# Run specific test file
python -m pytest reference/server-python/tests/test_tracker.py

# Run with coverage
python -m pytest --cov=reference/server-python/graphql_cascade
```

### Test Guidelines
- **Unit tests** for all new functions and classes
- **Integration tests** for end-to-end functionality
- **Documentation tests** for examples in docs
- **Performance tests** for critical paths

### Test Coverage
- Maintain >80% code coverage
- Test both success and error cases
- Test edge cases and boundary conditions

## Documentation Standards

### Code Documentation
- **Docstrings** for all public functions and classes
- **Type hints** for Python code
- **JSDoc comments** for JavaScript/TypeScript code
- **Inline comments** for complex logic

### Example
```python
def track_entity_relationship(
    entity_type: str,
    entity_id: str,
    related_type: str,
    related_id: str
) -> None:
    """
    Track a relationship between two entities for cascade invalidation.

    Args:
        entity_type: The type of the primary entity
        entity_id: The ID of the primary entity
        related_type: The type of the related entity
        related_id: The ID of the related entity

    Raises:
        ValueError: If entity_type or related_type is invalid
    """
```

### Documentation Files
- **Markdown** for guides and documentation
- **Clear structure** with headings and sections
- **Working examples** that users can copy-paste
- **Cross-references** to related documentation

## Pull Request Process

### Before Submitting
1. **Update documentation** - Ensure docs reflect your changes
2. **Run tests** - All tests must pass
3. **Check formatting** - Code should be properly formatted
4. **Update CHANGELOG.md** - Add entry for your changes

### Creating a Pull Request
1. **Fork** the repository on GitHub
2. **Create a feature branch** from `main`
3. **Make your changes** following the guidelines above
4. **Push** your branch to your fork
5. **Create a Pull Request** with:
   - Clear title describing the change
   - Description explaining what and why
   - Reference to any related issues

### PR Review Process
- **Automated checks** will run (tests, linting, docs validation)
- **Code review** by maintainers
- **Approval** required before merge
- **Squash and merge** for clean history

### PR Template
Please use the [pull request template](./.github/PULL_REQUEST_TEMPLATE.md) when creating PRs.

## Code of Conduct

This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md) to ensure a welcoming environment for all contributors. Please read and follow it in all interactions.

## Getting Help

- **Issues** - Check existing issues or create new ones
- **Discussions** - Join community discussions on GitHub
- **Discord** - Chat with the community in real-time

## Recognition

Contributors are recognized in:
- **CHANGELOG.md** - For all releases
- **GitHub contributors** - Automatic recognition
- **Future acknowledgments** - As the project grows

Thank you for contributing to GraphQL Cascade! 🎉
