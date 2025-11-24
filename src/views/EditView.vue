<template>
  <div class="edit-view">
    <div class="header">
      <h2>{{ isNew ? '新規作成' : '編集' }}: {{ contentTypeConfig?.label }}</h2>
      <div class="header-actions">
        <button @click="handleSave" class="btn-primary" :disabled="saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
        <router-link :to="`/contents/${type}`" class="btn-secondary">
          キャンセル
        </router-link>
      </div>
    </div>

    <div v-if="loading" class="loading">読み込み中...</div>

    <div v-else class="editor-layout">
      <div class="form-panel">
        <div v-for="field in fields" :key="field.key" class="form-group">
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
          />

          <!-- Textarea -->
          <textarea 
            v-else-if="field.type === 'textarea'"
            :id="field.key"
            v-model="formData[field.key]"
            :rows="field.rows || 3"
            :placeholder="field.placeholder"
            :required="field.required"
          />

          <!-- Date -->
          <input 
            v-else-if="field.type === 'date'"
            :id="field.key"
            v-model="formData[field.key]"
            type="date"
            :required="field.required"
          />

          <!-- Toggle -->
          <label v-else-if="field.type === 'toggle'" class="toggle-label">
            <input 
              :id="field.key"
              v-model="formData[field.key]"
              type="checkbox"
            />
            <span class="toggle-slider"></span>
          </label>

          <!-- Select -->
          <select 
            v-else-if="field.type === 'select'"
            :id="field.key"
            v-model="formData[field.key]"
            :required="field.required"
          >
            <option value="">選択してください</option>
            <option v-for="opt in field.options" :key="opt" :value="opt">
              {{ opt }}
            </option>
          </select>

          <!-- Markdown -->
          <textarea 
            v-else-if="field.type === 'markdown'"
            :id="field.key"
            v-model="formData[field.key]"
            rows="20"
            placeholder="Markdown形式で入力..."
            class="markdown-editor"
          />

          <!-- Image -->
          <div v-else-if="field.type === 'image'" class="image-field">
            <input 
              v-model="formData[field.key]"
              type="text"
              placeholder="画像パス"
              readonly
            />
            <button @click="handleImageUpload(field.key)" class="btn-secondary">
              画像を選択
            </button>
            <img 
              v-if="formData[field.key]" 
              :src="formData[field.key]" 
              alt="Preview"
              class="image-preview"
            />
          </div>

          <!-- List -->
          <div v-else-if="field.type === 'list'" class="list-field">
            <div v-for="(item, index) in (formData[field.key] || [])" :key="index" class="list-item">
              <input v-model="formData[field.key][index]" type="text" />
              <button @click="removeListItem(field.key, index)" class="btn-remove">×</button>
            </div>
            <button @click="addListItem(field.key)" class="btn-secondary">+ 項目を追加</button>
          </div>

          <p v-if="field.help" class="field-help">{{ field.help }}</p>
        </div>
      </div>

      <div class="preview-panel">
        <iframe 
          v-if="previewUrl"
          :src="previewUrl" 
          class="preview-iframe"
        />
        <div v-else class="preview-placeholder">
          プレビューは保存後に表示されます
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '../stores/project'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()

const type = computed(() => route.params.type)
const slug = computed(() => route.params.slug)
const isNew = computed(() => !slug.value)

const formData = ref({})
const loading = ref(false)
const saving = ref(false)
const previewUrl = ref(null)

const contentTypeConfig = computed(() => {
  return projectStore.config?.content_types?.[type.value]
})

const fields = computed(() => {
  return contentTypeConfig.value?.fields || []
})

async function loadContent() {
  if (isNew.value) {
    // 新規作成時のデフォルト値設定
    const defaults = {}
    fields.value.forEach(field => {
      if (field.default === 'today' && field.type === 'date') {
        defaults[field.key] = new Date().toISOString().split('T')[0]
      } else if (field.default !== undefined) {
        defaults[field.key] = field.default
      } else if (field.type === 'list') {
        defaults[field.key] = []
      } else if (field.type === 'toggle') {
        defaults[field.key] = false
      }
    })
    formData.value = defaults
  } else {
    loading.value = true
    try {
      const result = await window.electronAPI.loadContent(type.value, slug.value)
      formData.value = result
    } catch (error) {
      console.error('Failed to load content:', error)
    } finally {
      loading.value = false
    }
  }
}

async function handleSave() {
  saving.value = true
  try {
    const saveSlug = slug.value || generateSlug()
    const result = await window.electronAPI.saveContent(
      type.value,
      saveSlug,
      formData.value
    )
    
    if (result.success) {
      alert('保存しました')
      if (isNew.value) {
        router.push(`/edit/${type.value}/${saveSlug}`)
      }
    } else {
      alert('保存に失敗しました: ' + result.error)
    }
  } catch (error) {
    console.error('Save error:', error)
    alert('保存に失敗しました')
  } finally {
    saving.value = false
  }
}

function generateSlug() {
  const title = formData.value.title || 'untitled'
  const date = formData.value.date || new Date().toISOString().split('T')[0]
  return `${date}-${title.toLowerCase().replace(/\s+/g, '-')}`
}

function addListItem(key) {
  if (!formData.value[key]) {
    formData.value[key] = []
  }
  formData.value[key].push('')
}

function removeListItem(key, index) {
  formData.value[key].splice(index, 1)
}

async function handleImageUpload(key) {
  // ファイル選択ダイアログを表示
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    try {
      // ファイルパスを取得（Electronの場合）
      const result = await window.electronAPI.uploadImage(file.path)
      
      if (result.success) {
        formData.value[key] = result.path
        alert('画像をアップロードしました')
      } else {
        alert('アップロードに失敗しました: ' + result.error)
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('アップロードに失敗しました')
    }
  }
  
  input.click()
}

onMounted(async () => {
  await loadContent()
  
  // プレビューURLを設定
  if (projectStore.config?.site?.preview_url) {
    previewUrl.value = projectStore.config.site.preview_url
  }
})
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h2 {
  margin: 0;
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

.editor-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  height: calc(100vh - 200px);
}

.form-panel {
  overflow-y: auto;
  padding-right: 1rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #2c3e50;
}

.required {
  color: #e74c3c;
}

.form-group input[type="text"],
.form-group input[type="date"],
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d5dbdb;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
}

.form-group textarea {
  resize: vertical;
}

.markdown-editor {
  font-family: 'Courier New', monospace;
  min-height: 400px;
}

.toggle-label {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
}

.toggle-label input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 34px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: #3498db;
}

input:checked + .toggle-slider:before {
  transform: translateX(26px);
}

.image-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.image-preview {
  max-width: 300px;
  max-height: 200px;
  object-fit: contain;
  border: 1px solid #d5dbdb;
  border-radius: 4px;
}

.list-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list-item {
  display: flex;
  gap: 0.5rem;
}

.list-item input {
  flex: 1;
}

.btn-remove {
  padding: 0.5rem 0.75rem;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.field-help {
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: #7f8c8d;
}

.preview-panel {
  border: 1px solid #d5dbdb;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #7f8c8d;
}

.btn-primary, .btn-secondary {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: all 0.2s;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #ecf0f1;
  color: #2c3e50;
}

.btn-secondary:hover {
  background: #d5dbdb;
}
</style>
