# Changelog

All notable changes to this project will be documented in this file.

## Version Numbering Clarification

This project uses **semantic versioning** for package versions:
- Package versions: 0.x.y (pre-1.0), 1.x.y (stable)
- Specification versions: Referenced as "spec vX.Y" in docs
- Feature names: Descriptive (e.g., "error-codes-enhancement")

### Historical Notes
- **v1.1.0 tag**: Early tag that doesn't follow our semver convention.
  Ignore this tag - actual package versions are 0.2.0.
- **"v1.1 error codes"**: Refers to specification v1.1, not package version.
  These are included in package version 0.2.0.

## [0.3.1] - 2025-12-08

### Added

#### TypeScript Code Generation 🎉
- **New Package**: `@graphql-cascade/codegen` - GraphQL Code Generator plugin for cascade-aware type generation
  - Auto-generates helper types: `CascadeOf<T>`, `DataOf<T>`, `UpdatedEntitiesOf<T>`, `DeletedEntitiesOf<T>`, `InvalidationsOf<T>`
  - Generates union type guards for discriminated union responses
  - Creates pre-configured `UnionCascadeConfig` objects for union types with cascade
  - Comprehensive test suite with 10 test cases (100% passing)

- **CLI Enhancements**: New codegen commands
  - `cascade codegen` - Run GraphQL Code Generator with cascade plugin
  - `cascade codegen init` - Scaffold codegen.yml configuration
  - Integrates seamlessly with existing GraphQL Code Generator ecosystem

#### Nuxt Module 🎉
- **New Package**: `@graphql-cascade/nuxt` - Zero-config Nuxt module for GraphQL Cascade
  - Auto-imports 7 Vue Composition API helpers
  - Full TypeScript support with generic type parameters
  - Smoke tests validating module metadata and exports

- **7 Vue Composables**:
  - `useCascadeMutation` - Enhanced mutation with automatic cascade tracking
  - `useCascadeClient` - Access to cascade-enabled Apollo Client
  - `useCascadeTracker` - Track cascade history across mutations
  - `useCascadeQuery` - Auto-refetch on cascade invalidations
  - `useCascadeBatch` - Batch multiple mutations with cascade coordination
  - `useCascadeOptimistic` - Optimistic updates with automatic rollback
  - `useCascadeUnionQuery` - Handle union type responses with type safety

#### Apollo Client Improvements
- **Union Type Support**: Enhanced cascade extraction for union responses
  - `extractCascadeFromMutationResult` utility function
  - Configurable `UnionCascadeConfig` for success/error type discrimination
  - Handles both success variants (with cascade) and error variants
  - Automatic cascade data extraction from union responses

#### TypeScript Improvements
- All composables and hooks now accept `TypedDocumentNode<TResult, TVariables>`
- Full generic type support across Nuxt composables
- Enhanced type inference for cascade data structures
- Works seamlessly with generated types from `@graphql-cascade/codegen`

### Fixed

- **Codegen**: Fixed union cascade detection - now properly traverses inline fragments to find cascade fields
  - Previous logic only checked direct field selections
  - Now correctly identifies cascade in `... on SuccessType { cascade { ... } }` patterns
  - Enables proper `UnionCascadeConfig` generation for union types

### Documentation

- Added comprehensive TypeScript codegen section to main README with before/after examples
- Created detailed DevTools integration proposal document (8-week implementation plan)
- Added codegen package documentation with usage examples and configuration options
- Documented all 7 Nuxt composables with code examples
- Added testing strategy documentation for Nuxt module

### Testing

- Added Jest test suite for codegen plugin (10 tests, all passing)
- Added smoke tests for Nuxt module (validates exports and configuration)
- Test coverage for:
  - Helper type generation
  - Union type guard generation
  - UnionCascadeConfig generation
  - Configuration options (cascadeImportFrom, generateTypeGuards, generateUnionHelpers)
  - Edge cases (operations without cascade, empty documents)

### Internal

- Testing revealed and fixed critical union cascade detection bug
- Added comprehensive test infrastructure for future development
- Improved visitor pattern for GraphQL AST traversal

## [0.3.0] - 2025-12-05

### Added

#### Production Hardening (Phase 22)
- **Observability & Metrics** (Phase 22.1)
  - `MetricsCollector` interface for cascade operation monitoring
  - `DefaultMetricsCollector` with in-memory storage
  - Prometheus export via `exportPrometheusMetrics()`
  - Counter, gauge, and histogram metrics
  - Metrics integration in `CascadeTracker` and `CascadeBuilder`
  - OpenTelemetry integration support

- **Security Best Practices** (Phase 22.2)
  - `fieldFilter` for sensitive field exclusion
  - `entityFilter` with async support for authorization checks
  - `validateEntity` hook for entity validation before tracking
  - `transformEntity` hook for data sanitization
  - Metadata control (`includeTimingMetadata`, `includeTransactionId`)
  - Comprehensive security documentation with examples

- **SBOM Generation** (Phase 22.3)
  - CycloneDX SBOM generation workflow
  - GitHub Actions automation for dependency tracking
  - Security vulnerability tracking integration

- **Operational Runbook** (Phase 22.4)
  - Production monitoring guide with key metrics
  - Prometheus alert rule examples (high latency, error rate, transaction leaks)
  - Grafana dashboard reference
  - Troubleshooting scenarios (slow responses, memory usage, missing entities, cache issues)
  - Emergency procedures (disable cascade, reduce scope, graceful degradation)
  - Capacity planning guidance

- **Health Check Endpoints** (Phase 22.5)
  - `createHealthCheck()` function for health status monitoring
  - Kubernetes-compatible status levels (healthy/degraded/unhealthy)
  - Configurable thresholds for error rates and latency
  - HTTP status code mapping via `getHealthStatusCode()`
  - Memory usage and active transaction monitoring

- **Platform Compatibility Documentation** (Phase 22.6)
  - Node.js version compatibility matrix (18.x, 20.x, 22.x)
  - Browser compatibility table (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
  - Platform-specific deployment notes (Linux, macOS, Windows, Docker/Alpine)
  - Docker deployment examples (single-stage and multi-stage builds)
  - Bundle size documentation
  - TypeScript version requirements (4.7+ supported, 5.0+ recommended)

#### Error Handling Enhancements
- Enhanced error codes (spec v1.1 compliance)
  - TIMEOUT, RATE_LIMITED, SERVICE_UNAVAILABLE
  - VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, FORBIDDEN
  - CONFLICT, TRANSACTION_FAILED, INTERNAL_ERROR
- Error handling utilities in all client packages
- Convenience functions for error creation (`validationError`, `notFoundError`, `timeoutError`, etc.)
- Comprehensive error tests
- Version alignment cleanup for consistent versioning

### Changed
- Renamed `CascadeError` type to `CascadeErrorInfo` for clarity
- Bumped all packages to 0.3.0
- Clarified versioning strategy (package versions vs spec versions)
- Updated VERSION constant in server-node to 0.3.0

### Fixed
- Version constant mismatch in `packages/server-node/src/index.ts`

## [0.2.0] - Unreleased

## [0.1.0] - Unreleased

### Added
- Python server reference implementation
  - CascadeTracker for transaction tracking
  - CascadeBuilder for response construction
  - CascadeInvalidator for cache invalidation
  - Middleware for Ariadne, Strawberry, and GraphQL Yoga
- TypeScript client packages
  - @graphql-cascade/client - Core client library
  - @graphql-cascade/client-apollo - Apollo Client integration
  - @graphql-cascade/client-react-query - React Query integration
- Comprehensive test suites
- CI/CD pipeline

### Fixed
- Corrected syntax errors in Python package files
