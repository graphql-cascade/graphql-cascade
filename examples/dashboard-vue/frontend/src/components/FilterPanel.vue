<script setup lang="ts">
import { useMutation } from '@urql/vue';

const REFRESH_DATA_MUTATION = `
  mutation RefreshData {
    refreshData {
      success
      cascade {
        invalidations
      }
    }
  }
`;

const refreshMutation = useMutation(REFRESH_DATA_MUTATION);

async function handleRefresh() {
  await refreshMutation.executeMutation({});
}
</script>

<template>
  <div class="filter-panel">
    <div class="filter-row">
      <span class="label">Data Controls</span>
      <button
        class="refresh-btn"
        @click="handleRefresh"
        :disabled="refreshMutation.fetching.value"
      >
        {{ refreshMutation.fetching.value ? 'Refreshing...' : 'Refresh Data' }}
      </button>
    </div>
    <p class="hint">
      Click refresh to invalidate cached metrics and aggregations via cascade.
    </p>
  </div>
</template>

<style scoped>
.filter-panel {
  background: #f0f4ff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  font-weight: 600;
  color: #333;
}

.refresh-btn {
  padding: 8px 16px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.refresh-btn:hover:not(:disabled) {
  background: #4338ca;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hint {
  margin-top: 12px;
  font-size: 13px;
  color: #666;
}
</style>
