<template>
  <div class="home-view">
    <!-- Welcome Screen (Not Loaded) -->
    <div v-show="!projectStore.isLoaded" class="welcome-screen fade-in-up">
      <div class="hero-section">
        <div class="hero-header">
          <span class="version-tag">Alpha v0.2.0</span>
          <div class="lang-switcher">
            <button @click="changeLanguage('ja')" :class="{ active: currentLocale === 'ja' }">JA</button>
            <button @click="changeLanguage('en')" :class="{ active: currentLocale === 'en' }">EN</button>
          </div>
        </div>
        <h1 class="hero-title text-glow">FUBAKO</h1>
        <p class="hero-subtitle">{{ $t('home.hero.subtitle') }}</p>
        
        <div class="main-actions">
          <button @click="handleOpenProject" class="btn-primary btn-hero">
            <span>{{ $t('home.openProject') }}</span>
            <i class="icon-folder-open"></i>
          </button>
        </div>
      </div>

      <div v-if="projectHistory.length > 0" class="history-section">
        <h3 class="section-label">{{ $t('home.recentWorkspaces') }}</h3>
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
                title="Remove from history"
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
          <h2>{{ $t('home.dashboard') }}</h2>
          <p class="project-path-display">{{ projectStore.projectPath }}</p>
        </div>

        <div class="dashboard-right">
          <!-- サイト名（別枠） -->
          <div class="site-name-card glass">
            <span class="site-label">SITE</span>
            <span class="site-name">{{ projectStore.config?.site?.name }}</span>
            <div class="lang-switcher-mini">
              <button @click="changeLanguage('ja')" :class="{ active: currentLocale === 'ja' }">JA</button>
              <button @click="changeLanguage('en')" :class="{ active: currentLocale === 'en' }">EN</button>
            </div>
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
                  :title="gitActionReasons.save"
                >
                  {{ gitStore.loading.commit ? $t('home.git.saving') : $t('home.git.saveAndPush') }}
                </button>
                <button
                  @click="handleGitFetch"
                  class="btn-secondary btn-sm"
                  :disabled="!gitStore.canFetch || gitStore.loading.fetch"
                  :title="gitActionReasons.fetch"
                >
                  {{ gitStore.loading.fetch ? $t('home.git.checking') : $t('home.git.checkUpdate') }}
                </button>
                <button
                  @click="handleGitPublish"
                  class="btn-publish btn-sm"
                  :disabled="!canStartPublish || gitStore.loading.merge"
                  :title="gitActionReasons.publish"
                >
                  {{ gitStore.loading.merge ? $t('home.git.publishing') : $t('home.git.publish') }}
                </button>
              </div>

              <button
                @click="handleExport"
                class="btn-secondary btn-sm"
                :disabled="gitStore.loading.export"
              >
                {{ gitStore.loading.export ? $t('home.export.exporting') : $t('home.export.label') }}
              </button>
            </div>

            <div v-if="showGitButtons" class="publish-checklist">
              <div class="publish-checklist-header">
                <span>{{ $t('home.git.publishChecks.title') }}</span>
                <strong :class="canStartPublish ? 'status-ready' : 'status-blocked'">
                  {{ canStartPublish ? $t('home.git.publishChecks.ready') : $t('home.git.publishChecks.blocked') }}
                </strong>
              </div>
              <div class="publish-checks">
                <span
                  v-for="check in publishChecks"
                  :key="check.key"
                  class="publish-check"
                  :class="{ ok: check.ok }"
                >
                  <span class="check-dot"></span>
                  {{ check.label }}
                </span>
              </div>
            </div>

            <!-- 2段目: プレビュー操作 + サイト確認 -->
            <div class="action-row action-row-preview">
              <button
                v-if="!projectStore.previewRunning"
                @click="handleStartPreview"
                class="btn-primary btn-sm"
                :disabled="previewStarting"
              >
                {{ previewStarting ? $t('home.preview.starting') : $t('home.preview.start') }}
              </button>
              <button
                v-else
                @click="handleStopPreview"
                class="btn-secondary btn-sm"
              >
                {{ $t('home.preview.stop') }}
              </button>

              <div class="divider"></div>

              <div class="site-link-group" :class="{ disabled: !projectStore.previewUrl }">
                <span class="site-link-label">{{ $t('home.preview.local') }}</span>
                <button
                  class="btn-secondary btn-sm"
                  :disabled="!projectStore.previewUrl"
                  @click="openInBrowser(projectStore.previewUrl)"
                >
                  {{ $t('home.preview.openBrowser') }}
                </button>
              </div>

              <div class="divider"></div>

              <div class="site-link-group" :class="{ disabled: !productionUrl }">
                <span class="site-link-label">{{ $t('home.preview.production') }}</span>
                <button
                  class="btn-secondary btn-sm"
                  :disabled="!productionUrl"
                  @click="openInBrowser(productionUrl)"
                >
                  {{ $t('home.preview.openBrowser') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- コンフリクト解決パネル -->
      <div v-if="showConflictPanel" class="conflict-panel glass fade-in-up">
        <h3 class="conflict-title">{{ $t('git.conflictTitle') }}</h3>
        <p class="conflict-description">{{ $t('git.conflictDescription') }}</p>

        <div class="conflict-files-list">
          <div
            v-for="file in conflictFiles"
            :key="file"
            class="conflict-file-item"
          >
            <span class="conflict-file-path">{{ file }}</span>
            <div class="conflict-file-actions">
              <button
                @click="handleResolveConflict(file, 'local')"
                class="btn-conflict"
                :class="{ selected: conflictResolutions[file] === 'local' }"
              >
                {{ $t('git.keepLocal') }}
              </button>
              <button
                @click="handleResolveConflict(file, 'remote')"
                class="btn-conflict"
                :class="{ selected: conflictResolutions[file] === 'remote' }"
              >
                {{ $t('git.keepRemote') }}
              </button>
            </div>
          </div>
        </div>

        <div class="conflict-footer">
          <button
            @click="handleAbortMerge"
            class="btn-secondary"
          >
            {{ $t('git.cancelMerge') }}
          </button>
          <button
            @click="handleCompleteMerge"
            class="btn-primary"
            :disabled="!isAllConflictsResolved"
          >
            {{ $t('git.completeMerge') }}
          </button>
        </div>
      </div>

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
                {{ $t('home.contents.list') }}
              </router-link>
              <router-link 
                :to="`/edit/${contentType.key}`"
                class="btn-primary btn-full"
              >
                {{ $t('home.contents.new') }}
              </router-link>
            </div>
          </div>
        </div>

        <!-- 設定カード（特別デザイン） -->
        <router-link to="/settings" class="settings-card-link">
          <div class="content-type-card settings-card glass">
            <div class="card-content">
              <span class="content-key">SYSTEM</span>
              <h3>{{ $t('home.siteSettings.title') }}</h3>
              <p>{{ $t('home.siteSettings.description') }}</p>
              <div class="card-footer">
                <span class="btn-primary btn-full">{{ $t('home.siteSettings.open') }}</span>
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
import { useI18n } from 'vue-i18n'
const { locale, t } = useI18n()

const previewStarting = ref(false)
const projectHistory = ref([])

// コンフリクト解決パネルの状態
const showConflictPanel = ref(false)
const conflictFiles = ref([])
const conflictResolutions = ref({}) // { file: 'local' | 'remote' }

const currentLocale = computed(() => locale.value)

// 全てのコンフリクトが解決されたかどうか
const isAllConflictsResolved = computed(() => {
  return conflictFiles.value.length > 0 &&
    conflictFiles.value.every(file => conflictResolutions.value[file])
})

async function changeLanguage(lang) {
  locale.value = lang
  localStorage.setItem('fubako-locale', lang)
  // Electron側にも通知
  if (window.electronAPI.setLocale) {
    await window.electronAPI.setLocale(lang)
  }
}

// Gitボタンの表示条件
const showGitButtons = computed(() => gitStore.isGitEnabled)

// 本番URL（Git設定の productionBaseUrl）
const productionUrl = computed(() => gitStore.gitConfig?.productionBaseUrl || '')

const developBranchName = computed(() => gitStore.settings?.developBranch || 'develop')
const productionBranchName = computed(() => gitStore.settings?.productionBranch || 'production')

const publishChecks = computed(() => [
  {
    key: 'repo',
    ok: gitStore.isRepo,
    label: t('home.git.publishChecks.repo')
  },
  {
    key: 'remote',
    ok: gitStore.hasRemote,
    label: t('home.git.publishChecks.remote')
  },
  {
    key: 'branch',
    ok: gitStore.currentBranch === developBranchName.value,
    label: t('home.git.publishChecks.branch', { develop: developBranchName.value })
  },
  {
    key: 'clean',
    ok: !gitStore.hasUncommittedChanges && !gitStore.isAheadOfRemote,
    label: t('home.git.publishChecks.clean')
  },
  {
    key: 'synced',
    ok: !gitStore.isBehindRemote && !gitStore.hasRemoteUpdates,
    label: t('home.git.publishChecks.synced')
  }
])

const canStartPublish = computed(() => {
  return gitStore.isGitEnabled && publishChecks.value.every(check => check.ok)
})

const gitActionReasons = computed(() => {
  const publishTitle = t('home.git.publishTitle', {
    develop: developBranchName.value,
    production: productionBranchName.value
  })

  let publish = publishTitle
  if (!gitStore.hasRemote) {
    publish = t('home.git.disabled.noRemote')
  } else if (gitStore.currentBranch !== developBranchName.value) {
    publish = t('home.git.disabled.wrongBranch', { develop: developBranchName.value })
  } else if (gitStore.hasUncommittedChanges) {
    publish = t('home.git.disabled.uncommitted')
  } else if (gitStore.isAheadOfRemote) {
    publish = t('home.git.disabled.ahead')
  } else if (gitStore.isBehindRemote || gitStore.hasRemoteUpdates) {
    publish = t('home.git.disabled.behind')
  }

  return {
    save: gitStore.canSave ? t('home.git.saveAndPush') : t('home.git.disabled.noChanges'),
    fetch: gitStore.canFetch ? t('home.git.checkUpdate') : t('home.git.disabled.noRemote'),
    publish
  }
})

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
  return date.toLocaleDateString(locale.value === 'ja' ? 'ja-JP' : 'en-US', {
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
          t('home.gitIgnoreWarning', { count }),
          'warning'
        )
      }
      const pushResult = await gitStore.push(projectStore.projectPath)
      if (pushResult.success) {
        projectStore.notify(t('git.saveSuccess'), 'success')
      } else {
        projectStore.notify(t('git.savePushFailed', { error: pushResult.error }), 'warning')
      }
    } else {
      projectStore.notify(t('git.saveFailed', { error: result.error }), 'error')
    }
  } catch (error) {
    console.error('Git save error:', error)
    projectStore.notify(t('git.saveError'), 'error')
  }
}

