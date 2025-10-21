// src/admin/views/AdminDashboard.vue - Admin dashboard main page
<template>
  <div class="admin-dashboard space-y-6">
    <!-- Welcome Section -->
    <div class="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
      <h2 class="text-2xl font-bold mb-2">{{ $t('admin.dashboard.welcome.title') }}</h2>
      <p class="opacity-90">{{ $t('admin.dashboard.welcome.subtitle') }}</p>
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
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {{ $t('admin.dashboard.quickActions.title') }}
        </h3>
        <div class="space-y-3">
          <button
            @click="navigateTo('AdminRooms')"
            class="w-full flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
              </div>
              <div class="text-left">
                <p class="font-medium text-gray-900 dark:text-white">{{ $t('admin.dashboard.quickActions.roomManagement.title') }}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('admin.dashboard.quickActions.roomManagement.desc') }}</p>
              </div>
            </div>
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>

          <button
            @click="navigateTo('AdminUsers')"
            class="w-full flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
          >
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                </svg>
              </div>
              <div class="text-left">
                <p class="font-medium text-gray-900 dark:text-white">{{ $t('admin.dashboard.quickActions.userManagement.title') }}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('admin.dashboard.quickActions.userManagement.desc') }}</p>
              </div>
            </div>
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>

          <button
            @click="navigateTo('AdminSettings')"
            class="w-full flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
          >
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </div>
              <div class="text-left">
                <p class="font-medium text-gray-900 dark:text-white">{{ $t('admin.dashboard.quickActions.systemSettings.title') }}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('admin.dashboard.quickActions.systemSettings.desc') }}</p>
              </div>
            </div>
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {{ $t('admin.dashboard.recentActivity.title') }}
        </h3>
        <div class="space-y-4">
          <div v-for="activity in recentActivity" :key="activity.id" class="flex items-start space-x-3">
            <div :class="[
              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
              activity.type === 'room_created' ? 'bg-green-100 dark:bg-green-900/20' :
              activity.type === 'user_login' ? 'bg-blue-100 dark:bg-blue-900/20' :
              activity.type === 'room_ended' ? 'bg-red-100 dark:bg-red-900/20' :
              'bg-gray-100 dark:bg-gray-900/20'
            ]">
              <svg class="w-4 h-4" :class="[
                activity.type === 'room_created' ? 'text-green-600 dark:text-green-400' :
                activity.type === 'user_login' ? 'text-blue-600 dark:text-blue-400' :
                activity.type === 'room_ended' ? 'text-red-600 dark:text-red-400' :
                'text-gray-600 dark:text-gray-400'
              ]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-900 dark:text-white">{{ activity.description }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ activity.time }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- System Status -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {{ $t('admin.dashboard.systemStatus.title') }}
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ $t('admin.dashboard.systemStatus.websocketServer') }}</span>
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span class="text-sm font-medium text-green-600 dark:text-green-400">{{ $t('admin.common.online') }}</span>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ $t('admin.dashboard.systemStatus.sfuServer') }}</span>
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span class="text-sm font-medium text-green-600 dark:text-green-400">{{ $t('admin.common.online') }}</span>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ $t('admin.dashboard.systemStatus.database') }}</span>
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span class="text-sm font-medium text-green-600 dark:text-green-400">{{ $t('admin.common.online') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

// Router
const router = useRouter()

// Reactive state
const loading = ref(true)
const stats = ref({
  activeRooms: 0,
  onlineUsers: 0,
  totalCalls: 0,
  serverLoad: 0,
})

const recentActivity = ref([
  {
    id: 1,
    type: 'room_created',
    description: $t('admin.dashboard.recentActivity.roomCreated') + ': ABC123',
    time: '2 ' + $t('admin.dashboard.recentActivity.minutesAgo')
  },
  {
    id: 2,
    type: 'user_login',
    description: $t('admin.dashboard.recentActivity.userLogin'),
    time: '5 ' + $t('admin.dashboard.recentActivity.minutesAgo')
  },
  {
    id: 3,
    type: 'room_ended',
    description: $t('admin.dashboard.recentActivity.roomEnded') + ': XYZ789',
    time: '10 ' + $t('admin.dashboard.recentActivity.minutesAgo')
  },
  {
    id: 4,
    type: 'room_created',
    description: $t('admin.dashboard.recentActivity.roomCreated') + ': DEF456',
    time: '15 ' + $t('admin.dashboard.recentActivity.minutesAgo')
  },
])

// Methods
const navigateTo = (routeName) => {
  router.push({ name: routeName })
}

const loadStats = async () => {
  loading.value = true

  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Mock data - in real app this would come from API
    stats.value = {
      activeRooms: 12,
      onlineUsers: 48,
      totalCalls: 156,
      serverLoad: 23,
    }
  } catch (error) {
    console.error('Failed to load stats:', error)
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