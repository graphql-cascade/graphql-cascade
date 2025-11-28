import {
  DefaultMetricsCollector,
  exportPrometheusMetrics,
  type MetricsCollector,
} from './metrics';

describe('DefaultMetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new DefaultMetricsCollector();
  });

  describe('increment', () => {
    it('increments counter by 1 by default', () => {
      collector.increment('transactionsStarted');
      const snapshot = collector.getSnapshot();
      expect(snapshot.transactionsStarted).toBe(1);
    });

    it('increments counter by specified value', () => {
      collector.increment('entitiesTracked', 5);
      const snapshot = collector.getSnapshot();
      expect(snapshot.entitiesTracked).toBe(5);
    });

    it('accumulates multiple increments', () => {
      collector.increment('transactionsCompleted');
      collector.increment('transactionsCompleted');
      collector.increment('transactionsCompleted', 3);
      const snapshot = collector.getSnapshot();
      expect(snapshot.transactionsCompleted).toBe(5);
    });
  });

  describe('gauge', () => {
    it('sets gauge value', () => {
      collector.gauge('activeTransactions', 10);
      const snapshot = collector.getSnapshot();
      expect(snapshot.activeTransactions).toBe(10);
    });

    it('overwrites previous gauge value', () => {
      collector.gauge('activeTransactions', 10);
      collector.gauge('activeTransactions', 5);
      const snapshot = collector.getSnapshot();
      expect(snapshot.activeTransactions).toBe(5);
    });
  });

  describe('histogram', () => {
    it('records histogram values', () => {
      collector.histogram('trackingTimeMs', 100);
      collector.histogram('trackingTimeMs', 200);
      collector.histogram('trackingTimeMs', 150);
      const snapshot = collector.getSnapshot();
      expect(snapshot.trackingTimeMs).toEqual([100, 200, 150]);
    });

    it('limits histogram size to 1000 values', () => {
      for (let i = 0; i < 1005; i++) {
        collector.histogram('cascadeSize', i);
      }
      const snapshot = collector.getSnapshot();
      expect(snapshot.cascadeSize.length).toBe(1000);
      expect(snapshot.cascadeSize[0]).toBe(5); // First 5 values should be shifted out
    });
  });

  describe('getSnapshot', () => {
    it('returns initial snapshot with zeros', () => {
      const snapshot = collector.getSnapshot();
      expect(snapshot).toEqual({
        transactionsStarted: 0,
        transactionsCompleted: 0,
        transactionsFailed: 0,
        entitiesTracked: 0,
        entitiesTruncated: 0,
        activeTransactions: 0,
        trackingTimeMs: [],
        constructionTimeMs: [],
        cascadeSize: [],
      });
    });

    it('returns copy of histogram arrays', () => {
      collector.histogram('trackingTimeMs', 100);
      const snapshot1 = collector.getSnapshot();
      collector.histogram('trackingTimeMs', 200);
      const snapshot2 = collector.getSnapshot();

      expect(snapshot1.trackingTimeMs).toEqual([100]);
      expect(snapshot2.trackingTimeMs).toEqual([100, 200]);
    });
  });

  describe('reset', () => {
    it('resets all counters to zero', () => {
      collector.increment('transactionsStarted', 10);
      collector.increment('transactionsCompleted', 5);
      collector.increment('transactionsFailed', 2);
      collector.increment('entitiesTracked', 100);
      collector.increment('entitiesTruncated', 3);

      collector.reset();
      const snapshot = collector.getSnapshot();

      expect(snapshot.transactionsStarted).toBe(0);
      expect(snapshot.transactionsCompleted).toBe(0);
      expect(snapshot.transactionsFailed).toBe(0);
      expect(snapshot.entitiesTracked).toBe(0);
      expect(snapshot.entitiesTruncated).toBe(0);
    });

    it('resets all gauges to zero', () => {
      collector.gauge('activeTransactions', 10);
      collector.reset();
      const snapshot = collector.getSnapshot();
      expect(snapshot.activeTransactions).toBe(0);
    });

    it('clears all histogram arrays', () => {
      collector.histogram('trackingTimeMs', 100);
      collector.histogram('constructionTimeMs', 50);
      collector.histogram('cascadeSize', 10);

      collector.reset();
      const snapshot = collector.getSnapshot();

      expect(snapshot.trackingTimeMs).toEqual([]);
      expect(snapshot.constructionTimeMs).toEqual([]);
      expect(snapshot.cascadeSize).toEqual([]);
    });
  });
});

