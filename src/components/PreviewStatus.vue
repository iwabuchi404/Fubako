<template>
  <div class="preview-status-bar">

    <!-- 左: Git状態 -->
    <div class="git-status-section">
      <template v-if="gitStore.isGitEnabled">
        <div class="status-dot" :class="gitDotClass"></div>
        <span class="status-text">{{ gitStatusText }}</span>
        <span v-if="gitStore.currentBranch" class="git-branch">{{ gitStore.currentBranch }}</span>
      </template>
      <template v-else>
        <span class="status-text muted">Git 未設定</span>
      </template>
    </div>

    <!-- 右: プレビュー状態 -->
    <div class="preview-section">
      <div class="status-indicator">
        <div class="status-dot" :class="statusClass"></div>
        <span class="status-text">{{ statusMessage }}</span>
      </div>

      <div class="status-actions">
        <button
          v-if="projectStore.previewRunning"
          @click="handleRebuild"
          class="btn-icon-sm"
          title="リビルド"
          :disabled="isRebuilding"
        >
          <span v-if="isRebuilding">リビルド中...</span>
          <span v-else>🔄</span>
        </button>
        <button
          v-if="projectStore.previewRunning"
          @click="handleRestart"
          class="btn-icon-sm"
          title="サーバー再起動"
          :disabled="isRestarting"
        >
          <span v-if="isRestarting">再起動中...</span>
          <span v-else>⚡</span>
        </button>
        <button
          v-if="!projectStore.previewRunning"
          @click="handleStart"
          class="btn-icon-sm"
          title="サーバー起動"
        >
          <span v-if="isStarting">起動中...</span>
          <span v-else>▶</span>
        </button>
        <button
          v-if="projectStore.previewRunning"
          @click="handleStop"
          class="btn-icon-sm"
          title="サーバー停止"
        >
          ⏹
        </button>
      </div>

      <div
        v-if="projectStore.previewBuildError"
        class="error-details"
        @click="showErrorDetails = !showErrorDetails"
      >
        <span class="error-toggle">{{ showErrorDetails ? '▲' : '▼' }}</span>
        <div v-show="showErrorDetails" class="error-content">
          <h4>エラー詳細</h4>
          <p class="error-message">{{ projectStore.previewBuildError }}</p>
          <div v-if="projectStore.previewUrl" class="error-actions">
            <a :href="projectStore.previewUrl" target="_blank" class="btn-link">
              ブラウザで確認
            </a>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { useGitStore } from '../stores/git'

const projectStore = useProjectStore()
const gitStore = useGitStore()
const isRebuilding = ref(false)
const isRestarting = ref(false)
const isStarting = ref(false)
const showErrorDetails = ref(true)

// Git状態ドット
const gitDotClass = computed(() => {
  if (gitStore.hasUncommittedChanges || gitStore.isAheadOfRemote) return 'status-warn'
  if (gitStore.isBehindRemote) return 'status-building'
  return 'status-success'
})

// Git状態テキスト
const gitStatusText = computed(() => {
  if (gitStore.hasUncommittedChanges) return '未保存の変更あり'
  if (gitStore.isAheadOfRemote) return 'プッシュ待ち'
  if (gitStore.isBehindRemote) return 'リモートに更新あり'
  return '保存済み'
})

const statusClass = computed(() => {
  const status = projectStore.previewBuildStatus
  switch (status) {
    case 'building':
      return 'status-building'
    case 'success':
      return 'status-success'
    case 'error':
      return 'status-error'
    default:
      return 'status-idle'
  }
})

const statusMessage = computed(() => {
  if (!projectStore.previewRunning && projectStore.previewBuildStatus === 'idle') {
    return 'プレビューサーバー停止中'
  }
  
  const status = projectStore.previewBuildStatus
  const message = projectStore.previewBuildMessage
  
  if (status === 'error' && message) {
    return `エラー: ${message}`
  }
  
  return message || 'プレビューサーバー'
})

async function handleRebuild() {
  if (isRebuilding.value) return
  
  isRebuilding.value = true
  try {
    await projectStore.rebuildPreview()
  } finally {
    isRebuilding.value = false
  }
}

async function handleRestart() {
  if (isRestarting.value) return
  
  isRestarting.value = true
  try {
    await projectStore.stopPreview()
    await new Promise(resolve => setTimeout(resolve, 500))
    await projectStore.startPreview()
  } finally {
    isRestarting.value = false
  }
}

async function handleStart() {
  isStarting.value = true
  try {
    await projectStore.startPreview()
  } finally {
    isStarting.value = false
  }
}

async function handleStop() {
  await projectStore.stopPreview()
}
</script>

<style scoped>
.preview-status-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(21, 21, 25, 0.95);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  z-index: 1000;
  gap: 1rem;
}

/* 左: Git状態 */
.git-status-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.git-branch {
  font-size: 0.7rem;
  font-family: var(--font-mono);
  color: rgba(255, 255, 255, 0.4);
  padding: 0.1rem 0.4rem;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
}

.muted {
  color: rgba(255, 255, 255, 0.3) !important;
}

/* 右: プレビュー状態 */
.preview-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.status-dot.status-idle {
  background: #4a4a5a;
  box-shadow: 0 0 4px rgba(74, 74, 90, 0.3);
}

.status-dot.status-building {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
  animation: pulse 1s ease-in-out infinite;
}

.status-dot.status-success {
  background: #4ade80;
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
}

.status-dot.status-error {
  background: #ff6b6b;
  box-shadow: 0 0 8px rgba(255, 107, 107, 0.5);
  animation: flash 0.5s ease-in-out infinite;
}

.status-dot.status-warn {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

@keyframes flash {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.status-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  font-family: var(--font-mono);
}

.status-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon-sm {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.btn-icon-sm:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(0, 242, 255, 0.3);
}

.btn-icon-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon-sm span {
  font-size: 0.65rem;
  font-weight: 600;
  white-space: nowrap;
}

.error-details {
  max-width: 400px;
  position: relative;
}

.error-toggle {
  font-size: 0.7rem;
  color: #ff6b6b;
  cursor: pointer;
  user-select: none;
  transition: all 0.3s ease;
}

.error-toggle:hover {
  color: #ff8787;
}

.error-content {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  right: 0;
  background: rgba(21, 21, 25, 0.98);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 8px;
  padding: 1rem;
  min-width: 400px;
  max-width: calc(100vw - 3rem);
  max-height: 300px;
  overflow-y: auto;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 1001;
}

.error-content h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.85rem;
  color: #ff6b6b;
  font-weight: 600;
}

.error-message {
  margin: 0 0 1rem 0;
  font-size: 0.8rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-word;
  white-space: pre-wrap;
}

.error-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-link {
  color: #4ade80;
  text-decoration: none;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-link:hover {
  color: #7ee6a0;
  text-decoration: underline;
}
</style>