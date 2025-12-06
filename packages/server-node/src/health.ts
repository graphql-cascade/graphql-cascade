/**
 * GraphQL Cascade Health Check
 *
 * Provides health check functionality for cascade operations.
 */

import type { MetricsCollector } from './metrics';

/**
 * Health status for cascade operations.
 */
export interface CascadeHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  metrics: {
    activeTransactions: number;
    recentErrorRate: number;
    averageTrackingTimeMs: number;
    totalTransactions: number;
  };
  checks: {
    tracker: { status: boolean; message?: string };
    memory: { status: boolean; usedMb: number; limitMb: number };
  };
}

/**
 * Configuration for health check.
 */
export interface HealthCheckConfig {
  /**
   * Memory threshold in MB. Exceeding this marks status as unhealthy.
   * @default 500
   */
  memoryLimitMb?: number;

  /**
   * Error rate threshold for degraded status.
   * @default 0.05 (5%)
   */
  degradedErrorRate?: number;

  /**
   * Error rate threshold for unhealthy status.
   * @default 0.10 (10%)
   */
  unhealthyErrorRate?: number;

  /**
   * Average tracking time threshold (ms) for degraded status.
   * @default 200
   */
  degradedTrackingTimeMs?: number;

  /**
   * Average tracking time threshold (ms) for unhealthy status.
   * @default 500
   */
  unhealthyTrackingTimeMs?: number;

  /**
   * Package version string.
   * Pass from your package.json or build-time constant.
   */
  version?: string;
}

const startTime = Date.now();

/**
 * Create a health check function.
 */
export function createHealthCheck(
  metricsCollector: MetricsCollector | null,
  config: HealthCheckConfig = {}
): () => CascadeHealthStatus {
  const {
    memoryLimitMb = 500,
    degradedErrorRate = 0.05,
    unhealthyErrorRate = 0.1,
    degradedTrackingTimeMs = 200,
    unhealthyTrackingTimeMs = 500,
    version = 'unknown',
  } = config;

  return (): CascadeHealthStatus => {
    const snapshot = metricsCollector?.getSnapshot();
    const memoryUsage = process.memoryUsage();
    const heapUsedMb = memoryUsage.heapUsed / (1024 * 1024);

    // Calculate metrics
    const totalTransactions =
      (snapshot?.transactionsCompleted ?? 0) +
      (snapshot?.transactionsFailed ?? 0);
    const errorRate =
      totalTransactions > 0
        ? (snapshot?.transactionsFailed ?? 0) / totalTransactions
        : 0;

    const trackingTimes = snapshot?.trackingTimeMs ?? [];
    const avgTrackingTime =
      trackingTimes.length > 0
        ? trackingTimes.reduce((a, b) => a + b, 0) / trackingTimes.length
        : 0;

    // Check statuses
    const memoryOk = heapUsedMb < memoryLimitMb;
    const trackerOk = true; // Could add more checks

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (!memoryOk) {
      status = 'unhealthy';
    } else if (
      errorRate >= unhealthyErrorRate ||
      avgTrackingTime >= unhealthyTrackingTimeMs
    ) {
      status = 'unhealthy';
    } else if (
      errorRate >= degradedErrorRate ||
      avgTrackingTime >= degradedTrackingTimeMs
    ) {
      status = 'degraded';
    }

    return {
      status,
      version,
      uptime: Date.now() - startTime,
      metrics: {
        activeTransactions: snapshot?.activeTransactions ?? 0,
        recentErrorRate: Math.round(errorRate * 10000) / 100, // percentage with 2 decimals
        averageTrackingTimeMs: Math.round(avgTrackingTime * 100) / 100,
        totalTransactions,
      },
      checks: {
        tracker: { status: trackerOk },
        memory: {
          status: memoryOk,
          usedMb: Math.round(heapUsedMb),
          limitMb: memoryLimitMb,
        },
      },
    };
  };
}

/**
 * Get HTTP status code for health status.
 */
export function getHealthStatusCode(
  status: CascadeHealthStatus['status']
): number {
  switch (status) {
    case 'healthy':
      return 200;
    case 'degraded':
      return 200; // Still serving traffic
    case 'unhealthy':
      return 503;
  }
}
