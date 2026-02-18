<template>
  <div v-if="activeErrors.length > 0" class="error-notification-area">
    <div
      v-for="error in activeErrors"
      :key="error.id"
      class="error-item"
      :class="{ 'expanded': expandedErrors.has(error.id) }"
    >
      <!-- エラーサマリ -->
      <div class="error-summary" @click="toggleExpand(error.id)">
        <span class="error-icon">⚠</span>
        <span class="error-title">{{ error.summary }}</span>
        <span class="error-type-badge">{{ errorTypeLabel(error.type) }}</span>
        <button
          class="btn-close-error"
          @click.stop="dismissError(error.id)"
          title="閉じる"
        >
          ×
        </button>
        <span class="expand-icon">{{ expandedErrors.has(error.id) ? '▼' : '▶' }}</span>
      </div>

      <!-- エラー詳細（アコーディオン） -->
      <div v-if="expandedErrors.has(error.id)" class="error-details">
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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useErrorStore } from '../stores/error'

const errorStore = useErrorStore()
const expandedErrors = ref(new Set())

const activeErrors = computed(() => errorStore.activeErrors)

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
  } else if (typeof action.handler === 'string') {
    // 文字列の場合、グローバルイベント等として処理できる拡張ポイント
    console.log(`Action handler: ${action.handler}`, error)
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
</script>

<script>
import { computed } from 'vue'
export default {
  name: 'ErrorNotificationArea'
}
</script>

<style scoped>
.error-notification-area {
  background: var(--color-charcoal-main);
  border-bottom: 1px solid var(--glass-border);
  position: relative;
  z-index: 90;
}

.error-item {
  border-bottom: 1px solid var(--glass-border);
}

.error-item:last-child {
  border-bottom: none;
}

.error-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.5rem;
  cursor: pointer;
  transition: background 0.2s ease;
  background: rgba(255, 107, 107, 0.05);
}

.error-summary:hover {
  background: rgba(255, 107, 107, 0.1);
}

.error-icon {
  font-size: 1.1rem;
  color: var(--color-error);
  flex-shrink: 0;
}

.error-title {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-main);
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

.btn-close-error {
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  line-height: 1;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.btn-close-error:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-error);
}

.expand-icon {
  font-size: 0.7rem;
  color: var(--color-text-dim);
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.error-item.expanded .expand-icon {
  transform: rotate(180deg);
}

.error-details {
  background: rgba(255, 107, 107, 0.05);
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(255, 107, 107, 0.2);
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
  color: var(--color-error);
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
  background: rgba(0, 0, 0, 0.3);
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
  padding: 0.4rem 0.8rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-action:hover {
  background: rgba(255, 107, 107, 0.15);
  color: #fff;
  border-color: var(--color-error);
}
</style>
