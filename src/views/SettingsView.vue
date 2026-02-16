<template>
  <div class="settings-view fade-in-up">
    <header class="settings-header glass">
      <div class="title-area">
        <span class="type-tag">SYSTEM</span>
        <h2 class="text-glow">GLOBAL SETTINGS</h2>
      </div>
      <div class="header-actions">
        <button @click="handleSave" class="btn-primary" :disabled="saving">
          {{ saving ? 'UPDATING...' : 'SAVE CHANGES' }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="loading-full">
      <div class="loader-neon"></div>
      <p>LOADING SYSTEM CONFIG...</p>
    </div>

    <div v-if="errorMessage" class="error-banner">
      <i class="icon-warning">!</i> {{ errorMessage }}
    </div>

    <!-- Build Status Bar -->
    <div v-if="projectStore.previewBuildStatus === 'building'" class="build-status-bar">
      <div class="build-indicator">
        <div class="loader-pulse"></div>
        <span>{{ projectStore.previewBuildMessage || 'ビルド中...' }}</span>
      </div>
    </div>

    <!-- Error Status Bar -->
    <div v-if="projectStore.previewBuildStatus === 'error'" class="error-status-bar">
      <div class="error-indicator">
        <i class="icon-error">!</i>
        <span>ビルドエラーが発生しました</span>
      </div>
      <button @click="showBuildError = !showBuildError" class="btn-toggle-error">
        {{ showBuildError ? '詳細を隠す' : '詳細を表示' }}
      </button>
      <div v-if="showBuildError" class="build-error-details">
        <h4>エラー詳細</h4>
        <p>{{ projectStore.previewBuildError || '不明なエラー' }}</p>
        <div class="error-actions">
          <button @click="handleRebuildPreview" class="btn-secondary btn-sm">
            リビルドを試す
          </button>
          <button @click="showBuildError = false" class="btn-primary btn-sm">
            閉じる
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="settings-main-layout">
      <!-- Vertical Tabs Navigation -->
      <aside class="settings-nav glass">
        <div class="nav-label">CONFIGURATION</div>
        <button
          v-for="group in groups"
          :key="group.id"
          @click="activeTab = group.id"
          :class="['nav-button', { active: activeTab === group.id }]"
        >
          {{ group.label.toUpperCase() }}
        </button>
      </aside>

      <!-- Main Form Area -->
      <main class="settings-content glass">
        <div v-for="group in groups" :key="group.id" v-show="activeTab === group.id" class="form-section fade-in">
          <div class="section-header">
            <h3>{{ group.label }}</h3>
            <p class="section-desc">Manage your {{ group.label.toLowerCase() }} and global configurations.</p>
          </div>
          
          <div class="form-grid">
            <div v-for="field in group.fields" :key="field.key" class="form-item">
              <label :for="field.key">
                {{ field.label }}
                <span v-if="field.required" class="required">*</span>
              </label>

              <!-- Inputs styled globally in components.css -->
              <input 
                v-if="field.type === 'text'"
                :id="field.key"
                v-model="formData[field.key]"
                type="text"
                :placeholder="field.placeholder"
                :required="field.required"
                :readonly="field.readonly"
                :class="{ readonly: field.readonly }"
              />

              <textarea 
                v-else-if="field.type === 'textarea'"
                :id="field.key"
                v-model="formData[field.key]"
                :rows="field.rows || 3"
                :placeholder="field.placeholder"
                :required="field.required"
                :readonly="field.readonly"
                :class="{ readonly: field.readonly }"
              />

              <p v-if="field.help" class="field-help">{{ field.help }}</p>
              <p v-if="fieldErrors[field.key]" class="field-error">{{ fieldErrors[field.key] }}</p>
            </div>
          </div>
        </div>
      </main>

      <!-- Preview Panel -->
      <PreviewPanel 
        :is-new="false"
        :initial-width="400"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, toRaw } from 'vue'
import { useProjectStore } from '../stores/project'
import PreviewPanel from '../components/PreviewPanel.vue'

const projectStore = useProjectStore()

const formData = reactive({})
const fieldErrors = reactive({})
const loading = computed(() => projectStore.isSettingsLoading())
const saving = ref(false)
const errorMessage = computed(() => projectStore.getSettingsError())
const activeTab = ref('basic')
const showBuildError = ref(false)

const groups = computed(() => {
  return projectStore.config?.site_settings?.groups || []
})

async function handleRebuildPreview() {
  showBuildError.value = false
  await projectStore.rebuildPreview()
}

