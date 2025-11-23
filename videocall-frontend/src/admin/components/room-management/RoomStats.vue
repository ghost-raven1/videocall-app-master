<template>
  <div class="room-stats">
    <div class="stats-header">
      <h2>Статистика комнаты</h2>
      <div class="room-info">
        <span class="room-name">{{ room.name || 'Без названия' }}</span>
        <span class="room-id">{{ room.room_id }}</span>
      </div>
    </div>

    <!-- Overview Cards -->
    <div class="stats-overview">
      <div class="stat-card">
        <div class="stat-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ stats.totalParticipants }}</div>
          <div class="stat-label">Всего участников</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ formatDuration(stats.totalDuration) }}</div>
          <div class="stat-label">Общая длительность</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ stats.totalSessions }}</div>
          <div class="stat-label">Сессий проведено</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ formatDate(stats.lastActivity) }}</div>
          <div class="stat-label">Последняя активность</div>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="charts-section">
      <div class="chart-card">
        <h3>Активность по часам</h3>
        <div class="chart-container">
          <div class="bar-chart">
            <div
              v-for="(value, hour) in hourlyActivity"
              :key="hour"
              class="chart-bar"
              :style="{ height: (value / maxHourly) * 100 + '%' }"
              :title="`${hour}:00 - ${value} сессий`"
            ></div>
          </div>
          <div class="chart-labels">
            <span v-for="hour in 24" :key="hour">{{ hour }}</span>
          </div>
        </div>
      </div>

      <div class="chart-card">
        <h3>Распределение по дням недели</h3>
        <div class="chart-container">
          <div class="pie-chart">
            <div class="pie-segment" style="--percentage: 35%; --color: #2563eb;"></div>
            <div class="pie-segment" style="--percentage: 25%; --color: #16a34a;"></div>
            <div class="pie-segment" style="--percentage: 20%; --color: #d97706;"></div>
            <div class="pie-segment" style="--percentage: 12%; --color: #dc2626;"></div>
            <div class="pie-segment" style="--percentage: 8%; --color: #7c3aed;"></div>
          </div>
          <div class="pie-legend">
            <div class="legend-item">
              <div class="legend-color" style="background: #2563eb;"></div>
              <span>Понедельник</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #16a34a;"></div>
              <span>Вторник</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #d97706;"></div>
              <span>Среда</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detailed Tables -->
    <div class="details-section">
      <div class="table-card">
        <h3>Топ участников</h3>
        <div class="stats-table">
          <div class="table-header">
            <span>Пользователь</span>
            <span>Время в комнате</span>
            <span>Количество сессий</span>
          </div>
          <div
            v-for="participant in topParticipants"
            :key="participant.id"
            class="table-row"
          >
            <span class="participant-name">{{ participant.username }}</span>
            <span class="participant-duration">{{ formatDuration(participant.totalDuration) }}</span>
            <span class="participant-sessions">{{ participant.sessionCount }}</span>
          </div>
        </div>
      </div>

      <div class="table-card">
        <h3>Недавние сессии</h3>
        <div class="stats-table">
          <div class="table-header">
            <span>Дата</span>
            <span>Участники</span>
            <span>Длительность</span>
          </div>
          <div
            v-for="session in recentSessions"
            :key="session.id"
            class="table-row"
          >
            <span class="session-date">{{ formatDate(session.date) }}</span>
            <span class="session-participants">{{ session.participantCount }}</span>
            <span class="session-duration">{{ formatDuration(session.duration) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineProps, onMounted } from 'vue'

defineProps({
  room: {
    type: Object,
    required: true
  }
})

// Stats data
const stats = ref({
  totalParticipants: 0,
  totalDuration: 0,
  totalSessions: 0,
  lastActivity: null
})

// Chart data
const hourlyActivity = ref(Array.from({ length: 24 }, () => Math.floor(Math.random() * 20) + 1))
const maxHourly = computed(() => Math.max(...hourlyActivity.value))

// Table data
const topParticipants = ref([
  { id: 1, username: 'user1', totalDuration: 36000, sessionCount: 15 },
  { id: 2, username: 'user2', totalDuration: 28800, sessionCount: 12 },
  { id: 3, username: 'user3', totalDuration: 21600, sessionCount: 9 },
  { id: 4, username: 'user4', totalDuration: 14400, sessionCount: 6 },
  { id: 5, username: 'user5', totalDuration: 7200, sessionCount: 3 }
])

const recentSessions = ref([
  { id: 1, date: new Date(Date.now() - 2 * 60 * 60 * 1000), participantCount: 5, duration: 3600 },
  { id: 2, date: new Date(Date.now() - 5 * 60 * 60 * 1000), participantCount: 3, duration: 1800 },
  { id: 3, date: new Date(Date.now() - 8 * 60 * 60 * 1000), participantCount: 7, duration: 5400 },
  { id: 4, date: new Date(Date.now() - 24 * 60 * 60 * 1000), participantCount: 4, duration: 2700 },
  { id: 5, date: new Date(Date.now() - 26 * 60 * 60 * 1000), participantCount: 6, duration: 4200 }
])

// Methods
const loadStats = async () => {
  // Mock API call
  await new Promise(resolve => setTimeout(resolve, 1000))

  stats.value = {
    totalParticipants: Math.floor(Math.random() * 100) + 20,
    totalDuration: Math.floor(Math.random() * 500000) + 100000,
    totalSessions: Math.floor(Math.random() * 50) + 10,
    lastActivity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
  }
}

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}ч ${minutes}м`
  }
  return `${minutes}м`
}

const formatDate = (date) => {
  if (!date) return 'Никогда'
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Initialize
onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.room-stats {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stats-header {
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.stats-header h2 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.room-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.room-name {
  font-weight: 500;
  color: #374151;
}

.room-id {
  font-size: 14px;
  color: #6b7280;
  font-family: monospace;
}

.stats-overview {
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

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.chart-card {
  background: #f9fafb;
  padding: 20px;
  border-radius: 8px;
}

.chart-card h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.chart-container {
  height: 200px;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 150px;
  margin-bottom: 8px;
}

.chart-bar {
  flex: 1;
  background: #2563eb;
  border-radius: 2px 2px 0 0;
  min-height: 10px;
  transition: opacity 0.2s;
}

.chart-bar:hover {
  opacity: 0.8;
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #6b7280;
}

.pie-chart {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: conic-gradient(
    #2563eb 0% 35%,
    #16a34a 35% 60%,
    #d97706 60% 80%,
    #dc2626 80% 92%,
    #7c3aed 92% 100%
  );
}

.pie-chart::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 60px;
  height: 60px;
  background: white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.pie-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #374151;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.details-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  padding: 24px;
}

.table-card {
  background: #f9fafb;
  padding: 20px;
  border-radius: 8px;
}

.table-card h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.stats-table {
  display: flex;
  flex-direction: column;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
  color: #374151;
  align-items: center;
}

.table-row:last-child {
  border-bottom: none;
}

.participant-name {
  font-weight: 500;
}

.participant-duration,
.participant-sessions {
  text-align: right;
}

.session-date {
  font-size: 14px;
}

.session-participants,
.session-duration {
  text-align: right;
}
</style>