describe('exportPrometheusMetrics', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new DefaultMetricsCollector();
  });

  it('exports counters in Prometheus format', () => {
    collector.increment('transactionsStarted', 10);
    collector.increment('transactionsCompleted', 8);
    collector.increment('transactionsFailed', 2);
    collector.increment('entitiesTracked', 100);
    collector.increment('entitiesTruncated', 5);

    const output = exportPrometheusMetrics(collector);

    expect(output).toContain('# TYPE cascade_transactions_started_total counter');
    expect(output).toContain('cascade_transactions_started_total 10');
    expect(output).toContain('cascade_transactions_completed_total 8');
    expect(output).toContain('cascade_transactions_failed_total 2');
    expect(output).toContain('cascade_entities_tracked_total 100');
    expect(output).toContain('cascade_entities_truncated_total 5');
  });

  it('exports gauge in Prometheus format', () => {
    collector.gauge('activeTransactions', 3);

    const output = exportPrometheusMetrics(collector);

    expect(output).toContain('# TYPE cascade_active_transactions gauge');
    expect(output).toContain('cascade_active_transactions 3');
  });

  it('exports histogram summaries with quantiles', () => {
    // Add values: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
    for (let i = 1; i <= 10; i++) {
      collector.histogram('trackingTimeMs', i * 10);
    }

    const output = exportPrometheusMetrics(collector);

    expect(output).toContain('# TYPE cascade_tracking_duration_ms summary');
    expect(output).toContain('cascade_tracking_duration_ms{quantile="0.5"}');
    expect(output).toContain('cascade_tracking_duration_ms{quantile="0.95"}');
    expect(output).toContain('cascade_tracking_duration_ms{quantile="0.99"}');
  });

  it('skips histogram export when no values recorded', () => {
    const output = exportPrometheusMetrics(collector);

    expect(output).not.toContain('cascade_tracking_duration_ms');
    expect(output).not.toContain('cascade_construction_duration_ms');
    expect(output).not.toContain('cascade_response_size');
  });

  it('exports construction time histogram when present', () => {
    collector.histogram('constructionTimeMs', 5);
    collector.histogram('constructionTimeMs', 10);

    const output = exportPrometheusMetrics(collector);

    expect(output).toContain('# TYPE cascade_construction_duration_ms summary');
    expect(output).toContain('cascade_construction_duration_ms{quantile="0.5"}');
  });

  it('exports cascade size histogram when present', () => {
    collector.histogram('cascadeSize', 50);
    collector.histogram('cascadeSize', 100);

    const output = exportPrometheusMetrics(collector);

    expect(output).toContain('# TYPE cascade_response_size summary');
    expect(output).toContain('cascade_response_size{quantile="0.5"}');
  });

  it('includes HELP comments for all metrics', () => {
    const output = exportPrometheusMetrics(collector);

    expect(output).toContain('# HELP cascade_transactions_started_total');
    expect(output).toContain('# HELP cascade_transactions_completed_total');
    expect(output).toContain('# HELP cascade_transactions_failed_total');
    expect(output).toContain('# HELP cascade_entities_tracked_total');
    expect(output).toContain('# HELP cascade_entities_truncated_total');
    expect(output).toContain('# HELP cascade_active_transactions');
  });
});
