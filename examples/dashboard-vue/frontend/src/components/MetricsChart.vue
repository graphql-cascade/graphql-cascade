<script setup lang="ts">
import { useQuery, useMutation } from '@urql/vue';
import { ref, computed } from 'vue';

const METRICS_QUERY = `
  query GetMetrics($filter: MetricsFilter) {
    metrics(filter: $filter) {
      id
      name
      value
      category
      timestamp
    }
  }
`;

const CREATE_METRIC_MUTATION = `
  mutation CreateMetric($input: CreateMetricInput!) {
    createMetric(input: $input) {
      success
      data {
        id
        name
        value
        category
        timestamp
      }
      cascade {
        updated {
          __typename
          id
        }
        invalidations
      }
    }
  }
`;

interface Metric {
  id: string;
  name: string;
  value: number;
  category: string;
  timestamp: string;
}

const filter = ref<{ category?: string }>({});

const result = useQuery({
  query: METRICS_QUERY,
  variables: { filter: filter.value },
});

const createMetricMutation = useMutation(CREATE_METRIC_MUTATION);

const metrics = computed<Metric[]>(() => result.data.value?.metrics || []);
const fetching = computed(() => result.fetching.value);

// Group metrics by category
const metricsByCategory = computed(() => {
  const grouped: Record<string, Metric[]> = {};
  for (const metric of metrics.value) {
    if (!grouped[metric.category]) {
      grouped[metric.category] = [];
    }
    grouped[metric.category].push(metric);
  }
  return grouped;
});

// Form state for adding new metric
const newMetric = ref({
  name: '',
  value: 0,
  category: 'traffic',
});

async function handleAddMetric() {
  if (!newMetric.value.name) return;

  await createMetricMutation.executeMutation({
    input: newMetric.value,
  });

  // Reset form
  newMetric.value = { name: '', value: 0, category: 'traffic' };

  // Refetch metrics
  result.executeQuery({ requestPolicy: 'network-only' });
}
</script>

<template>
  <div class="metrics-chart">
    <h2>Metrics Overview</h2>

    <div v-if="fetching" class="loading">Loading metrics...</div>

    <div v-else class="metrics-grid">
      <div
        v-for="(categoryMetrics, category) in metricsByCategory"
        :key="category"
        class="category-card"
      >
        <h3>{{ category }}</h3>
        <div class="metric-list">
          <div
            v-for="metric in categoryMetrics"
            :key="metric.id"
            class="metric-item"
          >
            <span class="metric-name">{{ metric.name }}</span>
            <span class="metric-value">{{ metric.value.toLocaleString() }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="add-metric-form">
      <h3>Add New Metric</h3>
      <form @submit.prevent="handleAddMetric">
        <input
          v-model="newMetric.name"
          type="text"
          placeholder="Metric name"
          required
        />
        <input
          v-model.number="newMetric.value"
          type="number"
          placeholder="Value"
          required
        />
        <select v-model="newMetric.category">
          <option value="traffic">Traffic</option>
          <option value="sales">Sales</option>
          <option value="engagement">Engagement</option>
        </select>
        <button type="submit" :disabled="createMetricMutation.fetching.value">
          {{ createMetricMutation.fetching.value ? 'Adding...' : 'Add Metric' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.metrics-chart h2 {
  margin-bottom: 20px;
  color: #333;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.category-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
}

.category-card h3 {
  text-transform: capitalize;
  color: #4f46e5;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
}

.metric-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
}

.metric-name {
  color: #333;
  font-size: 14px;
}

.metric-value {
  font-weight: 600;
  color: #4f46e5;
}

.add-metric-form {
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.add-metric-form h3 {
  margin-bottom: 16px;
  color: #333;
  font-size: 16px;
}

.add-metric-form form {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.add-metric-form input,
.add-metric-form select {
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.add-metric-form input:focus,
.add-metric-form select:focus {
  outline: none;
  border-color: #4f46e5;
}

.add-metric-form button {
  padding: 10px 20px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.add-metric-form button:hover:not(:disabled) {
  background: #4338ca;
}

.add-metric-form button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
