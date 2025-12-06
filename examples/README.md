# GraphQL Cascade Examples

## Overview
This directory contains example applications demonstrating GraphQL Cascade in various configurations.

## Example Matrix

| Example | Backend | Frontend | Client Library | Complexity |
|---------|---------|----------|----------------|------------|
| todo-apollo | Apollo Server | React | Apollo Client | Simple |
| todo-urql | Apollo Server | React | URQL | Simple |
| todo-react-query | Apollo Server | React | React Query | Simple |
| blog-nestjs-relay | NestJS | React | Relay | Medium |

## Quick Start

Each example can be run with:
```bash
cd examples/<example-name>
npm install
npm run dev
```

Or with Docker:
```bash
cd examples/<example-name>
docker-compose up
```

## Examples by Complexity

### Simple Examples
- **todo-apollo** - Basic todo app with Apollo Client
- **todo-urql** - Basic todo app with URQL  
- **todo-react-query** - Basic todo app with React Query

### Medium Examples
- **blog-nestjs-relay** - Blog with NestJS backend and Relay

## Features Demonstrated

### By Example

| Feature | todo-apollo | todo-urql | todo-react-query | blog-nestjs-relay |
|---------|-------------|-----------|------------------|-------------------|
| Basic Cascade | ✅ | ✅ | ✅ | ✅ |
| Relationships | - | - | - | ✅ |
| Optimistic Updates | ✅ | - | - | - |
| Subscriptions | - | - | - | - |
| SSR | - | - | - | - |

## Schema Examples

Reference GraphQL schemas demonstrating different Cascade patterns:

- `schema_simple_crud.graphql` - Basic CRUD operations with cascade compliance
- `schema_nested_entities.graphql` - Cascading through nested entity relationships
- `schema_many_to_many.graphql` - Cascade handling for many-to-many relationships
- `schema_custom_actions.graphql` - Custom business logic actions with cascade support

## Server Implementation Examples

- `server_apollo.ts` - Node.js/Apollo Server implementation
- `server_strawberry.py` - Python/FraiseQL server implementation

## Learn More

- [GraphQL Cascade Documentation](../docs/)
- [Server Package](../packages/server-node/)
- [Apollo Client Package](../packages/client-apollo/)
