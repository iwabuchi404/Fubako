<template>
  <div :class="['toast', type]" @click="handleClick">
    <span class="toast-icon">{{ icon }}</span>
    <span class="toast-message">{{ message }}</span>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'info',
    validator: (value) => ['success', 'error', 'info'].includes(value)
  },
  duration: {
    type: Number,
    default: 3000
  },
  onClick: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['dismiss'])

const icon = computed(() => {
  switch (props.type) {
    case 'success':
      return '✓'
    case 'error':
      return '✕'
    default:
      return 'ℹ'
  }
})

let timeout = null

function handleClick() {
  if (props.onClick) {
    props.onClick()
  }
  emit('dismiss')
}

onMounted(() => {
  if (props.duration > 0) {
    timeout = setTimeout(() => {
      emit('dismiss')
    }, props.duration)
  }
})

onUnmounted(() => {
  if (timeout) {
    clearTimeout(timeout)
  }
})
</script>

<style scoped>
.toast {
  padding: 1rem 1.5rem;
  border-radius: var(--radius-md);
  background: var(--color-charcoal-muted);
  color: var(--color-text-main);
  min-width: 300px;
  max-width: 450px;
  box-shadow: var(--shadow-depth);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(10px);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.toast:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.toast.success {
  border-left: 4px solid var(--color-success);
  color: #fff;
}

.toast.error {
  border-left: 4px solid var(--color-error);
  color: #fff;
}

.toast.info {
  border-left: 4px solid var(--color-primary);
  color: #fff;
}

.toast-icon {
  font-size: 1.2rem;
  font-weight: 700;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  line-height: 1.4;
}

@keyframes slideIn {
  from {
    transform: translateX(30px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
