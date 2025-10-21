<template>
  <div v-if="show" class="confirm-dialog-overlay" @click="handleOverlayClick">
    <div class="confirm-dialog" :class="size">
      <div class="dialog-header">
        <h3 class="dialog-title">{{ title }}</h3>
        <button v-if="dismissible" class="dialog-close" @click="$emit('cancel')">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>

      <div class="dialog-body">
        <div class="dialog-icon" v-if="icon">
          <svg v-if="type === 'danger'" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          <svg v-else-if="type === 'warning'" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          <svg v-else-if="type === 'info'" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="dialog-message">{{ message }}</div>
        <div v-if="details" class="dialog-details">{{ details }}</div>
      </div>

      <div class="dialog-footer">
        <button
          v-if="showCancel"
          class="btn btn-secondary"
          @click="$emit('cancel')"
          :disabled="loading"
        >
          {{ cancelText }}
        </button>
        <button
          class="btn"
          :class="confirmButtonClass"
          @click="$emit('confirm')"
          :disabled="loading"
        >
          <LoadingSpinner v-if="loading" size="small" :text="loadingText" />
          <span v-else>{{ confirmText }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'

defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Подтверждение'
  },
  message: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'info', // danger, warning, info
    validator: (value) => ['danger', 'warning', 'info'].includes(value)
  },
  confirmText: {
    type: String,
    default: 'Подтвердить'
  },
  cancelText: {
    type: String,
    default: 'Отмена'
  },
  showCancel: {
    type: Boolean,
    default: true
  },
  dismissible: {
    type: Boolean,
    default: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  loadingText: {
    type: String,
    default: 'Загрузка...'
  },
  size: {
    type: String,
    default: 'medium', // small, medium, large
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  icon: {
    type: Boolean,
    default: true
  }
})

defineEmits(['confirm', 'cancel'])

const handleOverlayClick = (event) => {
  if (event.target === event.currentTarget) {
    event.stopPropagation()
  }
}

const confirmButtonClass = {
  danger: 'btn-danger',
  warning: 'btn-warning',
  info: 'btn-primary'
}
</script>

<style scoped>
.confirm-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.confirm-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.confirm-dialog.small {
  max-width: 400px;
}

.confirm-dialog.large {
  max-width: 600px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
}

.dialog-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.dialog-close {
  background: none;
  border: none;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
}

.dialog-close:hover {
  background-color: #f3f4f6;
  color: #374151;
}

.dialog-body {
  padding: 20px 24px;
  text-align: center;
}

.dialog-icon {
  margin-bottom: 16px;
}

.dialog-icon svg {
  width: 48px;
  height: 48px;
}

.confirm-dialog.danger .dialog-icon svg {
  color: #dc2626;
}

.confirm-dialog.warning .dialog-icon svg {
  color: #d97706;
}

.confirm-dialog.info .dialog-icon svg {
  color: #2563eb;
}

.dialog-message {
  font-size: 16px;
  line-height: 1.5;
  color: #374151;
  margin-bottom: 12px;
}

.dialog-details {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.4;
  font-family: monospace;
  background: #f9fafb;
  padding: 12px;
  border-radius: 6px;
  text-align: left;
}

.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 0 24px 24px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f9fafb;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #f3f4f6;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-warning {
  background: #d97706;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #b45309;
}
</style>