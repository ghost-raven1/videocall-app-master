<template>
  <div class="user-activity">
    <div class="activity-header">
      <h2>Активность пользователя</h2>
      <div class="user-info-card">
        <div class="user-avatar">
          <img
            v-if="user.avatar"
            :src="user.avatar"
            :alt="user.username"
          />
          <div v-else class="avatar-placeholder">
            {{ user.username?.charAt(0).toUpperCase() }}
          </div>
        </div>
        <div class="user-details">
          <h3>{{ user.username }}</h3>
          <p>{{ user.email }}</p>
          <span :class="['status-badge', { online: user.is_online }]">
            {{ user.is_online ? 'Онлайн' : 'Офлайн' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Activity Tabs -->
    <div class="activity-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-button', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
      </button>
    </div>

    <!-- Activity Content -->
    <div class="activity-content">
      <!-- Login History Tab -->
      <div v-if="activeTab === 'logins'" class="activity-section">
        <div class="section-header">
          <h3>История входов</h3>
          <div class="section-actions">
            <select v-model="loginsPeriod" @change="loadLoginHistory" class="period-select">
              <option value="7">Последние 7 дней</option>
              <option value="30">Последние 30 дней</option>
              <option value="90">Последние 90 дней</option>
            </select>
          </div>
        </div>

        <div v-if="loading.logins" class="loading-container">
          <LoadingSpinner text="Загрузка истории входов..." />
        </div>

        <div v-else-if="loginHistory.length > 0" class="activity-timeline">
          <div
            v-for="login in loginHistory"
            :key="login.id"
            class="timeline-item"
          >
            <div class="timeline-marker">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="timeline-content">
              <div class="timeline-time">
                {{ formatDateTime(login.timestamp) }}
              </div>
              <div class="timeline-description">
                Вход в систему
              </div>
              <div class="timeline-details">
                <span class="detail-item">
                  <strong>IP:</strong> {{ login.ip_address }}
                </span>
                <span class="detail-item">
                  <strong>Браузер:</strong> {{ login.user_agent }}
                </span>
                <span class="detail-item">
                  <strong>Устройство:</strong> {{ getDeviceInfo(login.user_agent) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <svg fill="currentColor" viewBox="0 0 20 20" class="empty-icon">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
          </svg>
          <h4>Нет данных о входах</h4>
          <p>История входов пуста</p>
        </div>
      </div>

      <!-- Room Activity Tab -->
      <div v-if="activeTab === 'rooms'" class="activity-section">
        <div class="section-header">
          <h3>Активность в комнатах</h3>
          <div class="section-actions">
            <select v-model="roomsPeriod" @change="loadRoomActivity" class="period-select">
              <option value="7">Последние 7 дней</option>
              <option value="30">Последние 30 дней</option>
              <option value="90">Последние 90 дней</option>
            </select>
          </div>
        </div>

        <div v-if="loading.rooms" class="loading-container">
          <LoadingSpinner text="Загрузка активности в комнатах..." />
        </div>

        <div v-else-if="roomActivity.length > 0" class="activity-list">
          <div
            v-for="activity in roomActivity"
            :key="activity.id"
            class="activity-item"
          >
            <div class="activity-icon">
              <svg v-if="activity.type === 'room_joined'" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
              </svg>
              <svg v-else-if="activity.type === 'room_left'" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clip-rule="evenodd"/>
              </svg>
              <svg v-else fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="activity-content">
              <div class="activity-title">
                {{ getActivityTitle(activity) }}
              </div>
              <div class="activity-subtitle">
                Комната: {{ activity.room_name }} ({{ activity.room_id }})
              </div>
              <div class="activity-time">
                {{ formatDateTime(activity.timestamp) }}
              </div>
              <div v-if="activity.duration" class="activity-details">
                Длительность: {{ formatDuration(activity.duration) }}
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <svg fill="currentColor" viewBox="0 0 20 20" class="empty-icon">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
          </svg>
          <h4>Нет активности в комнатах</h4>
          <p>Пользователь не участвовал в видеозвонках</p>
        </div>
      </div>

      <!-- Statistics Tab -->
      <div v-if="activeTab === 'stats'" class="activity-section">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ userStats.totalRoomsJoined }}</div>
              <div class="stat-label">Комнат посещено</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ formatDuration(userStats.totalTimeInRooms) }}</div>
              <div class="stat-label">Времени в звонках</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ userStats.totalLogins }}</div>
              <div class="stat-label">Всего входов</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ userStats.lastLogin ? formatDateTime(userStats.lastLogin) : 'Никогда' }}</div>
              <div class="stat-label">Последний вход</div>
            </div>
          </div>
        </div>

        <!-- Activity Chart -->
        <div class="activity-chart">
          <h4>Активность по дням</h4>
          <div class="chart-placeholder">
            <div class="chart-bars">
              <div
                v-for="(value, index) in activityChart"
                :key="index"
                class="chart-bar"
                :style="{ height: value + '%' }"
                :title="`День ${index + 1}: ${value}% активности`"
              ></div>
            </div>
            <div class="chart-labels">
              <span v-for="i in 7" :key="i">День {{ i }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineProps, onMounted } from 'vue'
