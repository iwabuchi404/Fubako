<template>
  <div class="edit-view fade-in-up">
    <!-- Floating Header -->
    <header class="edit-header glass">
      <div class="header-left">
        <router-link :to="`/contents/${type}`" class="btn-back" title="戻る">
          ←
        </router-link>
        <div class="title-meta">
          <span class="type-label">{{ contentTypeConfig?.label || type }}</span>
          <h2>{{ isNew ? 'NEW ENTRY' : formData.title || 'UNTITLED' }}</h2>
        </div>
      </div>

      <div class="header-right">
        <div class="status-indicator">
          <span class="dot" :class="currentStatus.class"></span>
          <span class="status-text">{{ currentStatus.label }}</span>
        </div>

        <div class="actions">
          <button
            v-if="!isNew"
            @click="handleDelete"
            class="btn-remove btn-icon"
            :disabled="saving"
            title="削除"
          >
            削除
          </button>
          <button @click="handleSave" class="btn-primary btn-save" :disabled="saving">
            {{ saving ? 'SAVING...' : 'PUBLISH / SAVE' }}
          </button>
        </div>
      </div>
    </header>

    <div v-if="loading" class="loading-full">
      <div class="loader-neon"></div>
      <p>FETCHING DATA...</p>
    </div>

    <div v-if="errorMessage" class="error-banner">
      <i class="icon-warning">!</i> {{ errorMessage }}
    </div>

    <div 
      v-else 
      class="editor-main-layout" 
      :class="{ 
        'sidebar-collapsed': sidebarCollapsed, 
        'preview-collapsed': previewCollapsed,
        'is-resizing': isResizing
      }"
      :style="layoutGridStyle"
    >
      <!-- Left Panel: Fields -->
      <aside class="sidebar-panel glass">
        <div class="panel-header-actions">
          <h3>METADATA</h3>
          <button @click="sidebarCollapsed = true" class="btn-icon-sm" title="サイドバーを隠す">◀</button>
        </div>
        <div class="sidebar-scroll-content">
          <div class="panel-section">
            <div v-for="field in fields" :key="field.key">
              <div v-if="field.type !== 'markdown'" class="field-item">
                <label :for="field.key">
                  {{ field.label }}
                  <span v-if="field.required" class="required">*</span>
                </label>
                
                <!-- Input Logic -->
                <input 
                  v-if="field.type === 'text'"
                  :id="field.key"
                  v-model="formData[field.key]"
                  type="text"
                  :required="field.required"
                />

                <!-- 特注: スラグ（URL）フィールド -->
                <div v-if="field.key === 'title'" class="field-item extra-field">
                  <label for="custom-slug">
                    カスタムURL (slug)
                  </label>
                  <input 
                    id="custom-slug"
                    v-model="formData.slug"
                    type="text"
                    placeholder="example-article-url"
                  />
                  <p class="field-help">英数字とハイフンを推奨します。空欄の場合はファイル名が使用されます。</p>
                </div>
                <textarea 
                  v-else-if="field.type === 'textarea'"
                  :id="field.key"
                  v-model="formData[field.key]"
                  :rows="field.rows || 3"
                  :required="field.required"
                />
                <input 
                  v-else-if="field.type === 'date'"
                  :id="field.key"
                  v-model="formData[field.key]"
                  type="date"
                  :required="field.required"
                />
                <select 
                  v-else-if="field.type === 'select'"
                  :id="field.key"
                  v-model="formData[field.key]"
                  :required="field.required"
                >
                  <option value="">Choose...</option>
                  <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
                </select>
                <div v-else-if="field.type === 'image'" class="image-uploader">
                  <div class="img-input-row">
                    <input v-model="formData[field.key]" type="text" readonly />
                    <button @click="handleImageUpload(field.key)" class="btn-secondary btn-sm">UPLOAD</button>
                  </div>
                  <img v-if="formData[field.key]" :src="formData[field.key]" class="img-thumb" />
                </div>
                <div v-else-if="field.type === 'toggle'" class="toggle-row">
                  <span>{{ field.label }}</span>
                  <label class="switch">
                    <input v-model="formData[field.key]" type="checkbox" />
                    <span class="slider"></span>
                  </label>
                </div>

                <p v-if="fieldErrors[field.key]" class="field-error">{{ fieldErrors[field.key] }}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Sidebar Restore Trigger -->
      <div v-if="sidebarCollapsed" class="collapsed-bar left" @click="sidebarCollapsed = false" title="サイドバーを表示">
        <span>METADATA ▶</span>
      </div>

      <!-- Center: Editor Area -->
      <section class="editor-area">
        <template v-for="field in fields" :key="field.key">
          <div v-if="field.type === 'markdown'" class="editor-wrapper">
            <textarea 
              :id="field.key"
              v-model="formData[field.key]"
              placeholder="Start writing in Markdown..."
              class="markdown-workspace"
            />
          </div>
        </template>
      </section>

      <!-- Resizer Handle -->
      <div 
        v-if="!previewCollapsed" 
        class="layout-resizer" 
        @mousedown="startResizing"
        title="ドラッグでプレビュー幅を調整"
      ></div>

      <!-- Preview Restore Trigger -->
      <div v-if="previewCollapsed" class="collapsed-bar right" @click="previewCollapsed = false" title="プレビューを表示">
        <span>◀ PREVIEW</span>
      </div>

      <!-- Right Panel: Preview -->
      <section class="preview-panel glass">
        <div class="preview-header">
          <div class="header-actions-left">
            <button @click="previewCollapsed = true" class="btn-icon-sm" title="プレビューを隠す">▶</button>
            <div class="device-selectors">
              <button @click="previewMode = 'desktop'" :class="{active: previewMode === 'desktop'}">DESKTOP</button>
              <button @click="previewMode = 'mobile'" :class="{active: previewMode === 'mobile'}">MOBILE</button>
            </div>
          </div>
          <button @click="openInBrowser" class="btn-link">OPEN BROWSER ↗</button>
        </div>

        <div class="preview-body" :class="previewMode">
          <div v-if="!projectStore.previewRunning" class="preview-state">
            <p>PREVIEW SERVER INACTIVE</p>
            <span class="hint">Start via Dashboard</span>
          </div>
          <div v-else-if="isNew" class="preview-state">
            <p>SAVE TO GENERATE PREVIEW</p>
          </div>
          <iframe 
            v-else-if="previewUrl"
            :src="previewUrl" 
            class="preview-frame"
          />
          <div v-else class="preview-state">
            <p>LOADING PREVIEW...</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, toRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '../stores/project'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()

