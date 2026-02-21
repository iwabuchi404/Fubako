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
      <h2 class="section-title">GitHub認証</h2>

      <div class="auth-area">
        <div v-if="!authStatus.authenticated && !authFlow.active">
          <button @click="handleStartAuth" class="btn-primary" :disabled="authFlow.loading">
            {{ authFlow.loading ? '開始中...' : 'GitHubにサインイン' }}
          </button>
        </div>

        <div v-if="authFlow.active" class="device-code-box">
          <p class="device-code-label">ブラウザで以下のコードを入力してください:</p>
          <div class="user-code">{{ authFlow.userCode }}</div>
          <p class="auth-hint">{{ authFlow.verificationUri }}</p>
          <p class="auth-status-text">{{ authFlow.statusText }}</p>
          <button @click="handleCancelAuth" class="btn-secondary">キャンセル</button>
        </div>

        <div v-if="authStatus.authenticated && !authFlow.active" class="auth-success">
          <span class="status-value status-success">✓ GitHub認証済み</span>
          <button @click="handleClearAuth" class="btn-secondary">サインアウト</button>
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

      <div class="setting-item">
        <label class="setting-label">
          <span>本番 base_url</span>
          <span class="setting-help">CIビルド時の公開URL（GitHub Pages など）</span>
        </label>
        <div class="setting-control">
          <input
            v-model="localSettings.productionBaseUrl"
            type="text"
            placeholder="https://username.github.io/repo"
            @change="handleSaveSettings"
          />
          <p class="setting-note">CIで <code>zola build --base-url</code> に渡されます。設定しないと config.toml の base_url がそのまま使われます。</p>
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">
          <span>プレビューポート</span>
          <span class="setting-help">ローカルプレビューサーバーのポート番号</span>
        </label>
        <div class="setting-control">
          <input
            v-model.number="localSettings.previewPort"
            type="number"
            min="1024"
            max="65535"
            style="width: 120px;"
            @change="handleSaveSettings"
          />
          <p class="setting-note">変更後は設定を保存してからプレビューを再起動してください。（デフォルト: 1111）</p>
        </div>
      </div>
    </section>

    <section v-if="localSettings.enabled" class="settings-section glass">
      <h2 class="section-title">CI設定</h2>

      <div class="setting-item">
        <label class="setting-label">
          <span>デプロイ先</span>
          <span class="setting-help">CIで自動デプロイする先を選択</span>
        </label>
        <div class="setting-control deploy-target-group">
          <label class="radio-option">
            <input
              v-model="localSettings.deployTarget"
              type="radio"
              value="github-pages"
              @change="handleSaveSettings"
            />
            <span>GitHub Pages</span>
          </label>
          <label class="radio-option radio-disabled">
            <input type="radio" disabled />
            <span>Netlify（近日対応）</span>
          </label>
          <label class="radio-option radio-disabled">
            <input type="radio" disabled />
            <span>AWS Amplify（近日対応）</span>
          </label>
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">
          <span>Zolaバージョン</span>
          <span class="setting-help">CIで使用するZolaのバージョン（例: 0.19.2）</span>
        </label>
        <div class="setting-control">
          <input
            v-model="localSettings.zolaVersion"
            type="text"
            placeholder="0.19.2"
            @change="handleSaveSettings"
          />
        </div>
      </div>

      <div class="ci-generate-area">
        <button
          @click="handleGenerateCI"
          class="btn-primary"
          :disabled="generating || !gitStore.hasRemote"
        >
          {{ generating ? '生成中...' : 'CIファイルを生成してpush' }}
        </button>
        <p v-if="!gitStore.hasRemote" class="ci-note">
          ※ リモートURLを設定してください
        </p>
        <div v-if="generateResult" :class="['ci-result', `ci-result--${generateResult.type}`]">
          {{ generateResult.message }}
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
import { ref, onMounted } from 'vue'
import { useProjectStore } from '../stores/project'
import { useGitStore } from '../stores/git'

const projectStore = useProjectStore()
const gitStore = useGitStore()

const localSettings = ref({
  enabled: false,
  developBranch: 'develop',
  productionBranch: 'production',
  remoteUrl: '',
  deployTarget: 'github-pages',
  zolaVersion: '0.19.2',
  productionBaseUrl: '',
  previewPort: 1111
})

const generating = ref(false)
const generateResult = ref(null)

// GitHub認証状態
const authStatus = ref({ authenticated: false })
const authFlow = ref({
  active: false,
  loading: false,
  deviceCode: null,
  userCode: '',
  verificationUri: '',
  interval: 5,
  statusText: '',
  pollTimer: null
})

