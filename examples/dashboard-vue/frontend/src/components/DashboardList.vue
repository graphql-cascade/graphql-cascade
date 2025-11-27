<script setup lang="ts">
import { useQuery, useMutation } from '@urql/vue';
import { computed, ref } from 'vue';

const DASHBOARDS_QUERY = `
  query GetDashboards {
    dashboards {
      id
      name
      widgets
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_DASHBOARD_MUTATION = `
  mutation UpdateDashboard($id: ID!, $input: UpdateDashboardInput!) {
    updateDashboard(id: $id, input: $input) {
      success
      data {
        id
        name
        widgets
        updatedAt
      }
      cascade {
        updated {
          __typename
          id
        }
      }
    }
  }
`;

interface Dashboard {
  id: string;
  name: string;
  widgets: string[];
  createdAt: string;
  updatedAt: string;
}

const result = useQuery({ query: DASHBOARDS_QUERY });
const updateMutation = useMutation(UPDATE_DASHBOARD_MUTATION);

const dashboards = computed<Dashboard[]>(() => result.data.value?.dashboards || []);
const fetching = computed(() => result.fetching.value);

const editingId = ref<string | null>(null);
const editName = ref('');

function startEdit(dashboard: Dashboard) {
  editingId.value = dashboard.id;
  editName.value = dashboard.name;
}

function cancelEdit() {
  editingId.value = null;
  editName.value = '';
}

async function saveEdit(id: string) {
  await updateMutation.executeMutation({
    id,
    input: { name: editName.value },
  });

  editingId.value = null;
  editName.value = '';

  // Refetch dashboards
  result.executeQuery({ requestPolicy: 'network-only' });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
</script>

<template>
  <div class="dashboard-list">
    <h2>Dashboards</h2>

    <div v-if="fetching" class="loading">Loading dashboards...</div>

    <div v-else class="dashboards">
      <div
        v-for="dashboard in dashboards"
        :key="dashboard.id"
        class="dashboard-card"
      >
        <div class="dashboard-header">
          <template v-if="editingId === dashboard.id">
            <input
              v-model="editName"
              class="edit-input"
              @keyup.enter="saveEdit(dashboard.id)"
              @keyup.escape="cancelEdit"
            />
            <div class="edit-actions">
              <button class="save-btn" @click="saveEdit(dashboard.id)">Save</button>
              <button class="cancel-btn" @click="cancelEdit">Cancel</button>
            </div>
          </template>
          <template v-else>
            <h3>{{ dashboard.name }}</h3>
            <button class="edit-btn" @click="startEdit(dashboard)">Edit</button>
          </template>
        </div>

        <div class="widgets">
          <span v-for="widget in dashboard.widgets" :key="widget" class="widget-tag">
            {{ widget }}
          </span>
        </div>

        <div class="dashboard-meta">
          <span>Created: {{ formatDate(dashboard.createdAt) }}</span>
          <span>Updated: {{ formatDate(dashboard.updatedAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-list h2 {
  margin-bottom: 20px;
  color: #333;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.dashboards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.dashboard-header h3 {
  color: #333;
  font-size: 18px;
}

.edit-btn {
  padding: 6px 12px;
  background: #e0e0e0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.edit-btn:hover {
  background: #d0d0d0;
}

.edit-input {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid #4f46e5;
  border-radius: 4px;
  font-size: 16px;
  margin-right: 10px;
}

.edit-actions {
  display: flex;
  gap: 8px;
}

.save-btn {
  padding: 6px 12px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn {
  padding: 6px 12px;
  background: #e0e0e0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.widgets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.widget-tag {
  padding: 4px 10px;
  background: #e0e7ff;
  color: #4f46e5;
  border-radius: 4px;
  font-size: 13px;
}

.dashboard-meta {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #666;
}
</style>
