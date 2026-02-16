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
    
    <div v-if="projectStore.previewBuildStatus === 'building'" class="build-status-bar">
      <div class="build-indicator">
        <div class="loader-pulse"></div>
        <span>{{ projectStore.previewBuildMessage || 'ビルド中...' }}</span>
      </div>
    </div>

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
        
        <!-- 重複スラグエラーの場合、解決ボタンを表示 -->
        <div v-if="isPathCollisionError" class="collision-actions">
          <p class="collision-info">
            <i class="icon-warning">⚠</i>
            URLパスの衝突が検出されました。自動的に解決できますか？
          </p>
          <div class="error-actions">
            <button @click="handleAutoResolveCollision" class="btn-primary btn-sm" :disabled="resolvingCollision">
              {{ resolvingCollision ? '解決中...' : '自動で解決する' }}
            </button>
            <button @click="showBuildError = false" class="btn-secondary btn-sm">
              閉じる
            </button>
          </div>
        </div>
        
        <!-- 一般的なエラー -->
        <div v-else class="error-actions">
          <button @click="handleRebuildPreview" class="btn-secondary btn-sm">
            リビルドを試す
          </button>
          <button @click="showBuildError = false" class="btn-primary btn-sm">
            閉じる
          </button>
        </div>
      </div>
    </div>

    <div 
      class="editor-main-layout" 
      :class="{ 
        'sidebar-collapsed': sidebarCollapsed,
        'is-resizing': isResizing
      }"
      :style="layoutGridStyle"
    >
      <!-- Left Panel: Fields -->
      <aside class="sidebar-panel glass" :class="{ 'editor-locked': projectStore.isBuildError }">
        <div class="panel-header-actions">
          <h3>METADATA</h3>
          <button @click="sidebarCollapsed = true" class="btn-icon-sm" title="サイドバーを隠す" :disabled="projectStore.isBuildError">◀</button>
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
                  :disabled="projectStore.isBuildError"
                >
                  <option value="">Choose...</option>
                  <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
                </select>
                <div v-else-if="field.type === 'image'" class="image-uploader">
                  <div class="img-input-row">
                    <input v-model="formData[field.key]" type="text" readonly :disabled="projectStore.isBuildError" />
                    <button @click="handleImageUpload(field.key)" class="btn-secondary btn-sm" :disabled="projectStore.isBuildError">UPLOAD</button>
                    <button v-if="formData[field.key] && !projectStore.isBuildError" @click="handleResizeImage(field.key)" class="btn-secondary btn-sm">RESIZE</button>
                    <button v-if="!formData[field.key] && !projectStore.isBuildError" @click="openDummyModal(field.key)" class="btn-secondary btn-sm">DUMMY</button>
                  </div>
                  <img v-if="formData[field.key]" :src="projectStore.resolveImageUrl(formData[field.key])" class="img-thumb" />
                </div>
                <div v-else-if="field.type === 'toggle'" class="toggle-row">
                  <span>{{ field.label }}</span>
                  <label class="switch">
                    <input v-model="formData[field.key]" type="checkbox" :disabled="projectStore.isBuildError" />
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
      <section class="editor-area" :class="{ 'editor-locked': projectStore.isBuildError }">
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

      <!-- Right Panel: Preview -->
      <PreviewPanel 
        :is-new="isNew"
        :initial-width="400"
      />
    </div>

    <!-- Dummy Image Generator Modal -->
    <div v-if="showDummyModal" class="modal-overlay">
      <div class="modal-content glass">
        <h3>ダミー画像生成</h3>
        <div class="modal-body">
          <div class="field-item">
            <label>サイズ (Width x Height)</label>
            <div class="flex-row">
              <input v-model.number="dummyOptions.width" type="number" placeholder="Width" />
              <span>x</span>
              <input v-model.number="dummyOptions.height" type="number" placeholder="Height" />
            </div>
          </div>
          <div class="field-item">
            <label>背景色 (Hex)</label>
            <input v-model="dummyOptions.bgColor" type="color" style="height: 40px;" />
          </div>
          <div class="field-item">
            <label>テキスト内容</label>
            <input v-model="dummyOptions.text" type="text" placeholder="DUMMY" />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showDummyModal = false" class="btn-secondary">キャンセル</button>
          <button @click="handleGenerateDummy" class="btn-primary" :disabled="saving">生成する</button>
        </div>
      </div>
    </div>

    <!-- Resize Modal -->
    <div v-if="showResizeModal" class="modal-overlay">
      <div class="modal-content glass">
        <h3>画像リサイズ</h3>
        <div class="modal-body">
          <div class="field-item">
            <label>リサイズ後のサイズ (Width x Height)</label>
            <div class="flex-row">
              <input v-model.number="resizeOptions.width" type="number" placeholder="Width" />
              <span>x</span>
              <input v-model.number="resizeOptions.height" type="number" placeholder="Height" />
            </div>
          </div>
          <p class="field-help">縦横比（Aspect Ratio）は「カバー」モードでリサイズされます。</p>
        </div>
        <div class="modal-footer">
          <button @click="showResizeModal = false" class="btn-secondary">キャンセル</button>
          <button @click="executeResize" class="btn-primary" :disabled="saving">リサイズ実行</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, toRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '../stores/project'
