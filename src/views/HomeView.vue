<template>
  <div class="home-view">
    <!-- Welcome Screen (Not Loaded) -->
    <div v-show="!projectStore.isLoaded" class="welcome-screen fade-in-up">
      <div class="hero-section">
        <span class="version-tag">Alpha v0.2.0</span>
        <h1 class="hero-title text-glow">FUBAKO</h1>
        <p class="hero-subtitle">The Digital Workbench for Modern Creators.</p>
        
        <div class="main-actions">
          <button @click="handleOpenProject" class="btn-primary btn-hero">
            <span>プロジェクトを新規に開く</span>
            <i class="icon-folder-open"></i>
          </button>
        </div>
      </div>

      <div v-if="projectHistory.length > 0" class="history-section">
        <h3 class="section-label">最近のワークスペース</h3>
        <div class="history-grid">
          <div
            v-for="item in projectHistory"
            :key="item.path"
            class="history-card glass"
            @click="handleOpenFromHistory(item.path)"
          >
            <div class="history-head">
              <span class="project-name">{{ item.name }}</span>
              <button
                class="history-remove"
                @click.stop="handleRemoveHistory(item.path)"
                title="履歴から削除"
              >
                &times;
              </button>
            </div>
            <span class="project-path">{{ item.path }}</span>
            <span class="project-date">{{ formatDate(item.lastOpened) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Dashboard (Loaded) -->
    <div v-show="projectStore.isLoaded" class="dashboard fade-in-up">
      <header class="dashboard-header">
        <div class="header-main">
          <h2>Dashboard</h2>
          <p class="project-path-display">{{ projectStore.projectPath }}</p>
        </div>
        
        <div class="dashboard-controls glass">
          <div class="site-badge">
            <span class="label">SITE</span>
            <span class="value">{{ projectStore.config?.site?.name }}</span>
          </div>
          <div class="divider"></div>
          <div class="preview-actions">
            <button 
              v-if="!projectStore.previewRunning"
              @click="handleStartPreview" 
              class="btn-primary btn-sm" 
              :disabled="previewStarting"
            >
              {{ previewStarting ? '起動中...' : 'プレビュー開始' }}
            </button>
            <a 
              v-if="projectStore.previewUrl" 
              :href="projectStore.previewUrl" 
              target="_blank" 
              class="btn-secondary btn-sm"
            >
              サイトを見る
            </a>
          </div>
        </div>
      </header>

      <div class="content-types-grid">
        <div 
          v-for="contentType in projectStore.contentTypes" 
          :key="contentType.key"
          class="content-type-card glass"
        >
          <div class="card-glow"></div>
          <div class="card-content">
            <span class="content-key">{{ contentType.key }}</span>
            <h3>{{ contentType.label }}</h3>
            <p class="content-folder">{{ contentType.folder }}</p>
            <div class="card-footer">
              <router-link 
                :to="`/contents/${contentType.key}`"
                class="btn-secondary btn-full"
              >
                一覧
              </router-link>
              <router-link 
                :to="`/edit/${contentType.key}`"
                class="btn-primary btn-full"
              >
                新規
              </router-link>
            </div>
          </div>
        </div>

        <!-- 設定カード（特別デザイン） -->
        <router-link to="/settings" class="settings-card-link">
          <div class="content-type-card settings-card glass">
            <div class="card-content">
              <span class="content-key">SYSTEM</span>
              <h3>サイト設定 ⚙️</h3>
              <p>名称、SEO、SNS、基本構成</p>
              <div class="card-footer">
                <span class="btn-primary btn-full">設定を開く</span>
              </div>
            </div>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useProjectStore } from '../stores/project'
import { useRouter } from 'vue-router'

const projectStore = useProjectStore()
const router = useRouter()

const previewStarting = ref(false)
const projectHistory = ref([])

async function loadHistory() {
  try {
    projectHistory.value = await window.electronAPI.getProjectHistory()
  } catch (error) {
    console.error('Failed to load project history:', error)
  }
}

async function handleOpenProject() {
  const success = await projectStore.openProject()
  if (success) {
    router.push('/')
  }
}

async function handleOpenFromHistory(projectPath) {
  const success = await projectStore.openProjectFromHistory(projectPath)
  if (success) {
    router.push('/')
  } else {
    await loadHistory()
  }
}

async function handleRemoveHistory(projectPath) {
  await window.electronAPI.removeProjectHistory(projectPath)
  await loadHistory()
}

function formatDate(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  if (!projectStore.isLoaded) {
    loadHistory()
  }
})

