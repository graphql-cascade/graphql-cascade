export interface Metric {
  id: string;
  name: string;
  value: number;
  category: string;
  timestamp: string;
}

export interface Dashboard {
  id: string;
  name: string;
  widgets: string[];
  createdAt: string;
  updatedAt: string;
}

// In-memory database
class Database {
  private metrics: Metric[] = [
    { id: '1', name: 'Page Views', value: 1250, category: 'traffic', timestamp: '2024-01-15T10:00:00Z' },
    { id: '2', name: 'Unique Visitors', value: 450, category: 'traffic', timestamp: '2024-01-15T10:00:00Z' },
    { id: '3', name: 'Conversions', value: 32, category: 'sales', timestamp: '2024-01-15T10:00:00Z' },
    { id: '4', name: 'Revenue', value: 5280, category: 'sales', timestamp: '2024-01-15T10:00:00Z' },
    { id: '5', name: 'Bounce Rate', value: 42.5, category: 'engagement', timestamp: '2024-01-15T10:00:00Z' },
    { id: '6', name: 'Avg Session Duration', value: 185, category: 'engagement', timestamp: '2024-01-15T10:00:00Z' },
  ];

  private dashboards: Dashboard[] = [
    {
      id: '1',
      name: 'Main Dashboard',
      widgets: ['traffic-chart', 'sales-summary', 'recent-activity'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      name: 'Sales Dashboard',
      widgets: ['revenue-chart', 'conversion-funnel', 'top-products'],
      createdAt: '2024-01-05T00:00:00Z',
      updatedAt: '2024-01-14T15:30:00Z',
    },
  ];

  private nextMetricId = 7;

  getMetrics(): Metric[] {
    return [...this.metrics];
  }

  createMetric(input: { name: string; value: number; category: string }): Metric {
    const metric: Metric = {
      id: String(this.nextMetricId++),
      name: input.name,
      value: input.value,
      category: input.category,
      timestamp: new Date().toISOString(),
    };
    this.metrics.push(metric);
    return metric;
  }

  getDashboards(): Dashboard[] {
    return [...this.dashboards];
  }

  getDashboard(id: string): Dashboard | undefined {
    return this.dashboards.find(d => d.id === id);
  }

  updateDashboard(id: string, input: { name?: string; widgets?: string[] }): Dashboard | undefined {
    const index = this.dashboards.findIndex(d => d.id === id);
    if (index === -1) return undefined;

    const dashboard = this.dashboards[index];
    const updated: Dashboard = {
      ...dashboard,
      name: input.name ?? dashboard.name,
      widgets: input.widgets ?? dashboard.widgets,
      updatedAt: new Date().toISOString(),
    };
    this.dashboards[index] = updated;
    return updated;
  }
}

export const db = new Database();
