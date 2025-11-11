# API Reference

This directory contains comprehensive API documentation for GraphQL Cascade implementations.

## Server APIs

- **[Server API](server-api.md)** - Complete reference for server-side GraphQL Cascade implementation
- **[Directives](directives.md)** - GraphQL directive reference for cascade configuration

## Client APIs

- **[Client API](client-api.md)** - Universal client API for all supported frameworks

## Framework-Specific APIs

- **Apollo Client**: Integrated with Apollo's normalized cache
- **React Query**: Query invalidation and entity updates
- **URQL**: Cache adapter implementation
- **Relay**: Environment integration

## Quick Reference

### Server Directives

```graphql
type Mutation {
  createTodo(input: CreateTodoInput!): Todo
    @cascade(
      updates: ["Todo"],
      invalidates: ["Query.todos"]
    )
}
```

### Client Usage

```typescript
// Apollo Client
const result = await cascade.mutate(CREATE_TODO, variables);

// React Query
const mutation = useCascadeMutation(cascade, CREATE_TODO);
```

## Implementation Details

For detailed implementation guides, see:
- [Server Implementation](../guides/server-implementation.md)
- [Client Integration](../guides/client-integration.md)

## Contributing

API documentation is automatically generated from code. To update:
1. Update the implementation code
2. Run the documentation generation script
3. Submit a pull request