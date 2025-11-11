# Migration Guide

This guide covers migrating existing GraphQL applications to use GraphQL Cascade.

## From Apollo Cache

### Before (Manual Cache Updates)

```javascript
const [createUser] = useMutation(CREATE_USER_MUTATION, {
  update: (cache, { data }) => {
    // Manual cache updates
    cache.modify({
      fields: {
        users(existingUsers = []) {
          return [...existingUsers, data.createUser];
        }
      }
    });
  }
});
```

### After (Automatic Cascades)

```javascript
const [createUser] = useMutation(CREATE_USER_MUTATION);
// Cache updates automatically via cascade data
```

## From Relay

### Before (Manual Connections)

```javascript
const [commit] = useMutation(CREATE_POST_MUTATION);
// Manual connection updates required
```

### After (Automatic Updates)

```javascript
const [commit] = useMutation(CREATE_POST_MUTATION);
// Connections update automatically
```

## Migration Steps

1. **Install GraphQL Cascade**
2. **Update server resolvers** to return cascade data
3. **Update client** to handle cascade responses
4. **Remove manual cache updates**
5. **Test thoroughly**

## Breaking Changes

- Mutations now return cascade data
- Manual cache updates are no longer needed
- Cache invalidation is automatic

## Compatibility

GraphQL Cascade is designed to be backward compatible with existing GraphQL implementations.