async function handleStartPreview() {
  previewStarting.value = true
  try {
    const result = await projectStore.startPreview()
    if (result.success) {
      // Notification handled by store
    }
  } catch (error) {
    console.error('Preview error:', error)
  } finally {
    previewStarting.value = false
  }
}
</script>

<style scoped>
.home-view {
  width: 100%;
  padding: 1.5rem 2rem;
}

/* --- Welcome Screen --- */
.welcome-screen {
  padding: 10vh 2rem;
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

.hero-section {
  text-align: left;
  border-left: 2px solid var(--color-primary);
  padding-left: 2rem;
}

.version-tag {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--color-text-dark);
  border: 1px solid var(--glass-border);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1rem;
  display: inline-block;
  background: rgba(255, 255, 255, 0.03);
}

.hero-title {
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
  color: var(--color-text-main);
}

.hero-subtitle {
  color: var(--color-text-dim);
  font-size: 1rem;
  font-weight: 400;
  margin-bottom: 2rem;
}

.btn-hero {
  padding: 0.75rem 2rem;
  font-size: 0.9rem;
  font-weight: 700;
  box-shadow: none;
}

.history-section {
  width: 100%;
}

.section-label {
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-text-dark);
  margin-bottom: 1.25rem;
  text-align: left;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.section-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--glass-border);
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem;
}

.history-card {
  padding: 1.25rem;
  background: var(--color-charcoal-main);
  border: 1px solid var(--glass-border);
  transition: all 0.2s ease;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  border-radius: var(--radius-md);
}

.history-card:hover {
  border-color: var(--color-primary);
  background: var(--color-charcoal-light);
  transform: translateY(-2px);
}

.history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.project-name {
  font-weight: 600;
  color: var(--color-text-main);
  font-size: 1rem;
}

.project-path {
  font-size: 0.75rem;
  color: var(--color-text-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-date {
  font-size: 0.7rem;
  color: var(--color-text-dark);
  margin-top: 0.4rem;
}

.history-remove {
  background: transparent;
  border: none;
  color: var(--color-text-dark);
  font-size: 1rem;
  cursor: pointer;
  transition: color 0.2s;
}

.history-remove:hover {
  color: var(--color-error);
}

/* --- Dashboard --- */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 2rem;
}

.dashboard-header h2 {
  font-size: 1.75rem;
  margin-bottom: 0.25rem;
}

.project-path-display {
  font-size: 0.75rem;
  color: var(--color-text-dark);
  font-family: var(--font-mono);
}

.dashboard-controls {
  display: flex;
  align-items: center;
  padding: 0.6rem 1.25rem;
  background: var(--color-charcoal-main);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  gap: 1.25rem;
}

.site-badge {
  display: flex;
  flex-direction: column;
}

.site-badge .label {
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--color-text-dark);
}

.site-badge .value {
  font-weight: 500;
  font-size: 0.85rem;
  color: var(--color-primary);
}

.divider {
  width: 1px;
  height: 24px;
  background: var(--glass-border);
}

.preview-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.4rem 1rem;
  font-size: 0.75rem;
}

.content-types-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.content-type-card {
  min-height: 160px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.2s;
  background: var(--color-charcoal-main);
  border: 1px solid var(--glass-border);
}

.content-type-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
}

.content-key {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--color-primary);
  text-transform: uppercase;
  margin-bottom: 0.4rem;
}

.content-type-card h3 {
  font-size: 1.25rem;
  margin-bottom: 0.4rem;
}

.content-folder {
  color: var(--color-text-dark);
  font-size: 0.75rem;
  margin-bottom: 1.5rem;
}

.card-footer {
  display: flex;
  gap: 0.75rem;
}

.btn-full {
  flex: 1;
}

.settings-card-link {
  text-decoration: none;
}

.settings-card {
  background: var(--color-charcoal-light);
  border: 1px solid var(--glass-border);
}

.settings-card:hover {
  background: var(--color-charcoal-muted);
  border-color: var(--color-primary);
}
</style>
