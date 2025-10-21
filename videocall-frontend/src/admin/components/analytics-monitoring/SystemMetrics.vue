<template>
  <div class="system-metrics">
    <!-- Header -->
    <div class="metrics-header">
      <div class="header-info">
        <h2>Системные метрики</h2>
        <p>Мониторинг производительности и состояния системы</p>
      </div>
      <div class="header-controls">
        <div class="auto-refresh">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="autoRefresh"
              @change="toggleAutoRefresh"
            />
            Автообновление (30с)
          </label>
        </div>
        <button class="btn btn-primary btn-sm" @click="refreshMetrics">
          <svg fill="currentColor" viewBox="0 0 20 20" class="btn-icon">
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
          </svg>
          Обновить
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <LoadingSpinner text="Загрузка метрик..." />
    </div>

    <!-- Error State -->
    <ErrorMessage
      v-else-if="error"
      :title="'Ошибка загрузки метрик'"
      :message="error"
      type="error"
      dismissible
      @dismiss="error = null"
    />

    <!-- Metrics Grid -->
    <div v-else class="metrics-grid">
      <!-- System Health Overview -->
      <div class="metric-card health-card">
        <div class="card-header">
          <h3>Состояние системы</h3>
          <div :class="['health-status', systemHealth.status]">
            <span class="status-dot"></span>
            {{ getHealthLabel(systemHealth.status) }}
          </div>
        </div>

        <div class="health-services">
          <div
            v-for="service in systemHealth.services"
            :key="service.name"
            class="service-item"
            :class="service.status"
          >
            <div class="service-icon">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path v-if="service.name === 'websocket'" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                <path v-else-if="service.name === 'sfu'" d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
                <path v-else d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
              </svg>
            </div>
            <div class="service-info">
              <div class="service-name">{{ getServiceLabel(service.name) }}</div>
              <div class="service-status">{{ getStatusLabel(service.status) }}</div>
            </div>
            <div class="service-uptime">
              {{ formatUptime(service.uptime) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Performance Metrics -->
      <div class="metric-card">
        <div class="card-header">
          <h3>Производительность</h3>
        </div>

        <div class="performance-metrics">
          <div class="metric-item">
            <div class="metric-label">CPU</div>
            <div class="metric-value">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: metrics.cpu + '%' }"
                  :class="getCpuClass(metrics.cpu)"
                ></div>
              </div>
              <span class="percentage">{{ metrics.cpu }}%</span>
            </div>
          </div>

          <div class="metric-item">
            <div class="metric-label">Память</div>
            <div class="metric-value">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: metrics.memory + '%' }"
                  :class="getMemoryClass(metrics.memory)"
                ></div>
              </div>
              <span class="percentage">{{ metrics.memory }}%</span>
            </div>
          </div>

          <div class="metric-item">
            <div class="metric-label">Диск</div>
            <div class="metric-value">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: metrics.disk + '%' }"
                  :class="getDiskClass(metrics.disk)"
                ></div>
              </div>
              <span class="percentage">{{ metrics.disk }}%</span>
            </div>
          </div>

          <div class="metric-item">
            <div class="metric-label">Сеть</div>
            <div class="metric-value">
              <div class="network-info">
                <span class="network-in">{{ formatBytes(metrics.network.in) }}/с</span>
                <span class="network-out">{{ formatBytes(metrics.network.out) }}/с</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Real-time Charts -->
      <div class="metric-card">
        <div class="card-header">
          <h3>Загрузка CPU (реал-тайм)</h3>
        </div>
        <div class="realtime-chart">
          <div class="mini-chart">
            <svg viewBox="0 0 300 100" class="chart-svg">
              <polyline
                :points="cpuHistory.map((val, i) => `${i * 30},${100 - val}`).join(' ')"
                fill="none"
                stroke="#2563eb"
                stroke-width="2"
              />
              <!-- Fill area under curve -->
              <polygon
                :points="`0,100 ${cpuHistory.map((val, i) => `${i * 30},${100 - val}`).join(' ')} 300,100`"
                fill="url(#cpuGradient)"
              />
              <defs>
                <linearGradient id="cpuGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#2563eb;stop-opacity:0.3" />
                  <stop offset="100%" style="stop-color:#2563eb;stop-opacity:0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="current-value">
            {{ cpuHistory[cpuHistory.length - 1] }}%
          </div>
        </div>
      </div>

      <!-- Memory Usage Chart -->
      <div class="metric-card">
        <div class="card-header">
          <h3>Использование памяти</h3>
        </div>
        <div class="memory-breakdown">
          <div class="memory-item">
            <div class="memory-label">Использовано</div>
            <div class="memory-value">{{ formatBytes(metrics.memoryDetails.used) }}</div>
            <div class="memory-bar">
              <div class="memory-fill used" :style="{ width: (metrics.memoryDetails.used / metrics.memoryDetails.total) * 100 + '%' }"></div>
            </div>
          </div>
          <div class="memory-item">
            <div class="memory-label">Свободно</div>
            <div class="memory-value">{{ formatBytes(metrics.memoryDetails.free) }}</div>
            <div class="memory-bar">
              <div class="memory-fill free" :style="{ width: (metrics.memoryDetails.free / metrics.memoryDetails.total) * 100 + '%' }"></div>
            </div>
          </div>
          <div class="memory-item">
            <div class="memory-label">Кэш</div>
            <div class="memory-value">{{ formatBytes(metrics.memoryDetails.cached) }}</div>
            <div class="memory-bar">
              <div class="memory-fill cached" :style="{ width: (metrics.memoryDetails.cached / metrics.memoryDetails.total) * 100 + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Active Connections -->
      <div class="metric-card">
        <div class="card-header">
          <h3>Активные соединения</h3>
        </div>

        <div class="connections-stats">
          <div class="connection-item">
            <div class="connection-icon websocket">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div class="connection-info">
              <div class="connection-count">{{ connections.websocket }}</div>
              <div class="connection-label">WebSocket</div>
            </div>
          </div>

          <div class="connection-item">
            <div class="connection-icon webrtc">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
              </svg>
            </div>
            <div class="connection-info">
              <div class="connection-count">{{ connections.webrtc }}</div>
              <div class="connection-label">WebRTC</div>
            </div>
          </div>

          <div class="connection-item">
            <div class="connection-icon http">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="connection-info">
              <div class="connection-count">{{ connections.http }}</div>
              <div class="connection-label">HTTP API</div>
            </div>
          </div>
        </div>
      </div>

      <!-- System Load -->
      <div class="metric-card">
        <div class="card-header">
          <h3>Нагрузка системы</h3>
        </div>

        <div class="load-averages">
          <div class="load-item">
            <div class="load-label">1 минута</div>
            <div class="load-value">{{ loadAverage.one }}</div>
          </div>
          <div class="load-item">
            <div class="load-label">5 минут</div>
            <div class="load-value">{{ loadAverage.five }}</div>
          </div>
          <div class="load-item">
            <div class="load-label">15 минут</div>
            <div class="load-value">{{ loadAverage.fifteen }}</div>
          </div>
        </div>

        <div class="load-chart">
          <div class="load-bars">
            <div
              v-for="i in 20"
              :key="i"
              class="load-bar"
              :style="{ height: (Math.random() * 60 + 20) + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import LoadingSpinner from '../ui/LoadingSpinner.vue'
