/**
 * OpenTelemetry Integration for GraphQL Cascade
 *
 * Provides OpenTelemetry-compatible metrics collection for cascade operations.
 * Requires @opentelemetry/api as a peer dependency.
 */

import type {
  MetricsCollector,
  CascadeMetricsSnapshot,
  CounterMetric,
  GaugeMetric,
  HistogramMetric,
} from '../metrics';

/**
 * OpenTelemetry Meter interface (subset of @opentelemetry/api Meter).
 * This allows users to pass their own meter without requiring the full dependency.
 */
export interface OTelMeter {
  createCounter(name: string, options?: { description?: string; unit?: string }): OTelCounter;
  createHistogram(name: string, options?: { description?: string; unit?: string }): OTelHistogram;
  createUpDownCounter(name: string, options?: { description?: string; unit?: string }): OTelUpDownCounter;
}

export interface OTelCounter {
  add(value: number, attributes?: Record<string, string>): void;
}

export interface OTelHistogram {
  record(value: number, attributes?: Record<string, string>): void;
}

export interface OTelUpDownCounter {
  add(value: number, attributes?: Record<string, string>): void;
}

/**
 * Configuration for OpenTelemetry metrics collector.
 */
export interface OpenTelemetryConfig {
  /** OpenTelemetry Meter instance */
  meter: OTelMeter;
  /** Metric name prefix (default: 'cascade') */
  prefix?: string;
  /** Maximum number of histogram values to keep in local snapshot (default: 100) */
  maxHistogramSize?: number;
}

/**
 * OpenTelemetry-compatible metrics collector for GraphQL Cascade.
 *
 * This collector sends metrics to OpenTelemetry while also maintaining a local
 * snapshot for getSnapshot() calls.
 *
 * @example
 * ```typescript
 * import { metrics } from '@opentelemetry/api';
 * import { OpenTelemetryMetricsCollector } from '@graphql-cascade/server-node';
 *
 * const meter = metrics.getMeter('graphql-cascade');
 * const metricsCollector = new OpenTelemetryMetricsCollector({ meter });
 *
 * const tracker = new CascadeTracker({
 *   metrics: metricsCollector
 * });
 * ```
 */
export class OpenTelemetryMetricsCollector implements MetricsCollector {
  private counters: Map<CounterMetric, OTelCounter>;
  private histograms: Map<HistogramMetric, OTelHistogram>;
  private activeTransactionsGauge: OTelUpDownCounter;
  private localSnapshot: CascadeMetricsSnapshot;
  private maxHistogramSize: number;

  constructor(config: OpenTelemetryConfig) {
    const prefix = config.prefix ?? 'cascade';
    const meter = config.meter;
    this.maxHistogramSize = config.maxHistogramSize ?? 100;

    // Create counters
    this.counters = new Map<CounterMetric, OTelCounter>([
      [
        'transactionsStarted',
        meter.createCounter(`${prefix}_transactions_started_total`, {
          description: 'Total cascade transactions started',
        }),
      ],
      [
        'transactionsCompleted',
        meter.createCounter(`${prefix}_transactions_completed_total`, {
          description: 'Total cascade transactions completed successfully',
        }),
      ],
      [
        'transactionsFailed',
        meter.createCounter(`${prefix}_transactions_failed_total`, {
          description: 'Total cascade transactions failed',
        }),
      ],
      [
        'entitiesTracked',
        meter.createCounter(`${prefix}_entities_tracked_total`, {
          description: 'Total entities tracked across all transactions',
        }),
      ],
      [
        'entitiesTruncated',
        meter.createCounter(`${prefix}_entities_truncated_total`, {
          description: 'Total entities truncated due to limits',
        }),
      ],
    ]);

    // Create histograms
    this.histograms = new Map<HistogramMetric, OTelHistogram>([
      [
        'trackingTimeMs',
        meter.createHistogram(`${prefix}_tracking_duration_milliseconds`, {
          description: 'Time spent tracking entities in milliseconds',
          unit: 'ms',
        }),
      ],
      [
        'constructionTimeMs',
        meter.createHistogram(`${prefix}_construction_duration_milliseconds`, {
          description: 'Time spent building cascade response in milliseconds',
          unit: 'ms',
        }),
      ],
      [
        'cascadeSize',
        meter.createHistogram(`${prefix}_response_size_entities`, {
          description: 'Number of entities in cascade response',
          unit: 'entities',
        }),
      ],
    ]);

    // Create gauge (using UpDownCounter for OTel compatibility)
    this.activeTransactionsGauge = meter.createUpDownCounter(
      `${prefix}_active_transactions`,
      {
        description: 'Current number of active cascade transactions',
      }
    );

    // Initialize local snapshot
    this.localSnapshot = this.createEmptySnapshot();
  }

  /**
   * Increment a counter metric.
   */
  increment(metric: CounterMetric, value = 1): void {
    const counter = this.counters.get(metric);
    if (counter) {
      counter.add(value);
    }
    this.localSnapshot[metric] += value;
  }

  /**
   * Set a gauge metric value.
   */
  gauge(metric: GaugeMetric, value: number): void {
    // Calculate delta for UpDownCounter
    const delta = value - this.localSnapshot[metric];
    if (delta !== 0) {
      this.activeTransactionsGauge.add(delta);
    }
    this.localSnapshot[metric] = value;
  }

  /**
   * Record a histogram value.
   */
  histogram(metric: HistogramMetric, value: number): void {
    const histogram = this.histograms.get(metric);
    if (histogram) {
      histogram.record(value);
    }

    // Update local snapshot
    const arr = this.localSnapshot[metric] as number[];
    arr.push(value);
    if (arr.length > this.maxHistogramSize) {
      arr.shift();
    }
  }

  /**
   * Get a snapshot of current metrics.
   * Note: Counter and gauge values are local approximations.
   * For accurate values, query your OpenTelemetry backend.
   */
  getSnapshot(): CascadeMetricsSnapshot {
    return {
      transactionsStarted: this.localSnapshot.transactionsStarted,
      transactionsCompleted: this.localSnapshot.transactionsCompleted,
      transactionsFailed: this.localSnapshot.transactionsFailed,
      entitiesTracked: this.localSnapshot.entitiesTracked,
      entitiesTruncated: this.localSnapshot.entitiesTruncated,
      activeTransactions: this.localSnapshot.activeTransactions,
      trackingTimeMs: [...this.localSnapshot.trackingTimeMs],
      constructionTimeMs: [...this.localSnapshot.constructionTimeMs],
      cascadeSize: [...this.localSnapshot.cascadeSize],
    };
  }

  /**
   * Reset local snapshot counters.
   * Note: This only resets the local snapshot, not the OpenTelemetry metrics.
   * OpenTelemetry counters are cumulative and cannot be reset.
   */
  reset(): void {
    this.localSnapshot = this.createEmptySnapshot();
  }

  private createEmptySnapshot(): CascadeMetricsSnapshot {
    return {
      transactionsStarted: 0,
      transactionsCompleted: 0,
      transactionsFailed: 0,
      entitiesTracked: 0,
      entitiesTruncated: 0,
      activeTransactions: 0,
      trackingTimeMs: [],
      constructionTimeMs: [],
      cascadeSize: [],
    };
  }
}
