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
      </nav>
    </header>
    
    <main class="app-main">
      <router-view />
    </main>
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

.main-nav a.router-link-active {
  background: rgba(255, 255, 255, 0.25);
}

.app-main {
  padding: 2rem;
  max-width: 1400px;
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
</style>
