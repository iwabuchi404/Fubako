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

    <div v-else-if="sortedContents.length === 0" class="empty-state glass">
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
            <th
              v-for="col in displayColumns"
              :key="col.key"
              class="sortable-header"
              @click="toggleSort(col.key)"
            >
              {{ col.label.toUpperCase() }}
              <span v-if="sortKey === col.key" class="sort-indicator">
                {{ sortOrder === 'asc' ? '▲' : '▼' }}
              </span>
            </th>
            <th class="col-actions">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in paginatedContents" :key="item.slug">
            <td>
              <span
                class="status-badge"
                :class="getPublishStatus(item).class"
              >
                {{ getPublishStatus(item).label }}
              </span>
            </td>
            <td v-for="col in displayColumns" :key="col.key" class="data-cell">
              {{ getNestedValue(item, col.key) || '-' }}
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

    <!-- ページネーション -->
    <div v-if="totalPages > 1" class="pagination">
      <button
        class="btn-page"
        :disabled="currentPage === 1"
        @click="goToPage(currentPage - 1)"
      >
        前へ
      </button>
      <span class="page-info">
        {{ currentPage }} / {{ totalPages }}（全{{ sortedContents.length }}件）
      </span>
      <button
        class="btn-page"
        :disabled="currentPage === totalPages"
        @click="goToPage(currentPage + 1)"
      >
        次へ
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectStore } from '../stores/project'
import dayjs from 'dayjs'

const route = useRoute()
const projectStore = useProjectStore()

const type = computed(() => route.params.type)
const contents = computed(() => projectStore.contents[type.value] || [])
const loading = computed(() => projectStore.isLoading(`contents/${type.value}`))

// ソート状態
const sortKey = ref(null)
const sortOrder = ref(null) // 'asc' | 'desc' | null

// ページネーション状態
const PAGE_SIZE = 50
const currentPage = ref(1)

// コンテンツタイプ切替時にソート・ページをリセット
watch(type, () => {
  sortKey.value = null
  sortOrder.value = null
  currentPage.value = 1
  loadContents()
})

// ページ遷移時に強制リフレッシュ（キャッシュクリア）
watch(() => route.path, (newPath, oldPath) => {
  // コンテンツ一覧画面に戻ってきた時のみリロード
  if (newPath.startsWith('/contents/') && newPath !== oldPath) {
    console.log('[ContentsListView] Force refreshing contents due to navigation')
    loadContents()
  }
})

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

// ドットキー対応のネスト値取得（extra.category など）
function getNestedValue(obj, keyPath) {
  const value = keyPath.split('.').reduce((o, k) => o?.[k], obj)

  // 日付フィールドの場合はフォーマット
  if (keyPath === 'date' && value) {
    try {
      return dayjs(value).format('YYYY/MM/DD')
    } catch {
      return value
    }
  }

  return value
}

// ソート済みコンテンツ
const sortedContents = computed(() => {
  const list = [...contents.value]
  if (!sortKey.value || !sortOrder.value) return list

  const key = sortKey.value
  const order = sortOrder.value

  return list.sort((a, b) => {
    const valA = getNestedValue(a, key) ?? ''
    const valB = getNestedValue(b, key) ?? ''

    // 日付カラムの場合
    if (key === 'date') {
      const diff = new Date(valA) - new Date(valB)
      return order === 'asc' ? diff : -diff
    }

    // 文字列比較
    const cmp = String(valA).localeCompare(String(valB))
    return order === 'asc' ? cmp : -cmp
  })
})

// ページネーション
const totalPages = computed(() => {
  return Math.ceil(sortedContents.value.length / PAGE_SIZE) || 1
})

const paginatedContents = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return sortedContents.value.slice(start, start + PAGE_SIZE)
})

function goToPage(page) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

// ソート切替: asc → desc → リセット
function toggleSort(colKey) {
  if (sortKey.value === colKey) {
    if (sortOrder.value === 'asc') {
      sortOrder.value = 'desc'
    } else {
      sortKey.value = null
      sortOrder.value = null
    }
  } else {
    sortKey.value = colKey
    sortOrder.value = 'asc'
  }
  currentPage.value = 1
}

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
  try {
    await projectStore.fetchContents(type.value)
  } catch (error) {
    console.error('Failed to load contents:', error)
  }
}

async function handleDelete(slug, title) {
  if (!confirm(`「${title || slug}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
    return
  }

  try {
    await projectStore.deleteContent(type.value, slug)
  } catch (error) {
    console.error('Delete error:', error)
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

.title-area {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.type-tag {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.25em;
  display: block;
}

.header h2 {
  font-size: 2rem;
  margin: 0;
  letter-spacing: -0.02em;
}

.table-container {
  overflow: hidden;
  border-radius: var(--radius-lg);
}

.contents-table {
  width: 100%;
  border-collapse: collapse;
}

.col-status { width: 150px; }
.col-actions { width: 200px; text-align: right !important; }

.sortable-header {
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}

.sortable-header:hover {
  color: var(--color-primary);
}

.sort-indicator {
  font-size: 0.6rem;
  margin-left: 0.25rem;
  opacity: 0.8;
}

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
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.1);
}

.status-draft {
  color: var(--color-text-dim);
  border-color: rgba(148, 163, 184, 0.2);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  padding: 1.5rem 0;
}

.page-info {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--color-text-dim);
  letter-spacing: 0.05em;
}

.btn-page {
  padding: 0.4rem 1rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  color: var(--color-text-main);
  transition: all 0.15s;
}

.btn-page:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-page:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.loading {
  padding: 10vh 0;
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 0.9rem;
}

.empty-state {
  padding: 4rem 2rem;
  text-align: center;
  border: 1px dashed var(--glass-border);
}

.empty-state p {
  color: var(--color-text-dim);
  font-size: 1.1rem;
  margin: 0 0 2rem 2rem;
}
</style>