import ErrorMessage from '../ui/ErrorMessage.vue'

// State
const loading = ref(false)
const error = ref(null)
const autoRefresh = ref(false)
const refreshInterval = ref(null)

// Metrics data
const systemHealth = ref({
  status: 'healthy',
  percentage: 100,
  services: [
    { name: 'websocket', status: 'online', uptime: 86400 },
    { name: 'sfu', status: 'online', uptime: 43200 },
    { name: 'database', status: 'warning', uptime: 172800 }
  ]
})

const metrics = ref({
  cpu: 45,
  memory: 67,
  disk: 23,
  network: {
    in: 1024000,
    out: 512000
  },
  memoryDetails: {
    total: 8589934592,
    used: 5368709120,
    free: 2147483648,
    cached: 1073741824
  }
})

const connections = ref({
  websocket: 142,
  webrtc: 89,
  http: 23
})

const loadAverage = ref({
  one: '1.23',
  five: '1.45',
  fifteen: '1.12'
})

const cpuHistory = ref(Array.from({ length: 10 }, () => Math.floor(Math.random() * 40) + 30))

// Computed
const getHealthLabel = (status) => {
  const labels = {
    healthy: 'Здорова',
    warning: 'Предупреждение',
    critical: 'Критично'
  }
  return labels[status] || status
}

const getServiceLabel = (name) => {
  const labels = {
    websocket: 'WebSocket сервер',
    sfu: 'SFU сервер',
    database: 'База данных'
  }
  return labels[name] || name
}

const getStatusLabel = (status) => {
  const labels = {
    online: 'Онлайн',
    offline: 'Офлайн',
    warning: 'Предупреждение'
  }
  return labels[status] || status
}

// Methods
const loadMetrics = async () => {
  loading.value = true
  error.value = null

  try {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Update metrics with random variations
    metrics.value = {
      cpu: Math.floor(Math.random() * 30) + 20,
      memory: Math.floor(Math.random() * 40) + 50,
      disk: Math.floor(Math.random() * 20) + 10,
      network: {
        in: Math.floor(Math.random() * 2000000) + 500000,
        out: Math.floor(Math.random() * 1000000) + 250000
      },
      memoryDetails: {
        total: 8589934592,
        used: Math.floor(Math.random() * 6000000000) + 4000000000,
        free: Math.floor(Math.random() * 3000000000) + 1000000000,
        cached: Math.floor(Math.random() * 2000000000) + 500000000
      }
    }

    // Update CPU history
    cpuHistory.value.push(metrics.value.cpu)
    if (cpuHistory.value.length > 10) {
      cpuHistory.value.shift()
    }

    // Update connections
    connections.value = {
      websocket: Math.floor(Math.random() * 50) + 100,
      webrtc: Math.floor(Math.random() * 30) + 60,
      http: Math.floor(Math.random() * 20) + 10
    }

    // Update load average
    loadAverage.value = {
      one: (Math.random() * 2).toFixed(2),
      five: (Math.random() * 2).toFixed(2),
      fifteen: (Math.random() * 2).toFixed(2)
    }

  } catch (err) {
    error.value = 'Не удалось загрузить метрики системы'
    console.error('Failed to load metrics:', err)
  } finally {
    loading.value = false
  }
}

