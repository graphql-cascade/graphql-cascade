# Dashboard Vue Example

An analytics dashboard demonstrating GraphQL Cascade with Vue 3 Composition API and URQL.

## Overview

This example shows how to integrate GraphQL Cascade with:
- **Backend**: Express with graphql-http middleware
- **Frontend**: Vue 3 with URQL client
- **Features**: Real-time data updates, filter-based invalidations

## Quick Start

```bash
# Install dependencies
npm install

# Start development servers
npm run dev
```

Or with Docker:

```bash
docker-compose up
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Vue 3 App     │────▶│  Express Server  │────▶│   In-Memory DB  │
│   (URQL)        │◀────│  (graphql-http)  │◀────│                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │
        │    Cascade Exchange    │    Cascade Middleware
        └────────────────────────┘
```

## Key Files

### Backend
- `backend/src/index.ts` - Express server setup with cascade middleware
- `backend/src/schema.ts` - GraphQL schema for metrics and analytics
- `backend/src/resolvers.ts` - Cascade-enabled resolvers

### Frontend
- `frontend/src/urql-client.ts` - URQL client with cascade exchange
- `frontend/src/components/MetricsChart.vue` - Real-time metrics visualization
- `frontend/src/components/FilterPanel.vue` - Filter controls with invalidation

## Features Demonstrated

- [x] Basic cascade updates
- [x] Vue 3 Composition API integration
- [x] URQL client with custom exchange
- [x] Filter-based cache invalidation
- [x] Real-time data updates
- [ ] Complex aggregations

## Learn More

- [GraphQL Cascade Documentation](../../docs/)
- [URQL Integration Guide](../../docs/guides/urql.md)
- [Vue 3 with GraphQL](../../docs/guides/vue.md)
