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

        <div class="dashboard-right">

          <!-- サイト名（別枠） -->
          <div class="site-name-card glass">
            <span class="site-label">SITE</span>
            <span class="site-name">{{ projectStore.config?.site?.name }}</span>
          </div>

          <!-- ボタン群 -->
          <div class="dashboard-controls glass">

            <!-- 1段目: Git/エクスポート操作 -->
            <div class="action-row">
              <div v-if="showGitButtons" class="git-actions">
                <button
                  @click="handleGitSave"
                  class="btn-secondary btn-sm"
                  :disabled="!gitStore.canSave || gitStore.loading.commit"
                >
                  {{ gitStore.loading.commit ? 'アップ中...' : '保存してアップ' }}
                </button>
                <button
                  @click="handleGitFetch"
                  class="btn-secondary btn-sm"
                  :disabled="!gitStore.canFetch || gitStore.loading.fetch"
                >
                  {{ gitStore.loading.fetch ? '確認中...' : '更新を確認' }}
                </button>
                <button
                  @click="handleGitPublish"
                  class="btn-publish btn-sm"
                  :disabled="!gitStore.canPublish || gitStore.loading.merge"
                  :title="`${gitStore.settings?.developBranch} → ${gitStore.settings?.productionBranch} へ公開`"
                >
                  {{ gitStore.loading.merge ? '公開中...' : '公開する' }}
                </button>
              </div>

              <button
                @click="handleExport"
                class="btn-secondary btn-sm"
                :disabled="gitStore.loading.export"
              >
                {{ gitStore.loading.export ? 'エクスポート中...' : 'エクスポート' }}
              </button>
            </div>

            <!-- 2段目: プレビュー操作 + サイト確認 -->
            <div class="action-row action-row-preview">
              <button
                v-if="!projectStore.previewRunning"
                @click="handleStartPreview"
                class="btn-primary btn-sm"
                :disabled="previewStarting"
              >
                {{ previewStarting ? '起動中...' : 'プレビュー開始' }}
              </button>
              <button
                v-else
                @click="handleStopPreview"
                class="btn-secondary btn-sm"
              >
                プレビュー停止
              </button>

              <div class="divider"></div>

              <div class="site-link-group" :class="{ disabled: !projectStore.previewUrl }">
                <span class="site-link-label">ローカル</span>
                <button
                  class="btn-secondary btn-sm"
                  :disabled="!projectStore.previewUrl"
                  @click="openInBrowser(projectStore.previewUrl)"
                >
                  ブラウザで開く ↗
                </button>
              </div>

              <div class="divider"></div>

              <div class="site-link-group" :class="{ disabled: !productionUrl }">
                <span class="site-link-label">本番</span>
                <button
                  class="btn-secondary btn-sm"
                  :disabled="!productionUrl"
                  @click="openInBrowser(productionUrl)"
                >
                  ブラウザで開く ↗
                </button>
              </div>
            </div>

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
import { ref, onMounted, computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { useGitStore } from '../stores/git'
import { useRouter } from 'vue-router'

const projectStore = useProjectStore()
const gitStore = useGitStore()
const router = useRouter()

const previewStarting = ref(false)
const projectHistory = ref([])

// Gitボタンの表示条件
const showGitButtons = computed(() => gitStore.isGitEnabled)

// 本番URL（Git設定の productionBaseUrl）
const productionUrl = computed(() => gitStore.gitConfig?.productionBaseUrl || '')

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

async function handleStopPreview() {
  await projectStore.stopPreview()
}

async function openInBrowser(url) {
  if (!url) return
  await window.electronAPI.openInBrowser(url)
}

async function handleGitSave() {
  try {
    const result = await gitStore.commit(projectStore.projectPath, 'Update content')
    if (result.success) {
      // 画像が .gitignore で除外されている場合は警告
      if (result.warning === 'gitignore_images') {
        const count = result.ignoredFiles?.length || 0
        projectStore.notify(
          `画像ファイル ${count} 件が .gitignore により除外されています。プロジェクトの .gitignore から static/uploads/ の除外設定を削除してください。`,
          'warning'
        )
      }
      const pushResult = await gitStore.push(projectStore.projectPath)
      if (pushResult.success) {
        projectStore.notify('Gitに保存・プッシュしました', 'success')
      } else {
        projectStore.notify('保存しましたがプッシュに失敗しました: ' + pushResult.error, 'warning')
      }
    } else {
      projectStore.notify('保存に失敗しました: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('Git save error:', error)
    projectStore.notify('保存エラー', 'error')
  }
}

async function handleGitFetch() {
  try {
    const result = await gitStore.fetch(projectStore.projectPath)
    if (result.success) {
      if (gitStore.hasRemoteUpdates) {
        projectStore.notify('リモートに更新があります', 'info')
      } else {
        projectStore.notify('更新はありません', 'success')
      }
    } else {
      projectStore.notify('更新に失敗しました: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('Git fetch error:', error)
    projectStore.notify('更新に失敗しました', 'error')
  }
}

async function handleGitPublish() {
  const developBranch = gitStore.settings?.developBranch || 'develop'
  const productionBranch = gitStore.settings?.productionBranch || 'main'
  const confirmed = window.confirm(`「${developBranch}」ブランチを「${productionBranch}」ブランチへ公開します。\nよろしいですか？`)
  if (!confirmed) return

  try {
    const result = await gitStore.mergeToProduction(projectStore.projectPath)
    if (result.success) {
      projectStore.notify('本番環境へ公開しました', 'success')
    } else {
      projectStore.notify('公開に失敗しました: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('Publish error:', error)
    projectStore.notify('公開に失敗しました', 'error')
  }
}

async function handleExport() {
  try {
    const result = await gitStore.exportDist(projectStore.projectPath)
    if (result.success) {
      projectStore.notify('dist/をエクスポートしました', 'success')
    } else {
      projectStore.notify('エクスポートに失敗しました: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('Export error:', error)
    projectStore.notify('エクスポートに失敗しました', 'error')
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
  align-items: flex-start;
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

/* サイト名 + ボタン群の縦並びラッパー */
.dashboard-right {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: stretch;
}

/* サイト名カード */
.site-name-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1.25rem;
  background: var(--color-charcoal-main);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.site-label {
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--color-text-dark);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.site-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-primary);
}

.dashboard-controls {
  display: flex;
  flex-direction: column;
  padding: 0.6rem 1.25rem;
  background: var(--color-charcoal-main);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  gap: 0.6rem;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.action-row-preview {
  border-top: 1px solid var(--glass-border);
  padding-top: 0.5rem;
  justify-content: flex-end;
}

.site-link-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.site-link-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.site-link-group.disabled .site-link-label {
  color: var(--color-text-dark);
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

.git-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.git-actions .btn-sm:last-child {
  margin-left: 0.25rem; /* 公開するボタンを少し離す */
}

.btn-sm {
  padding: 0.4rem 1rem;
  font-size: 0.75rem;
}

.btn-publish {
  padding: 0.4rem 1rem;
  font-size: 0.75rem;
  background: linear-gradient(135deg, var(--color-primary), #00b4d8);
  color: var(--color-charcoal-deep);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.03em;
}

.btn-publish:hover:not(:disabled) {
  opacity: 0.85;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 242, 255, 0.4);
}

.btn-publish:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
