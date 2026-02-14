<template>
  <div class="settings-view">
    <div class="header">
      <h2>⚙️ サイト設定</h2>
      <div class="header-actions">
        <button @click="handleSave" class="btn-primary" :disabled="saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">読み込み中...</div>

    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
    </div>

    <div v-else-if="!loading" class="settings-layout">
      <!-- タブナビゲーション -->
      <div class="tabs">
        <button
          v-for="group in groups"
          :key="group.id"
          @click="activeTab = group.id"
          :class="['tab-button', { active: activeTab === group.id }]"
        >
          {{ group.label }}
        </button>
      </div>

      <!-- フォームエリア -->
      <div class="form-container">
        <div v-for="group in groups" :key="group.id" v-show="activeTab === group.id" class="form-group-section">
          <h3>{{ group.label }}</h3>
          
          <div v-for="field in group.fields" :key="field.key" class="form-group">
            <label :for="field.key">
              {{ field.label }}
              <span v-if="field.required" class="required">*</span>
            </label>

            <!-- Text -->
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

            <!-- Textarea -->
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
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, toRaw } from 'vue'
import { useProjectStore } from '../stores/project'

const projectStore = useProjectStore()

const formData = reactive({})
const fieldErrors = reactive({})
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const activeTab = ref('basic')

const groups = computed(() => {
  return projectStore.config?.site_settings?.groups || []
})

async function loadSettings() {
  loading.value = true
  errorMessage.value = ''
  
  try {
    const result = await window.electronAPI.loadSiteSettings()
    
    if (result.success) {
      // reactiveオブジェクトに設定値を代入
      Object.keys(formData).forEach(key => delete formData[key])
      Object.assign(formData, result.settings)
      
      // 最初のグループをアクティブに
      if (groups.value.length > 0) {
        activeTab.value = groups.value[0].id
      }
    } else {
      errorMessage.value = '設定の読み込みに失敗しました: ' + result.error
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
    errorMessage.value = '設定の読み込みに失敗しました: ' + error.message
  } finally {
    loading.value = false
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
  errorMessage.value = ''
  
  try {
    const result = await window.electronAPI.saveSiteSettings(toRaw(formData))
    
    if (result.success) {
      projectStore.notify('設定を保存しました', 'success')
    } else {
      const errMsg = '保存に失敗しました: ' + (result.error || '原因不明')
      projectStore.notify(errMsg, 'error')
      errorMessage.value = errMsg
    }
  } catch (error) {
    console.error('Save error:', error)
    const errMsg = '保存に失敗しました: ' + error.message
    projectStore.notify(errMsg, 'error')
    errorMessage.value = errMsg
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
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h2 {
  margin: 0;
  font-size: 1.75rem;
  color: #2c3e50;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #7f8c8d;
}

.error-banner {
  background: #fee;
  border: 2px solid #e74c3c;
  color: #c0392b;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border-radius: 8px;
  font-weight: 600;
}

.settings-layout {
  background: white;
  border-radius: 8px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.tabs {
  display: flex;
  border-bottom: 2px solid #e9ecef;
  background: #f8f9fa;
  overflow-x: auto;
}

.tab-button {
  padding: 1rem 1.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: 500;
  color: #6c757d;
  transition: all 0.2s;
  border-bottom: 3px solid transparent;
  white-space: nowrap;
}

.tab-button:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #2c3e50;
}

.tab-button.active {
  color: #3498db;
  border-bottom-color: #3498db;
  background: white;
}

.form-container {
  padding: 2rem;
}

.form-group-section h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.25rem;
  color: #2c3e50;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e9ecef;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9375rem;
}

.required {
  color: #e74c3c;
}

.form-group input[type="text"],
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d5dbdb;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-group input[type="text"]:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.form-group input.readonly,
.form-group textarea.readonly {
  background: #f8f9fa;
  cursor: not-allowed;
  color: #6c757d;
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}

.field-help {
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: #7f8c8d;
}

.field-error {
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: #e74c3c;
  font-weight: 600;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: #3498db;
  color: white;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(52, 152, 219, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