async function loadSettings() {
  try {
    const settings = await projectStore.fetchSiteSettings()
    
    Object.keys(formData).forEach(key => delete formData[key])
    Object.assign(formData, settings)
    
    if (groups.value.length > 0) {
      activeTab.value = groups.value[0].id
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
    // エラーメッセージはストアから取得
  }
}

function validateForm() {
  Object.keys(fieldErrors).forEach(key => delete fieldErrors[key])
  let isValid = true

  groups.value.forEach(group => {
    group.fields.forEach(field => {
      if (field.required && !formData[field.key]) {
        fieldErrors[field.key] = 'この項目は必須です'
        isValid = false
      }
    })
  })

  return isValid
}

async function handleSave() {
  if (!validateForm()) {
    projectStore.notify('入力内容を確認してください', 'error')
    return false
  }

  saving.value = true
  
  try {
    await projectStore.updateSiteSettings(toRaw(formData))
    return true
  } catch (error) {
    console.error('Save error:', error)
    // エラーメッセージはストアから取得
    return false
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadSettings()
})
</script>

<style scoped>
.settings-view {
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem 2.5rem;
  height: calc(100vh - 60px); /* Adjust for header height */
  display: flex;
  flex-direction: column;
}

.settings-header {
  padding: 1rem 2.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  border-radius: var(--radius-lg);
}

.type-tag {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.25em;
  display: block;
}

.settings-header h2 {
  font-size: 1.5rem;
  margin: 0;
  letter-spacing: -0.02em;
}

.settings-main-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr auto;
  gap: 2rem;
  overflow: hidden;
}

.settings-nav {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-label {
  font-family: var(--font-display);
  font-size: 0.7rem;
  color: var(--color-text-dark);
  letter-spacing: 0.15em;
  margin-bottom: 1rem;
  padding-left: 0.75rem;
}

.nav-button {
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  text-align: left;
  padding: 0.8rem 1.2rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
  transition: all 0.3s ease;
  letter-spacing: 0.05em;
}

.nav-button:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-main);
}

.nav-button.active {
  background: rgba(0, 242, 255, 0.08);
  color: var(--color-primary);
  box-shadow: inset 2px 0 0 var(--color-primary);
}

.settings-content {
  padding: 3rem;
  overflow-y: auto;
}

.section-header {
  margin-bottom: 3rem;
}

.section-header h3 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.section-desc {
  color: var(--color-text-dark);
  font-size: 0.9rem;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 800px;
}

.form-item label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-dim);
  margin-bottom: 0.6rem;
}

.readonly {
  background: rgba(255, 255, 255, 0.02) !important;
  color: var(--color-text-dark) !important;
  cursor: not-allowed;
}

.loading-full {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  opacity: 0.6;
}

.loader-neon {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(0, 242, 255, 0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  box-shadow: 0 0 15px var(--color-primary-glow);
}

@keyframes spin { to { transform: rotate(360deg); } }

.error-banner {
  padding: 1.5rem 2rem;
  background: rgba(255, 68, 102, 0.1);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  font-weight: 600;
}

/* --- Build Status Bar --- */
.build-status-bar {
  position: relative;
  background: rgba(245, 158, 11, 0.1);
  border-bottom: 2px solid rgba(245, 158, 11, 0.5);
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  margin-bottom: 0;
}

.build-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #f59e0b;
  font-weight: 600;
  font-size: 0.8rem;
}

.loader-pulse {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(245, 158, 11, 0.3);
  border-top-color: #f59e0b;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* --- Error Status Bar --- */
.error-status-bar {
  position: relative;
  background: rgba(255, 107, 107, 0.1);
  border-bottom: 2px solid rgba(255, 107, 107, 0.5);
  padding: 1rem 1.5rem;
  backdrop-filter: blur(10px);
  margin-bottom: 0;
}

.error-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #ff6b6b;
  font-weight: 600;
  font-size: 0.9rem;
}

.icon-error {
  font-style: normal;
  font-size: 1.2rem;
  font-weight: 700;
}

.btn-toggle-error {
  background: transparent;
  border: 1px solid var(--color-error);
  color: var(--color-error);
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-toggle-error:hover {
  background: rgba(255, 107, 107, 0.1);
}

.build-error-details {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  border-left: 3px solid var(--color-error);
}

.build-error-details h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.85rem;
  color: var(--color-error);
}

.build-error-details p {
  margin: 0 0 1rem 0;
  font-size: 0.8rem;
  color: var(--color-text-dark);
  white-space: pre-wrap;
  word-break: break-all;
}

.error-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.75rem;
}
</style>
