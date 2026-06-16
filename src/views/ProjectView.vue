<template>
  <div class="project-view fade-in-up">
    <header class="page-header">
      <h1>{{ $t('project.title') }}</h1>
    </header>

    <!-- 現在のプロジェクト -->
    <section class="settings-section glass">
      <h2 class="section-title">{{ $t('project.currentProject') }}</h2>

      <div v-if="projectStore.isLoaded" class="current-project">
        <div class="project-info">
          <div class="project-name">{{ projectStore.config?.site?.name || '-' }}</div>
          <div class="project-path">{{ projectStore.projectPath }}</div>
        </div>
        <button @click="handleOpenProject" class="btn-secondary">
          {{ $t('project.changeProject') }}
        </button>
      </div>

      <div v-else class="no-project">
        <p>{{ $t('project.noProject') }}</p>
        <button @click="handleOpenProject" class="btn-primary">
          {{ $t('project.openProject') }}
        </button>
      </div>
    </section>

    <!-- 最近使ったプロジェクト -->
    <section class="settings-section glass">
      <h2 class="section-title">{{ $t('project.recentWorkspaces') }}</h2>

      <div v-if="loadingHistory" class="history-loading">
        <span>{{ $t('common.loading') }}</span>
      </div>

      <div v-else-if="history.length === 0" class="no-history">
        <p>{{ $t('project.noRecent') }}</p>
      </div>

      <ul v-else class="history-list">
        <li
          v-for="item in history"
          :key="item.path"
          class="history-item"
          :class="{ 'is-current': item.path === projectStore.projectPath }"
        >
          <div class="history-info">
            <span class="history-name">{{ item.name || item.path.split(/[/\\]/).pop() }}</span>
            <span class="history-path">{{ item.path }}</span>
          </div>
          <div class="history-actions">
            <span v-if="item.path === projectStore.projectPath" class="current-badge">
              現在
            </span>
            <button
              v-else
              @click="handleSwitch(item.path)"
              class="btn-secondary btn-sm"
              :disabled="switching"
            >
              {{ $t('project.switchTo') }}
            </button>
            <button
              @click="handleRemove(item.path)"
              class="btn-remove btn-sm"
              :disabled="switching"
              :title="$t('project.removeHistory')"
            >
              ×
            </button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useProjectStore } from '../stores/project'

const projectStore = useProjectStore()

const history = ref([])
const loadingHistory = ref(true)
const switching = ref(false)

async function loadHistory() {
  loadingHistory.value = true
  try {
    const result = await window.electronAPI.getProjectHistory()
    history.value = result || []
  } catch {
    history.value = []
  } finally {
    loadingHistory.value = false
  }
}

async function handleOpenProject() {
  await projectStore.openProject()
  await loadHistory()
}

async function handleSwitch(path) {
  switching.value = true
  try {
    await projectStore.openProjectFromHistory(path)
    await loadHistory()
  } finally {
    switching.value = false
  }
}

async function handleRemove(path) {
  try {
    await window.electronAPI.removeProjectHistory(path)
    await loadHistory()
  } catch {
    // 失敗時は履歴をリフレッシュするだけ
    await loadHistory()
  }
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.project-view {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  color: var(--color-text-main);
}

.settings-section {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 1.25rem 0;
  color: var(--color-text-main);
}

/* 現在のプロジェクト */
.current-project {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.project-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.project-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.project-path {
  font-size: 0.75rem;
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-project {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
}

.no-project p {
  margin: 0;
  color: var(--color-text-dim);
}

/* 履歴リスト */
.history-loading,
.no-history {
  color: var(--color-text-dim);
  font-size: 0.9rem;
  padding: 0.5rem 0;
}

.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--color-charcoal-deep);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  transition: border-color 0.2s;
}

.history-item.is-current {
  border-color: var(--color-primary);
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.history-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.history-path {
  font-size: 0.7rem;
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.current-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-primary);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.btn-sm {
  padding: 0.3rem 0.75rem;
  font-size: 0.8rem;
}

.btn-remove {
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--color-text-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-remove:hover:not(:disabled) {
  color: var(--color-error);
  border-color: var(--color-error);
  background: rgba(255, 107, 107, 0.1);
}

.btn-secondary {
  padding: 0.4rem 0.9rem;
  background: transparent;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--color-text-dim);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--color-text-main);
  color: var(--color-text-main);
}

.btn-secondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary {
  padding: 0.6rem 1.5rem;
  background: var(--color-primary);
  color: var(--color-charcoal-deep);
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #00c4ff;
  box-shadow: 0 0 12px rgba(0, 242, 255, 0.4);
}
</style>
