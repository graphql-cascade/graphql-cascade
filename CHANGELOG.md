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

## [0.2.0] - 2025-12-04

### Added
- Enhanced error codes (spec v1.1 compliance)
  - TIMEOUT, RATE_LIMITED, SERVICE_UNAVAILABLE
  - VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, FORBIDDEN
  - CONFLICT, TRANSACTION_FAILED, INTERNAL_ERROR
- Error handling utilities in all client packages
- Convenience functions for error creation
- Comprehensive error tests

### Changed
- Renamed CascadeError type to CascadeErrorInfo for clarity
- Bumped all packages to 0.2.0

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
