<template>
  <div class="contents-list">
    <div class="header">
      <h2>{{ contentTypeConfig?.label || type }}</h2>
      <router-link :to="`/edit/${type}`" class="btn-primary">
        新規作成
      </router-link>
    </div>

    <div v-if="loading" class="loading">読み込み中...</div>
    
    <div v-else-if="contents.length === 0" class="empty-state">
      <p>まだコンテンツがありません</p>
      <router-link :to="`/edit/${type}`" class="btn-primary">
        最初のコンテンツを作成
      </router-link>
    </div>

    <table v-else class="contents-table">
      <thead>
        <tr>
          <th v-for="col in displayColumns" :key="col.key">
            {{ col.label }}
          </th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in contents" :key="item.slug">
          <td v-for="col in displayColumns" :key="col.key">
            {{ item[col.key] || '-' }}
          </td>
          <td>
            <router-link 
              :to="`/edit/${type}/${item.slug}`"
              class="btn-edit"
            >
              編集
            </router-link>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectStore } from '../stores/project'

const route = useRoute()
const projectStore = useProjectStore()

const type = computed(() => route.params.type)
const contents = ref([])
const loading = ref(false)

const contentTypeConfig = computed(() => {
  return projectStore.config?.content_types?.[type.value]
})

const displayColumns = computed(() => {
  const cols = contentTypeConfig.value?.list_columns
  if (cols && cols.length > 0) {
    return cols
  }
  // デフォルトカラム
  return [
    { key: 'date', label: '日付' },
    { key: 'title', label: 'タイトル' }
  ]
})

async function loadContents() {
  loading.value = true
  try {
    const result = await window.electronAPI.listContents(type.value)
    contents.value = result
  } catch (error) {
    console.error('Failed to load contents:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadContents()
})
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h2 {
  margin: 0;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #7f8c8d;
}

.empty-state {
  text-align: center;
  padding: 3rem;
}

.empty-state p {
  color: #7f8c8d;
  margin-bottom: 1rem;
}

.contents-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.contents-table th,
.contents-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e1e4e8;
}

.contents-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.contents-table tbody tr:hover {
  background: #f8f9fa;
}

.btn-primary {
  padding: 0.5rem 1rem;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-edit {
  padding: 0.25rem 0.75rem;
  background: #ecf0f1;
  color: #2c3e50;
  border-radius: 4px;
  text-decoration: none;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-edit:hover {
  background: #d5dbdb;
}
</style>
