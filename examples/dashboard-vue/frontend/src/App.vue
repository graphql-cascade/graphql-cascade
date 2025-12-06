<script setup lang="ts">
import { ref } from 'vue';
import { useQuery, useMutation } from '@urql/vue';
import MetricsCard from './components/MetricsCard.vue';
import DataTable from './components/DataTable.vue';
import FilterPanel from './components/FilterPanel.vue';

const activeTab = ref<'metrics' | 'data'>('metrics');

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

const UPDATE_METRIC = `
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
        deleted {
          __typename
          id
        }
        invalidations
      }
    }
  }
`;

const { data, fetching } = useQuery({ query: METRICS_QUERY });
const { executeMutation } = useMutation(UPDATE_METRIC);
</script>

<template>
  <div class="app">
    <header>
      <h1>Dashboard - Vue 3 + GraphQL Cascade</h1>
      <p>Real-time analytics with cascade updates</p>
    </header>

    <nav class="tabs">
      <button
        :class="{ active: activeTab === 'metrics' }"
        @click="activeTab = 'metrics'"
      >
        Metrics
      </button>
      <button
        :class="{ active: activeTab === 'data' }"
        @click="activeTab = 'data'"
      >
        Data Table
      </button>
    </nav>

    <main>
      <FilterPanel v-if="activeTab === 'metrics'" />
      <div v-if="activeTab === 'metrics'" class="dashboard-grid">
        <MetricsCard
          v-for="metric in data?.metrics"
          :key="metric.id"
          :metric="metric"
          :update-mutation="executeMutation"
        />
      </div>
      <DataTable v-if="activeTab === 'data'" />
    </main>
  </div>
</template>

<style>
.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

header {
  text-align: center;
  margin-bottom: 30px;
}

header h1 {
  color: #333;
  margin-bottom: 8px;
}

header p {
  color: #666;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.tabs button {
  padding: 10px 20px;
  border: none;
  background: #e0e0e0;
  color: #333;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.tabs button:hover {
  background: #d0d0d0;
}

.tabs button.active {
  background: #4f46e5;
  color: white;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

main {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
