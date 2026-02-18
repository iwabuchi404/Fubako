<template>
  <div class="git-settings-view fade-in-up">
    <header class="page-header">
      <h1>Git設定</h1>
      <p class="page-subtitle">Git連携の設定を管理します</p>
    </header>

    <section class="settings-section glass">
      <h2 class="section-title">基本設定</h2>

      <div class="setting-item">
        <label class="setting-label">
          <span>Git管理を有効にする</span>
          <span class="setting-help">Gitでバージョン管理を行う場合にチェック</span>
        </label>
        <div class="setting-control">
          <label class="toggle">
            <input v-model="localSettings.enabled" type="checkbox" @change="handleToggleEnabled" />
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </section>

    <section v-if="localSettings.enabled" class="settings-section glass">
      <h2 class="section-title">ブランチ設定</h2>

      <div class="setting-item">
        <label class="setting-label">
          <span>開発ブランチ名</span>
          <span class="setting-help">日々の作業で使用するブランチ</span>
        </label>
        <div class="setting-control">
          <input
            v-model="localSettings.developBranch"
            type="text"
            placeholder="develop"
            @change="handleSaveSettings"
          />
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">
          <span>本番ブランチ名</span>
          <span class="setting-help">本番公開時に使用するブランチ</span>
        </label>
        <div class="setting-control">
          <input
            v-model="localSettings.productionBranch"
            type="text"
            placeholder="production"
            @change="handleSaveSettings"
          />
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">
          <span>リモートURL</span>
          <span class="setting-help">GitリポジトリのURL</span>
        </label>
        <div class="setting-control">
          <input
            v-model="localSettings.remoteUrl"
            type="text"
            placeholder="https://github.com/username/repo.git"
            @change="handleSaveSettings"
          />
        </div>
      </div>
    </section>

    <section v-if="localSettings.enabled" class="settings-section glass">
      <h2 class="section-title">現在の状態</h2>

      <div v-if="!gitStore.isRepo" class="init-container">
        <p class="init-message">このプロジェクトはまだGitリポジトリとして初期化されていません。</p>
        <button @click="handleInitRepo" class="btn-primary" :disabled="gitStore.loading.init">
          {{ gitStore.loading.init ? '初期化中...' : 'リポジトリを初期化' }}
        </button>
      </div>

      <div v-else class="status-grid">
        <div class="status-item">
          <span class="status-label">リポジトリ</span>
          <span :class="['status-value', gitStore.isRepo ? 'status-success' : 'status-dim']">
            {{ gitStore.isRepo ? '✓ 有効' : '× 無効' }}
          </span>
        </div>

        <div class="status-item">
          <span class="status-label">現在のブランチ</span>
          <span class="status-value">
            {{ gitStore.currentBranch || '-' }}
          </span>
        </div>

        <div class="status-item">
          <span class="status-label">未コミットの変更</span>
          <span :class="['status-value', gitStore.hasUncommittedChanges ? 'status-warning' : 'status-success']">
            {{ gitStore.hasUncommittedChanges ? `✓ ${gitStore.files.length}件` : '✓ なし' }}
          </span>
        </div>

        <div class="status-item">
          <span class="status-label">リモートとの同期</span>
          <span :class="['status-value', getSyncStatusClass()]">
            {{ getSyncStatusText() }}
          </span>
        </div>
      </div>

      <div v-if="gitStore.isRepo" class="refresh-button">
        <button @click="handleRefresh" class="btn-primary" :disabled="gitStore.loading.status">
          {{ gitStore.loading.status ? '更新中...' : 'ステータスを更新' }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useProjectStore } from '../stores/project'
import { useGitStore } from '../stores/git'

const projectStore = useProjectStore()
const gitStore = useGitStore()

const localSettings = ref({
  enabled: false,
  developBranch: 'develop',
  productionBranch: 'production',
  remoteUrl: ''
})

async function loadSettings() {
  const config = gitStore.gitConfig
  if (config) {
    localSettings.value = {
      enabled: config.enabled || false,
      developBranch: config.developBranch || 'develop',
      productionBranch: config.productionBranch || 'production',
      remoteUrl: config.remoteUrl || ''
    }
  } else {
    // デフォルト値
    localSettings.value = {
      enabled: false,
      developBranch: 'develop',
      productionBranch: 'production',
      remoteUrl: ''
    }
  }
}

function handleToggleEnabled() {
  handleSaveSettings()
}

function handleSaveSettings() {
  gitStore.saveConfig(projectStore.projectPath, localSettings.value)
}

async function handleInitRepo() {
  if (!confirm('Gitリポジトリを初期化しますか？')) return
  await gitStore.initRepo(projectStore.projectPath)
}

function handleRefresh() {
  gitStore.getStatus(projectStore.projectPath)
}

function getSyncStatusText() {
  if (!gitStore.isRepo) return '-'
  if (!gitStore.hasRemote) return '× リモート未設定'
  if (gitStore.isAheadOfRemote) return '△ 先に進んでいる'
  if (gitStore.isBehindRemote) return '▼ 遅れている'
  if (gitStore.hasRemoteUpdates) return '⚠ 更新があります'
  return '✓ 同期中'
}

function getSyncStatusClass() {
  if (!gitStore.isRepo) return 'status-dim'
  if (!gitStore.hasRemote) return 'status-dim'
  if (gitStore.isAheadOfRemote) return 'status-info'
  if (gitStore.isBehindRemote || gitStore.hasRemoteUpdates) return 'status-warning'
  return 'status-success'
}

onMounted(() => {
  loadSettings()
  if (projectStore.isLoaded) {
    gitStore.loadConfig(projectStore.projectPath)
    if (gitStore.isGitEnabled) {
      gitStore.getStatus(projectStore.projectPath)
    }
  }
})
</script>

<style scoped>
.git-settings-view {
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
  margin: 0 0 0.5rem 0;
  color: var(--color-text-main);
}

.page-subtitle {
  margin: 0;
  color: var(--color-text-dim);
  font-size: 0.9rem;
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
  margin: 0 0 1rem 0;
  color: var(--color-text-main);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid var(--glass-border);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.setting-label span:first-child {
  font-weight: 500;
  color: var(--color-text-main);
}

.setting-help {
  font-size: 0.8rem;
  color: var(--color-text-dim);
}

.setting-control {
  flex: 1;
  max-width: 400px;
}

.setting-control input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--color-charcoal-deep);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-main);
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.setting-control input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 8px rgba(0, 242, 255, 0.2);
}

.toggle {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-charcoal-muted);
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle input:checked + .slider {
  background: var(--color-primary);
}

.toggle input:checked + .slider:before {
  transform: translateX(24px);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.status-item {
  padding: 1rem;
  background: var(--color-charcoal-deep);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-label {
  font-size: 0.8rem;
  color: var(--color-text-dim);
}

.status-value {
  font-size: 1rem;
  font-weight: 600;
}

.status-value.status-success {
  color: var(--color-success);
}

.status-value.status-warning {
  color: var(--color-warning);
}

.status-value.status-error {
  color: var(--color-error);
}

.status-value.status-info {
  color: var(--color-primary);
}

.status-value.status-dim {
  color: var(--color-text-dim);
}

.refresh-button {
  text-align: right;
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
  transition: all 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  background: #00c4ff;
  box-shadow: 0 0 12px rgba(0, 242, 255, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.init-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  background: var(--color-charcoal-deep);
  border-radius: var(--radius-md);
  text-align: center;
}

.init-message {
  color: var(--color-text-dim);
  font-size: 0.95rem;
}
</style>
