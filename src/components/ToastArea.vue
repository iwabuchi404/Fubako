<template>
  <div class="toast-area">
    <Toast
      v-for="note in notifications"
      :key="note.id"
      :message="note.message"
      :type="note.type"
      :duration="note.duration || 3000"
      @dismiss="removeToast(note.id)"
    />
  </div>
</template>

<script setup>
import { useProjectStore } from '../stores/project'
import Toast from './Toast.vue'

const projectStore = useProjectStore()

const notifications = computed(() => projectStore.notifications)

function removeToast(id) {
  projectStore.notifications = projectStore.notifications.filter(n => n.id !== id)
}
</script>

<script>
import { computed } from 'vue'
export default {
  name: 'ToastArea'
}
</script>

<style scoped>
.toast-area {
  position: fixed;
  bottom: calc(2rem + 60px); /* PreviewStatusバーの分を考慮 */
  right: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  z-index: 1000;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.toast-area::-webkit-scrollbar {
  width: 6px;
}

.toast-area::-webkit-scrollbar-track {
  background: transparent;
}

.toast-area::-webkit-scrollbar-thumb {
  background: var(--color-charcoal-muted);
  border-radius: 3px;
}

.toast-area::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-dim);
}
</style>