import PreviewPanel from '../components/PreviewPanel.vue'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()

const type = computed(() => route.params.type)
const slug = computed(() => route.params.slug)
const isNew = computed(() => !slug.value)

const formData = reactive({})
const fieldErrors = reactive({})
const loading = computed(() => projectStore.isLoading(`content/${type.value}/${slug.value}`))
const saving = ref(false)
const isDirty = ref(false)
const showBuildError = ref(false)
const resolvingCollision = ref(false)

// URLパス衝突エラーの判定
const isPathCollisionError = computed(() => {
  const error = projectStore.previewBuildError
  return error && (error.includes('URLパスの衝突') || error.includes('path collisions'))
})

// 衝突しているスラグを抽出
const collisionSlug = computed(() => {
  const error = projectStore.previewBuildError
  if (!error) return null
  
  const match = error.match(/\/([^\/]+)`/);
  return match ? match[1] : null
})

const sidebarCollapsed = ref(false)
const isResizing = ref(false)

// --- Image Processing Logic ---
const showDummyModal = ref(false)
const showResizeModal = ref(false)
const currentImageField = ref('')

const dummyOptions = reactive({
  width: 800,
  height: 450,
  bgColor: '#2d2d35',
  textColor: '#ffffff',
  text: 'SAMPLE IMAGE'
})

const resizeOptions = reactive({
  width: 800,
  height: 450
})

function openDummyModal(fieldKey) {
  currentImageField.value = fieldKey
  showDummyModal.value = true
}

async function handleGenerateDummy() {
  saving.value = true
  try {
    const result = await window.electronAPI.generateDummyImage({
      ...dummyOptions,
      projectPath: projectStore.projectPath
    })
    
    if (result.success) {
      formData[currentImageField.value] = result.path
      projectStore.notify('ダミー画像を生成しました', 'success')
      showDummyModal.value = false
    } else {
      projectStore.notify('生成に失敗しました: ' + result.error, 'error')
    }
  } catch (error) {
    projectStore.notify('生成エラー: ' + error.message, 'error')
  } finally {
    saving.value = false
  }
}

function handleResizeImage(fieldKey) {
  console.log('[EditView] handleResizeImage trigger - field:', fieldKey)
  const currentPath = formData[fieldKey]
  if (!currentPath) return
  
  currentImageField.value = fieldKey
  showResizeModal.value = true
}

async function executeResize() {
  const fieldKey = currentImageField.value
  const currentPath = formData[fieldKey]
  
  saving.value = true
  try {
    console.log('[EditView] calling resizeImage IPC...')
    const result = await window.electronAPI.resizeImage({
      imagePath: currentPath,
      width: resizeOptions.width,
      height: resizeOptions.height
    })
    console.log('[EditView] resizeImage result:', result)
    
    if (result.success) {
      formData[fieldKey] = result.path
      projectStore.notify('リサイズ完了', 'success')
      showResizeModal.value = false
    } else {
      projectStore.notify('リサイズ失敗: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('[EditView] Resize error:', error)
    projectStore.notify('エラー: ' + error.message, 'error')
  } finally {
    saving.value = false
  }
}

const layoutGridStyle = computed(() => {
  let left = sidebarCollapsed.value ? '40px' : '280px'
  return {
    display: 'grid',
    gridTemplateColumns: `${left} 1fr auto`
  }
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
    try {
      console.log('[EditView] Loading existing content...')
      const result = await projectStore.fetchContent(type.value, slug.value)
      console.log('[EditView] Loaded content:', result)
      
      // reactiveオブジェクトに直接代入
      Object.keys(formData).forEach(key => delete formData[key])
      Object.assign(formData, result)
      
      console.log('[EditView] FormData after load:', formData)
    } catch (error) {
      console.error('[EditView] Failed to load content:', error)
      // エラーメッセージはストアから取得
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

    // 1. 完全一致チェック（同じファイル名が既に存在するか）
    const existsResult = await window.electronAPI.existsContent({ type: type.value, slug: saveSlug })
    if (existsResult.success && existsResult.exists) {
      projectStore.notify('同じファイル名の記事が既に存在します。タイトルまたは日付を変更してください。', 'error')
      isValid = false
    }

    // 2. ZolaスラグコリジョンチェックURL（日付違いでも同じURLになるケースを検出）
    if (isValid) {
      const collisionResult = await window.electronAPI.checkSlugCollision({
        type: type.value,
        slug: saveSlug
      })
      if (collisionResult.success && collisionResult.collision) {
        projectStore.notify(`同じURLスラグの記事が既に存在します（${collisionResult.collidingFile}）。タイトルを変更してください。`, 'error')
        isValid = false
      }
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
  
  try {
    const saveSlug = slug.value || generateSlug()
    console.log('[EditView] Saving content...', { type: type.value, slug: saveSlug })
    console.log('[EditView] FormData to save:', toRaw(formData))
    
    // スラグ衝突チェック
    if (!isNew.value) {
      const collisionCheck = await projectStore.checkSlugCollision(type.value, saveSlug, slug.value)
      if (collisionCheck.collision) {
        projectStore.notify(`URLスラグ「${saveSlug}」が既存のファイルと衝突しています`, 'error')
        saving.value = false
        return false
      }
    }
    
    await projectStore.updateContent(type.value, saveSlug, toRaw(formData))
    
    // 成功時の処理
    isDirty.value = false
    
    // 新規作成時はルーティングを更新
    if (isNew.value) {
      router.push(`/edit/${type.value}/${saveSlug}`)
    }
    
    // 一覧データもリフレッシュ（他の画面の整合性を確保）
    try {
      await projectStore.refreshContents(type.value)
    } catch (error) {
      console.warn('[EditView] Failed to refresh contents list:', error)
    }
    
    return true
  } catch (error) {
    console.error('[EditView] Save error:', error)
    // エラーメッセージはストアから取得
    return false
  } finally {
    saving.value = false
  }
}

function generateSlug() {
  const title = formData.title || 'untitled'
  const date = formData.date || new Date().toISOString().split('T')[0]
  
  // カスタムスラグが指定されている場合はそれを優先
  if (formData.slug && formData.slug.trim()) {
    return formData.slug
  }
  
  // URL安全なスラグを生成（スペースと特殊文字を除去）
  const safeSlug = title.toLowerCase()
    .replace(/\s+/g, '-') // スペースをハイフンに
    .replace(/[^a-z0-9-]/g, '') // 英数字以外を除去
    .replace(/-+/g, '-') // 連続ハイフンを単一化
    .replace(/^-|-$/g, '') // 先頭・末尾のハイフンを除去
  
  return `${date}-${safeSlug}`
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

async function handleRebuildPreview() {
  showBuildError.value = false
  await projectStore.rebuildPreview()
}

async function handleAutoResolveCollision() {
  if (!collisionSlug.value) {
    projectStore.notify('衝突しているスラグを特定できません', 'error')
    return
  }
  
  resolvingCollision.value = true
  try {
    const result = await projectStore.resolveSlugCollision(type.value, collisionSlug.value)
    
    if (result.success) {
      showBuildError.value = false
      projectStore.notify(`重複スラグ「${collisionSlug.value}」を解決しました`, 'success')
      
      // 現在の編集中のスラグが変更された場合、リロード
      if (slug.value === collisionSlug.value && result.details && result.details.length > 0) {
        // スラグが変更されたファイルを探す
        const changedItem = result.details.find(item => item.oldSlug === collisionSlug.value)
        if (changedItem) {
          router.push(`/edit/${type.value}/${changedItem.newSlug}`)
        }
      } else {
        // コンテンツを再読み込み
        await loadContent()
      }
    }
  } catch (error) {
    console.error('Collision resolution failed:', error)
    projectStore.notify('重複解決に失敗しました: ' + error.message, 'error')
  } finally {
    resolvingCollision.value = false
  }
}

async function handleImageUpload(key) {
  console.log('[EditView] handleImageUpload trigger - field:', key)
  try {
    const filePath = await window.electronAPI.selectImageFile()
    console.log('[EditView] selectImageFile result:', filePath)
    if (!filePath) return

    const result = await window.electronAPI.uploadImage(filePath)
    console.log('[EditView] uploadImage result:', result)

    if (result.success) {
      formData[key] = result.path
      projectStore.notify('画像をアップロードしました', 'success')
    } else {
      projectStore.notify('アップロードに失敗しました: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('[EditView] Upload error:', error)
    projectStore.notify('アップロードに失敗しました', 'error')
  }
}

async function handleDelete() {
  const title = formData.title || slug.value
  if (!confirm(`「${title}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
    return
  }

  try {
    await projectStore.deleteContent(type.value, slug.value)
    
    // 成功時は一覧画面に遷移
    router.push(`/contents/${type.value}`)
    
    // 一覧データもリフレッシュ（他の画面の整合性を確保）
    try {
      await projectStore.refreshContents(type.value)
    } catch (error) {
      console.warn('[EditView] Failed to refresh contents list after delete:', error)
    }
  } catch (error) {
    console.error('Delete error:', error)
    // エラーメッセージはストアから取得
  }
}

onMounted(async () => {
  await loadContent()
})
</script>

<style scoped>
.edit-view {
  height: calc(100vh - 126px);
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
  color: #ff6b6b;
}

.btn-toggle-error {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: rgba(255, 255, 255, 0.8);
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.3s ease;
  margin-left: auto;
}

.btn-toggle-error:hover {
  background: rgba(255, 107, 107, 0.1);
  color: #ff6b6b;
}

.build-error-details {
  margin-top: 1rem;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 8px;
  padding: 1rem;
}

.build-error-details h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.85rem;
  color: #ff6b6b;
  font-weight: 700;
}

