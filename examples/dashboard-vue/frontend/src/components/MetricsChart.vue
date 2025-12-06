<script setup lang="ts">
import { useQuery, useMutation } from '@urql/vue';
import { ref, computed } from 'vue';

const METRICS_QUERY = `
  query GetMetrics {
    metrics {
      id
      name
      value
      trend
      updatedAt
    }
  }
`;

const UPDATE_METRIC_MUTATION = `
  mutation UpdateMetric($id: ID!, $value: Float!) {
    updateMetric(id: $id, value: $value) {
      success
      data {
        id
        name
        value
        trend
        updatedAt
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
  trend: 'UP' | 'DOWN' | 'STABLE';
  updatedAt: string;
}

const result = useQuery({
  query: METRICS_QUERY,
});

const updateMetricMutation = useMutation(UPDATE_METRIC_MUTATION);

const metrics = computed<Metric[]>(() => result.data.value?.metrics || []);
const fetching = computed(() => result.fetching.value);

// Form state for updating metric
const selectedMetricId = ref('');
const newValue = ref(0);

async function handleUpdateMetric() {
  if (!selectedMetricId.value) return;

  await updateMetricMutation.executeMutation({
    id: selectedMetricId.value,
    value: newValue.value,
  });

  // Reset form
  selectedMetricId.value = '';
  newValue.value = 0;

  // Refetch metrics
  result.executeQuery({ requestPolicy: 'network-only' });
}
</script>

<template>
  <div class="metrics-chart">
    <h2>Metrics Overview</h2>

    <div v-if="fetching" class="loading">Loading metrics...</div>

    <div v-else class="metrics-list">
      <div
        v-for="metric in metrics"
        :key="metric.id"
        class="metric-item"
      >
        <div class="metric-info">
          <span class="metric-name">{{ metric.name }}</span>
          <span class="metric-value">{{ metric.value.toLocaleString() }}</span>
          <span class="metric-trend" :class="metric.trend.toLowerCase()">
            {{ metric.trend }}
          </span>
          <span class="metric-updated">{{ new Date(metric.updatedAt).toLocaleDateString() }}</span>
        </div>
      </div>
    </div>

    <div class="update-metric-form">
      <h3>Update Metric Value</h3>
      <form @submit.prevent="handleUpdateMetric">
        <select v-model="selectedMetricId" required>
          <option value="">Select metric to update</option>
          <option
            v-for="metric in metrics"
            :key="metric.id"
            :value="metric.id"
          >
            {{ metric.name }}
          </option>
        </select>
        <input
          v-model.number="newValue"
          type="number"
          placeholder="New value"
          required
        />
        <button type="submit" :disabled="updateMetricMutation.fetching.value">
          {{ updateMetricMutation.fetching.value ? 'Updating...' : 'Update Metric' }}
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

.metrics-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 30px;
}

.metric-item {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
}

.metric-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.metric-name {
  color: #333;
  font-size: 16px;
  font-weight: 500;
}

.metric-value {
  font-weight: 600;
  color: #4f46e5;
  font-size: 18px;
}

.metric-trend {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.metric-trend.up {
  background: #dcfce7;
  color: #166534;
}

.metric-trend.down {
  background: #fee2e2;
  color: #991b1b;
}

.metric-trend.stable {
  background: #fef3c7;
  color: #92400e;
}

.metric-updated {
  color: #666;
  font-size: 12px;
}

.update-metric-form {
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.update-metric-form h3 {
  margin-bottom: 16px;
  color: #333;
  font-size: 16px;
}

.update-metric-form form {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.update-metric-form input,
.update-metric-form select {
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.update-metric-form input:focus,
.update-metric-form select:focus {
  outline: none;
  border-color: #4f46e5;
}

.update-metric-form button {
  padding: 10px 20px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.update-metric-form button:hover:not(:disabled) {
  background: #4338ca;
}

.update-metric-form button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