import LoadingSpinner from '../ui/LoadingSpinner.vue'

const props = defineProps({
  user: {
    type: Object,
    required: true
  }
})

// Tab management
const activeTab = ref('logins')
const tabs = ref([
  { key: 'logins', label: 'Входы', badge: null },
  { key: 'rooms', label: 'Комнаты', badge: null },
  { key: 'stats', label: 'Статистика', badge: null }
])

// Loading states
const loading = ref({
  logins: false,
  rooms: false,
  stats: false
})

// Data
const loginHistory = ref([])
const roomActivity = ref([])
const userStats = ref({
  totalLogins: 0,
  totalRoomsJoined: 0,
  totalTimeInRooms: 0,
  lastLogin: null
})

// Filter periods
const loginsPeriod = ref('7')
const roomsPeriod = ref('7')

// Mock activity chart data
const activityChart = ref([65, 45, 78, 32, 89, 54, 67])

// Methods
const loadLoginHistory = async () => {
  loading.value.logins = true
  try {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    loginHistory.value = Array.from({ length: Math.floor(Math.random() * 10) + 5 }, (_, i) => ({
      id: i + 1,
      timestamp: new Date(Date.now() - Math.random() * parseInt(loginsPeriod.value) * 24 * 60 * 60 * 1000),
      ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      device: 'Desktop'
    }))
  } catch (error) {
    console.error('Failed to load login history:', error)
  } finally {
    loading.value.logins = false
  }
}

const loadRoomActivity = async () => {
  loading.value.rooms = true
  try {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 800))

    roomActivity.value = Array.from({ length: Math.floor(Math.random() * 15) + 5 }, (_, i) => ({
      id: i + 1,
      type: ['room_joined', 'room_left', 'room_created'][Math.floor(Math.random() * 3)],
      room_id: `room_${Math.floor(Math.random() * 1000)}`,
      room_name: `Комната ${Math.floor(Math.random() * 100)}`,
      timestamp: new Date(Date.now() - Math.random() * parseInt(roomsPeriod.value) * 24 * 60 * 60 * 1000),
      duration: Math.floor(Math.random() * 3600) + 300 // 5 minutes to 1 hour
    }))
  } catch (error) {
    console.error('Failed to load room activity:', error)
  } finally {
    loading.value.rooms = false
  }
}

const loadUserStats = async () => {
  loading.value.stats = true
  try {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 600))

    userStats.value = {
      totalLogins: Math.floor(Math.random() * 100) + 10,
      totalRoomsJoined: Math.floor(Math.random() * 50) + 5,
      totalTimeInRooms: Math.floor(Math.random() * 100000) + 10000,
      lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    }
  } catch (error) {
    console.error('Failed to load user stats:', error)
  } finally {
    loading.value.stats = false
  }
}

const getActivityTitle = (activity) => {
  const titles = {
    room_joined: 'Вошел в комнату',
    room_left: 'Вышел из комнаты',
    room_created: 'Создал комнату'
  }
  return titles[activity.type] || 'Неизвестная активность'
}

const getDeviceInfo = (userAgent) => {
  if (userAgent.includes('Mobile')) return 'Мобильное устройство'
  if (userAgent.includes('Tablet')) return 'Планшет'
  return 'Компьютер'
}

const formatDateTime = (date) => {
  return new Date(date).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
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
  loadLoginHistory()
  loadUserStats()
})
</script>

<style scoped>
.user-activity {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.activity-header {
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.activity-header h2 {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.user-info-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  font-size: 18px;
}

.user-details h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.user-details p {
  margin: 0 0 8px;
  font-size: 14px;
  color: #6b7280;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.online {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge:not(.online) {
  background: #fef2f2;
  color: #dc2626;
}

.activity-tabs {
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
  position: relative;
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

.tab-badge {
  background: #e5e7eb;
  color: #374151;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 6px;
}

.activity-content {
  padding: 24px;
}

.activity-section {
  min-height: 300px;
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

.timeline-item {
  position: relative;
  margin-bottom: 20px;
}

.timeline-marker {
  position: absolute;
  left: -32px;
  top: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #2563eb;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timeline-marker svg {
  width: 12px;
  height: 12px;
}

.timeline-content {
  background: #f9fafb;
  padding: 16px;
  border-radius: 8px;
  margin-left: 8px;
}

.timeline-time {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.timeline-description {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.timeline-details {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.detail-item {
  font-size: 12px;
  color: #6b7280;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border-left: 4px solid #2563eb;
}

.activity-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 4px;
}

.activity-subtitle {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 4px;
}

.activity-time {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.activity-details {
  font-size: 12px;
  color: #6b7280;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: #e5e7eb;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
}

.activity-chart {
  background: #f9fafb;
  padding: 20px;
  border-radius: 8px;
}

.activity-chart h4 {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.chart-placeholder {
  height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 150px;
  margin-bottom: 8px;
}

.chart-bar {
  flex: 1;
  background: #2563eb;
  border-radius: 2px 2px 0 0;
  min-height: 10px;
  transition: background-color 0.2s;
}

.chart-labels {
  display: flex;
  gap: 8px;
  font-size: 12px;
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
</style>