.build-error-details p {
  margin: 0 0 1rem 0;
  font-size: 0.8rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-word;
}

/* URLパス衝突の解決策スタイル */
.collision-solution {
  margin-top: 1rem;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 8px;
  padding: 1rem;
}

.collision-solution h5 {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  color: #ff6b6b;
  font-weight: 700;
}

.collision-solution p {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.8);
}

.solution-options {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.solution-options h6 {
  margin: 0 0 0.25rem 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
}

.solution-options p {
  margin: 0 0 0.25rem 0 5 0;
  padding-left: 1.25rem;
  font-size: 0.7rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.6);
}

.error-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.collision-actions {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(240, 173, 78, 0.1);
  border-radius: 4px;
  border-left: 3px solid var(--color-warning);
}

.collision-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: var(--color-warning);
}

.icon-warning {
  font-style: normal;
  font-size: 1.2rem;
}

.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.75rem;
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

/* --- Modals --- */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  width: 100%;
  max-width: 450px;
  padding: 2rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  background: var(--color-charcoal-main);
}

.modal-content h3 {
  margin-top: 0;
  margin-bottom: 2rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-main);
  text-align: center;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.flex-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.flex-row input {
  flex: 1;
}

.img-input-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.img-input-row input {
  flex: 1;
}

.btn-sm {
  padding: 0.35rem 0.6rem;
  font-size: 0.75rem;
}
</style>
