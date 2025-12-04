# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2025-12-04

### Added

- **New Error Codes**: Added `TIMEOUT`, `RATE_LIMITED`, and `SERVICE_UNAVAILABLE` error codes to handle production scenarios (#1)
- **Error Code Guidelines**: Added comprehensive guidelines for selecting appropriate error codes
- **Async Operation Documentation**: Documented recommended patterns for asynchronous mutation handling
- **Extended Examples**: Added comprehensive error examples including timeout, rate limiting, and service unavailability scenarios

### Changed

- **Specification Version**: Bumped to v1.1 to reflect new error codes (backward compatible)

### Migration Notes

These changes are **fully backward compatible**. Existing implementations continue to work without modification. New error codes are optional - implementations may adopt them incrementally.

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