const type = computed(() => route.params.type)
const slug = computed(() => route.params.slug)
const isNew = computed(() => !slug.value)

const formData = reactive({})
const fieldErrors = reactive({})
const loading = ref(false)
const saving = ref(false)
const isDirty = ref(false)
const previewUrl = ref(null)
const errorMessage = ref('')
const previewMode = ref('desktop') // 'mobile' or 'desktop'

const sidebarCollapsed = ref(false)
const previewCollapsed = ref(false)

// --- Resizing Logic ---
const isResizing = ref(false)
const previewWidth = ref(450) // Default width in pixels for preview

const layoutGridStyle = computed(() => {
  let left = sidebarCollapsed.value ? '40px' : '280px'
  if (previewCollapsed.value) {
    return {
      display: 'grid',
      gridTemplateColumns: `${left} 1fr 40px`
    }
  } else {
    return {
      display: 'grid',
      gridTemplateColumns: `${left} 1fr 6px ${previewWidth.value}px`
    }
  }
})

function startResizing(e) {
  isResizing.value = true
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', stopResizing)
  document.body.style.cursor = 'col-resize'
  e.preventDefault()
}

function handleMouseMove(e) {
  if (!isResizing.value) return
  
  // Calculate new width for the right panel
  const newWidth = window.innerWidth - e.clientX
  
  // Constrain width
  if (newWidth > 200 && newWidth < (window.innerWidth * 0.7)) {
    previewWidth.value = newWidth
  }
}

function stopResizing() {
  isResizing.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', stopResizing)
  document.body.style.cursor = ''
}

onUnmounted(() => {
  stopResizing()
})

// フォームの変更を監視
watch(formData, () => {
  isDirty.value = true
}, { deep: true })

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

async function validateForm() {
  Object.keys(fieldErrors).forEach(key => delete fieldErrors[key])
  let isValid = true

  // 必須チェック
  fields.value.forEach(field => {
    if (field.required && !formData[field.key]) {
      fieldErrors[field.key] = 'この項目は必須です'
      isValid = false
    }
  })

  // スラグ重複チェック（新規作成時のみ）
  if (isNew.value && isValid) {
    const saveSlug = generateSlug()
    const result = await window.electronAPI.existsContent({ type: type.value, slug: saveSlug })
    if (result.success && result.exists) {
      errorMessage.value = '同じスラグ（ファイル名）の記事が既に存在します。タイトルを変更してください。'
      isValid = false
    }
  }

  return isValid
}