async function loadSettings() {
  const config = gitStore.gitConfig
  if (config) {
    localSettings.value = {
      enabled: config.enabled || false,
      developBranch: config.developBranch || 'develop',
      productionBranch: config.productionBranch || 'production',
      remoteUrl: config.remoteUrl || '',
      deployTarget: config.deployTarget || 'github-pages',
      zolaVersion: config.zolaVersion || '0.19.2',
      productionBaseUrl: config.productionBaseUrl || '',
      previewPort: config.previewPort || 1111
    }
  } else {
    // デフォルト値
    localSettings.value = {
      enabled: false,
      developBranch: 'develop',
      productionBranch: 'production',
      remoteUrl: '',
      deployTarget: 'github-pages',
      zolaVersion: '0.19.2',
      productionBaseUrl: '',
      previewPort: 1111
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

async function handleGenerateCI() {
  generating.value = true
  generateResult.value = null
  const result = await window.electronAPI.gitGenerateCI(
    projectStore.projectPath,
    localSettings.value.deployTarget,
    {
      productionBranch: localSettings.value.productionBranch,
      workingBranch: localSettings.value.developBranch,
      zolaVersion: localSettings.value.zolaVersion,
      productionBaseUrl: localSettings.value.productionBaseUrl
    }
  )
  generating.value = false
  if (result.success) {
    generateResult.value = {
      type: 'success',
      message: 'CIファイルを生成してpushしました。GitHubリポジトリの Settings > Pages でブランチ設定を有効にしてください。'
    }
    // ステータスを更新
    gitStore.getStatus(projectStore.projectPath)
  } else {
    generateResult.value = { type: 'error', message: result.error }
  }
}

async function checkAuthStatus() {
  const result = await window.electronAPI.githubAuthStatus()
  authStatus.value = result
}

async function handleStartAuth() {
  authFlow.value.loading = true
  const result = await window.electronAPI.githubAuthStart()
  authFlow.value.loading = false
  if (!result.success) {
    alert('認証開始に失敗しました: ' + result.error)
    return
  }
  authFlow.value = {
    active: true,
    loading: false,
    deviceCode: result.device_code,
    userCode: result.user_code,
    verificationUri: result.verification_uri,
    interval: result.interval || 5,
    statusText: '認証待機中...',
    pollTimer: null
  }
  // ポーリング開始
  authFlow.value.pollTimer = setInterval(async () => {
    const r = await window.electronAPI.githubAuthPoll(authFlow.value.deviceCode)
    if (r.authenticated) {
      clearInterval(authFlow.value.pollTimer)
      authFlow.value.active = false
      authStatus.value.authenticated = true
    } else if (!r.pending) {
      clearInterval(authFlow.value.pollTimer)
      authFlow.value.active = false
      authFlow.value.statusText = 'エラー: ' + (r.error || '不明なエラー')
    }
  }, authFlow.value.interval * 1000)
}

function handleCancelAuth() {
  if (authFlow.value.pollTimer) clearInterval(authFlow.value.pollTimer)
  authFlow.value.active = false
  authFlow.value.loading = false
}

async function handleClearAuth() {
  await window.electronAPI.githubAuthClear()
  authStatus.value.authenticated = false
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
  checkAuthStatus()
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

.setting-note {
  font-size: 0.78rem;
  color: var(--color-text-dim);
  margin: 0.25rem 0 0;
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

/* CI設定 */
.deploy-target-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-main);
}

.radio-option input[type='radio'] {
  accent-color: var(--color-primary);
  cursor: pointer;
}

.radio-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.radio-disabled input[type='radio'] {
  cursor: not-allowed;
}

.ci-generate-area {
  margin-top: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.ci-note {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-warning);
}

.ci-result {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  line-height: 1.5;
}

.ci-result--success {
  background: rgba(0, 200, 100, 0.1);
  border: 1px solid var(--color-success);
  color: var(--color-success);
}

.ci-result--error {
  background: rgba(255, 80, 80, 0.1);
  border: 1px solid var(--color-error);
  color: var(--color-error);
}

/* GitHub認証 */
.auth-area {
  margin-top: 0.5rem;
}

.device-code-box {
  padding: 1.25rem;
  background: var(--color-charcoal-deep);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.device-code-label {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-main);
}

.user-code {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--color-primary);
  text-align: center;
  padding: 0.5rem 0;
  font-family: monospace;
}

.auth-hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-dim);
}

.auth-status-text {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-dim);
}

.auth-success {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--color-text-dim);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  border-color: var(--color-text-main);
  color: var(--color-text-main);
}
</style>