const refreshMetrics = () => {
  loadMetrics()
}

const toggleAutoRefresh = () => {
  if (autoRefresh.value) {
    refreshInterval.value = setInterval(() => {
      loadMetrics()
    }, 30000) // 30 seconds
  } else {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value)
      refreshInterval.value = null
    }
  }
}

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `${days}д ${hours}ч`
  } else if (hours > 0) {
    return `${hours}ч ${minutes}м`
  }
  return `${minutes}м`
}

const getCpuClass = (percentage) => {
  if (percentage < 50) return 'good'
  if (percentage < 80) return 'warning'
  return 'critical'
}

const getMemoryClass = (percentage) => {
  if (percentage < 60) return 'good'
  if (percentage < 85) return 'warning'
  return 'critical'
}

const getDiskClass = (percentage) => {
  if (percentage < 70) return 'good'
  if (percentage < 90) return 'warning'
  return 'critical'
}

// Initialize and cleanup
onMounted(() => {
  loadMetrics()
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<style scoped>
.system-metrics {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.metrics-header {
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
  gap: 16px;
  align-items: center;
}

.auto-refresh {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  accent-color: #2563eb;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 24px;
  padding: 24px;
}

.metric-card {
  background: #f9fafb;
  border-radius: 8px;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.health-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.health-status.healthy {
  background: #dcfce7;
  color: #16a34a;
}

.health-status.warning {
  background: #fef3c7;
  color: #d97706;
}

.health-status.critical {
  background: #fef2f2;
  color: #dc2626;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.health-status.healthy .status-dot {
  background: #16a34a;
}

.health-status.warning .status-dot {
  background: #d97706;
}

.health-status.critical .status-dot {
  background: #dc2626;
}

.health-services {
  padding: 20px;
}

.service-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  background: white;
  border-radius: 6px;
  transition: all 0.2s;
}

.service-item.online {
  border-left: 4px solid #16a34a;
}

.service-item.warning {
  border-left: 4px solid #d97706;
}

.service-item.offline {
  border-left: 4px solid #dc2626;
}

.service-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
}

.service-info {
  flex: 1;
}

.service-name {
  font-weight: 500;
  color: #374151;
  margin-bottom: 2px;
}

.service-status {
  font-size: 12px;
  color: #6b7280;
}

.service-uptime {
  font-size: 12px;
  color: #6b7280;
  font-family: monospace;
}

.performance-metrics {
  padding: 20px;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.metric-item:last-child {
  margin-bottom: 0;
}

.metric-label {
  font-weight: 500;
  color: #374151;
}

.metric-value {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 120px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-fill.good {
  background: #16a34a;
}

.progress-fill.warning {
  background: #d97706;
}

.progress-fill.critical {
  background: #dc2626;
}

.percentage {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  min-width: 35px;
  text-align: right;
}

.network-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.network-in,
.network-out {
  font-size: 10px;
  color: #6b7280;
  font-family: monospace;
}

.realtime-chart {
  padding: 20px;
  position: relative;
}

.mini-chart {
  height: 80px;
  margin-bottom: 12px;
}

.chart-svg {
  width: 100%;
  height: 100%;
}

.current-value {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: #2563eb;
}

.memory-breakdown {
  padding: 20px;
}

.memory-item {
  margin-bottom: 12px;
}

.memory-item:last-child {
  margin-bottom: 0;
}

.memory-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.memory-value {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.memory-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.memory-fill {
  height: 100%;
  border-radius: 3px;
}

.memory-fill.used {
  background: #2563eb;
}

.memory-fill.free {
  background: #16a34a;
}

.memory-fill.cached {
  background: #d97706;
}

.connections-stats {
  padding: 20px;
}

.connection-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  background: white;
  border-radius: 6px;
}

.connection-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.connection-icon.websocket {
  background: #16a34a;
}

.connection-icon.webrtc {
  background: #2563eb;
}

.connection-icon.http {
  background: #7c3aed;
}

.connection-count {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}

.connection-label {
  font-size: 12px;
  color: #6b7280;
}

.load-averages {
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.load-item {
  text-align: center;
}

.load-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.load-value {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.load-chart {
  padding: 20px;
  height: 60px;
}

.load-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 100%;
}

.load-bar {
  flex: 1;
  background: #2563eb;
  border-radius: 1px 1px 0 0;
  min-height: 10px;
  opacity: 0.7;
}

.loading-container {
  padding: 60px;
  text-align: center;
}

.btn {
  padding: 6px 12px;
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

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.btn-icon {
  width: 16px;
  height: 16px;
}
</style>