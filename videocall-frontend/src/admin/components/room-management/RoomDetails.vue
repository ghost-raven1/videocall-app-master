<template>
  <div class="room-details">
    <div class="details-header">
      <div class="room-info">
        <div class="room-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
          </svg>
        </div>
        <div class="room-meta">
          <h1>{{ room.name || 'Без названия' }}</h1>
          <div class="room-identifiers">
            <span class="room-id">ID: {{ room.room_id }}</span>
            <span class="room-code">{{ room.short_code }}</span>
            <span :class="['status-badge', room.status]">
              {{ getStatusLabel(room.status) }}
            </span>
          </div>
        </div>
      </div>

      <div class="header-actions">
        <button class="btn btn-secondary" @click="$emit('edit')">
          <svg fill="currentColor" viewBox="0 0 20 20" class="btn-icon">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
          </svg>
          Редактировать
        </button>
        <button
          v-if="room.status === 'active'"
          class="btn btn-warning"
          @click="$emit('force-close')"
        >
          <svg fill="currentColor" viewBox="0 0 20 20" class="btn-icon">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          Закрыть
        </button>
        <button class="btn btn-primary" @click="$emit('close')">
          Закрыть
        </button>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="quick-stats">
      <div class="stat-card">
        <div class="stat-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ room.participants || 0 }}</div>
          <div class="stat-label">Участников</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ formatDuration(room.duration || 0) }}</div>
          <div class="stat-label">Длительность</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ formatDate(room.created_at) }}</div>
          <div class="stat-label">Создана</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ formatDate(room.last_activity) }}</div>
          <div class="stat-label">Последняя активность</div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="details-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-button', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'" class="tab-section">
        <div class="info-grid">
          <div class="info-card">
            <h3>Основная информация</h3>
            <div class="info-list">
              <div class="info-item">
                <label>Название:</label>
                <span>{{ room.name || 'Без названия' }}</span>
              </div>
              <div class="info-item">
                <label>ID комнаты:</label>
                <span class="mono">{{ room.room_id }}</span>
              </div>
              <div class="info-item">
                <label>Короткий код:</label>
                <span class="mono">{{ room.short_code }}</span>
              </div>
              <div class="info-item">
                <label>Тип:</label>
                <span>{{ getTypeLabel(room.type) }}</span>
              </div>
              <div class="info-item">
                <label>Статус:</label>
                <span :class="['status-badge', room.status]">
                  {{ getStatusLabel(room.status) }}
                </span>
              </div>
              <div class="info-item">
                <label>Максимум участников:</label>
                <span>{{ room.max_participants || 'Не ограничено' }}</span>
              </div>
            </div>
          </div>

          <div class="info-card">
            <h3>Техническая информация</h3>
            <div class="info-list">
              <div class="info-item">
                <label>SFU сервер:</label>
                <span>{{ room.sfu_server || 'Автоматически' }}</span>
              </div>
              <div class="info-item">
                <label>Качество видео:</label>
                <span>{{ room.video_quality || 'HD' }}</span>
              </div>
              <div class="info-item">
                <label>Разрешение экрана:</label>
                <span>{{ room.screen_sharing || 'Отключено' }}</span>
              </div>
              <div class="info-item">
                <label>Запись:</label>
                <span :class="{ enabled: room.recording }">
                  {{ room.recording ? 'Включена' : 'Отключена' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Participants Tab -->
      <div v-if="activeTab === 'participants'" class="tab-section">
        <div class="section-header">
          <h3>Участники ({{ room.participants || 0 }})</h3>
          <button class="btn btn-secondary btn-sm" @click="loadParticipants">
            Обновить
          </button>
        </div>

        <div v-if="loading.participants" class="loading-container">
          <LoadingSpinner text="Загрузка участников..." />
        </div>

        <div v-else-if="participants.length > 0" class="participants-list">
          <div
            v-for="participant in participants"
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
              <div class="participant-role">{{ getRoleLabel(participant.role) }}</div>
            </div>
            <div class="participant-status">
              <span :class="['connection-badge', participant.connection]">
                {{ getConnectionLabel(participant.connection) }}
              </span>
            </div>
            <div class="participant-join-time">
              {{ formatDateTime(participant.join_time) }}
            </div>
            <div class="participant-actions">
              <button
                class="btn btn-sm btn-secondary"
                @click="muteParticipant(participant)"
                :title="participant.muted ? 'Включить микрофон' : 'Отключить микрофон'"
              >
                <svg v-if="participant.muted" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.29 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.29l4.093-3.816a1 1 0 011.617.816zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
                <svg v-else fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.29 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.29l4.093-3.816a1 1 0 011.617.816zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
              </button>
              <button
                class="btn btn-sm btn-danger"
                @click="kickParticipant(participant)"
                title="Отключить от комнаты"
              >
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clip-rule="evenodd"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <svg fill="currentColor" viewBox="0 0 20 20" class="empty-icon">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
          </svg>
          <h4>Нет активных участников</h4>
          <p>Комната пуста</p>
        </div>
      </div>

      <!-- Activity Tab -->
      <div v-if="activeTab === 'activity'" class="tab-section">
        <div class="section-header">
          <h3>История активности</h3>
          <div class="section-actions">
            <select v-model="activityPeriod" @change="loadActivity" class="period-select">
              <option value="1h">Последний час</option>
              <option value="24h">Последние 24 часа</option>
              <option value="7d">Последние 7 дней</option>
            </select>
          </div>
        </div>

        <div v-if="loading.activity" class="loading-container">
          <LoadingSpinner text="Загрузка активности..." />
        </div>

        <div v-else-if="activity.length > 0" class="activity-timeline">
          <div
            v-for="item in activity"
            :key="item.id"
            class="activity-item"
          >
            <div class="activity-time">
              {{ formatDateTime(item.timestamp) }}
            </div>
            <div class="activity-content">
              <div class="activity-icon">
                <svg v-if="item.type === 'user_joined'" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <svg v-else-if="item.type === 'user_left'" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                <svg v-else fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                </svg>
              </div>
              <div class="activity-text">
                <div class="activity-title">{{ getActivityTitle(item) }}</div>
                <div class="activity-details">{{ item.details }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <svg fill="currentColor" viewBox="0 0 20 20" class="empty-icon">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
          </svg>
          <h4>Нет активности</h4>
          <p>За выбранный период активность отсутствует</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineProps, onMounted } from 'vue'
import LoadingSpinner from '../ui/LoadingSpinner.vue'

const props = defineProps({
  room: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['edit', 'force-close', 'close'])

// Tab management
const activeTab = ref('overview')
const tabs = ref([
  { key: 'overview', label: 'Обзор' },
  { key: 'participants', label: 'Участники' },
  { key: 'activity', label: 'Активность' }
])

// Loading states
const loading = ref({
  participants: false,
  activity: false
})

// Data
const participants = ref([])
const activity = ref([])
const activityPeriod = ref('24h')

// Computed
const activeParticipants = computed(() => {
  return participants.value.filter(p => p.connection === 'connected')
})

// Methods
const loadParticipants = async () => {
  loading.value.participants = true
  try {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    participants.value = Array.from({ length: props.room.participants || 0 }, (_, i) => ({
      id: i + 1,
      username: `participant${i + 1}`,
      role: ['user', 'moderator'][Math.floor(Math.random() * 2)],
      connection: ['connected', 'connecting', 'disconnected'][Math.floor(Math.random() * 3)],
      join_time: new Date(Date.now() - Math.random() * 3600000),
      muted: Math.random() > 0.7,
      avatar: `https://i.pravatar.cc/32?u=${props.room.id}_${i}`
    }))
  } catch (error) {
    console.error('Failed to load participants:', error)
  } finally {
    loading.value.participants = false
  }
}

const loadActivity = async () => {
  loading.value.activity = true
  try {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 800))

    const activityTypes = [
      { type: 'user_joined', title: 'Пользователь присоединился', details: 'К комнате присоединился новый участник' },
      { type: 'user_left', title: 'Пользователь покинул', details: 'Участник покинул комнату' },
      { type: 'room_created', title: 'Комната создана', details: 'Комната была создана' },
      { type: 'settings_changed', title: 'Настройки изменены', details: 'Были изменены настройки комнаты' }
    ]

    activity.value = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      type: activityTypes[Math.floor(Math.random() * activityTypes.length)].type,
      title: activityTypes[Math.floor(Math.random() * activityTypes.length)].title,
      details: activityTypes[Math.floor(Math.random() * activityTypes.length)].details,
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000)
    }))
  } catch (error) {
    console.error('Failed to load activity:', error)
  } finally {
    loading.value.activity = false
  }
}

