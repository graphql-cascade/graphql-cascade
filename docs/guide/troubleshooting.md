# Troubleshooting Guide

This guide covers common issues you may encounter when using GraphQL Cascade and how to resolve them.

## Common Issues

### 1. Cascade Data Not Appearing in Response

**Symptoms:**
- Mutation succeeds but the `cascade` field is empty or missing
- No entity updates are reflected in the cache

**Causes and Solutions:**

#### Tracker Not Started
The most common cause is forgetting to start a transaction before tracking entities.

```typescript
// Wrong - no transaction started
const tracker = new CascadeTracker();
tracker.trackCreate(user); // Error: No cascade transaction in progress

// Correct - start transaction first
const tracker = new CascadeTracker();
tracker.startTransaction();
tracker.trackCreate(user);
const cascadeData = tracker.endTransaction();
```

#### Plugin Not Registered
Ensure the cascade plugin is properly configured in your GraphQL server.

```typescript
// Apollo Server
import { createCascadePlugin } from '@graphql-cascade/server';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [createCascadePlugin()]
});
```

#### Response Not Wrapped Correctly
The response must include the cascade data in the correct format.

```typescript
// Wrong - cascade not included
return {
  success: true,
  data: user
};

// Correct - include cascade field
const builder = new CascadeBuilder(tracker);
return builder.buildResponse(user, true);
// Returns: { success, data, cascade: { updated, deleted, invalidations, metadata } }
```

---

### 2. Cache Not Updating After Mutation

**Symptoms:**
- UI doesn't reflect changes after mutation
- Manual page refresh is required to see updates
- Data appears stale

**Causes and Solutions:**

#### Entity Missing __typename or id
Entities must have both `__typename` and `id` for cache normalization.

```typescript
// Wrong - missing __typename
const user = {
  id: '123',
  name: 'John'
};
tracker.trackUpdate(user); // May not update cache correctly

// Correct - include __typename
const user = {
  __typename: 'User',
  id: '123',
  name: 'John'
};
tracker.trackUpdate(user);
```

#### Cache Normalization Misconfigured
Ensure your client's cache is configured to use the same ID format.

```typescript
// Apollo Client
const cache = new InMemoryCache({
  typePolicies: {
    User: {
      keyFields: ['id'] // Must match cascade entity format
    }
  }
});
```

#### Invalidation Not Processed
Check that cascade invalidations are being processed by your client.

```typescript
// Check cascade response includes invalidations
console.log(response.cascade.invalidations);
// Should show: [{ __typename: 'Query', field: 'users' }]
```

---

### 3. Transaction Errors

**Symptoms:**
- "No cascade transaction in progress" error
- "Transaction already in progress" error

**Causes and Solutions:**

#### No Transaction Started

```typescript
// Wrong
tracker.trackCreate(entity); // Error!

// Correct
tracker.startTransaction();
tracker.trackCreate(entity);
```

#### Transaction Already Active

```typescript
// Wrong - starting when already active
tracker.startTransaction();
tracker.trackCreate(entity1);
tracker.startTransaction(); // Error: Transaction already in progress

// Correct - end before starting new
tracker.startTransaction();
tracker.trackCreate(entity1);
tracker.endTransaction();
tracker.startTransaction();
tracker.trackCreate(entity2);
tracker.endTransaction();
```

#### Transaction Not Ended Properly
Always ensure transactions are ended, even in error cases.

```typescript
try {
  tracker.startTransaction();
  // ... operations
  return builder.buildResponse(result, true);
} catch (error) {
  // Still need to clean up transaction
  return builder.buildErrorResponse([{
    message: error.message,
    code: 'INTERNAL_ERROR'
  }]);
}
```

---

### 4. Circular Reference Errors

**Symptoms:**
- "Maximum call stack exceeded" error
- Infinite loop in relationship tracking
- Very slow response times

**Causes and Solutions:**

#### Bi-directional Relationships
Entities that reference each other can cause infinite loops.

```typescript
// Problem: User -> Posts -> User -> Posts...
const user = {
  __typename: 'User',
  id: '1',
  posts: [{ author: user }] // Circular!
};

// Solution 1: Limit traversal depth
const tracker = new CascadeTracker({
  maxDepth: 2 // Stop after 2 levels
});

// Solution 2: Exclude problematic types
const tracker = new CascadeTracker({
  excludeTypes: ['Post'] // Don't traverse posts
});
```

#### Self-Referential Entities

