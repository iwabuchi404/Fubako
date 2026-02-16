<template>
  <section 
    class="preview-panel glass" 
    :class="{ 'collapsed': collapsed }"
    :style="{ width: panelWidth + 'px' }"
  >
    <div class="preview-header">
      <div class="header-actions-left">
        <button @click="toggleCollapse" class="btn-icon-sm" :title="'プレビューを隠す'">
           ▶
        </button>
        <div class="device-selectors">
          <button @click="previewMode = 'desktop'" :class="{active: previewMode === 'desktop'}">DESKTOP</button>
          <button @click="previewMode = 'mobile'" :class="{active: previewMode === 'mobile'}">MOBILE</button>
        </div>
        <button @click="openInBrowser" class="btn-link">OPEN BROWSER ↗</button>
      </div>
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
        :style="{ pointerEvents: isDragging ? 'none' : 'auto' }"
      />

      <div v-else class="preview-state">
        <p>LOADING PREVIEW...</p>
      </div>
    </div>
    
    <!-- Sidebar Restore Trigger -->
    <div v-if="collapsed" class="collapsed-bar left" @click="collapsed = false" title="レビューを表示">
      <span>PREVIEW ◀</span>
    </div>

    <!-- Resize Handle -->
    <div 
      v-if="!collapsed"
      class="resize-handle" 
      @mousedown="startResize"
      @touchstart="startResize"
      title="ドラッグで幅を調整"
    ></div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useProjectStore } from '../stores/project'

const props = defineProps({
  isNew: {
    type: Boolean,
    default: false
  }
})

const projectStore = useProjectStore()

const previewUrl = ref(null)
const previewMode = ref('desktop')
const collapsed = ref(false)
const panelWidth = ref(400)

// リサイズ機能
const isDragging = ref(false)
const startX = ref(0)
const startWidth = ref(0)

// プレビューURLを設定
function updatePreviewUrl() {
  if (projectStore.previewRunning && projectStore.zolaUrl) {
    previewUrl.value = projectStore.zolaUrl
  } else {
    previewUrl.value = null
  }
}

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

async function openInBrowser() {
  if (previewUrl.value) {
    await window.electronAPI.openInBrowser(previewUrl.value)
  }
}


// マウスイベントハンドラー
function handleGlobalMouseMove(event) {
  if (!isDragging.value) return
  
  const deltaX = event.clientX - startX.value
  const newWidth = startWidth.value - deltaX
  
  // 制限（300px〜800px）
  if (newWidth >= 300 ) {
    panelWidth.value = newWidth
  }
}

function handleGlobalMouseUp() {
  if (isDragging.value) {
    isDragging.value = false
  }

}

function startResize(event) {
  // 左ボタンのみでドラッグ開始
  if (event.button !== 0) return
  
  isDragging.value = true
  startX.value = event.clientX
  startWidth.value = panelWidth.value
  
  event.preventDefault()
  event.stopPropagation()
}

function setMouseEventListener (){
  // グローバルイベントリスナー（コンポーネント外でも動作） 
  document.addEventListener('mousemove', handleGlobalMouseMove)
  document.addEventListener('mouseup', handleGlobalMouseUp)
}

function removeMouseEventListener () {
  document.removeEventListener('mousemove', handleGlobalMouseMove)
  document.removeEventListener('mouseup', handleGlobalMouseUp)
}

// グローバルイベント監視
onMounted(() => {
  updatePreviewUrl()
  setMouseEventListener()

})

onUnmounted(() => {
  removeMouseEventListener()
})
</script>

<style scoped>
.preview-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  border-left: 1px solid var(--glass-border);
}

.preview-panel.collapsed {
  width: 40px !important;
}

.preview-panel.collapsed .preview-header,
.preview-panel.collapsed .preview-body {
  display: none;
}

.preview-panel.collapsed .resize-handle {
  width: 40px;
  height: 100%;
  left: 0;
  cursor: e-resize;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.02);
}

.header-actions-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.device-selectors {
  display: flex;
  gap: 0.25rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 0.25rem;
}

.device-selectors button {
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  padding: 0.4rem 0.6rem;
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.2s;
}

.device-selectors button.active {
  background: var(--color-primary);
  color: #000;
}

.btn-icon-sm {
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  cursor: pointer;
  padding: 0.4rem 0.5rem;
  border-radius: 4px;
  transition: all 0.2s;
  font-size: 0.8rem;
}

.btn-icon-sm:hover {
  color: var(--color-text-main);
  background: rgba(255, 255, 255, 0.1);
}

.btn-link {
  background: transparent;
  border: none;
  color: var(--color-primary);
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-link:hover {
  background: rgba(0, 242, 255, 0.1);
}

.preview-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #000;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
}

.preview-body.desktop {
  width: 100%;
}

.preview-body.mobile {
  width: 375px;
  margin: 0 auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.preview-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  color: var(--color-text-dark);
  text-align: center;
  padding: 2rem;
}

.preview-state p {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0;
}

.preview-state .hint {
  font-size: 0.7rem;
  color: var(--color-text-dim);
}

.preview-frame {
  flex: 1;
  width: 100%;
  height: 100%;
  border: none;
  background: #000;
}

.resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  transition: background-color 0.2s;
}

.resize-handle:hover {
  background-color: var(--color-primary);
}

/* --- Collapsed Bars --- */
.collapsed-bar {
  height: 100%;
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

</style>