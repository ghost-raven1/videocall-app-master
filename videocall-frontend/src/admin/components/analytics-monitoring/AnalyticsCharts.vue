<template>
  <div class="analytics-charts">
    <!-- Header with Controls -->
    <div class="charts-header">
      <div class="header-info">
        <h2>Аналитика и графики</h2>
        <p>Детальный анализ активности системы видеозвонков</p>
      </div>
      <div class="header-controls">
        <select v-model="timeRange" @change="loadAnalyticsData" class="time-select">
          <option value="24h">Последние 24 часа</option>
          <option value="7d">Последние 7 дней</option>
          <option value="30d">Последние 30 дней</option>
          <option value="90d">Последние 90 дней</option>
        </select>
        <button class="btn btn-secondary btn-sm" @click="exportData">
          <svg fill="currentColor" viewBox="0 0 20 20" class="btn-icon">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
          Экспорт
        </button>
        <button class="btn btn-primary btn-sm" @click="refreshData">
          <svg fill="currentColor" viewBox="0 0 20 20" class="btn-icon">
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
          </svg>
          Обновить
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <LoadingSpinner text="Загрузка аналитики..." />
    </div>

    <!-- Error State -->
    <ErrorMessage
      v-else-if="error"
      :title="'Ошибка загрузки аналитики'"
      :message="error"
      type="error"
      dismissible
      @dismiss="error = null"
    />

    <!-- Charts Grid -->
    <div v-else class="charts-grid">
      <!-- Calls Over Time Chart -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>Звонки по времени</h3>
          <div class="chart-legend">
            <div class="legend-item">
              <div class="legend-color" style="background: #2563eb;"></div>
              <span>Исходящие</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #16a34a;"></div>
              <span>Входящие</span>
            </div>
          </div>
        </div>
        <div class="chart-container">
          <div class="line-chart">
            <svg viewBox="0 0 400 200" class="chart-svg">
              <!-- Grid lines -->
              <defs>
                <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" stroke-width="0.5"/>
                </pattern>
              </defs>
              <rect width="400" height="200" fill="url(#grid)" />

              <!-- Chart area -->
              <polyline
                :points="callsOverTime.outgoing.map((val, i) => `${i * 40},${200 - (val / maxCalls) * 180}`).join(' ')"
                fill="none"
                stroke="#2563eb"
                stroke-width="2"
              />
              <polyline
                :points="callsOverTime.incoming.map((val, i) => `${i * 40},${200 - (val / maxCalls) * 180}`).join(' ')"
                fill="none"
                stroke="#16a34a"
                stroke-width="2"
              />

              <!-- Data points -->
              <circle
                v-for="(val, i) in callsOverTime.outgoing"
                :key="`outgoing-${i}`"
                :cx="i * 40"
                :cy="200 - (val / maxCalls) * 180"
                r="3"
                fill="#2563eb"
              />
              <circle
                v-for="(val, i) in callsOverTime.incoming"
                :key="`incoming-${i}`"
                :cx="i * 40"
                :cy="200 - (val / maxCalls) * 180"
                r="3"
                fill="#16a34a"
              />
            </svg>
          </div>
          <div class="chart-labels">
            <span v-for="i in 10" :key="i">{{ i * 2 }}:00</span>
          </div>
        </div>
      </div>

      <!-- User Activity Chart -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>Активность пользователей</h3>
          <div class="chart-legend">
            <div class="legend-item">
              <div class="legend-color" style="background: #d97706;"></div>
              <span>Активные пользователи</span>
            </div>
          </div>
        </div>
        <div class="chart-container">
          <div class="area-chart">
            <svg viewBox="0 0 400 200" class="chart-svg">
              <!-- Gradient fill -->
              <defs>
                <linearGradient id="userGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#d97706;stop-opacity:0.3" />
                  <stop offset="100%" style="stop-color:#d97706;stop-opacity:0" />
                </linearGradient>
              </defs>

              <!-- Area fill -->
              <polygon
                :points="`${userActivity.map((val, i) => `${i * 40},${200 - (val / maxUsers) * 180}`).join(' ')} ${400},${200} 0,200`"
                fill="url(#userGradient)"
              />

              <!-- Line -->
              <polyline
                :points="userActivity.map((val, i) => `${i * 40},${200 - (val / maxUsers) * 180}`).join(' ')"
                fill="none"
                stroke="#d97706"
                stroke-width="2"
              />

              <!-- Data points -->
              <circle
                v-for="(val, i) in userActivity"
                :key="i"
                :cx="i * 40"
                :cy="200 - (val / maxUsers) * 180"
                r="3"
                fill="#d97706"
              />
            </svg>
          </div>
          <div class="chart-labels">
            <span v-for="i in 10" :key="i">{{ i * 2 }}:00</span>
          </div>
        </div>
      </div>

      <!-- Room Status Distribution -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>Распределение комнат по статусу</h3>
        </div>
        <div class="chart-container">
          <div class="doughnut-chart">
            <svg viewBox="0 0 200 200" class="chart-svg">
              <!-- Doughnut segments -->
              <g transform="translate(100,100)">
                <!-- Active rooms -->
                <path
                  d="M 0,-60 A 60 60 0 1 1 0,60 A 60 60 0 0 1 0,-60"
                  fill="#16a34a"
                  stroke="white"
                  stroke-width="2"
                />
                <!-- Inactive rooms -->
                <path
                  d="M 0,60 A 60 60 0 0 1 0,-60 A 60 60 0 1 1 0,60"
                  fill="#6b7280"
                  stroke="white"
                  stroke-width="2"
                />
                <!-- Error rooms -->
                <path
                  d="M 0,-60 A 60 60 0 0 1 0,60 A 60 60 0 0 1 0,-60"
                  fill="#dc2626"
                  stroke="white"
                  stroke-width="2"
                />
              </g>
            </svg>
          </div>
          <div class="doughnut-legend">
            <div class="legend-item">
              <div class="legend-color" style="background: #16a34a;"></div>
              <span>Активные (65%)</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #6b7280;"></div>
              <span>Неактивные (30%)</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #dc2626;"></div>
              <span>С ошибками (5%)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Peak Hours Chart -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>Пиковые часы нагрузки</h3>
        </div>
        <div class="chart-container">
          <div class="bar-chart-horizontal">
            <div class="chart-bars">
              <div
                v-for="(hour, index) in peakHours"
                :key="index"
                class="chart-bar-horizontal"
                :style="{ width: (hour.load / 100) * 100 + '%' }"
              >
                <span class="bar-label">{{ hour.time }}</span>
                <span class="bar-value">{{ hour.load }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="summary-content">
          <div class="summary-value">{{ summary.totalCalls }}</div>
          <div class="summary-label">Всего звонков</div>
          <div class="summary-change positive">+12% от прошлого периода</div>
        </div>
      </div>

      <div class="summary-card">
        <div class="summary-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="summary-content">
          <div class="summary-value">{{ summary.avgDuration }}</div>
          <div class="summary-label">Средняя длительность</div>
          <div class="summary-change positive">+5 мин от прошлого периода</div>
        </div>
      </div>

      <div class="summary-card">
        <div class="summary-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
          </svg>
        </div>
        <div class="summary-content">
          <div class="summary-value">{{ summary.activeUsers }}</div>
          <div class="summary-label">Активных пользователей</div>
          <div class="summary-change negative">-3% от прошлого периода</div>
        </div>
      </div>

      <div class="summary-card">
        <div class="summary-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
          </svg>
        </div>
        <div class="summary-content">
          <div class="summary-value">{{ summary.activeRooms }}</div>
          <div class="summary-label">Активных комнат</div>
          <div class="summary-change positive">+8% от прошлого периода</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import LoadingSpinner from '../ui/LoadingSpinner.vue'
import ErrorMessage from '../ui/ErrorMessage.vue'

// State
const loading = ref(false)
const error = ref(null)
const timeRange = ref('7d')

// Chart data
const callsOverTime = ref({
  outgoing: Array.from({ length: 10 }, () => Math.floor(Math.random() * 50) + 10),
  incoming: Array.from({ length: 10 }, () => Math.floor(Math.random() * 40) + 5)
})

const userActivity = ref(Array.from({ length: 10 }, () => Math.floor(Math.random() * 100) + 20))

const peakHours = ref([
  { time: '09:00', load: 45 },
  { time: '10:00', load: 62 },
  { time: '11:00', load: 78 },
  { time: '12:00', load: 85 },
  { time: '13:00', load: 72 },
  { time: '14:00', load: 89 },
  { time: '15:00', load: 94 },
  { time: '16:00', load: 76 },
  { time: '17:00', load: 58 },
  { time: '18:00', load: 43 }
])

const summary = ref({
  totalCalls: 1247,
  avgDuration: '24 мин',
  activeUsers: 89,
  activeRooms: 23
})

// Computed
const maxCalls = computed(() => {
  const allValues = [...callsOverTime.value.outgoing, ...callsOverTime.value.incoming]
  return Math.max(...allValues)
})

const maxUsers = computed(() => Math.max(...userActivity.value))

// Methods
const loadAnalyticsData = async () => {
  loading.value = true
  error.value = null

  try {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Update chart data based on time range
    if (timeRange.value === '24h') {
      callsOverTime.value.outgoing = Array.from({ length: 10 }, () => Math.floor(Math.random() * 30) + 5)
      callsOverTime.value.incoming = Array.from({ length: 10 }, () => Math.floor(Math.random() * 25) + 3)
      userActivity.value = Array.from({ length: 10 }, () => Math.floor(Math.random() * 60) + 10)
    } else if (timeRange.value === '30d') {
      callsOverTime.value.outgoing = Array.from({ length: 10 }, () => Math.floor(Math.random() * 80) + 20)
      callsOverTime.value.incoming = Array.from({ length: 10 }, () => Math.floor(Math.random() * 70) + 15)
      userActivity.value = Array.from({ length: 10 }, () => Math.floor(Math.random() * 150) + 30)
    }

  } catch (err) {
    error.value = 'Не удалось загрузить данные аналитики'
    console.error('Failed to load analytics:', err)
  } finally {
    loading.value = false
  }
}

const refreshData = () => {
  loadAnalyticsData()
}

const exportData = () => {
  const data = {
    timeRange: timeRange.value,
    callsOverTime: callsOverTime.value,
    userActivity: userActivity.value,
    peakHours: peakHours.value,
    summary: summary.value,
    exportedAt: new Date().toISOString()
  }

  const dataStr = JSON.stringify(data, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `analytics_export_${timeRange.value}_${new Date().toISOString().split('T')[0]}.json`
  link.click()
  URL.revokeObjectURL(url)
}

// Initialize
onMounted(() => {
  loadAnalyticsData()
})
</script>

<style scoped>
.analytics-charts {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.charts-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
  gap: 24px;
}

.header-info h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
}

.header-info p {
  margin: 0;
  color: #6b7280;
  font-size: 16px;
}

.header-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.time-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
  padding: 24px;
}

