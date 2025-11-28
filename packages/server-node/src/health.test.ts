import {
  createHealthCheck,
  getHealthStatusCode,
  type CascadeHealthStatus,
} from './health';
import { DefaultMetricsCollector, type MetricsCollector } from './metrics';

describe('createHealthCheck', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new DefaultMetricsCollector();
  });

  describe('health status calculation', () => {
    it('returns healthy status when all checks pass', () => {
      const healthCheck = createHealthCheck(collector, { version: '1.0.0' });
      const status = healthCheck();

      expect(status.status).toBe('healthy');
      expect(status.version).toBe('1.0.0');
      expect(status.uptime).toBeGreaterThan(0);
      expect(status.checks.tracker.status).toBe(true);
      expect(status.checks.memory.status).toBe(true);
    });

    it('returns degraded status when error rate exceeds threshold', () => {
      // 6% error rate (> 5% default threshold)
      collector.increment('transactionsCompleted', 94);
      collector.increment('transactionsFailed', 6);

      const healthCheck = createHealthCheck(collector);
      const status = healthCheck();

      expect(status.status).toBe('degraded');
      expect(status.metrics.recentErrorRate).toBe(6);
    });

    it('returns unhealthy status when error rate is very high', () => {
      // 15% error rate (> 10% default threshold)
      collector.increment('transactionsCompleted', 85);
      collector.increment('transactionsFailed', 15);

      const healthCheck = createHealthCheck(collector);
      const status = healthCheck();

      expect(status.status).toBe('unhealthy');
      expect(status.metrics.recentErrorRate).toBe(15);
    });

    it('returns degraded status when tracking time exceeds threshold', () => {
      // Average tracking time > 200ms
      collector.histogram('trackingTimeMs', 250);
      collector.histogram('trackingTimeMs', 230);
      collector.histogram('trackingTimeMs', 220);

      const healthCheck = createHealthCheck(collector);
      const status = healthCheck();

      expect(status.status).toBe('degraded');
      expect(status.metrics.averageTrackingTimeMs).toBeGreaterThan(200);
    });

    it('returns unhealthy status when tracking time is very high', () => {
      // Average tracking time > 500ms
      collector.histogram('trackingTimeMs', 600);
      collector.histogram('trackingTimeMs', 550);

      const healthCheck = createHealthCheck(collector);
      const status = healthCheck();

      expect(status.status).toBe('unhealthy');
      expect(status.metrics.averageTrackingTimeMs).toBeGreaterThan(500);
    });
  });

  describe('metrics calculation', () => {
    it('calculates total transactions correctly', () => {
      collector.increment('transactionsCompleted', 10);
      collector.increment('transactionsFailed', 2);

      const healthCheck = createHealthCheck(collector);
      const status = healthCheck();

      expect(status.metrics.totalTransactions).toBe(12);
    });

    it('calculates error rate correctly', () => {
      collector.increment('transactionsCompleted', 80);
      collector.increment('transactionsFailed', 20);

      const healthCheck = createHealthCheck(collector);
      const status = healthCheck();

      expect(status.metrics.recentErrorRate).toBe(20);
    });

    it('calculates average tracking time correctly', () => {
      collector.histogram('trackingTimeMs', 100);
      collector.histogram('trackingTimeMs', 200);
      collector.histogram('trackingTimeMs', 300);

      const healthCheck = createHealthCheck(collector);
      const status = healthCheck();

      expect(status.metrics.averageTrackingTimeMs).toBe(200);
    });

    it('reports active transactions from collector', () => {
      collector.gauge('activeTransactions', 5);

      const healthCheck = createHealthCheck(collector);
      const status = healthCheck();

      expect(status.metrics.activeTransactions).toBe(5);
    });

    it('handles zero transactions gracefully', () => {
      const healthCheck = createHealthCheck(collector);
      const status = healthCheck();

      expect(status.metrics.totalTransactions).toBe(0);
      expect(status.metrics.recentErrorRate).toBe(0);
      expect(status.status).toBe('healthy');
    });

    it('handles empty tracking times gracefully', () => {
      const healthCheck = createHealthCheck(collector);
      const status = healthCheck();

      expect(status.metrics.averageTrackingTimeMs).toBe(0);
    });
  });

  describe('configuration', () => {
    it('uses custom error rate thresholds', () => {
      collector.increment('transactionsCompleted', 97);
      collector.increment('transactionsFailed', 3);

      const healthCheck = createHealthCheck(collector, {
        degradedErrorRate: 0.02, // 2%
      });
      const status = healthCheck();

      expect(status.status).toBe('degraded');
    });

    it('uses custom tracking time thresholds', () => {
      collector.histogram('trackingTimeMs', 150);

      const healthCheck = createHealthCheck(collector, {
        degradedTrackingTimeMs: 100,
      });
      const status = healthCheck();

      expect(status.status).toBe('degraded');
    });

    it('uses custom version string', () => {
      const healthCheck = createHealthCheck(collector, {
        version: '2.0.0-beta',
      });
      const status = healthCheck();

      expect(status.version).toBe('2.0.0-beta');
    });

    it('uses custom memory limit', () => {
      // Cannot easily trigger memory limit in tests, but verify config is accepted
      const healthCheck = createHealthCheck(collector, {
        memoryLimitMb: 1000,
      });
      const status = healthCheck();

      expect(status.checks.memory.limitMb).toBe(1000);
    });
  });

  describe('null collector handling', () => {
    it('works with null metrics collector', () => {
      const healthCheck = createHealthCheck(null);
      const status = healthCheck();

      expect(status.status).toBe('healthy');
      expect(status.metrics.activeTransactions).toBe(0);
      expect(status.metrics.totalTransactions).toBe(0);
      expect(status.metrics.averageTrackingTimeMs).toBe(0);
    });
  });
});

describe('getHealthStatusCode', () => {
  it('returns 200 for healthy status', () => {
    expect(getHealthStatusCode('healthy')).toBe(200);
  });

  it('returns 200 for degraded status', () => {
    expect(getHealthStatusCode('degraded')).toBe(200);
  });

  it('returns 503 for unhealthy status', () => {
    expect(getHealthStatusCode('unhealthy')).toBe(503);
  });
});
