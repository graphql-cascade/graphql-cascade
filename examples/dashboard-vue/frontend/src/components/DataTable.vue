<script setup lang="ts">
import { useQuery } from '@urql/vue';
import { computed, ref } from 'vue';

const DATAROWS_QUERY = `
  query GetDataRows($filter: FilterInput) {
    dataRows(filter: $filter) {
      id
      category
      values
    }
  }
`;

interface DataRow {
  id: string;
  category: string;
  values: number[];
}

const filter = ref<{
  category?: string;
  minValue?: number;
  maxValue?: number;
}>({});

const result = useQuery({
  query: DATAROWS_QUERY,
  variables: computed(() => ({ filter: filter.value })),
});

const dataRows = computed<DataRow[]>(() => result.data.value?.dataRows || []);
const fetching = computed(() => result.fetching.value);
</script>

<template>
  <div class="data-table">
    <h3>Data Rows</h3>

    <div v-if="fetching" class="loading">Loading data...</div>

    <div v-else>
      <div class="filters">
        <select v-model="filter.category">
          <option value="">All categories</option>
          <option value="traffic">Traffic</option>
          <option value="sales">Sales</option>
          <option value="engagement">Engagement</option>
        </select>
        <input
          v-model.number="filter.minValue"
          type="number"
          placeholder="Min value"
        />
        <input
          v-model.number="filter.maxValue"
          type="number"
          placeholder="Max value"
        />
      </div>

      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Values</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in dataRows" :key="row.id">
            <td>{{ row.category }}</td>
            <td>{{ row.values.join(', ') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.data-table {
  margin-top: 30px;
}

.data-table h3 {
  margin-bottom: 15px;
  color: #333;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filters select,
.filters input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.filters select:focus,
.filters input:focus {
  outline: none;
  border-color: #4f46e5;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

th, td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
}

tbody tr:hover {
  background: #f8f9fa;
}
</style>