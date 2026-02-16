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
      </nav>
    </header>
    
    <main class="app-main">
      <router-view />
    </main>

    <!-- プレビューステータスバー -->
    <PreviewStatus v-if="projectStore.isLoaded" />
    
    <!-- 通知コンテナ -->
    <div class="notification-container">
      <div 
        v-for="note in projectStore.notifications" 
        :key="note.id" 
        :class="['notification', note.type]"
      >
        {{ note.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useProjectStore } from './stores/project'
import PreviewStatus from './components/PreviewStatus.vue'

const projectStore = useProjectStore()

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

.app-main {
  /* Remove constraints to allow full-width views like EditView */
  min-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  padding-bottom: 60px; /* PreviewStatusバーの分の余白 */
}

/* --- Notifications --- */
.notification-container {
  position: fixed;
  bottom: calc(2rem + 60px); /* PreviewStatusバーの分を考慮 */
  right: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  z-index: 1000;
}

.notification {
  padding: 1.2rem 2rem;
  border-radius: var(--radius-md);
  background: var(--color-surface-mid);
  color: var(--color-text-main);
  min-width: 320px;
  box-shadow: var(--shadow-depth);
  display: flex;
  align-items: center;
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(10px);
  font-weight: 500;
  animation: slideInNeon 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.notification.success {
  border-left: 4px solid var(--color-success);
  color: #fff;
}

.notification.error {
  border-left: 4px solid var(--color-error);
  color: #fff;
}

.notification.info {
  border-left: 4px solid var(--color-primary);
  color: #fff;
}

@keyframes slideInNeon {
  from {
    transform: translateX(30px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
