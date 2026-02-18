<template>
  <div id="app">
    <header v-if="projectStore.isLoaded" class="app-header">
      <h1>{{ projectStore.config?.site?.name || 'Fubako' }}</h1>
      <nav class="main-nav">
        <router-link to="/">ダッシュボード</router-link>
        <router-link
          v-for="contentType in projectStore.contentTypes"
          :key="contentType.key"
          :to="`/contents/${contentType.key}`"
        >
          {{ contentType.label }}
        </router-link>
        <router-link to="/settings">設定</router-link>
        <router-link
          to="/git-settings"
          class="nav-git-link"
          :class="{ 'git-enabled': gitStore.isGitEnabled }"
        >
          Git
        </router-link>
        <router-link
          to="/error"
          class="nav-error-link"
          :class="{ 'has-error': errorStore.activeErrorCount > 0 }"
        >
          エラー
          <span v-if="errorStore.activeErrorCount > 0" class="error-badge">
            {{ errorStore.activeErrorCount }}
          </span>
        </router-link>
      </nav>
    </header>

    <main class="app-main">
      <router-view />
    </main>

    <!-- Gitフッター通知 -->
    <div v-if="showGitFooterNotice" class="git-footer-notice">
      <span class="git-icon">Git</span>
      <span class="git-message">未保存の変更があります</span>
    </div>

    <!-- エラー通知エリア -->
    <ErrorNotificationArea />

    <!-- プレビューステータスバー -->
    <PreviewStatus v-if="projectStore.isLoaded" />

    <!-- トーストエリア -->
    <ToastArea />

    <!-- Gitローディングモーダル -->
    <GitLoadingModal />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, computed } from 'vue'
import { useProjectStore } from './stores/project'
import { useErrorStore } from './stores/error'
import { useGitStore } from './stores/git'
import PreviewStatus from './components/PreviewStatus.vue'
import ErrorNotificationArea from './components/ErrorNotificationArea.vue'
import ToastArea from './components/ToastArea.vue'
import GitLoadingModal from './components/GitLoadingModal.vue'

const projectStore = useProjectStore()
const errorStore = useErrorStore()
const gitStore = useGitStore()

// フッター通知の表示条件
const showGitFooterNotice = computed(() => {
  return gitStore.isGitEnabled && gitStore.hasUncommittedChanges
})

onMounted(() => {
  // プロジェクトが既にロードされている場合（自動ロード等）のフォールバック
  if (projectStore.isLoaded) {
    projectStore.setupZolaErrorListener()
  }
})

onUnmounted(() => {
  projectStore.cleanupZolaErrorListener()
})
</script>

<style scoped>
.app-header {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border-bottom: 1px solid var(--glass-border);
  color: var(--color-text-main);
  padding: 0.75rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
}

.app-header h1 {
  margin: 0;
  font-size: 1.25rem;
  font-family: var(--font-display);
  font-weight: 800;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--color-primary);
  text-shadow: 0 0 15px var(--color-primary-glow);
}

.app-header h1::before {
  content: '';
  display: inline-block;
  width: 12px;
  height: 12px;
  background: var(--color-primary);
  border-radius: 2px;
  transform: rotate(45deg);
  box-shadow: 0 0 10px var(--color-primary);
}

.main-nav {
  display: flex;
  gap: 0.5rem;
}

.main-nav a {
  color: var(--color-text-dim);
  text-decoration: none;
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius-md);
  transition: all 0.3s ease;
  font-weight: 500;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.main-nav a:hover {
  color: var(--color-text-main);
  background: rgba(255, 255, 255, 0.05);
}

.main-nav a.router-link-active {
  color: var(--color-primary);
  background: rgba(0, 242, 255, 0.05);
  font-weight: 600;
}

/* Gitナビゲーションリンク */
.nav-git-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.nav-git-link.git-enabled {
  border-color: var(--color-primary);
  box-shadow: 0 0 8px rgba(0, 242, 255, 0.3);
}

/* エラーナビゲーションリンク */
.nav-error-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.nav-error-link.has-error {
  border-color: var(--color-error);
  box-shadow: 0 0 8px rgba(255, 107, 107, 0.3);
}

.error-badge {
  background: var(--color-error);
  color: white;
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 10px;
  font-weight: 700;
  min-width: 18px;
  text-align: center;
}

/* Gitフッター通知 */
.git-footer-notice {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-primary);
  color: var(--color-charcoal-deep);
  padding: 0.6rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;
  font-size: 0.85rem;
  z-index: 1001;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
}

.git-icon {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-sm);
}

.app-main {
  /* Remove constraints to allow full-width views like EditView */
  min-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  padding-bottom: 60px; /* PreviewStatusバーの分の余白 */
}
</style>
