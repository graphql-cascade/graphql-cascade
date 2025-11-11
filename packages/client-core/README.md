# GraphQL Cascade Client Core

The core client library providing the fundamental interfaces and base classes for GraphQL Cascade client implementations.

## Installation

```bash
npm install @graphql-cascade/client-core
```

## Overview

This package provides:

- `CascadeClient`: Base client class for processing cascade responses
- `OptimisticCascadeClient`: Extended client with optimistic update support
- `CascadeConflictResolver`: Handles conflicts between local and server data
- TypeScript types for all cascade response structures
- Framework-agnostic cache interfaces

## Basic Usage

```typescript
import { CascadeClient } from '@graphql-cascade/client-core';

// Create a client with your GraphQL executor
const cascade = new CascadeClient(executor);

// Process cascade responses
const result = await cascade.mutate(MUTATION, variables);
```

## API Reference

See [Client API](../../docs/api/client-api.md) for complete documentation.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## License

MIT