<template>
  <div class="error-history-view fade-in-up">
    <header class="page-header">
      <h1>エラー履歴</h1>
      <p class="page-subtitle">システムで発生したエラーを確認できます</p>
    </header>

    <!-- 現在のエラー -->
    <section v-if="activeErrors.length > 0" class="error-section active">
      <h2 class="section-title">
        <span class="icon">⚠</span>
        現在のエラー ({{ activeErrors.length }})
      </h2>
      <div class="error-list">
        <div
          v-for="error in activeErrors"
          :key="error.id"
          class="error-card"
          :class="{ 'expanded': expandedErrors.has(error.id) }"
        >
          <div class="error-header" @click="toggleExpand(error.id)">
            <div class="error-header-left">
              <span class="error-type-badge">{{ errorTypeLabel(error.type) }}</span>
              <span class="error-time">{{ formatTime(error.createdAt) }}</span>
            </div>
            <span class="expand-icon">{{ expandedErrors.has(error.id) ? '▼' : '▶' }}</span>
          </div>
          <div class="error-body">
            <h3 class="error-summary">{{ error.summary }}</h3>
          </div>

          <!-- 詳細（アコーディオン） -->
          <div v-if="expandedErrors.has(error.id)" class="error-details-panel">
            <!-- 日本語詳細 -->
            <div v-if="error.details" class="detail-section">
              <h4>詳細</h4>
              <p>{{ error.details }}</p>
            </div>

            <!-- 生のエラーメッセージ -->
            <div v-if="error.rawError" class="detail-section raw-error">
              <h4>生のエラーメッセージ</h4>
              <pre>{{ error.rawError }}</pre>
            </div>

            <!-- アクションボタン -->
            <div v-if="error.actions && error.actions.length > 0" class="detail-section actions">
              <h4>アクション</h4>
              <div class="action-buttons">
                <button
                  v-for="action in error.actions"
                  :key="action.label"
                  @click="handleAction(error, action)"
                  class="btn-action"
                >
                  {{ action.label }}
                </button>
              </div>
            </div>

            <!-- 閉じるボタン -->
            <div class="detail-section dismiss-action">
              <button
                @click="dismissError(error.id)"
                class="btn-dismiss"
              >
                エラーを閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- エラーがない場合 -->
    <section v-else class="error-section empty">
      <div class="empty-state">
        <div class="empty-icon">✓</div>
        <h3>現在エラーはありません</h3>
        <p>システムが正常に動作しています</p>
      </div>
    </section>

    <!-- 解消済みエラー -->
    <section v-if="resolvedErrors.length > 0" class="error-section resolved">
      <h2 class="section-title">
        <span class="icon">✓</span>
        解消済みエラー ({{ resolvedErrors.length }})
      </h2>
      <div class="error-list">
        <div
          v-for="error in resolvedErrors"
          :key="error.id"
          class="error-card resolved"
          :class="{ 'expanded': expandedErrors.has(error.id) }"
        >
          <div class="error-header" @click="toggleExpand(error.id)">
            <div class="error-header-left">
              <span class="error-type-badge">{{ errorTypeLabel(error.type) }}</span>
              <span class="error-time">{{ formatTime(error.createdAt) }}</span>
              <span class="error-status-badge">{{ errorStatusLabel(error.status) }}</span>
            </div>
            <span class="expand-icon">{{ expandedErrors.has(error.id) ? '▼' : '▶' }}</span>
          </div>
          <div class="error-body">
            <h3 class="error-summary">{{ error.summary }}</h3>
          </div>

          <!-- 詳細（アコーディオン） -->
          <div v-if="expandedErrors.has(error.id)" class="error-details-panel">
            <!-- 日本語詳細 -->
            <div v-if="error.details" class="detail-section">
              <h4>詳細</h4>
              <p>{{ error.details }}</p>
            </div>

            <!-- 生のエラーメッセージ -->
            <div v-if="error.rawError" class="detail-section raw-error">
              <h4>生のエラーメッセージ</h4>
              <pre>{{ error.rawError }}</pre>
            </div>

            <!-- 解消/無視時刻 -->
            <div class="detail-section">
              <h4>ステータス変更</h4>
              <p v-if="error.resolvedAt">
                解消: {{ formatTime(error.resolvedAt) }}
              </p>
              <p v-if="error.dismissedAt">
                閉じた: {{ formatTime(error.dismissedAt) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useErrorStore } from '../stores/error'

const errorStore = useErrorStore()
const expandedErrors = ref(new Set())

const activeErrors = computed(() => errorStore.activeErrors)
const resolvedErrors = computed(() => errorStore.resolvedErrors)

function toggleExpand(id) {
  if (expandedErrors.value.has(id)) {
    expandedErrors.value.delete(id)
  } else {
    expandedErrors.value.add(id)
  }
}

function dismissError(id) {
  errorStore.dismissError(id)
  expandedErrors.value.delete(id)
}

function handleAction(error, action) {
  if (typeof action.handler === 'function') {
    action.handler(error)
  }
}

function errorTypeLabel(type) {
  const labels = {
    'build-error': 'ビルドエラー',
    'path-collision': 'パス衝突',
    'process-exit': 'プロセスエラー',
    'validation-error': 'バリデーション',
    'unknown': 'エラー'
  }
  return labels[type] || labels['unknown']
}

function errorStatusLabel(status) {
  const labels = {
    'dismissed': '閉じた',
    'resolved': '解消済み'
  }
  return labels[status] || status
}

function formatTime(isoString) {
  const date = new Date(isoString)
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>

<style scoped>
.error-history-view {
  padding: 2rem;
  max-width: 1000px;
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

.error-section {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: var(--color-text-main);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-title .icon {
  font-size: 1.2rem;
}

.error-section.active .section-title .icon {
  color: var(--color-error);
}

.error-section.resolved .section-title .icon {
  color: var(--color-success);
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.error-card {
  background: var(--color-charcoal-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: all 0.2s ease;
}

.error-card:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.error-card.resolved {
  opacity: 0.7;
}

.error-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.error-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

.error-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.error-type-badge {
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
  background: rgba(255, 107, 107, 0.15);
  border-radius: var(--radius-sm);
  color: var(--color-error);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.error-card.resolved .error-type-badge {
  background: rgba(0, 242, 255, 0.15);
  color: var(--color-primary);
}

.error-time {
  font-size: 0.75rem;
  color: var(--color-text-dim);
  font-family: var(--font-mono);
}

.error-status-badge {
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
  background: rgba(0, 242, 255, 0.15);
  border-radius: var(--radius-sm);
  color: var(--color-primary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.expand-icon {
  font-size: 0.7rem;
  color: var(--color-text-dim);
  transition: transform 0.2s ease;
}

.error-card.expanded .expand-icon {
  transform: rotate(180deg);
}

.error-body {
  padding: 0 1.25rem 0.75rem;
}

.error-summary {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.error-details-panel {
  padding: 0.75rem 1.25rem 1.25rem;
  border-top: 1px solid var(--glass-border);
  background: rgba(0, 0, 0, 0.2);
}

.detail-section {
  margin-bottom: 1rem;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-section p {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
}

.detail-section.raw-error pre {
  background: rgba(0, 0, 0, 0.4);
  border-radius: var(--radius-sm);
  padding: 0.75rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.8);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-action {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: rgba(255, 255, 255, 0.9);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-action:hover {
  background: rgba(255, 107, 107, 0.15);
  color: #fff;
  border-color: var(--color-error);
}

.dismiss-action {
  text-align: right;
}

.btn-dismiss {
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--color-text-dim);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-dismiss:hover {
  background: rgba(255, 107, 107, 0.1);
  color: var(--color-error);
  border-color: var(--color-error);
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: var(--color-charcoal-light);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
}

.empty-icon {
  font-size: 3rem;
  color: var(--color-success);
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: var(--color-text-main);
  font-size: 1.2rem;
}

.empty-state p {
  margin: 0;
  color: var(--color-text-dim);
  font-size: 0.9rem;
}
</style>