```typescript
// Problem: Category -> ParentCategory -> ParentCategory...
const category = {
  __typename: 'Category',
  id: '1',
  parent: { parent: { parent: /* ... */ } }
};

// Solution: Configure maxDepth
const tracker = new CascadeTracker({
  maxDepth: 3
});
```

---

### 5. Memory Issues with Large Cascades

**Symptoms:**
- High memory usage on server
- Slow response times
- Out of memory errors

**Causes and Solutions:**

#### Too Many Entities Tracked

```typescript
// Solution 1: Limit total entities
const tracker = new CascadeTracker({
  maxEntities: 500 // Default is 1000
});

// Solution 2: Limit related entities per entity
const tracker = new CascadeTracker({
  maxRelatedPerEntity: 50 // Default is 100
});
```

#### Use Streaming Builder for Large Operations

```typescript
import { StreamingCascadeBuilder } from '@graphql-cascade/server';

const builder = new StreamingCascadeBuilder(tracker, invalidator, {
  maxUpdatedEntities: 100,
  maxDeletedEntities: 50
});

return builder.buildStreamingResponse(result, true);
```

#### Disable Relationship Tracking for Bulk Operations

```typescript
// For imports/migrations, skip relationship traversal
const tracker = new CascadeTracker({
  enableRelationshipTracking: false
});
```

---

### 6. Entity Serialization Errors

**Symptoms:**
- Some entities missing from cascade response
- "Cannot serialize entity" errors
- `serializationErrors` in metadata is non-zero

**Causes and Solutions:**

#### Entity Has Non-Serializable Properties

```typescript
// Problem: functions, symbols, circular refs
const entity = {
  id: '1',
  __typename: 'User',
  callback: () => {}, // Can't serialize
  private: Symbol('secret') // Can't serialize
};

// Solution 1: Use toDict method
const entity = {
  id: '1',
  __typename: 'User',
  callback: () => {},
  toDict() {
    return { id: this.id, __typename: this.__typename };
  }
};

// Solution 2: Handle serialization errors
const tracker = new CascadeTracker({
  onSerializationError: (entity, error) => {
    console.warn('Failed to serialize:', entity.id, error);
  }
});
```

---

### 7. Optimistic Updates Not Rolling Back

**Symptoms:**
- Optimistic UI changes persist after server error
- Cache shows stale/incorrect data after failed mutation

**Causes and Solutions:**

#### Optimistic Response Format Mismatch

```typescript
// Wrong - optimistic response doesn't match actual response
const optimisticResponse = {
  updateUser: {
    id: '1',
    name: 'Updated'
  }
};

// Correct - include full cascade structure
const optimisticResponse = {
  updateUser: {
    success: true,
    data: { id: '1', name: 'Updated', __typename: 'User' },
    cascade: {
      updated: [{ __typename: 'User', id: '1', operation: 'UPDATED', entity: { name: 'Updated' } }],
      deleted: [],
      invalidations: [],
      metadata: { timestamp: new Date().toISOString(), affectedCount: 1 }
    }
  }
};
```

---

### 8. Query Invalidation Not Working

**Symptoms:**
- Queries don't refetch after mutation
- Stale data displayed in UI

**Causes and Solutions:**

#### Invalidator Not Configured

```typescript
// Wrong - no invalidator
const builder = new CascadeBuilder(tracker);

// Correct - pass invalidator
const invalidator = {
  computeInvalidations(updated, deleted, result) {
    return [{ __typename: 'Query', field: 'users', reason: 'User modified' }];
  }
};
const builder = new CascadeBuilder(tracker, invalidator);
```

#### Query Key Mismatch

```typescript
// React Query: ensure query keys match invalidation patterns
const { data } = useQuery({
  queryKey: ['users', { status: 'active' }], // Specific key
  queryFn: fetchUsers
});

// Invalidation must match the key pattern
cascade: {
  invalidations: [{
    queryName: 'users',
    scope: 'PREFIX' // Invalidates all 'users*' queries
  }]
}
```

---

## Debug Logging

### Enable Debug Mode

```typescript
// Server-side
const tracker = new CascadeTracker({
  // Enable verbose logging
});

// After tracking, check metadata
const response = builder.buildResponse(result, true);
console.log('Cascade metadata:', response.cascade.metadata);
// Shows: { transactionId, timestamp, depth, affectedCount, trackingTime }
```

### Inspect Cascade Responses

```typescript
// Server-side middleware
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body.data?.cascade) {
      console.log('Cascade response:', JSON.stringify(body.data.cascade, null, 2));
    }
    return originalJson(body);
  };
  next();
});
```

