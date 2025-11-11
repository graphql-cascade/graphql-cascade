# Contributing to GraphQL Cascade

Thank you for your interest in contributing to GraphQL Cascade! This document provides guidelines and information for contributors.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

When filing a bug report, include:

- **Clear title and description**
- **GraphQL Cascade version** (server and client)
- **Server/client implementation** (Python/FraiseQL, Apollo, etc.)
- **Steps to reproduce** the issue
- **Expected behavior** vs **actual behavior**
- **Code examples** (minimal reproduction if possible)
- **Error messages** and stack traces
- **Environment details** (OS, Node version, Python version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide detailed description** of the proposed functionality
- **Explain why this enhancement would be useful** to most users
- **List any alternatives** you've considered
- **Include examples** of how the feature would be used

### Proposing Specification Changes

GraphQL Cascade has a formal specification. Changes to the spec follow an RFC (Request for Comments) process:

1. **Open an RFC Discussion** in [GitHub Discussions](https://github.com/graphql-cascade/graphql-cascade/discussions)
2. **Describe the problem** the change solves
3. **Propose a solution** with examples
4. **Gather community feedback** (minimum 2 weeks)
5. **Steering committee reviews** and makes a decision
6. **Implementation** after approval

### Pull Requests

#### Before Submitting

1. **Check existing PRs** to avoid duplicates
2. **Discuss large changes** in an issue first
3. **Follow the coding standards** for the language (Python: PEP 8 + Black, TypeScript: Google style + Prettier)
4. **Write tests** for your changes (aim for 80%+ coverage)
5. **Update documentation** if needed

#### Submission Process

1. **Fork the repository** and create a branch from `main`
2. **Make your changes** with clear, atomic commits
3. **Write meaningful commit messages** (see Commit Guidelines below)
4. **Ensure all tests pass** (`npm test` or `pytest`)
5. **Run linters** (`npm run lint` or `black .`)
6. **Update CHANGELOG.md** if appropriate
7. **Submit the pull request**

#### PR Requirements

- ✅ All tests pass
- ✅ Code follows style guidelines
- ✅ 80%+ test coverage for new code
- ✅ Documentation updated (if applicable)
- ✅ No merge conflicts with `main`
- ✅ Signed commits (optional but recommended)

### Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(server): add cascade depth limit configuration

Allow configuring max cascade depth per mutation using @cascade directive.
Defaults to 3 levels to balance completeness with performance.

Closes #123
```

```
fix(apollo): handle undefined cache entries gracefully

Previously crashed when applying cascade to queries not in cache.
Now checks for existence before writing.

Fixes #456
```

## Development Setup

### Server (Python)

```bash
cd server-reference
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -e ".[dev]"
pytest
```

### Client (TypeScript)

```bash
cd client-reference
npm install
npm test
npm run lint
```

## Project Structure

```
graphql-cascade/
├── specification/          # Formal specification
├── research/              # Research documents (Phase 1)
├── server-reference/      # Python implementation
│   ├── graphql_cascade/
│   ├── tests/
│   └── examples/
├── client-reference/      # TypeScript implementations
│   ├── packages/
│   │   ├── core/
│   │   ├── apollo/
│   │   ├── relay/
│   │   └── react-query/
│   └── tests/
├── examples/              # Example applications
└── docs/                  # Documentation
```

## Coding Standards

### Python

- Follow [PEP 8](https://peps.python.org/pep-0008/)
- Use [Black](https://black.readthedocs.io/) for formatting
- Use [mypy](http://mypy-lang.org/) for type checking
- Use [pytest](https://pytest.org/) for testing
- Docstrings: Google style

```python
def track_create(self, entity: Entity) -> None:
    """Track a newly created entity.

    Args:
        entity: The entity that was created.

    Raises:
        ValueError: If entity lacks required fields.
    """
    pass
```

### TypeScript

- Follow [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- Use [Prettier](https://prettier.io/) for formatting
- Use [ESLint](https://eslint.org/) for linting
- Use [Jest](https://jestjs.io/) for testing
- JSDoc for public APIs

```typescript
/**
 * Apply a cascade response to the cache.
 *
 * @param response - The cascade response from the server
 * @throws {CascadeError} If response structure is invalid
 */
applyCascade(response: CascadeResponse): void {
  // ...
}
```

## Testing

### Test Coverage

- Aim for **80%+ coverage** on new code
- **100% coverage** on critical paths (tracking, builder, invalidator)
- Test both success and error cases
- Test edge cases (empty cascades, cycles, max depth)

### Test Structure

```python
# Python
def test_tracker_records_created_entity():
    """Test that tracker correctly records created entities."""
    tracker = CascadeTracker()
    entity = User(id="123", name="John")

    tracker.track_create(entity)

    assert len(tracker.created) == 1
    assert tracker.created[0] == entity
```

```typescript
// TypeScript
describe('CascadeClient', () => {
  it('should apply entity updates to cache', () => {
    const cache = new MockCache();
    const client = new CascadeClient(cache);
    const response = createMockCascadeResponse();

    client.applyCascade(response);

    expect(cache.write).toHaveBeenCalledWith(
      'User',
      '123',
      expect.objectContaining({ name: 'John' })
    );
  });
});
```

## Documentation

### What to Document

- **Public APIs**: All public functions, classes, and methods
- **Examples**: Include usage examples for new features
- **Rationale**: Explain *why*, not just *what*
- **Breaking changes**: Clearly mark and explain
- **Migration guides**: Help users upgrade

### Documentation Style

- Use clear, concise language
- Include code examples
- Link to related documentation
- Keep it up-to-date with code changes

## Release Process

GraphQL Cascade uses [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

Releases are created by maintainers through GitHub Actions.

## Community

### Communication Channels

- **GitHub Issues**: Bug reports, feature requests
- **GitHub Discussions**: Questions, ideas, RFCs
- **Discord**: Real-time chat, community support
- **Twitter**: Announcements, updates

### Getting Help

- Check the [Documentation](./docs/)
- Search [existing issues](https://github.com/graphql-cascade/graphql-cascade/issues)
- Ask in [GitHub Discussions](https://github.com/graphql-cascade/graphql-cascade/discussions)
- Join our [Discord server](https://discord.gg/graphql-cascade)

## Recognition

Contributors are recognized in:

- **CONTRIBUTORS.md**: All contributors listed
- **Release notes**: Significant contributions highlighted
- **README.md**: Major contributors featured

## License

By contributing to GraphQL Cascade, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

---

Thank you for contributing to GraphQL Cascade! Your efforts help make GraphQL cache management better for everyone. 🚀