const muteParticipant = (participant) => {
  participant.muted = !participant.muted
  // In real app, this would send a signal to mute/unmute the participant
}

const kickParticipant = (participant) => {
  // In real app, this would kick the participant from the room
  const index = participants.value.findIndex(p => p.id === participant.id)
  if (index > -1) {
    participants.value.splice(index, 1)
  }
}

const getStatusLabel = (status) => {
  const labels = {
    active: 'Активная',
    inactive: 'Неактивная',
    error: 'Ошибка'
  }
  return labels[status] || status
}

const getTypeLabel = (type) => {
  const labels = {
    public: 'Публичная',
    private: 'Приватная'
  }
  return labels[type] || type
}

const getRoleLabel = (role) => {
  const labels = {
    user: 'Участник',
    moderator: 'Модератор',
    admin: 'Администратор'
  }
  return labels[role] || role
}

const getConnectionLabel = (connection) => {
  const labels = {
    connected: 'Подключен',
    connecting: 'Подключение',
    disconnected: 'Отключен'
  }
  return labels[connection] || connection
}

const getActivityTitle = (item) => {
  return item.title || 'Неизвестная активность'
}

const formatDate = (date) => {
  if (!date) return 'Никогда'
  return new Date(date).toLocaleDateString('ru-RU')
}