### Client-Side Debug Logging

```typescript
// Apollo Client
const cascadeLink = createCascadeLink({
  debug: true, // Logs all cascade operations
  onCascade: (cascade) => {
    console.log('Processing cascade:', cascade);
    console.log('Updated:', cascade.updated.length, 'entities');
    console.log('Deleted:', cascade.deleted.length, 'entities');
    console.log('Invalidated:', cascade.invalidations.length, 'queries');
  }
});

// React Query
const cascadeClient = createCascadeClient({
  endpoint: '/graphql',
  queryClient,
  cascade: {
    debug: true,
    onCascade: (cascade) => {
      console.log('Cascade processed:', cascade);
    }
  }
});
```

### Check Cascade Metadata

```typescript
// Response metadata provides diagnostic information
{
  cascade: {
    metadata: {
      transactionId: 'cascade_1234567890_abc123',
      timestamp: '2024-01-01T00:00:00.000Z',
      depth: 2,                    // Relationship traversal depth
      affectedCount: 15,           // Total entities tracked
      trackingTime: 5,             // ms spent tracking
      constructionTime: 2,         // ms spent building response
      truncatedUpdated: false,     // true if entity limit hit
      truncatedDeleted: false,
      serializationErrors: 0       // Number of entities that failed to serialize
    }
  }
}
```

---

## Frequently Asked Questions

### Q: Why are some entities missing from the cascade?

**A:** Entities may be missing for several reasons:
1. They exceed the `maxEntities` limit (check `metadata.truncatedUpdated`)
2. They're in the `excludeTypes` list
3. They're beyond `maxDepth` in relationship traversal
4. They failed serialization (check `metadata.serializationErrors`)
5. They don't have an `id` field

### Q: How do I exclude certain types from tracking?

**A:** Use the `excludeTypes` configuration:

```typescript
const tracker = new CascadeTracker({
  excludeTypes: ['AuditLog', 'Metric', 'SystemEvent']
});
```

### Q: Can I use cascade with GraphQL subscriptions?

**A:** Yes, subscriptions can include cascade data. Configure your subscription manager:

```typescript
// Apollo Client
const subscriptionManager = new CascadeSubscriptionManager(cascadeClient, apolloClient);

subscriptionManager.subscribeToEntity('Todo', TODO_SUBSCRIPTION, {
  onCascade: (cascade) => {
    // Cache updates automatically applied
  }
});
```

### Q: What's the performance overhead of cascade tracking?

**A:** Typical overhead is minimal:
- Memory: ~1KB per tracked entity
- CPU: O(n × d) where n = entities, d = depth
- Response size: 1-5KB for typical mutations

Monitor with metadata:
```typescript
console.log('Tracking time:', response.cascade.metadata.trackingTime, 'ms');
console.log('Construction time:', response.cascade.metadata.constructionTime, 'ms');
```

### Q: How do I test cascade behavior?

**A:** Use mock responses in tests:

```typescript
// Jest example
const mockCascade = {
  updated: [{ __typename: 'User', id: '1', operation: 'UPDATED', entity: { name: 'Test' } }],
  deleted: [],
  invalidations: [],
  metadata: { timestamp: new Date().toISOString(), affectedCount: 1 }
};

const mockResponse = {
  success: true,
  data: { id: '1', name: 'Test' },
  cascade: mockCascade
};
```

### Q: How do I handle cascade errors gracefully?

**A:** Use error handlers in configuration:

```typescript
const tracker = new CascadeTracker({
  onSerializationError: (entity, error) => {
    logger.warn('Serialization failed', { entityId: entity.id, error: error.message });
    // Entity will be skipped but operation continues
  }
});

const builder = new CascadeBuilder(tracker, invalidator, {
  onInvalidationError: (error) => {
    logger.warn('Invalidation computation failed', { error: error.message });
    // Response will include empty invalidations
  }
});
```

### Q: Can I use cascade with batched mutations?

**A:** Yes, track all changes in a single transaction:

```typescript
tracker.startTransaction();

for (const user of usersToUpdate) {
  await updateUserInDb(user);
  tracker.trackUpdate(user);
}

return builder.buildResponse(usersToUpdate, true);
// Single cascade with all updates
```

---

## Next Steps

- **[Performance Optimization](/guide/performance)** - Tuning cascade for large-scale applications
- **[Server Setup](/server/)** - Detailed server configuration
- **[Client Integration](/clients/)** - Framework-specific guides
- **[API Reference](/api/)** - Complete API documentation
