export interface Metric {
  id: string;
  name: string;
  value: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  updatedAt: string;
}

export interface DataRow {
  id: string;
  category: string;
  values: number[];
}

// In-memory database
class Database {
  private metrics: Metric[] = [
    { id: '1', name: 'Page Views', value: 1250, trend: 'UP', updatedAt: '2024-01-15T10:00:00Z' },
    { id: '2', name: 'Unique Visitors', value: 450, trend: 'DOWN', updatedAt: '2024-01-15T10:00:00Z' },
    { id: '3', name: 'Conversions', value: 32, trend: 'UP', updatedAt: '2024-01-15T10:00:00Z' },
    { id: '4', name: 'Revenue', value: 5280, trend: 'STABLE', updatedAt: '2024-01-15T10:00:00Z' },
    { id: '5', name: 'Bounce Rate', value: 42.5, trend: 'DOWN', updatedAt: '2024-01-15T10:00:00Z' },
    { id: '6', name: 'Avg Session Duration', value: 185, trend: 'UP', updatedAt: '2024-01-15T10:00:00Z' },
  ];

  private dataRows: DataRow[] = [
    { id: '1', category: 'traffic', values: [1250, 1180, 1320, 1100, 1400] },
    { id: '2', category: 'sales', values: [32, 28, 35, 30, 38] },
    { id: '3', category: 'engagement', values: [42.5, 45.2, 38.1, 41.8, 39.3] },
  ];

  getMetrics(): Metric[] {
    return [...this.metrics];
  }

  updateMetric(id: string, value: number): Metric | undefined {
    const index = this.metrics.findIndex(m => m.id === id);
    if (index === -1) return undefined;

    const metric = this.metrics[index];
    const oldValue = metric.value;
    const newTrend = value > oldValue ? 'UP' : value < oldValue ? 'DOWN' : 'STABLE';

    const updated: Metric = {
      ...metric,
      value,
      trend: newTrend,
      updatedAt: new Date().toISOString(),
    };
    this.metrics[index] = updated;
    return updated;
  }

  getDataRows(): DataRow[] {
    return [...this.dataRows];
  }
}

export const db = new Database();
