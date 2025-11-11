# Conformance

This document defines the requirements for GraphQL Cascade compliance.

## Conformance Levels

### Cascade Basic (Minimum Viable)
A server/library is **Cascade Basic compliant** if it implements:

- [ ] All core interfaces and types
- [ ] CascadeResponse structure in mutation responses
- [ ] Entity update tracking for primary mutation results
- [ ] Basic cache invalidation hints

### Cascade Standard (Recommended)
A server/library is **Cascade Standard compliant** if it implements Cascade Basic plus:

- [ ] Cascade depth control
- [ ] Relationship traversal
- [ ] Structured error handling
- [ ] Transaction metadata

### Cascade Complete (Full Featured)
A server/library is **Cascade Complete compliant** if it implements Cascade Standard plus:

- [ ] Optimistic updates protocol
- [ ] Real-time subscriptions integration
- [ ] Conflict resolution
- [ ] Analytics hooks

## Server Conformance Requirements

### Schema Requirements

All Cascade-compliant GraphQL schemas MUST:

1. **Implement Base Interfaces**
   ```graphql
   interface Node {
     id: ID!
   }

   interface CascadeResponse {
     success: Boolean!
     errors: [CascadeError!]
     data: MutationPayload
     cascade: CascadeUpdates!
   }
   ```

2. **Use Standardized Mutation Response Types**
   - All mutations MUST return types implementing `CascadeResponse`
   - Response type names MUST follow pattern: `{Verb}{EntityType}Cascade`

3. **Include Required Types**
   - `CascadeUpdates`
   - `UpdatedEntity`
   - `DeletedEntity`
   - `QueryInvalidation`
   - `CascadeError`
   - `CascadeMetadata`

### Runtime Requirements

Cascade-compliant servers MUST:

1. **Track Entity Changes**
   - Track all entities modified during mutation execution
   - Include primary result and related entities
   - Respect cascade depth limits

2. **Generate Invalidation Hints**
   - Compute which queries may be affected by changes
   - Include appropriate invalidation strategies

3. **Maintain Transaction Consistency**
   - Cascade data reflects committed transaction state
   - No phantom entities in cascade response

## Client Conformance Requirements

### Generic Client Requirements

Cascade-compliant clients MUST:

1. **Implement CascadeCache Interface**
   ```typescript
   interface CascadeCache {
     write(typename: string, id: string, data: any): void;
     read(typename: string, id: string): any | null;
     evict(typename: string, id: string): void;
     invalidate(invalidation: QueryInvalidation): void;
     refetch(invalidation: QueryInvalidation): Promise<void>;
     remove(invalidation: QueryInvalidation): void;
     identify(entity: any): string;
   }
   ```

2. **Apply Cascade Responses**
   - Process all `updated` entities
   - Process all `deleted` entities
   - Apply all `invalidations`

3. **Handle Errors Gracefully**
   - Continue processing cascade even if individual operations fail
   - Log errors appropriately

### Framework-Specific Requirements

#### Apollo Client Integration
- MUST use `InMemoryCache` with proper normalization
- MUST implement cache writes using `cache.writeFragment`
- SHOULD support optimistic updates

#### Relay Integration
- MUST use Relay's normalized store
- MUST implement updates using `commitLocalUpdate`
- SHOULD integrate with Relay's mutation system

#### React Query Integration
- MUST update query data appropriately
- MUST implement invalidation using `invalidateQueries`
- SHOULD support optimistic updates

## Testing Conformance

### Compliance Test Suite

Implementations SHOULD pass the compliance test suite:

1. **Server Tests**
   - Entity tracking accuracy
   - Cascade structure validation
   - Invalidation hint correctness
   - Performance requirements

2. **Client Tests**
   - Cache update correctness
   - Invalidation behavior
   - Error handling
   - Optimistic update rollback

### Validation Tools

- **Schema Validator**: Validates GraphQL schema compliance
- **Response Validator**: Validates mutation response structure
- **Integration Tests**: End-to-end cascade functionality

## Version Compatibility

- **v0.1**: Initial specification
- Future versions MUST maintain backward compatibility
- Breaking changes require major version bump

## Implementation Notes

### Gradual Adoption
- Servers can implement Cascade alongside existing mutations
- Clients can opt-in to cascade processing
- Mixed environments supported during migration

### Performance Considerations
- Cascade responses SHOULD be bounded in size
- Servers MAY limit cascade depth to prevent excessive data
- Clients SHOULD process cascades asynchronously

### Security Considerations
- Cascade responses MUST NOT expose unauthorized data
- Servers MUST respect access controls in cascade computation
- Clients MUST validate cascade data before applying