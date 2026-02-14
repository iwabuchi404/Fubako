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
import { useProjectStore } from './stores/project'

const projectStore = useProjectStore()
</script>

<style scoped>
.app-header {
  background: var(--color-primary);
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-md);
  position: sticky;
  top: 0;
  z-index: 100;
}

.app-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-header h1::before {
  content: '🚀';
  font-size: 1.5rem;
}

.main-nav {
  display: flex;
  gap: 0.5rem;
}

.main-nav a {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  transition: background 0.2s ease;
  font-weight: 500;
  font-size: 0.9375rem;
}

.main-nav a:hover {
  background: rgba(255, 255, 255, 0.15);
}

.main-nav a.router-link-exact-active {
  background: rgba(255, 255, 255, 0.25);
}

.app-main {
  padding: 2rem;
  max-width: 1800px;
  margin: 0 auto;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 通知スタイル */
.notification-container {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  z-index: 1000;
}

.notification {
  padding: 1rem 1.5rem;
  border-radius: var(--radius-md);
  color: white;
  min-width: 300px;
  box-shadow: var(--shadow-lg);
  display: flex;
  align-items: center;
  animation: slideIn 0.3s ease-out;
  font-weight: 500;
}

.notification.success {
  background: #27ae60;
  border-left: 5px solid #1e8449;
}

.notification.error {
  background: #e74c3c;
  border-left: 5px solid #c0392b;
}

.notification.info {
  background: #3498db;
  border-left: 5px solid #2980b9;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
