# GraphQL Cascade - TypeScript/Node.js Server

A TypeScript/Node.js implementation of GraphQL Cascade server functionality for automatic cache updates.

## Overview

This package provides the core server-side components for GraphQL Cascade:

- **CascadeTracker**: Tracks entity changes during GraphQL mutations
- **CascadeBuilder**: Constructs cascade response objects
- **TypeScript Types**: Complete type definitions for cascade operations

## Installation

```bash
npm install @graphql-cascade/server
```

## Quick Start

```typescript
import { CascadeTracker, CascadeBuilder } from '@graphql-cascade/server';

// Create tracker and builder
const tracker = new CascadeTracker();
const builder = new CascadeBuilder(tracker);

// Start a cascade transaction
const transactionId = tracker.startTransaction();

// Track entity changes
tracker.trackCreate({ id: 1, __typename: 'User', name: 'John' });
tracker.trackUpdate({ id: 2, __typename: 'Post', title: 'Updated Title' });

// Build cascade response
const response = builder.buildResponse(mutationResult);

// Response includes cascade data for cache updates
console.log(response.cascade.updated); // Updated entities
console.log(response.cascade.deleted); // Deleted entities
```

## API Reference

### CascadeTracker

Tracks entity changes during GraphQL operations.

```typescript
const tracker = new CascadeTracker({
  maxDepth: 3,              // Maximum relationship traversal depth
  excludeTypes: ['Audit'],  // Types to exclude from tracking
  enableRelationshipTracking: true
});

tracker.startTransaction();    // Begin tracking
tracker.trackCreate(entity);   // Track creation
tracker.trackUpdate(entity);   // Track update
tracker.trackDelete('User', 1); // Track deletion
tracker.endTransaction();      // End and get cascade data
```

### CascadeBuilder

Builds GraphQL Cascade responses.

```typescript
const builder = new CascadeBuilder(tracker, invalidator, {
  maxResponseSizeMb: 5.0,
  maxUpdatedEntities: 500,
  maxDeletedEntities: 100
});

const response = builder.buildResponse(primaryResult, success, errors);
```

## Response Format

```typescript
interface CascadeResponse {
  success: boolean;
  data?: any;
  cascade: {
    updated: Array<{
      __typename: string;
      id: string;
      operation: 'CREATED' | 'UPDATED';
      entity: Record<string, any>;
    }>;
    deleted: Array<{
      __typename: string;
      id: string;
      deletedAt: string;
    }>;
    invalidations: Array<{
      __typename: string;
      id?: string;
      field?: string;
      reason: string;
    }>;
    metadata: {
      transactionId?: string;
      timestamp: string;
      depth: number;
      affectedCount: number;
      trackingTime: number;
      constructionTime?: number;
    };
  };
  errors: CascadeError[];
}
```

## Framework Integration

This core package provides the foundation for framework-specific integrations:

- **NestJS Module** (coming in Week 2)
- **Apollo Server Plugin** (coming in Week 2)
- **Express Middleware** (coming in Week 2)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm run test

# Lint
npm run lint
```

## License

MIT