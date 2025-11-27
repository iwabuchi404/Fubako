<template>
  <div class="edit-view">
    <div class="header">
      <h2>{{ isNew ? '新規作成' : '編集' }}: {{ contentTypeConfig?.label }}</h2>
      <div class="header-actions">
        <!-- 現在の状態を表示 -->
        <span 
          v-if="!isNew"
          class="current-status"
          :class="currentStatus.class"
        >
          {{ currentStatus.label }}
        </span>

        <button @click="handleSave" class="btn-primary" :disabled="saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
        <router-link :to="`/contents/${type}`" class="btn-secondary">
          キャンセル
        </router-link>
      </div>
    </div>

    <div v-if="loading" class="loading">読み込み中...</div>

    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
    </div>

    <div v-else class="editor-layout">
      <div class="form-panel">
        <!-- 公開設定セクション -->
        <div class="publish-settings-card">
          <h3>📤 公開設定</h3>
          
          <div class="publish-info">
            <div v-if="!isNew" class="status-display">
              <strong>現在の状態:</strong>
              <span 
                class="status-badge"
                :class="currentStatus.class"
              >
                {{ currentStatus.label }}
              </span>
            </div>
            
            <p class="help-text">
              ※ プレビューでは全ての記事が表示されます。本番サイトでは公開済みの記事のみ表示されます。
            </p>
          </div>
        </div>
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
        <!-- プレビューツールバー -->
        <div class="preview-toolbar" v-if="projectStore.previewRunning && !isNew">
          <div class="preview-mode-buttons">
            <button 
              @click="previewMode = 'mobile'"
              :class="['btn-mode', { active: previewMode === 'mobile' }]"
              title="モバイルビュー"
            >
              📱 モバイル
            </button>
            <button 
              @click="previewMode = 'desktop'"
              :class="['btn-mode', { active: previewMode === 'desktop' }]"
              title="デスクトップビュー"
            >
              💻 デスクトップ
            </button>
          </div>
          <button 
            v-if="previewUrl"
            @click="openInBrowser"
            class="btn-external"
            title="ブラウザで開く"
          >
            🔗 ブラウザで開く
          </button>
        </div>

        <!-- プレビュー表示エリア -->
        <div v-if="!projectStore.previewRunning" class="preview-placeholder">
          <p>プレビューサーバーが起動していません</p>
          <p class="preview-hint">ダッシュボードから「プレビューを開始」してください</p>
        </div>
        <div v-else-if="isNew" class="preview-placeholder">
          <p>記事を保存するとプレビューが表示されます</p>
        </div>
        <div v-else-if="previewUrl" class="preview-container" :class="previewMode">
          <iframe 
            :src="previewUrl" 
            class="preview-iframe"
          />
        </div>
        <div v-else class="preview-placeholder">
          <p>プレビューを読み込み中...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, toRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '../stores/project'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()

const type = computed(() => route.params.type)
const slug = computed(() => route.params.slug)
const isNew = computed(() => !slug.value)

const formData = reactive({})
const loading = ref(false)
const saving = ref(false)
const previewUrl = ref(null)
const errorMessage = ref('')
const previewMode = ref('desktop') // 'mobile' or 'desktop'

const contentTypeConfig = computed(() => {
  return projectStore.config?.content_types?.[type.value]
})

const fields = computed(() => {
  return contentTypeConfig.value?.fields || []
})

const currentStatus = computed(() => {
  if (isNew.value) {
    return { label: '新規', class: '' }
  }
  
  if (formData.draft) {
    return {
      label: '📝 下書き',
      class: 'status-draft'
    }
  }
  
  const publishDate = new Date(formData.date)
  const now = new Date()
  
  if (publishDate > now) {
    return {
      label: '🕐 予約投稿',
      class: 'status-scheduled'
    }
  }
  
  return {
    label: '✅ 公開中',
    class: 'status-published'
  }
})

async function loadContent() {
  console.log('[EditView] Loading content...', { isNew: isNew.value, type: type.value, slug: slug.value })
  
  if (isNew.value) {
    // 新規作成時のデフォルト値設定
    console.log('[EditView] Creating new content with fields:', fields.value)
    fields.value.forEach(field => {
      if (field.default === 'today' && field.type === 'date') {
        formData[field.key] = new Date().toISOString().split('T')[0]
      } else if (field.default !== undefined) {
        formData[field.key] = field.default
      } else if (field.type === 'list') {
        formData[field.key] = []
      } else if (field.type === 'toggle') {
        formData[field.key] = false
      } else if (field.type === 'markdown') {
        formData[field.key] = ''
      } else {
        formData[field.key] = ''
      }
    })
    console.log('[EditView] Initialized formData:', formData)
  } else {
    loading.value = true
    try {
      console.log('[EditView] Loading existing content...')
      const result = await window.electronAPI.loadContent(type.value, slug.value)
      console.log('[EditView] Loaded content:', result)
      
      // reactiveオブジェクトに直接代入
      Object.keys(formData).forEach(key => delete formData[key])
      Object.assign(formData, result)
      
      console.log('[EditView] FormData after load:', formData)
    } catch (error) {
      console.error('[EditView] Failed to load content:', error)
      errorMessage.value = 'コンテンツの読み込みに失敗しました: ' + error.message
    } finally {
      loading.value = false
    }
  }
}

