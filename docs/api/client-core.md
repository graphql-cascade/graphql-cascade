# Client Core API

Core client types and interfaces.

## Cascade Types

### Cascade

```typescript
interface Cascade {
  created: EntityRef[];
  updated: EntityRef[];
  deleted: EntityRef[];
  invalidated: InvalidationRef[];
}
```

### EntityRef

```typescript
interface EntityRef {
  __typename: string;
  id: string;
}
```

### InvalidationRef

```typescript
interface InvalidationRef {
  __typename: string;
  field?: string;
}
```

## Cache Interface

### CascadeCache

```typescript
interface CascadeCache {
  write(key: string, data: any): void;
  merge(key: string, data: any): void;
  delete(key: string): void;
  invalidate(typename: string, field?: string): void;
}
```

## Processing

### processCascade

```typescript
function processCascade(
  cache: CascadeCache,
  cascade: Cascade,
  options?: ProcessOptions
): void;

interface ProcessOptions {
  debug?: boolean;
  onError?: (error: Error) => void;
}
```

## Utilities

### getCacheKey

```typescript
function getCacheKey(ref: EntityRef): string;
// Returns: "TypeName:id"
```

### parseCacheKey

```typescript
function parseCacheKey(key: string): EntityRef;
// Parses: "TypeName:id" -> { __typename: "TypeName", id: "id" }
```

## Next Steps

- **[Server Node API](/api/server-node)** - Server types
- **[Client Guides](/clients/)** - Usage examples
