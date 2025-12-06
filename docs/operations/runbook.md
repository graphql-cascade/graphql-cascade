# GraphQL Cascade Operations Runbook

## Overview

This runbook provides guidance for operating GraphQL Cascade in production environments.

## Monitoring

### Key Metrics

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| `cascade_tracking_duration_ms{quantile="0.99"}` | >100ms | >500ms | Review maxDepth, check for complex entity graphs |
| `cascade_response_size{quantile="0.99"}` | >100KB | >1MB | Enable truncation, review maxEntities limits |
| `cascade_transactions_failed_total` (rate) | >1% | >5% | Check error logs, review entity serialization |
| `cascade_entities_truncated_total` (rate) | >10% | >25% | Increase limits or optimize queries |
| `cascade_active_transactions` | >100 | >500 | Check for transaction leaks, review concurrency |

### Example Prometheus Alert Rules

```yaml
# prometheus/alerts/cascade.yml
groups:
  - name: graphql-cascade
    rules:
      - alert: CascadeHighLatency
        expr: |
          histogram_quantile(0.99,
            rate(cascade_tracking_duration_ms_bucket[5m])
          ) > 500
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High cascade tracking latency (p99 > 500ms)"
          runbook_url: "https://docs.example.com/runbook#high-latency"

      - alert: CascadeHighErrorRate
        expr: |
          rate(cascade_transactions_failed_total[5m]) /
          rate(cascade_transactions_started_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Cascade error rate > 5%"

      - alert: CascadeTransactionLeak
        expr: cascade_active_transactions > 100
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Possible transaction leak - active transactions stuck high"
```

### Grafana Dashboard

See `examples/grafana-dashboard.json` for a pre-built dashboard including:
- Transaction rate and error rate
- Latency percentiles (p50, p95, p99)
- Entity counts and truncation rate
- Active transactions gauge

## Troubleshooting

### Symptom: Cascade responses are slow

**Diagnosis:**
1. Check `cascade.metadata.trackingTime` in responses
2. Review `maxDepth` configuration - deep traversals are expensive
3. Look for entities with many relationships

**Resolution:**
```typescript
// Reduce depth for faster responses
const tracker = new CascadeTracker({
  maxDepth: 2,  // Reduce from default 3
  maxRelatedPerEntity: 50  // Limit breadth
});
```

### Symptom: Memory usage increasing over time

**Diagnosis:**
1. Check for transaction leaks (transactions started but never ended)
2. Review entity limits - large entities consume memory
3. Check for circular references in entity graphs

**Resolution:**
```typescript
// Ensure transactions are always ended
try {
  tracker.startTransaction();
  // ... mutations
  return builder.buildResponse(result);
} catch (error) {
  tracker.resetTransactionState();  // Clean up on error
  throw error;
}
```

### Symptom: Entities missing from cascade

**Diagnosis:**
1. Check if type is in `excludeTypes`
2. Verify entity has `id` and `__typename`
3. Check if entity limit was reached (`metadata.truncatedUpdated`)
4. Enable debug logging

**Resolution:**
```typescript
const tracker = new CascadeTracker({
  debug: true,  // Enable logging
  maxEntities: 2000  // Increase if needed
});
```

### Symptom: Client cache not updating

**Diagnosis:**
1. Verify cascade data in network response
2. Check entity `__typename` matches schema exactly
3. Check entity `id` format matches cache key
4. Enable client debug logging

**Resolution:**
- Ensure `__typename` is consistent between queries and cascade
- Verify ID serialization (string vs number)

## Emergency Procedures

### Disable Cascade (Feature Flag)

```typescript
const ENABLE_CASCADE = process.env.ENABLE_CASCADE !== 'false';

// In your middleware/resolver
if (!ENABLE_CASCADE) {
  return {
    success: true,
    data: result,
    cascade: {
      updated: [],
      deleted: [],
      invalidations: [],
      metadata: { timestamp: new Date().toISOString(), depth: 0, affectedCount: 0 }
    }
  };
}
```

### Reduce Cascade Scope (Runtime)

```bash
# Environment variables for emergency throttling
export CASCADE_MAX_DEPTH=1
export CASCADE_MAX_ENTITIES=50
export CASCADE_DISABLE_RELATIONSHIPS=true
```

```typescript
// Read from environment
const tracker = new CascadeTracker({
  maxDepth: parseInt(process.env.CASCADE_MAX_DEPTH ?? '3'),
  maxEntities: parseInt(process.env.CASCADE_MAX_ENTITIES ?? '1000'),
  enableRelationshipTracking: process.env.CASCADE_DISABLE_RELATIONSHIPS !== 'true'
});
```

### Graceful Degradation

Cascade is backward compatible. Clients receiving empty or minimal cascade data will:
- Continue to function normally
- Fall back to refetching queries if cache is stale
- Not experience errors (cascade is additive optimization)

## Capacity Planning

### Memory Usage

Approximate memory per tracked entity: ~2KB (varies with entity size)

| Max Entities | Peak Memory (approx) |
|-------------|---------------------|
| 100 | ~200KB |
| 500 | ~1MB |
| 1000 | ~2MB |
| 5000 | ~10MB |

### Response Size

Approximate response size per entity: ~500 bytes - 2KB

Configure `maxResponseSizeMb` based on:
- Network bandwidth constraints
- Client parsing performance
- CDN/proxy body size limits