async function handleSave() {
  if (!(await validateForm())) {
    projectStore.notify('入力内容を確認してください', 'error')
    return false
  }

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
      projectStore.notify('保存しました', 'success')
      errorMessage.value = ''
      isDirty.value = false
      
      // プレビューURLを更新
      updatePreviewUrl()
      
      if (isNew.value) {
        router.push(`/edit/${type.value}/${saveSlug}`)
      }
      
      return true
    } else {
      const errMsg = '保存に失敗しました: ' + (result.error || '原因不明')
      console.error('[EditView] Save failed:', result)
      projectStore.notify(errMsg, 'error')
      errorMessage.value = errMsg
      return false
    }
  } catch (error) {
    console.error('[EditView] Save error:', error)
    const errMsg = '保存に失敗しました: ' + error.message
    projectStore.notify(errMsg, 'error')
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
  try {
    // Electronのファイル選択ダイアログで画像を選択
    const filePath = await window.electronAPI.selectImageFile()
    if (!filePath) return

    const result = await window.electronAPI.uploadImage(filePath)

    if (result.success) {
      formData[key] = result.path
      projectStore.notify('画像をアップロードしました', 'success')
    } else {
      projectStore.notify('アップロードに失敗しました: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('Upload error:', error)
    projectStore.notify('アップロードに失敗しました', 'error')
  }
}

async function handleDelete() {
  const title = formData.title || slug.value
  if (!confirm(`「${title}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
    return
  }

  try {
    const result = await window.electronAPI.deleteContent(type.value, slug.value)
    if (result.success) {
      projectStore.notify('削除しました', 'success')
      router.push(`/contents/${type.value}`)
    } else {
      projectStore.notify('削除に失敗しました: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('Delete error:', error)
    projectStore.notify('削除に失敗しました', 'error')
  }
}

onMounted(async () => {
  await loadContent()
  updatePreviewUrl()
})

// プレビューURLを更新する関数
function updatePreviewUrl() {
  if (projectStore.previewRunning && !isNew.value) {
    const contentType = contentTypeConfig.value
    if (contentType) {
      // カスタムスラグが指定されている場合はそれを最優先する
      let zolaSlug = formData.slug || slug.value
      
      // カスタムスラグがない（ファイル名を使用する）場合のみ、日付プレフィックスを削除する
      if (!formData.slug) {
        const datePrefix = /^\d{4}-\d{2}-\d{2}-/
        if (datePrefix.test(zolaSlug)) {
          zolaSlug = zolaSlug.replace(datePrefix, '')
        }
      }
      
      // Zolaのパス構造: /{folder}/{slug}/
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
.edit-view {
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
}

/* --- Header --- */
.edit-header {
  height: 54px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.5rem;
  background: var(--color-charcoal-main);
  border-bottom: 1px solid var(--glass-border);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.btn-back {
  font-size: 1.25rem;
  color: var(--color-text-dim);
  text-decoration: none;
  line-height: 1;
}

.btn-back:hover {
  color: var(--color-primary);
}

.title-meta {
  display: flex;
  flex-direction: column;
}

.type-label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--color-primary);
  text-transform: uppercase;
  font-weight: 600;
  line-height: 1.2;
}

.title-meta h2 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-charcoal-muted);
}

.dot.status-published { background: var(--color-success); }
.dot.status-scheduled { background: var(--color-warning); }
.dot.status-draft { background: var(--color-text-dark); }

.status-text {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-text-dim);
  text-transform: uppercase;
}

.actions {
  display: flex;
  gap: 0.75rem;
}

.btn-save {
  padding: 0.5rem 1.25rem;
}

/* --- Layout --- */
.editor-main-layout {
  flex: 1;
  display: grid;
  /* grid-template-columns is set via inline :style */
  gap: 0; /* Gap is handled by resizer and borders */
  background: var(--glass-border);
  overflow: hidden;
  width: 100%;
}

.editor-main-layout.is-resizing {
  user-select: none;
}

.editor-main-layout.is-resizing iframe {
  pointer-events: none;
}

.layout-resizer {
  width: 6px;
  background: transparent;
  cursor: col-resize;
  z-index: 50;
  transition: background 0.2s;
  position: relative;
  margin: 0 -3px; /* Center the touch area */
}

.layout-resizer:hover,
.is-resizing .layout-resizer {
  background: var(--color-primary);
  box-shadow: 0 0 8px var(--color-primary);
}

/* --- Sidebar --- */
.sidebar-panel {
  padding: 1.25rem;
  overflow-y: auto;
  background: var(--color-charcoal-main);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.sidebar-collapsed .sidebar-panel {
  display: none;
}

.panel-header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.btn-icon-sm {
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--color-text-dim);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.6rem;
}

.btn-icon-sm:hover {
  background: var(--color-charcoal-muted);
  color: var(--color-primary);
}

.sidebar-scroll-content {
  flex: 1;
  overflow-y: auto;
}

.panel-section h3 {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--color-text-dark);
  text-transform: uppercase;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--glass-border);
  padding-bottom: 0.4rem;
  letter-spacing: 0.05em;
}

.field-item {
  margin-bottom: 1.25rem;
}

.field-item label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-dim);
  margin-bottom: 0.4rem;
}

.required {
  color: var(--color-error);
  margin-left: 0.2rem;
}

.image-uploader {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.img-thumb {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: contain;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--color-charcoal-deep);
  display: flex;
  align-items: center;
  justify-content: center;
}

.img-thumb:empty::after {
  content: 'NO IMAGE';
  font-size: 0.6rem;
  color: var(--color-text-dark);
  font-weight: 700;
}

.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  padding: 0.4rem 0;
}

/* --- Collapsed Bars --- */
.collapsed-bar {
  background: var(--color-charcoal-light);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  border-right: 1px solid var(--glass-border);
  border-left: 1px solid var(--glass-border);
}

.collapsed-bar:hover {
  background: var(--color-charcoal-muted);
}

.collapsed-bar span {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--color-text-dark);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.collapsed-bar:hover span {
  color: var(--color-primary);
}

/* --- Editor Area --- */
.editor-area {
  display: flex;
  flex-direction: column;
  background: var(--color-charcoal-deep);
  height: 100%;
}

.editor-wrapper {
  flex: 1;
  display: flex;
  height: 100%;
}

.markdown-workspace {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-text-main);
  padding: 2rem 3rem;
  font-family: var(--font-mono);
  font-size: 15px;
  line-height: 1.8;
  resize: none;
  outline: none;
  height: 100%;
}

.markdown-workspace::placeholder {
  color: var(--color-charcoal-muted);
}

/* --- Preview Panel --- */
.preview-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-charcoal-main);
}

.preview-collapsed .preview-panel {
  display: none;
}

.preview-header {
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-charcoal-light);
  border-bottom: 1px solid var(--glass-border);
}

.header-actions-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.device-selectors {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  padding: 2px;
  border-radius: var(--radius-sm);
}

.device-selectors button {
  background: transparent;
  border: none;
  color: var(--color-text-dark);
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  border-radius: 2px;
}

.device-selectors button.active {
  background: var(--color-charcoal-muted);
  color: var(--color-primary);
}

.btn-link {
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-link:hover {
  color: var(--color-text-main);
}

.preview-body {
  flex: 1;
  background: #25252b;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 0;
  overflow: hidden;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
}

.preview-body.mobile {
  padding: 1.5rem;
  background: #3a3a45;
}

.preview-body.mobile .preview-frame {
  width: 375px;
  max-height: 100%;
  aspect-ratio: 9/16;
  border-radius: 24px;
  border: 12px solid #000;
  box-shadow: var(--shadow-lg);
}

.preview-state {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: var(--color-text-dark);
  font-size: 0.85rem;
  font-weight: 600;
  gap: 0.5rem;
}

.preview-state .hint {
  font-size: 0.75rem;
  font-weight: 400;
}

/* --- Misc --- */
.loading-full {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1.5rem;
  color: var(--color-text-dark);
  font-weight: 700;
  font-size: 0.8rem;
}

.loader-neon {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(74, 144, 226, 0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-banner {
  padding: 1rem 1.5rem;
  background: rgba(217, 83, 79, 0.1);
  border-bottom: 1px solid var(--color-error);
  color: var(--color-error);
  font-size: 0.9rem;
  font-weight: 500;
}

.field-error {
  color: var(--color-error);
  font-size: 0.75rem;
  margin-top: 0.4rem;
  font-weight: 500;
}

.field-help {
  font-size: 0.65rem;
  color: var(--color-text-dark);
  margin-top: 0.4rem;
  line-height: 1.4;
}

.extra-field {
  border-top: 1px solid var(--glass-border);
  padding-top: 1rem;
  margin-top: 0.5rem;
}
</style>
