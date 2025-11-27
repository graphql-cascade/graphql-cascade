<script setup lang="ts">
import { ref } from 'vue';
import MetricsChart from './components/MetricsChart.vue';
import FilterPanel from './components/FilterPanel.vue';
import DashboardList from './components/DashboardList.vue';

const activeTab = ref<'metrics' | 'dashboards'>('metrics');
</script>

<template>
  <div class="app">
    <header>
      <h1>Analytics Dashboard</h1>
      <p>GraphQL Cascade + Vue 3 + URQL Example</p>
    </header>

    <nav class="tabs">
      <button
        :class="{ active: activeTab === 'metrics' }"
        @click="activeTab = 'metrics'"
      >
        Metrics
      </button>
      <button
        :class="{ active: activeTab === 'dashboards' }"
        @click="activeTab = 'dashboards'"
      >
        Dashboards
      </button>
    </nav>

    <main>
      <FilterPanel v-if="activeTab === 'metrics'" />
      <MetricsChart v-if="activeTab === 'metrics'" />
      <DashboardList v-if="activeTab === 'dashboards'" />
    </main>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  min-height: 100vh;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
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
  font-size: 14px;
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

main {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
