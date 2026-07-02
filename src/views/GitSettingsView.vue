<template>
  <div class="git-settings-view fade-in-up">
    <header class="page-header">
      <h1>{{ $t('gitSettings.title') }}</h1>
      <p class="page-subtitle">{{ $t('gitSettings.subtitle') }}</p>
    </header>

    <section class="settings-section glass">
      <h2 class="section-title">{{ $t('gitSettings.sections.basic') }}</h2>

      <div class="setting-item">
        <label class="setting-label">
          <span>{{ $t('gitSettings.enabled.label') }}</span>
          <span class="setting-help">{{ $t('gitSettings.enabled.help') }}</span>
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
      <h2 class="section-title">{{ $t('gitSettings.sections.setup') }}</h2>
      <div class="setup-steps">
        <div
          v-for="step in setupSteps"
          :key="step.key"
          class="setup-step"
          :class="{ done: step.done }"
        >
          <span class="setup-step-index">{{ step.index }}</span>
          <div class="setup-step-body">
            <strong>{{ step.label }}</strong>
            <span>{{ step.done ? $t('gitSettings.setup.done') : $t('gitSettings.setup.todo') }}</span>
          </div>
        </div>
      </div>
    </section>

    <section v-if="localSettings.enabled" class="settings-section glass">
      <h2 class="section-title">{{ $t('gitSettings.sections.auth') }}</h2>

      <div class="auth-area">
        <div v-if="!authStatus.authenticated && !authFlow.active">
          <button @click="handleStartAuth" class="btn-primary" :disabled="authFlow.loading">
            {{ authFlow.loading ? $t('gitSettings.auth.starting') : $t('gitSettings.auth.signIn') }}
          </button>
        </div>

        <div v-if="authFlow.active" class="device-code-box">
          <p class="device-code-label">{{ $t('gitSettings.auth.enterCode') }}</p>
          <div class="user-code">{{ authFlow.userCode }}</div>
          <p class="auth-hint">{{ authFlow.verificationUri }}</p>
          <p class="auth-status-text">{{ authFlow.statusText }}</p>
          <button @click="handleCancelAuth" class="btn-secondary">{{ $t('gitSettings.auth.cancel') }}</button>
        </div>

        <div v-if="authStatus.authenticated && !authFlow.active" class="auth-success">
          <span class="status-value status-success">{{ $t('gitSettings.auth.success') }}</span>
          <button @click="handleClearAuth" class="btn-secondary">{{ $t('gitSettings.auth.signOut') }}</button>
        </div>
      </div>
    </section>

    <section v-if="localSettings.enabled" class="settings-section glass">
      <h2 class="section-title">{{ $t('gitSettings.sections.branch') }}</h2>

      <div class="setting-item">
        <label class="setting-label">
          <span>{{ $t('gitSettings.branch.develop') }}</span>
          <span class="setting-help">{{ $t('gitSettings.branch.developHelp') }}</span>
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
          <span>{{ $t('gitSettings.branch.production') }}</span>
          <span class="setting-help">{{ $t('gitSettings.branch.productionHelp') }}</span>
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
          <span>{{ $t('gitSettings.branch.remoteUrl') }}</span>
          <span class="setting-help">{{ $t('gitSettings.branch.remoteUrlHelp') }}</span>
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
          <span>{{ $t('gitSettings.branch.productionBaseUrl') }}</span>
          <span class="setting-help">{{ $t('gitSettings.branch.productionBaseUrlHelp') }}</span>
        </label>
        <div class="setting-control">
          <input
            v-model="localSettings.productionBaseUrl"
            type="text"
            placeholder="https://username.github.io/repo"
            @change="handleSaveSettings"
          />
          <p class="setting-note">{{ $t('gitSettings.branch.productionBaseUrlNote') }}</p>
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">
          <span>{{ $t('gitSettings.branch.previewPort') }}</span>
          <span class="setting-help">{{ $t('gitSettings.branch.previewPortHelp') }}</span>
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
          <p class="setting-note">{{ $t('gitSettings.branch.previewPortNote') }}</p>
        </div>
      </div>
    </section>

    <section v-if="localSettings.enabled" class="settings-section glass">
      <h2 class="section-title">{{ $t('gitSettings.sections.ci') }}</h2>

      <div class="setting-item">
        <label class="setting-label">
          <span>{{ $t('gitSettings.ci.deployTarget') }}</span>
          <span class="setting-help">{{ $t('gitSettings.ci.deployTargetHelp') }}</span>
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
            <span>{{ $t('gitSettings.ci.netlify') }}</span>
          </label>
          <label class="radio-option radio-disabled">
            <input type="radio" disabled />
            <span>{{ $t('gitSettings.ci.amplify') }}</span>
          </label>
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">
          <span>{{ $t('gitSettings.ci.zolaVersion') }}</span>
          <span class="setting-help">{{ $t('gitSettings.ci.zolaVersionHelp') }}</span>
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
          :title="!gitStore.hasRemote ? $t('gitSettings.ci.remoteRequired') : ''"
        >
          {{ generating ? $t('gitSettings.ci.generating') : $t('gitSettings.ci.generate') }}
        </button>
        <p v-if="!gitStore.hasRemote" class="ci-note">
          {{ $t('gitSettings.ci.remoteRequired') }}
        </p>
        <div v-if="generateResult" :class="['ci-result', `ci-result--${generateResult.type}`]">
          {{ generateResult.message }}
        </div>
      </div>
    </section>

    <section v-if="localSettings.enabled" class="settings-section glass">
      <h2 class="section-title">{{ $t('gitSettings.sections.status') }}</h2>

      <div v-if="!gitStore.isRepo" class="init-container">
        <p class="init-message">{{ $t('gitSettings.status.noRepo') }}</p>
        <button @click="handleInitRepo" class="btn-primary" :disabled="gitStore.loading.init">
          {{ gitStore.loading.init ? $t('gitSettings.status.initializing') : $t('gitSettings.status.initRepo') }}
        </button>
      </div>

      <div v-else class="status-grid">
        <div class="status-item">
          <span class="status-label">{{ $t('gitSettings.status.repoLabel') }}</span>
          <span :class="['status-value', gitStore.isRepo ? 'status-success' : 'status-dim']">
            {{ gitStore.isRepo ? $t('gitSettings.status.repoValid') : $t('gitSettings.status.repoInvalid') }}
          </span>
        </div>

        <div class="status-item">
          <span class="status-label">{{ $t('gitSettings.status.branchLabel') }}</span>
          <span class="status-value">
            {{ gitStore.currentBranch || '-' }}
          </span>
        </div>

        <div class="status-item">
          <span class="status-label">{{ $t('gitSettings.status.uncommittedLabel') }}</span>
          <span :class="['status-value', gitStore.hasUncommittedChanges ? 'status-warning' : 'status-success']">
            {{ gitStore.hasUncommittedChanges ? $t('gitSettings.status.uncommittedHas', { count: gitStore.files.length }) : $t('gitSettings.status.uncommittedNone') }}
          </span>
        </div>

        <div class="status-item">
          <span class="status-label">{{ $t('gitSettings.status.syncLabel') }}</span>
          <span :class="['status-value', getSyncStatusClass()]">
            {{ getSyncStatusText() }}
          </span>
        </div>
      </div>

      <div v-if="gitStore.isRepo" class="refresh-button">
        <button @click="handleRefresh" class="btn-primary" :disabled="gitStore.loading.status">
          {{ gitStore.loading.status ? $t('gitSettings.status.refreshing') : $t('gitSettings.status.refresh') }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '../stores/project'
import { useGitStore } from '../stores/git'

const { t } = useI18n()
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

const setupSteps = computed(() => [
  {
    key: 'auth',
    index: 1,
    label: t('gitSettings.setup.auth'),
    done: authStatus.value.authenticated
  },
  {
    key: 'repo',
    index: 2,
    label: t('gitSettings.setup.repo'),
    done: gitStore.isRepo
  },
  {
    key: 'remote',
    index: 3,
    label: t('gitSettings.setup.remote'),
    done: Boolean(localSettings.value.remoteUrl || gitStore.hasRemote)
  },
  {
    key: 'ci',
    index: 4,
    label: t('gitSettings.setup.ci'),
    done: Boolean(generateResult.value?.type === 'success')
  }
])

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
  if (!confirm(t('gitSettings.initConfirm'))) return
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
      message: t('gitSettings.ci.success')
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
    alert(t('gitSettings.auth.startError', { error: result.error }))
    return
  }
  authFlow.value = {
    active: true,
    loading: false,
    deviceCode: result.device_code,
    userCode: result.user_code,
    verificationUri: result.verification_uri,
    interval: result.interval || 5,
    statusText: t('gitSettings.auth.waiting'),
    pollTimer: null
  }
  scheduleAuthPoll(authFlow.value.interval)
}

