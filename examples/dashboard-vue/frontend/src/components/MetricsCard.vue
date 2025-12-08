<script setup lang="ts">
interface Metric {
  id: string;
  name: string;
  value: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  updatedAt: string;
}

interface Props {
  metric: Metric;
  updateMutation: (variables: { id: string; value: number }) => Promise<any>;
}

const props = defineProps<Props>();

const handleUpdate = async () => {
  const newValue = props.metric.value + Math.random() * 100 - 50;
  await props.updateMutation({
    id: props.metric.id,
    value: Math.round(newValue * 100) / 100,
  });
};
</script>

<template>
  <div class="metric-card">
    <div class="metric-header">
      <h3>{{ metric.name }}</h3>
      <span class="trend" :class="metric.trend.toLowerCase()">
        {{ metric.trend === 'UP' ? '↗' : metric.trend === 'DOWN' ? '↘' : '→' }}
      </span>
    </div>
    <div class="metric-value">{{ metric.value.toLocaleString() }}</div>
    <div class="metric-updated">Updated: {{ new Date(metric.updatedAt).toLocaleTimeString() }}</div>
    <button @click="handleUpdate" class="update-btn">Update</button>
  </div>
</template>

<style scoped>
.metric-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.metric-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.trend {
  font-size: 18px;
}

.trend.up {
  color: #10b981;
}

.trend.down {
  color: #ef4444;
}

.trend.stable {
  color: #6b7280;
}

.metric-value {
  font-size: 32px;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 5px;
}

.metric-updated {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 15px;
}

.update-btn {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.update-btn:hover {
  background: #4338ca;
}
</style>