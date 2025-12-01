// src/admin/views/AdminDashboard.vue - Admin dashboard main page
<template>
  <div class="admin-dashboard space-y-6">
    <!-- Welcome Section -->
    <div class="card p-6 bg-gradient-to-r from-indigo-500/80 via-purple-600/80 to-fuchsia-600/80 border border-warp-border/60 text-white shadow-warp-md">
      <h2 class="text-2xl font-bold mb-2">{{ $t('admin.dashboard.welcome.title') }}</h2>
      <p class="opacity-90 text-sm">{{ $t('admin.dashboard.welcome.subtitle') }}</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        :title="$t('admin.dashboard.stats.activeRooms')"
        :value="stats.activeRooms"
        icon="video-camera"
        color="blue"
        :loading="loading"
      />
      <StatCard
        :title="$t('admin.dashboard.stats.onlineUsers')"
        :value="stats.onlineUsers"
        icon="users"
        color="green"
        :loading="loading"
      />
      <StatCard
        :title="$t('admin.dashboard.stats.totalCalls')"
        :value="stats.totalCalls"
        icon="phone"
        color="purple"
        :loading="loading"
      />
      <StatCard
        :title="$t('admin.dashboard.stats.serverLoad')"
        :value="stats.serverLoad"
        icon="cpu-chip"
        color="orange"
        suffix="%"
        :loading="loading"
      />
    </div>

    <!-- Main Actions -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Quick Actions -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold text-warp-text mb-4">
          {{ $t('admin.dashboard.quickActions.title') }}
        </h3>
        <div class="space-y-3">
          <button
            @click="navigateTo('AdminRooms')"
            class="w-full flex items-center justify-between p-3 bg-warp-surfaceAlt/80 hover:bg-warp-surface text-warp-text rounded-lg transition-colors border border-warp-border/60 shadow-warp-sm"
          >
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-warp-accent shadow-warp-md border border-warp-border/80">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
              </div>
              <div class="text-left">
                <p class="font-medium text-warp-text">{{ $t('admin.dashboard.quickActions.roomManagement.title') }}</p>
                <p class="text-xs text-warp-muted">{{ $t('admin.dashboard.quickActions.roomManagement.desc') }}</p>
              </div>
            </div>
            <svg class="w-5 h-5 text-warp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>

          <button
            @click="navigateTo('AdminUsers')"
            class="w-full flex items-center justify-between p-3 bg-warp-surfaceAlt/80 hover:bg-warp-surface text-warp-text rounded-lg transition-colors border border-warp-border/60 shadow-warp-sm"
          >
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-warp-accent shadow-warp-md border border-warp-border/80">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                </svg>
              </div>
              <div class="text-left">
                <p class="font-medium text-warp-text">{{ $t('admin.dashboard.quickActions.userManagement.title') }}</p>
                <p class="text-xs text-warp-muted">{{ $t('admin.dashboard.quickActions.userManagement.desc') }}</p>
              </div>
            </div>
            <svg class="w-5 h-5 text-warp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>

          <button
            @click="navigateTo('AdminSettings')"
            class="w-full flex items-center justify-between p-3 bg-warp-surfaceAlt/80 hover:bg-warp-surface text-warp-text rounded-lg transition-colors border border-warp-border/60 shadow-warp-sm"
          >
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-warp-accent shadow-warp-md border border-warp-border/80">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </div>
              <div class="text-left">
                <p class="font-medium text-warp-text">{{ $t('admin.dashboard.quickActions.systemSettings.title') }}</p>
                <p class="text-xs text-warp-muted">{{ $t('admin.dashboard.quickActions.systemSettings.desc') }}</p>
              </div>
            </div>
            <svg class="w-5 h-5 text-warp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold text-warp-text mb-4">
          {{ $t('admin.dashboard.recentActivity.title') }}
        </h3>
        <div class="space-y-4">
          <div v-for="activity in recentActivity" :key="activity.id" class="flex items-start space-x-3">
            <div :class="[
              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
              activity.type === 'room_created' ? 'bg-emerald-500/10' :
              activity.type === 'user_login' ? 'bg-blue-500/10' :
              activity.type === 'room_ended' ? 'bg-red-500/10' :
              'bg-warp-surfaceAlt/80'
            ]">
              <svg class="w-4 h-4" :class="[
                activity.type === 'room_created' ? 'text-emerald-400' :
                activity.type === 'user_login' ? 'text-blue-400' :
                activity.type === 'room_ended' ? 'text-red-400' :
                'text-warp-muted'
              ]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-warp-text">{{ activity.description }}</p>
                <p class="text-xs text-warp-muted">{{ activity.time }}</p>
              </div>
          </div>
        </div>
      </div>
    </div>

    <!-- System Status -->
    <div class="card p-6">
      <h3 class="text-lg font-semibold text-warp-text mb-4">
        {{ $t('admin.dashboard.systemStatus.title') }}
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="flex items-center justify-between">
          <span class="text-sm text-warp-muted">{{ $t('admin.dashboard.systemStatus.websocketServer') }}</span>
          <div class="flex items-center space-x-2">
            <div
              :class="[
                'w-3 h-3 rounded-full',
                getServiceStatus('websocket') === 'online'
                  ? 'bg-green-500 animate-pulse'
                  : getServiceStatus('websocket') === 'unknown'
                    ? 'bg-gray-400'
                    : 'bg-red-500 animate-pulse'
              ]"
            ></div>
            <span
              class="text-sm font-medium"
              :class="[
                getServiceStatus('websocket') === 'online'
                  ? 'text-green-600 dark:text-green-400'
                  : getServiceStatus('websocket') === 'unknown'
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-red-600 dark:text-red-400'
              ]"
            >
              {{
                getServiceStatus('websocket') === 'online'
                  ? $t('admin.common.online')
                  : getServiceStatus('websocket') === 'unknown'
                    ? $t('admin.common.unknown')
                    : $t('admin.common.offline')
              }}
            </span>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-warp-muted">{{ $t('admin.dashboard.systemStatus.sfuServer') }}</span>
          <div class="flex items-center space-x-2">
            <div
              :class="[
                'w-3 h-3 rounded-full',
                getServiceStatus('sfu') === 'online'
                  ? 'bg-green-500 animate-pulse'
                  : getServiceStatus('sfu') === 'unknown'
                    ? 'bg-gray-400'
                    : 'bg-red-500 animate-pulse'
              ]"
            ></div>
            <span
              class="text-sm font-medium"
              :class="[
                getServiceStatus('sfu') === 'online'
                  ? 'text-green-600 dark:text-green-400'
                  : getServiceStatus('sfu') === 'unknown'
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-red-600 dark:text-red-400'
              ]"
            >
              {{
                getServiceStatus('sfu') === 'online'
                  ? $t('admin.common.online')
                  : getServiceStatus('sfu') === 'unknown'
                    ? $t('admin.common.unknown')
                    : $t('admin.common.offline')
              }}
            </span>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-warp-muted">{{ $t('admin.dashboard.systemStatus.database') }}</span>
          <div class="flex items-center space-x-2">
            <div
              :class="[
                'w-3 h-3 rounded-full',
                getServiceStatus('database') === 'online'
                  ? 'bg-green-500 animate-pulse'
                  : getServiceStatus('database') === 'unknown'
                    ? 'bg-gray-400'
                    : 'bg-red-500 animate-pulse'
              ]"
            ></div>
            <span
              class="text-sm font-medium"
              :class="[
                getServiceStatus('database') === 'online'
                  ? 'text-green-600 dark:text-green-400'
                  : getServiceStatus('database') === 'unknown'
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-red-600 dark:text-red-400'
              ]"
            >
              {{
                getServiceStatus('database') === 'online'
                  ? $t('admin.common.online')
                  : getServiceStatus('database') === 'unknown'
                    ? $t('admin.common.unknown')
                    : $t('admin.common.offline')
              }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin'

// Router
const router = useRouter()
const adminStore = useAdminStore()

// Local loading flag for initial dashboard fetch
const loading = ref(false)

// Computed state from admin store
const stats = computed(() => adminStore.stats)
const recentActivity = computed(() => adminStore.recentActivity || [])
const systemStatus = computed(() => adminStore.systemStatus)

// Methods
const navigateTo = (routeName) => {
  router.push({ name: routeName })
}

const getServiceStatus = (key) => {
  return systemStatus.value[key]?.status || 'unknown'
}

const loadStats = async () => {
  loading.value = true

  try {
    await Promise.all([
      adminStore.loadDashboardStats(),
      adminStore.loadSystemStatus(),
      adminStore.loadRecentActivity(),
    ])
  } catch (error) {
    console.error('Failed to load admin dashboard data:', error)
  } finally {
    loading.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.admin-dashboard {
  min-height: calc(100vh - 4rem);
}

/* Custom animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.admin-dashboard > * {
  animation: fadeIn 0.3s ease-out;
}

/* Dark mode adjustments */
.dark .admin-dashboard {
  color-scheme: dark;
}
</style>