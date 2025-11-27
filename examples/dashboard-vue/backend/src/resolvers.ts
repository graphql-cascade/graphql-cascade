import { buildSuccessResponse, CascadeBuilder } from '@graphql-cascade/server';
import { db, Metric, Dashboard } from './db';

interface MetricsFilter {
  startDate?: string;
  endDate?: string;
  category?: string;
}

interface CreateMetricInput {
  name: string;
  value: number;
  category: string;
}

interface UpdateDashboardInput {
  name?: string;
  widgets?: string[];
}

export const resolvers = {
  // Queries
  metrics: ({ filter }: { filter?: MetricsFilter }) => {
    let metrics = db.getMetrics();

    if (filter) {
      if (filter.category) {
        metrics = metrics.filter(m => m.category === filter.category);
      }
      if (filter.startDate) {
        metrics = metrics.filter(m => m.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        metrics = metrics.filter(m => m.timestamp <= filter.endDate!);
      }
    }

    return metrics;
  },

  aggregations: ({ type }: { type: string }) => {
    const metrics = db.getMetrics();
    const total = metrics.reduce((sum, m) => sum + m.value, 0);
    const average = metrics.length > 0 ? total / metrics.length : 0;

    // Group by category
    const categoryMap = new Map<string, { total: number; count: number }>();
    for (const metric of metrics) {
      const existing = categoryMap.get(metric.category) || { total: 0, count: 0 };
      categoryMap.set(metric.category, {
        total: existing.total + metric.value,
        count: existing.count + 1,
      });
    }

    const breakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
    }));

    return {
      type,
      total,
      average,
      count: metrics.length,
      breakdown,
    };
  },

  dashboards: () => db.getDashboards(),

  dashboard: ({ id }: { id: string }) => db.getDashboard(id),

  // Mutations
  createMetric: ({ input }: { input: CreateMetricInput }) => {
    const metric = db.createMetric(input);

    return buildSuccessResponse(metric, (builder: CascadeBuilder) => {
      builder.updated('Metric', metric);
      // Invalidate aggregations since they depend on metrics
      builder.invalidate('Aggregation');
    });
  },

  updateDashboard: ({ id, input }: { id: string; input: UpdateDashboardInput }) => {
    const dashboard = db.updateDashboard(id, input);

    if (!dashboard) {
      return {
        success: false,
        data: null,
        cascade: { updated: [], deleted: [], invalidations: [] },
      };
    }

    return buildSuccessResponse(dashboard, (builder: CascadeBuilder) => {
      builder.updated('Dashboard', dashboard);
    });
  },

  refreshData: () => {
    // Simulate data refresh - just return cascade invalidations
    return {
      success: true,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: ['Metric', 'Aggregation'],
      },
    };
  },
};