const formatDateTime = (date) => {
  if (!date) return 'Никогда'
  return new Date(date).toLocaleString('ru-RU')
}

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}ч ${minutes}м`
  }
  return `${minutes}м`
}

// Initialize
onMounted(() => {
  loadParticipants()
  loadActivity()
})
</script>

<style scoped>
.room-details {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
  gap: 24px;
}

.room-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.room-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  flex-shrink: 0;
}

.room-meta h1 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
}

.room-identifiers {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.room-id,
.room-code {
  font-size: 14px;
  color: #6b7280;
  font-family: monospace;
}

.quick-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb;
  color: #6b7280;
  flex-shrink: 0;
}

.stat-number {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
}

.details-tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
}

.tab-button {
  padding: 12px 16px;
  border: none;
  background: none;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-button:hover {
  color: #374151;
  background: #f9fafb;
}

.tab-button.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
  background: #f9fafb;
}

.tab-content {
  padding: 24px;
}

.tab-section {
  min-height: 300px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.info-card {
  background: #f9fafb;
  padding: 20px;
  border-radius: 8px;
}

.info-card h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item label {
  font-weight: 500;
  color: #6b7280;
}

.info-item span {
  color: #374151;
}

.mono {
  font-family: monospace;
  font-size: 13px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.active {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge.inactive {
  background: #f3f4f6;
  color: #6b7280;
}

.status-badge.error {
  background: #fef2f2;
  color: #dc2626;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.period-select {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
}

.participants-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.participant-item {
  display: grid;
  grid-template-columns: auto 1fr auto auto auto;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.participant-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
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

.participant-role {
  font-size: 12px;
  color: #6b7280;
}

.connection-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.connection-badge.connected {
  background: #dcfce7;
  color: #16a34a;
}

.connection-badge.connecting {
  background: #fef3c7;
  color: #d97706;
}

.connection-badge.disconnected {
  background: #fef2f2;
  color: #dc2626;
}

.participant-join-time {
  font-size: 12px;
  color: #6b7280;
}

.participant-actions {
  display: flex;
  gap: 4px;
}

.activity-timeline {
  position: relative;
  padding-left: 40px;
}

.activity-timeline::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e5e7eb;
}

.activity-item {
  position: relative;
  margin-bottom: 20px;
}

.activity-item::before {
  content: '';
  position: absolute;
  left: -32px;
  top: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2563eb;
}

.activity-time {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}

.activity-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #f9fafb;
  padding: 12px 16px;
  border-radius: 8px;
}

.activity-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  flex-shrink: 0;
}

.activity-title {
  font-weight: 500;
  color: #374151;
  margin-bottom: 4px;
}

.activity-details {
  font-size: 14px;
  color: #6b7280;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.empty-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  opacity: 0.5;
}

.empty-state h4 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #374151;
}

.empty-state p {
  margin: 0;
}

.loading-container {
  padding: 60px;
  text-align: center;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn:disabled {
  opacity: 0.5;
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

.btn-warning {
  background: #d97706;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #b45309;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-sm {
  padding: 6px 8px;
  font-size: 12px;
}

.btn-icon {
  width: 16px;
  height: 16px;
}
</style>