async function handleGitFetch() {
  try {
    const result = await gitStore.pull(projectStore.projectPath)
    if (result.success) {
      if (result.isConflict) {
        // コンフリクト発生: パネルを表示
        conflictFiles.value = result.conflictFiles || []
        conflictResolutions.value = {}
        showConflictPanel.value = true
      } else if (result.upToDate) {
        projectStore.notify(t('git.syncUpToDate'), 'info')
      } else if (result.fastForwarded || result.merged) {
        projectStore.notify(t('git.syncFastForwarded'), 'success')
      }
    } else {
      projectStore.notify(t('git.syncFailed', { error: result.error }), 'error')
    }
  } catch (error) {
    console.error('Git sync error:', error)
    projectStore.notify(t('git.syncFailed', { error: error.message }), 'error')
  }
}

async function handleGitPublish() {
  if (!canStartPublish.value) {
    projectStore.notify(gitActionReasons.value.publish, 'warning')
    return
  }

  const developBranch = developBranchName.value
  const productionBranch = productionBranchName.value
  const confirmed = window.confirm(t('git.publishConfirm', { develop: developBranch, production: productionBranch }))
  if (!confirmed) return

  try {
    const result = await gitStore.mergeToProduction(projectStore.projectPath)
    if (result.success) {
      projectStore.notify(t('git.publishSuccess'), 'success')
    } else {
      projectStore.notify(t('git.publishFailed', { error: result.error }), 'error')
    }
  } catch (error) {
    console.error('Publish error:', error)
    projectStore.notify(t('git.publishFailed', { error: error.message }), 'error')
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

// コンフリクト解決: ローカルまたはリモートを選択
async function handleResolveConflict(file, side) {
  try {
    const result = await gitStore.resolveConflict(projectStore.projectPath, file, side)
    if (result.success) {
      conflictResolutions.value[file] = side
    }
  } catch (error) {
    console.error('Resolve conflict error:', error)
  }
}

// マージを完了
async function handleCompleteMerge() {
  try {
    const result = await gitStore.completeMerge(projectStore.projectPath)
    if (result.success) {
      showConflictPanel.value = false
      conflictFiles.value = []
      conflictResolutions.value = {}
      projectStore.notify(t('git.conflictResolved'), 'success')
    } else {
      projectStore.notify(t('git.syncFailed', { error: result.error }), 'error')
    }
  } catch (error) {
    console.error('Complete merge error:', error)
    projectStore.notify(t('git.syncFailed', { error: error.message }), 'error')
  }
}

// マージを中止
async function handleAbortMerge() {
  try {
    const result = await gitStore.abortMerge(projectStore.projectPath)
    if (result.success) {
      showConflictPanel.value = false
      conflictFiles.value = []
      conflictResolutions.value = {}
    }
  } catch (error) {
    console.error('Abort merge error:', error)
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
  position: relative;
}

.hero-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.lang-switcher, .lang-switcher-mini {
  display: flex;
  gap: 0.5rem;
}

.lang-switcher button, .lang-switcher-mini button {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  color: var(--color-text-dark);
  font-size: 0.7rem;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.lang-switcher button.active, .lang-switcher-mini button.active {
  background: var(--color-primary);
  color: var(--color-charcoal-deep);
  border-color: var(--color-primary);
}

.lang-switcher-mini {
  margin-left: auto;
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

.publish-checklist {
  border-top: 1px solid var(--glass-border);
  padding-top: 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.publish-checklist-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.72rem;
  color: var(--color-text-dim);
  font-weight: 700;
  text-transform: uppercase;
}

.status-ready {
  color: var(--color-success);
}

.status-blocked {
  color: var(--color-warning);
}

.publish-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.publish-check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: 0.68rem;
  color: var(--color-text-dark);
  background: rgba(255, 255, 255, 0.03);
}

.publish-check.ok {
  color: var(--color-text-dim);
}

.check-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-warning);
}

.publish-check.ok .check-dot {
  background: var(--color-success);
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

/* --- コンフリクト解決パネル --- */
.conflict-panel {
  padding: 1.5rem;
  margin-bottom: 2rem;
  background: var(--color-charcoal-main);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
}

.conflict-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-primary);
  margin: 0 0 0.5rem 0;
}

.conflict-description {
  color: var(--color-text-dim);
  font-size: 0.9rem;
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
}

.conflict-files-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.conflict-file-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--color-charcoal-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
}

.conflict-file-path {
  font-size: 0.85rem;
  color: var(--color-text-main);
  font-family: var(--font-mono);
  word-break: break-all;
}

.conflict-file-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-conflict {
  flex: 1;
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
  background: var(--color-charcoal-main);
  border: 1px solid var(--glass-border);
  color: var(--color-text-main);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-conflict:hover {
  border-color: var(--color-primary);
  background: var(--color-charcoal-muted);
}

.btn-conflict.selected {
  background: var(--color-primary);
  color: var(--color-charcoal-deep);
  border-color: var(--color-primary);
  font-weight: 600;
}

.conflict-footer {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.conflict-footer button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
