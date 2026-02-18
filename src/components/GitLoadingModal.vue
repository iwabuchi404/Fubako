<template>
  <div v-if="isActive" class="git-loading-modal">
    <div class="modal-content glass">
      <div class="spinner"></div>
      <h3 class="modal-title">{{ currentActionTitle }}</h3>
      <p class="modal-message">{{ currentActionMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGitStore } from '../stores/git'

const gitStore = useGitStore()

// モーダルを表示するかどうか
const isActive = computed(() => {
  const l = gitStore.loading
  return l.init || l.commit || l.push || l.fetch || l.merge || l.export
})

// 現在のアクションに応じたタイトル
const currentActionTitle = computed(() => {
  const l = gitStore.loading
  if (l.init) return 'Gitリポジトリ初期化中'
  if (l.commit) return 'コミット中'
  if (l.push) return 'プッシュ中'
  if (l.fetch) return '更新を確認中'
  if (l.merge) return '本番公開中'
  if (l.export) return 'エクスポート中'
  return '処理中...'
})

// 現在のアクションに応じたメッセージ
const currentActionMessage = computed(() => {
  const l = gitStore.loading
  if (l.push || l.merge) {
    return 'GitHubに接続しています。認証画面が表示された場合はログインしてください...'
  }
  return 'しばらくお待ちください...'
})
</script>

<style scoped>
.git-loading-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease;
}

.modal-content {
  background: var(--color-bg-sub);
  padding: 2.5rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  text-align: center;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid var(--color-charcoal-muted);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-main);
  margin: 0;
}

.modal-message {
  color: var(--color-text-dim);
  font-size: 0.95rem;
  margin: 0;
  line-height: 1.5;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
