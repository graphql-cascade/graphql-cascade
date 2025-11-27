import { buildSuccessResponse, CascadeBuilder } from '@graphql-cascade/server';
import { db, Metric, DataRow } from './db';

interface FilterInput {
  category?: string;
  minValue?: number;
  maxValue?: number;
}

export const resolvers = {
  // Queries
  metrics: () => db.getMetrics(),

  dataRows: ({ filter }: { filter?: FilterInput }) => {
    let dataRows = db.getDataRows();

    if (filter) {
      if (filter.category) {
        dataRows = dataRows.filter(row => row.category === filter.category);
      }
      if (filter.minValue !== undefined) {
        dataRows = dataRows.filter(row =>
          row.values.some(value => value >= filter.minValue!)
        );
      }
      if (filter.maxValue !== undefined) {
        dataRows = dataRows.filter(row =>
          row.values.some(value => value <= filter.maxValue!)
        );
      }
    }

    return dataRows;
  },

  // Mutations
  updateMetric: ({ id, value }: { id: string; value: number }) => {
    const metric = db.updateMetric(id, value);

    if (!metric) {
      return {
        success: false,
        data: null,
        cascade: { updated: [], deleted: [], invalidations: [] },
      };
    }

    return buildSuccessResponse(metric, (builder: CascadeBuilder) => {
      builder.updated('Metric', metric);
    });
  },

  refreshData: () => {
    // Simulate data refresh - just return cascade invalidations
    return {
      success: true,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: ['Metric', 'DataRow'],
      },
    };
  },
};
