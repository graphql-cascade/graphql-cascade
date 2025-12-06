# Security Best Practices

## Entity Data Exposure

### Problem
Cascade responses include full entity data, which may expose sensitive fields.

### Solution: Field Filtering
```typescript
const tracker = new CascadeTracker({
  fieldFilter: (typename, fieldName, value) => {
    // Never expose these fields
    const sensitiveFields = ['password', 'passwordHash', 'ssn', 'creditCard', 'apiKey', 'secret'];
    return !sensitiveFields.includes(fieldName);
  }
});
```

### Solution: Type-Level Exclusion (Already Available)
```typescript
const tracker = new CascadeTracker({
  excludeTypes: ['AuditLog', 'Session', 'ApiKey', 'InternalMetric']
});
```

### Solution: Entity Transformation
```typescript
const tracker = new CascadeTracker({
  transformEntity: (entity) => {
    // Mask email addresses
    if ('email' in entity && typeof entity.email === 'string') {
      const [local, domain] = entity.email.split('@');
      return {
        ...entity,
        email: `${local[0]}***@${domain}`
      };
    }
    return entity;
  }
});
```

## Rate Limiting

### Problem
Large cascades can consume significant resources.

### Solution: Response Size Limits (Already Available)
```typescript
const builder = new CascadeBuilder(tracker, null, {
  maxUpdatedEntities: 100,  // Default: 500
  maxDeletedEntities: 50,   // Default: 100
  maxResponseSizeMb: 1      // Default: 5
});
```

### Solution: Tracker-Level Limits (Already Available)
```typescript
const tracker = new CascadeTracker({
  maxEntities: 500,          // Default: 1000
  maxRelatedPerEntity: 50,   // Default: 100
  maxDepth: 2                // Default: 3
});
```

## Authorization

### Problem
Cascade may include entities the user isn't authorized to see.

### Solution: Authorization Filter
```typescript
const tracker = new CascadeTracker({
  entityFilter: async (entity, context) => {
    const user = (context as any)?.user;
    if (!user) return false;

    // Check authorization - supports both sync and async
    return await authService.canView(user, entity.__typename, entity.id);
  }
});

// Set context before tracking entities
tracker.setContext({ user: currentUser });

// Use async methods to properly handle async entityFilter
tracker.startTransaction();
// ... track entities ...
const cascadeData = await tracker.endTransactionAsync();
```

**Note on Async Entity Filters:**
- Use `endTransactionAsync()` or `getCascadeDataAsync()` when using async `entityFilter`
- Synchronous methods (`endTransaction()`, `getCascadeData()`) will log a warning if async filters are detected
- Context is passed to `entityFilter` via `setContext()` method

**Synchronous Filtering (for simple cases):**
```typescript
const tracker = new CascadeTracker({
  entityFilter: (entity, context) => {
    // Sync filtering - no async/await needed
    const userRole = (context as any)?.userRole;
    return userRole === 'admin' || entity.ownerId === (context as any)?.userId;
  }
});

tracker.setContext({ userRole: 'user', userId: 123 });
tracker.startTransaction();
// ... track entities ...
const cascadeData = tracker.endTransaction(); // Can use sync method
```

## Information Disclosure

### Problem
Cascade metadata may reveal system internals (timing, transaction IDs).

### Solution: Minimal Metadata in Production
```typescript
const builder = new CascadeBuilder(tracker, null, {
  includeTimingMetadata: process.env.NODE_ENV !== 'production',
  includeTransactionId: process.env.NODE_ENV !== 'production'
});
```

## Input Validation

### Problem
Malicious or malformed entities could cause tracking issues or security vulnerabilities.

### Solution: Entity Validation
```typescript
const tracker = new CascadeTracker({
  validateEntity: (entity) => {
    if (!entity.id) {
      throw new Error('Entity must have an id');
    }
    if (typeof entity.id !== 'string' && typeof entity.id !== 'number') {
      throw new Error('Entity id must be string or number');
    }
    if (entity.__typename && typeof entity.__typename !== 'string') {
      throw new Error('Entity __typename must be a string');
    }
    // Prevent prototype pollution - check for explicit dangerous properties
    if (Object.prototype.hasOwnProperty.call(entity, 'prototype')) {
      throw new Error('Entity contains forbidden properties');
    }
  }
});
```

## Security Checklist

- [ ] Sensitive fields are filtered via `fieldFilter`
- [ ] Internal types are excluded via `excludeTypes`
- [ ] Response size limits are configured appropriately
- [ ] Authorization checks are implemented for multi-tenant systems
- [ ] Timing metadata is disabled in production
- [ ] Entity validation is enabled to prevent malformed data
- [ ] Rate limiting is applied at the application layer

## Serialization Error Handling

Handle serialization errors to prevent information leakage:

```typescript
const tracker = new CascadeTracker({
  onSerializationError: (entity, error) => {
    // Log internally but don't expose details
    logger.error('Entity serialization failed', {
      typename: entity.__typename,
      id: entity.id,
      // Don't log the full entity or error stack in production
    });
  }
});
```

## Network Security

### TLS
Always use HTTPS in production to protect cascade data in transit.

### Response Headers
Consider adding security headers to responses containing cascade data:
- `X-Content-Type-Options: nosniff`
- `Cache-Control: no-store` (if cascade contains sensitive data)

### CORS
If cascade data is accessed cross-origin, configure CORS appropriately:
```typescript
app.use(cors({
  origin: ['https://your-app.com'],
  credentials: true
}));
```
