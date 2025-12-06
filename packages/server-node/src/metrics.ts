/**
 * GraphQL Cascade Metrics Collection
 *
 * Provides observability for cascade operations through a type-safe metrics API.
 */

/**
 * Counter metrics for cumulative values.
 */
export type CounterMetric =
  | 'transactionsStarted'
  | 'transactionsCompleted'
  | 'transactionsFailed'
  | 'entitiesTracked'
  | 'entitiesTruncated';

/**
 * Gauge metrics for point-in-time values.
 */
export type GaugeMetric = 'activeTransactions';

/**
 * Histogram metrics for distribution tracking.
 */
export type HistogramMetric =
  | 'trackingTimeMs'
  | 'constructionTimeMs'
  | 'cascadeSize';

/**
 * Snapshot of all cascade metrics.
 */
export interface CascadeMetricsSnapshot {
  // Counters
  transactionsStarted: number;
  transactionsCompleted: number;
  transactionsFailed: number;
  entitiesTracked: number;
  entitiesTruncated: number;

  // Gauges
  activeTransactions: number;

  // Histograms (recent values for local collector)
  trackingTimeMs: number[];
  constructionTimeMs: number[];
  cascadeSize: number[];
}

/**
 * Interface for collecting cascade metrics.
 */
export interface MetricsCollector {
  /**
   * Increment a counter metric.
   */
  increment(metric: CounterMetric, value?: number): void;

  /**
   * Set a gauge metric value.
   */
  gauge(metric: GaugeMetric, value: number): void;

  /**
   * Record a histogram value.
   */
  histogram(metric: HistogramMetric, value: number): void;

  /**
   * Get a snapshot of all current metrics.
   */
  getSnapshot(): CascadeMetricsSnapshot;

  /**
   * Reset all metrics to initial state.
   */
  reset(): void;
}

/**
 * Default in-memory metrics collector.
 */
export class DefaultMetricsCollector implements MetricsCollector {
  private counters: Record<CounterMetric, number> = {
    transactionsStarted: 0,
    transactionsCompleted: 0,
    transactionsFailed: 0,
    entitiesTracked: 0,
    entitiesTruncated: 0,
  };

  private gauges: Record<GaugeMetric, number> = {
    activeTransactions: 0,
  };

  private histograms: Record<HistogramMetric, number[]> = {
    trackingTimeMs: [],
    constructionTimeMs: [],
    cascadeSize: [],
  };

  private maxHistogramSize = 1000;

  increment(metric: CounterMetric, value = 1): void {
    this.counters[metric] += value;
  }

  gauge(metric: GaugeMetric, value: number): void {
    this.gauges[metric] = value;
  }

  histogram(metric: HistogramMetric, value: number): void {
    const arr = this.histograms[metric];
    arr.push(value);
    if (arr.length > this.maxHistogramSize) {
      arr.shift();
    }
  }

  getSnapshot(): CascadeMetricsSnapshot {
    return {
      ...this.counters,
      ...this.gauges,
      trackingTimeMs: [...this.histograms.trackingTimeMs],
      constructionTimeMs: [...this.histograms.constructionTimeMs],
      cascadeSize: [...this.histograms.cascadeSize],
    };
  }

  reset(): void {
    (Object.keys(this.counters) as CounterMetric[]).forEach(
      (k) => (this.counters[k] = 0)
    );
    (Object.keys(this.gauges) as GaugeMetric[]).forEach(
      (k) => (this.gauges[k] = 0)
    );
    (Object.keys(this.histograms) as HistogramMetric[]).forEach(
      (k) => (this.histograms[k] = [])
    );
  }
}

/**
 * Export metrics in Prometheus text format.
 */
export function exportPrometheusMetrics(collector: MetricsCollector): string {
  const snapshot = collector.getSnapshot();
  const lines: string[] = [];

  // Counters
  lines.push(
    '# HELP cascade_transactions_started_total Total cascade transactions started'
  );
  lines.push('# TYPE cascade_transactions_started_total counter');
  lines.push(`cascade_transactions_started_total ${snapshot.transactionsStarted}`);

  lines.push(
    '# HELP cascade_transactions_completed_total Total cascade transactions completed'
  );
  lines.push('# TYPE cascade_transactions_completed_total counter');
  lines.push(
    `cascade_transactions_completed_total ${snapshot.transactionsCompleted}`
  );

  lines.push(
    '# HELP cascade_transactions_failed_total Total cascade transactions failed'
  );
  lines.push('# TYPE cascade_transactions_failed_total counter');
  lines.push(`cascade_transactions_failed_total ${snapshot.transactionsFailed}`);

  lines.push('# HELP cascade_entities_tracked_total Total entities tracked');
  lines.push('# TYPE cascade_entities_tracked_total counter');
  lines.push(`cascade_entities_tracked_total ${snapshot.entitiesTracked}`);

  lines.push(
    '# HELP cascade_entities_truncated_total Total entities truncated due to limits'
  );
  lines.push('# TYPE cascade_entities_truncated_total counter');
  lines.push(`cascade_entities_truncated_total ${snapshot.entitiesTruncated}`);

  // Gauges
  lines.push('# HELP cascade_active_transactions Current active transactions');
  lines.push('# TYPE cascade_active_transactions gauge');
  lines.push(`cascade_active_transactions ${snapshot.activeTransactions}`);

  // Histogram summaries (p50, p95, p99)
  if (snapshot.trackingTimeMs.length > 0) {
    const sorted = [...snapshot.trackingTimeMs].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;

    lines.push(
      '# HELP cascade_tracking_duration_ms Tracking duration in milliseconds'
    );
    lines.push('# TYPE cascade_tracking_duration_ms summary');
    lines.push(`cascade_tracking_duration_ms{quantile="0.5"} ${p50}`);
    lines.push(`cascade_tracking_duration_ms{quantile="0.95"} ${p95}`);
    lines.push(`cascade_tracking_duration_ms{quantile="0.99"} ${p99}`);
  }

  if (snapshot.constructionTimeMs.length > 0) {
    const sorted = [...snapshot.constructionTimeMs].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;

    lines.push(
      '# HELP cascade_construction_duration_ms Construction duration in milliseconds'
    );
    lines.push('# TYPE cascade_construction_duration_ms summary');
    lines.push(`cascade_construction_duration_ms{quantile="0.5"} ${p50}`);
    lines.push(`cascade_construction_duration_ms{quantile="0.95"} ${p95}`);
    lines.push(`cascade_construction_duration_ms{quantile="0.99"} ${p99}`);
  }

  if (snapshot.cascadeSize.length > 0) {
    const sorted = [...snapshot.cascadeSize].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;

    lines.push('# HELP cascade_response_size Cascade response size in entities');
    lines.push('# TYPE cascade_response_size summary');
    lines.push(`cascade_response_size{quantile="0.5"} ${p50}`);
    lines.push(`cascade_response_size{quantile="0.95"} ${p95}`);
    lines.push(`cascade_response_size{quantile="0.99"} ${p99}`);
  }

  return lines.join('\n');
}
