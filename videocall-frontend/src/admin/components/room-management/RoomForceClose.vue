<template>
  <div class="room-force-close">
    <div class="force-close-header">
      <h2>Принудительное закрытие комнаты</h2>
      <div class="room-info-card">
        <div class="room-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
          </svg>
        </div>
        <div class="room-details">
          <h3>{{ room.name || 'Без названия' }}</h3>
          <div class="room-meta">
            <span class="room-id">ID: {{ room.room_id }}</span>
            <span class="room-status" :class="room.status">
              {{ getStatusLabel(room.status) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="force-close-content">
      <div class="warning-section">
        <div class="warning-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="warning-text">
          <h3>Внимание!</h3>
          <p>Принудительное закрытие комнаты приведет к следующим последствиям:</p>
          <ul>
            <li>Все активные участники будут отключены от комнаты</li>
            <li>Текущий видеозвонок будет прерван</li>
            <li>Комната будет помечена как закрытая</li>
            <li>Пользователи не смогут присоединиться к комнате</li>
            <li>Данные о комнате будут сохранены в истории</li>
          </ul>
        </div>
      </div>

      <!-- Current Participants -->
      <div v-if="room.participants > 0" class="participants-section">
        <h3>Активные участники ({{ room.participants }})</h3>
        <div class="participants-list">
          <div
            v-for="participant in activeParticipants"
            :key="participant.id"
            class="participant-item"
          >
            <div class="participant-avatar">
              <img
                v-if="participant.avatar"
                :src="participant.avatar"
                :alt="participant.username"
              />
              <div v-else class="avatar-placeholder">
                {{ participant.username.charAt(0).toUpperCase() }}
              </div>
            </div>
            <div class="participant-info">
              <div class="participant-name">{{ participant.username }}</div>
              <div class="participant-status">{{ getConnectionLabel(participant.connection) }}</div>
            </div>
          </div>
        </div>
        <div class="participants-warning">
          <strong>Важно:</strong> Убедитесь, что принудительное закрытие оправдано.
          Пользователи могут потерять несохраненные данные.
        </div>
      </div>

      <!-- Reason for closing -->
      <div class="reason-section">
        <h3>Причина закрытия</h3>
        <div class="reason-options">
          <label v-for="reason in closeReasons" :key="reason.value" class="reason-option">
            <input
              type="radio"
              :value="reason.value"
              v-model="selectedReason"
              name="close-reason"
            />
            <div class="reason-content">
              <div class="reason-title">{{ reason.title }}</div>
              <div class="reason-description">{{ reason.description }}</div>
            </div>
          </label>
        </div>

        <div v-if="selectedReason === 'other'" class="custom-reason">
          <label for="custom-reason-input">Укажите причину:</label>
          <textarea
            id="custom-reason-input"
            v-model="customReason"
            placeholder="Опишите причину принудительного закрытия комнаты..."
            class="form-textarea"
            rows="3"
          ></textarea>
        </div>
      </div>

      <!-- Notification options -->
      <div class="notification-section">
        <h3>Уведомления</h3>
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="notifyParticipants"
            />
            <div class="checkbox-content">
              <div class="checkbox-title">Уведомить участников</div>
              <div class="checkbox-description">Отправить уведомление всем активным участникам о предстоящем закрытии</div>
            </div>
          </label>

          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="sendReport"
            />
            <div class="checkbox-content">
              <div class="checkbox-title">Отправить отчет администратору</div>
              <div class="checkbox-description">Создать отчет о принудительном закрытии для администраторов</div>
            </div>
          </label>
        </div>
      </div>

      <!-- Confirmation -->
      <div class="confirmation-section">
        <div class="confirmation-text">
          <p>Я подтверждаю, что принудительное закрытие комнаты оправдано и понимаю последствия этого действия.</p>
        </div>
        <label class="confirmation-checkbox">
          <input
            type="checkbox"
            v-model="confirmed"
          />
          Подтвердить принудительное закрытие
        </label>
      </div>

      <!-- Action buttons -->
      <div class="action-buttons">
        <button
          class="btn btn-secondary"
          @click="$emit('cancel')"
          :disabled="loading"
        >
          Отмена
        </button>
        <button
          class="btn btn-danger"
          @click="forceCloseRoom"
          :disabled="!canForceClose || loading"
        >
          <LoadingSpinner v-if="loading" size="small" text="Закрытие..." />
          <span v-else>
            <svg fill="currentColor" viewBox="0 0 20 20" class="btn-icon">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
            Принудительно закрыть
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineProps, defineEmits } from 'vue'
import LoadingSpinner from '../ui/LoadingSpinner.vue'

defineProps({
  room: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['force-close', 'cancel'])

// Form data
const selectedReason = ref('')
const customReason = ref('')
const notifyParticipants = ref(true)
const sendReport = ref(true)
const confirmed = ref(false)

// Reasons for closing
const closeReasons = ref([
  {
    value: 'maintenance',
    title: 'Техническое обслуживание',
    description: 'Комната закрывается для проведения технических работ'
  },
  {
    value: 'policy_violation',
    title: 'Нарушение правил',
    description: 'В комнате зафиксировано нарушение правил использования'
  },
  {
    value: 'security',
    title: 'Безопасность',
    description: 'Обнаружена подозрительная активность или угроза безопасности'
  },
  {
    value: 'abuse',
    title: 'Жалобы пользователей',
    description: 'Множественные жалобы на поведение участников комнаты'
  },
  {
    value: 'other',
    title: 'Другая причина',
    description: 'Укажите причину в поле ниже'
  }
])

// Mock active participants
const activeParticipants = ref([
  {
    id: 1,
    username: 'user1',
    connection: 'connected',
    avatar: 'https://i.pravatar.cc/32?u=user1'
  },
  {
    id: 2,
    username: 'user2',
    connection: 'connected',
    avatar: null
  }
])

// Computed
const canForceClose = computed(() => {
  return confirmed.value && (selectedReason.value || customReason.value)
})

// Methods
const forceCloseRoom = async () => {
  if (!canForceClose.value) return

  const closeData = {
    reason: selectedReason.value,
    customReason: selectedReason.value === 'other' ? customReason.value : '',
    notifyParticipants: notifyParticipants.value,
    sendReport: sendReport.value
  }

  emit('force-close', closeData)
}

const getStatusLabel = (status) => {
  const labels = {
    active: 'Активная',
    inactive: 'Неактивная',
    error: 'Ошибка'
  }
  return labels[status] || status
}

const getConnectionLabel = (connection) => {
  const labels = {
    connected: 'Подключен',
    connecting: 'Подключение',
    disconnected: 'Отключен'
  }
  return labels[connection] || connection
}
</script>

<style scoped>
.room-force-close {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  max-width: 600px;
  margin: 0 auto;
}

.force-close-header {
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.force-close-header h2 {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.room-info-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.room-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  flex-shrink: 0;
}

.room-details h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.room-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.room-id {
  font-size: 14px;
  color: #6b7280;
  font-family: monospace;
}

.room-status {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.room-status.active {
  background: #dcfce7;
  color: #16a34a;
}

.force-close-content {
  padding: 24px;
}

.warning-section {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  margin-bottom: 24px;
}

.warning-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: #d97706;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.warning-icon svg {
  width: 24px;
  height: 24px;
}

.warning-text h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #92400e;
}

.warning-text p {
  margin: 0 0 12px;
  color: #92400e;
  line-height: 1.5;
}

.warning-text ul {
  margin: 0;
  padding-left: 20px;
  color: #92400e;
}

.warning-text li {
  margin-bottom: 4px;
}

.participants-section {
  margin-bottom: 24px;
}

.participants-section h3 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.participants-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.participant-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.participant-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: #e5e7eb;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.participant-name {
  font-weight: 500;
  color: #1f2937;
}

.participant-status {
  font-size: 12px;
  color: #6b7280;
}

.participants-warning {
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  font-size: 14px;
  color: #dc2626;
}

.reason-section,
.notification-section {
  margin-bottom: 24px;
}

.reason-section h3,
.notification-section h3 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.reason-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reason-option {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.reason-option:hover {
  border-color: #d1d5db;
  background: #f9fafb;
}

.reason-option input[type="radio"] {
  margin: 0;
  accent-color: #2563eb;
}

.reason-content {
  flex: 1;
}

.reason-title {
  font-weight: 500;
  color: #374151;
  margin-bottom: 4px;
}

.reason-description {
  font-size: 14px;
  color: #6b7280;
}

.custom-reason {
  margin-top: 12px;
}

.custom-reason label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  min-height: 80px;
}

.form-textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checkbox-label {
  display: flex;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  margin: 0;
  accent-color: #2563eb;
}

.checkbox-content {
  flex: 1;
}

.checkbox-title {
  font-weight: 500;
  color: #374151;
  margin-bottom: 2px;
}

.checkbox-description {
  font-size: 14px;
  color: #6b7280;
}

.confirmation-section {
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 24px;
}

.confirmation-text p {
  margin: 0 0 12px;
  color: #6b7280;
  line-height: 1.5;
}

.confirmation-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
}

.confirmation-checkbox input[type="checkbox"] {
  accent-color: #2563eb;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-secondary {
  background: #f9fafb;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #f3f4f6;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-icon {
  width: 16px;
  height: 16px;
}
</style>
