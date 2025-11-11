# Debugging GraphQL Cascade

This guide covers debugging techniques and tools for GraphQL Cascade implementations.

## Common Issues

### Cascade Not Triggering

**Symptoms:**
- Mutations succeed but cache doesn't update
- No cascade data in response

**Debugging Steps:**
1. Check cascade tracking is enabled
2. Verify entity relationships are defined
3. Inspect mutation response for cascade field

### Incorrect Invalidations

**Symptoms:**
- Wrong data being invalidated
- Cache updates for unrelated entities

**Debugging Steps:**
1. Review cascade calculation logic
2. Check entity identification
3. Validate relationship mappings

## Debugging Tools

### Logging

Enable detailed cascade logging:

```python
import logging
logging.getLogger('graphql_cascade').setLevel(logging.DEBUG)
```

### Cascade Inspector

Use the cascade inspector to visualize cascade flow:

```javascript
const inspector = new CascadeInspector();
inspector.onCascade((cascade) => {
  console.log('Cascade triggered:', cascade);
});
```

## Performance Debugging

### Identifying Bottlenecks

1. **Measure cascade calculation time**
2. **Count invalidation operations**
3. **Monitor memory usage**

### Optimization Techniques

1. **Batch invalidations**
2. **Lazy cascade evaluation**
3. **Cache cascade results**

## Client-Side Debugging

### Apollo Client

```javascript
const client = new ApolloClient({
  // Enable cascade debugging
  cascade: {
    debug: true,
    logInvalidations: true
  }
});
```

### Relay

```javascript
const environment = new Environment({
  // Enable cascade debugging
  cascade: {
    debug: true
  }
});
```