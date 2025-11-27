<template>
  <div class="home-view">
    <div v-if="!projectStore.isLoaded" class="welcome-screen">
      <h1>Fubako へようこそ</h1>
      <p>静的サイト管理ツール</p>
      <button @click="handleOpenProject" class="btn-primary">
        プロジェクトを開く
      </button>
    </div>

    <div v-else class="dashboard">
      <h2>ダッシュボード</h2>
      <div class="project-info">
        <p><strong>プロジェクト:</strong> {{ projectStore.projectPath }}</p>
        <p><strong>サイト名:</strong> {{ projectStore.config?.site?.name }}</p>
        <div class="preview-controls">
          <button 
            v-if="!projectStore.previewRunning"
            @click="handleStartPreview" 
            class="btn-primary" 
            :disabled="previewStarting"
          >
            {{ previewStarting ? 'プレビュー起動中...' : 'プレビューを開始' }}
          </button>
          <a 
            v-if="projectStore.previewUrl" 
            :href="projectStore.previewUrl" 
            target="_blank" 
            class="btn-secondary"
          >
            プレビューを開く
          </a>
        </div>
      </div>

      <div class="content-types-grid">
        <div 
          v-for="contentType in projectStore.contentTypes" 
          :key="contentType.key"
          class="content-type-card"
        >
          <h3>{{ contentType.label }}</h3>
          <p>{{ contentType.folder }}</p>
          <div class="card-actions">
            <router-link 
              :to="`/contents/${contentType.key}`"
              class="btn-secondary"
            >
              一覧を見る
            </router-link>
            <router-link 
              :to="`/edit/${contentType.key}`"
              class="btn-primary"
            >
              新規作成
            </router-link>
          </div>
        </div>

        <!-- 設定カード -->
        <div class="content-type-card settings-card">
          <h3>⚙️ サイト設定</h3>
          <p>サイトの基本情報や会社情報を編集</p>
          <div class="card-actions">
            <router-link 
              to="/settings"
              class="btn-primary btn-full"
            >
              設定を開く
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useProjectStore } from '../stores/project'
import { useRouter } from 'vue-router'

const projectStore = useProjectStore()
const router = useRouter()

const previewStarting = ref(false)

async function handleOpenProject() {
  const success = await projectStore.openProject()
  if (success) {
    router.push('/')
  }
}

async function handleStartPreview() {
  previewStarting.value = true
  try {
    const result = await projectStore.startPreview()
    if (result.success) {
      alert('プレビューサーバーを起動しました')
    } else {
      alert('プレビューの起動に失敗しました: ' + result.error)
    }
  } catch (error) {
    console.error('Preview error:', error)
    alert('プレビューの起動に失敗しました')
  } finally {
    previewStarting.value = false
  }
}
</script>

<style scoped>
.welcome-screen {
  text-align: center;
  padding: 6rem 2rem;
  background: white;
  border-radius: var(--radius-lg);
  border: 2px solid var(--color-primary);
  box-shadow: var(--shadow-md);
}

.welcome-screen h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
  font-weight: 700;
  color: var(--color-primary);
}

.welcome-screen p {
  font-size: 1.25rem;
  margin-bottom: 2.5rem;
  color: var(--color-text-secondary);
}

.dashboard {
  animation: fadeIn 0.3s ease-out;
}

.dashboard h2 {
  margin-bottom: 2rem;
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.project-info {
  background: white;
  padding: 2rem;
  border-radius: var(--radius-lg);
  margin-bottom: 2.5rem;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-gray-200);
}

.project-info p {
  margin: 0.75rem 0;
  font-size: 1rem;
  color: var(--color-text-secondary);
}

.project-info strong {
  color: var(--color-text-primary);
  font-weight: 600;
}

.preview-controls {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 2px solid var(--color-gray-200);
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.content-types-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.content-type-card {
  background: white;
  border: 1px solid var(--color-gray-200);
  border-radius: var(--radius-lg);
  padding: 2rem;
  transition: all 0.2s ease;
  position: relative;
}

.content-type-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--color-primary);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.content-type-card:hover {
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary);
}

.content-type-card h3 {
  margin: 0 0 0.5rem 0;
  color: var(--color-text-primary);
  font-size: 1.5rem;
  font-weight: 700;
}

.content-type-card p {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.card-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-primary, .btn-secondary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  transition: all 0.2s ease;
  text-align: center;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: var(--color-text-primary);
  border: 2px solid var(--color-gray-300);
}

.btn-secondary:hover {
  background: var(--color-gray-50);
  border-color: var(--color-gray-400);
}

.btn-full {
  width: 100%;
}

.settings-card {
  border: 2px solid var(--color-primary);
  background: white;
}

.settings-card::before {
  background: var(--color-primary);
}

.settings-card:hover {
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary-dark);
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
