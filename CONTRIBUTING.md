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
- **Node.js 18+** for development
- **pnpm 8+** for package management
- **Git** for version control

### Clone and Setup
```bash
# Clone the repository
git clone https://github.com/your-org/graphql-cascade.git
cd graphql-cascade

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Development Workflow
```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... edit files ...

# Run tests
pnpm test

# Run linting
pnpm lint

# Commit your changes
git add .
git commit -m "Add: brief description of your changes"
```

## Testing Requirements

### Running Tests
```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm test --filter @graphql-cascade/server

# Run with coverage
pnpm test --coverage
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
- **JSDoc comments** for all public functions and classes
- **Type annotations** for TypeScript code
- **Inline comments** for complex logic

### Example
```typescript
/**
 * Track a relationship between two entities for cascade invalidation.
 *
 * @param entityType - The type of the primary entity
 * @param entityId - The ID of the primary entity
 * @param relatedType - The type of the related entity
 * @param relatedId - The ID of the related entity
 * @throws {Error} If entityType or relatedType is invalid
 */
function trackEntityRelationship(
  entityType: string,
  entityId: string,
  relatedType: string,
  relatedId: string
): void {
  // Implementation here
}
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
