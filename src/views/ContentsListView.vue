<template>
  <div class="contents-list fade-in-up">
    <div class="header">
      <div class="title-area">
        <span class="type-tag">{{ type }}</span>
        <h2 class="text-glow">{{ contentTypeConfig?.label || type }}</h2>
      </div>
      <router-link :to="`/edit/${type}`" class="btn-primary">
        <span>新規エントリ作成</span>
        <i class="icon-plus"></i>
      </router-link>
    </div>

    <div v-if="loading" class="loading">
      <span>データの整合性を確認中...</span>
    </div>
    
    <div v-else-if="contents.length === 0" class="empty-state glass">
      <p>このディレクトリにはまだコンテンツが存在しません。</p>
      <router-link :to="`/edit/${type}`" class="btn-primary">
        最初のエントリを作成
      </router-link>
    </div>

    <div v-else class="table-container glass">
      <table class="contents-table">
        <thead>
          <tr>
            <th class="col-status">STATUS</th>
            <th v-for="col in displayColumns" :key="col.key">
              {{ col.label.toUpperCase() }}
            </th>
            <th class="col-actions">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in contents" :key="item.slug">
            <td>
              <span 
                class="status-badge" 
                :class="getPublishStatus(item).class"
              >
                {{ getPublishStatus(item).label }}
              </span>
            </td>
            <td v-for="col in displayColumns" :key="col.key" class="data-cell">
              {{ item[col.key] || '-' }}
            </td>
            <td class="actions-cell">
              <router-link
                :to="`/edit/${type}/${item.slug}`"
                class="btn-edit"
                title="編集"
              >
                編集
              </router-link>
              <button
                @click="handleDelete(item.slug, item.title)"
                class="btn-remove"
                title="削除"
              >
                削除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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
  return [
    { key: 'date', label: '日付' },
    { key: 'title', label: 'タイトル' }
  ]
})

function getPublishStatus(item) {
  if (item.draft) {
    return {
      label: 'DRAFT',
      class: 'status-draft'
    }
  }
  
  const publishDate = new Date(item.date)
  const now = new Date()
  
  if (publishDate > now) {
    return {
      label: 'SCHEDULED',
      class: 'status-scheduled'
    }
  }
  
  return {
    label: 'PUBLISHED',
    class: 'status-published'
  }
}

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

async function handleDelete(slug, title) {
  if (!confirm(`「${title || slug}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
    return
  }

  try {
    const result = await window.electronAPI.deleteContent(type.value, slug)
    if (result.success) {
      projectStore.notify('削除しました', 'success')
      await loadContents()
    } else {
      projectStore.notify('削除に失敗しました: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('Delete error:', error)
    projectStore.notify('削除に失敗しました', 'error')
  }
}

onMounted(() => {
  loadContents()
})
</script>

<style scoped>
.contents-list {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem 2.5rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 3rem;
}

.type-tag {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--color-text-dark);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  display: block;
}

.header h2 {
  font-size: 2.5rem;
  margin: 0;
  line-height: 1;
}

.table-container {
  overflow: hidden;
  border-radius: var(--radius-lg);
}

.contents-table {
  border: none;
}

.col-status { width: 150px; }
.col-actions { width: 200px; text-align: right !important; }

.data-cell {
  font-weight: 500;
  color: var(--color-text-main);
}

.actions-cell {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.status-badge {
  padding: 0.3rem 0.8rem;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 800;
  font-family: var(--font-mono);
  display: inline-block;
  letter-spacing: 0.05em;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
}

.status-published {
  color: var(--color-success);
  border-color: rgba(16, 185, 129, 0.2);
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.1);
}

.status-scheduled {
  color: var(--color-warning);
  border-color: rgba(245, 158, 11, 0.2);
}

.status-draft {
  color: var(--color-text-dim);
  border-color: rgba(148, 163, 184, 0.2);
}

.loading {
  padding: 10vh 0;
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 0.9rem;
}

.empty-state {
  border: 1px dashed var(--glass-border);
}
</style>