function clearAuthPollTimer() {
  if (authFlow.value.pollTimer) {
    clearTimeout(authFlow.value.pollTimer)
    authFlow.value.pollTimer = null
  }
}

function scheduleAuthPoll(delaySeconds) {
  clearAuthPollTimer()
  authFlow.value.pollTimer = setTimeout(async () => {
    if (!authFlow.value.active || !authFlow.value.deviceCode) return

    const r = await window.electronAPI.githubAuthPoll(authFlow.value.deviceCode)
    if (r.authenticated) {
      clearAuthPollTimer()
      authFlow.value.active = false
      authStatus.value.authenticated = true
    } else if (r.pending) {
      if (r.slowDown) {
        authFlow.value.interval = (authFlow.value.interval || delaySeconds) + 5
      }
      scheduleAuthPoll(authFlow.value.interval || delaySeconds)
    } else if (!r.pending) {
      clearAuthPollTimer()
      authFlow.value.active = false
      authFlow.value.statusText = t('gitSettings.auth.pollError', { error: r.error || '?' })
    }
  }, delaySeconds * 1000)
}

function handleCancelAuth() {
  clearAuthPollTimer()
  authFlow.value.active = false
  authFlow.value.loading = false
}

async function handleClearAuth() {
  await window.electronAPI.githubAuthClear()
  authStatus.value.authenticated = false
}

function getSyncStatusText() {
  if (!gitStore.isRepo) return '-'
  if (!gitStore.hasRemote) return t('gitSettings.status.noRemote')
  if (gitStore.isAheadOfRemote) return t('gitSettings.status.ahead')
  if (gitStore.isBehindRemote) return t('gitSettings.status.behind')
  if (gitStore.hasRemoteUpdates) return t('gitSettings.status.hasUpdates')
  return t('gitSettings.status.synced')
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

onUnmounted(() => {
  clearAuthPollTimer()
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

.setup-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}

.setup-step {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--color-charcoal-deep);
}

.setup-step.done {
  border-color: rgba(0, 200, 100, 0.45);
}

.setup-step-index {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  background: var(--color-charcoal-muted);
  color: var(--color-text-dim);
  font-size: 0.75rem;
  font-weight: 700;
}

.setup-step.done .setup-step-index {
  background: var(--color-success);
  color: var(--color-charcoal-deep);
}

.setup-step-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.setup-step-body strong {
  color: var(--color-text-main);
  font-size: 0.85rem;
}

.setup-step-body span {
  color: var(--color-text-dim);
  font-size: 0.75rem;
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
