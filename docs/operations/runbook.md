# Operations Runbook

Running `@graphql-cascade/server` in production.

## Metrics

Give trackers a `DefaultMetricsCollector` and expose `exportPrometheusMetrics(metrics)` on a metrics endpoint (see [Observability](/server/node#observability)). It exports:

| Metric | Type | Watch for |
|--------|------|-----------|
| `cascade_transactions_started_total`, `_completed_total`, `_failed_total` | Counters | Failures: tracking or building errors |
| `cascade_entities_tracked_total` | Counter | Growth out of line with traffic |
| `cascade_entities_truncated_total` | Counter | Frequent truncation: limits too low, or traversal too wide |
| `cascade_active_transactions` | Gauge | A value that keeps rising: transactions started and never ended |
| `cascade_tracking_duration_ms`, `cascade_construction_duration_ms` | Summaries (p50, p95, p99) | Slow tracking: deep or wide relationship traversal |
| `cascade_response_size` | Summary | Payloads approaching `maxResponseSizeMb` |

Example alerts:

```yaml
groups:
  - name: graphql-cascade
    rules:
      - alert: CascadeSlowTracking
        expr: cascade_tracking_duration_ms{quantile="0.99"} > 500
        for: 5m
      - alert: CascadeFailures
        expr: rate(cascade_transactions_failed_total[5m]) / rate(cascade_transactions_started_total[5m]) > 0.05
        for: 5m
      - alert: CascadeTransactionLeak
        expr: cascade_active_transactions > 100
        for: 10m
```

`createHealthCheck(metrics)` returns `healthy`, `degraded` or `unhealthy` from the same metrics, for a health endpoint.

## Symptoms

### Slow Mutations

Tracking time grows with relationship traversal. Lower `maxDepth` or `maxRelatedPerEntity`, exclude types no query reads with `excludeTypes`, or turn off `enableRelationshipTracking` for bulk mutations and hint their lists instead.

### Active Transactions Keep Rising

A transaction was started and never ended, usually on an error path. Build a response on every path, `buildErrorResponse` included, or call `resetTransactionState()`:

```typescript
import { CascadeErrorCode } from "@graphql-cascade/server";

tracker.startTransaction();
try {
  const result = await runMutation(tracker);
  return builder.buildResponse(result);
} catch (error) {
  logger.error(error);
  return builder.buildErrorResponse([
    { message: "Internal error", code: CascadeErrorCode.INTERNAL_ERROR },
  ]);
}
```

Use one tracker per mutation; the integrations create one per request.

### Truncation Is Frequent

`metadata.truncated` is `true` and `cascade_entities_truncated_total` climbs. Clients stay correct, invalidating the truncated types, but refetch more. Raise the builder limits if payload size allows, or reduce what is tracked.

### Clients Show Stale Data

See [Troubleshooting](/guide/troubleshooting#the-cache-doesn-t-update): usually fields missing from the mutation's `entity` selection, or lists without invalidation hints.

## Emergency Measures

### Shed Tracking Load

Read limits from the environment so they can be lowered without a release:

```typescript
const tracker = new CascadeTracker({
  maxDepth: Number(process.env.CASCADE_MAX_DEPTH ?? 3),
  maxEntities: Number(process.env.CASCADE_MAX_ENTITIES ?? 1000),
  enableRelationshipTracking: process.env.CASCADE_RELATIONSHIPS !== "off",
});
```

Lower limits produce more truncation, which clients handle by invalidating types.

### Turn Tracking Off

Never answer with an empty cascade to save work: an empty cascade tells clients nothing changed, and their caches go stale. To stop tracking entirely, tell clients to invalidate everything:

```typescript
import { InvalidationScope, InvalidationStrategy } from "@graphql-cascade/server";

if (process.env.CASCADE_TRACKING === "off") {
  return {
    success: true,
    errors: [],
    data: result,
    cascade: {
      updated: [],
      deleted: [],
      invalidations: [{ strategy: InvalidationStrategy.INVALIDATE, scope: InvalidationScope.ALL }],
      typeInvalidations: [],
      metadata: { timestamp: new Date().toISOString(), depth: 0, affectedCount: 0, truncated: true },
    },
  };
}
```

Clients then refetch queries as they are read: correct, and costlier than tracking.