async function handleSave() {
  saving.value = true
  errorMessage.value = ''
  
  try {
    const saveSlug = slug.value || generateSlug()
    console.log('[EditView] Saving content...', { type: type.value, slug: saveSlug })
    console.log('[EditView] FormData to save:', toRaw(formData))
    
    const result = await window.electronAPI.saveContent(
      type.value,
      saveSlug,
      toRaw(formData)
    )
    
    console.log('[EditView] Save result:', result)
    
    if (result.success) {
      alert('保存しました')
      errorMessage.value = ''
      
      // プレビューURLを更新
      updatePreviewUrl()
      
      if (isNew.value) {
        router.push(`/edit/${type.value}/${saveSlug}`)
      }
      
      return true
    } else {
      const errMsg = '保存に失敗しました: ' + (result.error || '原因不明')
      console.error('[EditView] Save failed:', result)
      alert(errMsg)
      errorMessage.value = errMsg
      return false
    }
  } catch (error) {
    console.error('[EditView] Save error:', error)
    const errMsg = '保存に失敗しました: ' + error.message
    alert(errMsg)
    errorMessage.value = errMsg
    return false
  } finally {
    saving.value = false
  }
}

function generateSlug() {
  const title = formData.title || 'untitled'
  const date = formData.date || new Date().toISOString().split('T')[0]
  return `${date}-${title.toLowerCase().replace(/\s+/g, '-')}`
}

function addListItem(key) {
  if (!formData[key]) {
    formData[key] = []
  }
  formData[key].push('')
}

function removeListItem(key, index) {
  formData[key].splice(index, 1)
}

async function openInBrowser() {
  if (previewUrl.value) {
    await window.electronAPI.openInBrowser(previewUrl.value)
  }
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
        formData[key] = result.path
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
  updatePreviewUrl()
})

// プレビューURLを更新する関数
function updatePreviewUrl() {
  // Zolaサーバーが起動している場合のみ
  if (projectStore.previewRunning && !isNew.value) {
    const contentType = contentTypeConfig.value
    if (contentType) {
      // Zolaはファイル名から日付プレフィックス（YYYY-MM-DD-）を削除してslugを生成する
      // 例: 2025-11-20-cloudsync-pro-release → cloudsync-pro-release
      let zolaSlug = slug.value
      
      // 日付プレフィックスを削除（YYYY-MM-DD-のパターン）
      const datePrefix = /^\d{4}-\d{2}-\d{2}-/
      if (datePrefix.test(zolaSlug)) {
        zolaSlug = zolaSlug.replace(datePrefix, '')
      }
      
      // Zolaのパス構造: /{folder}/{slug}/
      // 例: /news/cloudsync-pro-release/
      const articlePath = `/${contentType.folder.replace('content/', '')}/${zolaSlug}/`
      previewUrl.value = `http://localhost:1111${articlePath}`
      console.log('[EditView] Preview URL updated:', previewUrl.value)
    }
  } else if (!projectStore.previewRunning) {
    previewUrl.value = null
  }
}

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
  align-items: center;
}

.current-status {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 600;
  margin-right: 0.5rem;
}

.publish-settings-card {
  background: #f8f9fa;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.publish-settings-card h3 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  color: #2c3e50;
}

.publish-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-display {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.help-text {
  font-size: 0.875rem;
  color: #6c757d;
  margin: 0;
  line-height: 1.5;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  display: inline-block;
}

.status-published {
  background: #d4edda;
  color: #155724;
}

.status-scheduled {
  background: #fff3cd;
  color: #856404;
}

.status-draft {
  background: #e2e3e5;
  color: #383d41;
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

.editor-layout {
  display: grid;
  grid-template-columns: 1fr 2fr;
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
  display: flex;
  flex-direction: column;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid #d5dbdb;
  gap: 0.5rem;
}

.preview-mode-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-mode {
  padding: 0.5rem 1rem;
  border: 1px solid #d5dbdb;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-mode:hover {
  background: #e9ecef;
}

.btn-mode.active {
  background: #3498db;
  color: white;
  border-color: #3498db;
}

.btn-external {
  padding: 0.5rem 1rem;
  border: 1px solid #d5dbdb;
  background: white;
  border-radius: 4px;
  text-decoration: none;
  color: #2c3e50;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-external:hover {
  background: #e9ecef;
}

.preview-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: #e9ecef;
  overflow: auto;
  padding: 1rem;
}

.preview-container.mobile {
  padding: 0.5rem;
}

.preview-container.desktop {
  padding: 0;
}

.preview-container.mobile .preview-iframe {
  width: 375px;
  max-width: 100%;
  height: calc(100vh - 280px);
  border: 1px solid #d5dbdb;
  border-radius: 8px;
  background: white;
}

.preview-container.desktop .preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}


.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #7f8c8d;
  text-align: center;
  padding: 2rem;
}

.preview-placeholder p {
  margin: 0.5rem 0;
}

.preview-hint {
  font-size: 0.875rem;
  color: #95a5a6;
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