.chart-card {
  background: #f9fafb;
  border-radius: 8px;
  overflow: hidden;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.chart-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.chart-legend {
  display: flex;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.chart-container {
  padding: 20px;
  height: 250px;
}

.chart-svg {
  width: 100%;
  height: 100%;
}

.line-chart,
.area-chart,
.bar-chart-horizontal {
  height: 200px;
  width: 100%;
}

.bar-chart-horizontal .chart-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.chart-bar-horizontal {
  display: flex;
  align-items: center;
  background: #2563eb;
  border-radius: 0 4px 4px 0;
  height: 24px;
  padding: 0 8px;
  color: white;
  font-size: 12px;
  transition: opacity 0.2s;
}

.chart-bar-horizontal:hover {
  opacity: 0.8;
}

.bar-label {
  font-weight: 500;
}

.bar-value {
  margin-left: auto;
  font-weight: 600;
}

.doughnut-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.doughnut-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 20px;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  padding: 24px;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(37, 99, 235, 0.1);
}

.summary-card:nth-child(2) {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  box-shadow: 0 4px 6px rgba(22, 163, 74, 0.1);
}

.summary-card:nth-child(3) {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  box-shadow: 0 4px 6px rgba(217, 119, 6, 0.1);
}

.summary-card:nth-child(4) {
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  box-shadow: 0 4px 6px rgba(124, 58, 237, 0.1);
}

.summary-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.summary-icon svg {
  width: 24px;
  height: 24px;
}

.summary-content {
  flex: 1;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
}

.summary-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 6px;
}

.summary-change {
  font-size: 12px;
  font-weight: 500;
}

.summary-change.positive {
  color: rgba(255, 255, 255, 0.9);
}

.summary-change.negative {
  color: rgba(255, 255, 255, 0.7);
}

.loading-container {
  padding: 60px;
  text-align: center;
}

.btn {
  padding: 8px 12px;
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

.btn-sm {
  padding: 6px 8px;
  font-size: 12px;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

/* Responsive */
@media (max-width: 768px) {
  .charts-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-controls {
    justify-content: space-between;
  }

  .charts-grid {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 16px;
  }
}
</style>