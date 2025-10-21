<template>
  <div :class="['error-message', type, { dismissible }]" v-if="show">
    <div class="error-content">
      <div class="error-icon">
        <svg v-if="type === 'error'" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <svg v-else-if="type === 'warning'" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        <svg v-else fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
      </div>
      <div class="error-text">
        <div class="error-title">{{ title }}</div>
        <div class="error-description">{{ message }}</div>
        <div v-if="details" class="error-details">{{ details }}</div>
      </div>
    </div>

    <div class="error-actions">
      <button
        v-if="retryable && showRetry"
        @click="$emit('retry')"
        class="error-retry-btn"
        :disabled="retrying"
      >
        {{ retrying ? 'Повтор...' : 'Повторить' }}
      </button>
      <button v-if="dismissible" class="error-dismiss" @click="$emit('dismiss')">
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

defineProps({
  show: {
    type: Boolean,
    default: true
  },
  title: {
    type: String,
    required: true
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
    default: 'error', // error, warning, success
    validator: (value) => ['error', 'warning', 'success'].includes(value)
  },
  dismissible: {
    type: Boolean,
    default: false
  },
  retryable: {
    type: Boolean,
    default: false
  },
  showRetry: {
    type: Boolean,
    default: true
  },
  retrying: {
    type: Boolean,
    default: false
  }
})

defineEmits(['dismiss', 'retry'])
</script>

<style scoped>
.error-message {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.4;
  position: relative;
}

.error-message.error {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.error-message.warning {
  background-color: #fffbeb;
  border: 1px solid #fed7aa;
  color: #d97706;
}

.error-message.success {
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #16a34a;
}

.error-content {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: 1;
}

.error-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.error-text {
  flex: 1;
}

.error-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.error-description {
  font-weight: 400;
}

.error-details {
  font-size: 12px;
  margin-top: 6px;
  opacity: 0.8;
  font-family: monospace;
}

.error-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.error-retry-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: inherit;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.error-retry-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.error-retry-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-dismiss {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.error-dismiss:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.05);
}

.error-message.error .error-dismiss:hover {
  background-color: rgba(220, 38, 38, 0.1);
}

.error-message.warning .error-dismiss:hover {
  background-color: rgba(217, 119, 6, 0.1);
}

.error-message.success .error-dismiss:hover {
  background-color: rgba(22, 163, 74, 0.1);
}

/* Dark mode support */
.dark .error-message.error {
  background-color: rgba(220, 38, 38, 0.1);
  border-color: rgba(220, 38, 38, 0.3);
  color: #fca5a5;
}

.dark .error-message.warning {
  background-color: rgba(217, 119, 6, 0.1);
  border-color: rgba(217, 119, 6, 0.3);
  color: #fbbf24;
}

.dark .error-message.success {
  background-color: rgba(22, 163, 74, 0.1);
  border-color: rgba(22, 163, 74, 0.3);
  color: #86efac;
}
</style>