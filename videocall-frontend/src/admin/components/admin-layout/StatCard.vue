// src/admin/components/admin-layout/StatCard.vue - Statistics card component
<template>
  <div class="stat-card bg-warp-surface rounded-lg shadow-warp-sm p-6 border border-warp-border/70">
    <div class="flex items-center justify-between">
      <div class="flex-1">
        <p class="text-sm font-medium text-warp-muted mb-1">
          {{ title }}
        </p>
        <div class="flex items-center space-x-2">
          <div v-if="loading" class="animate-pulse">
            <div class="h-8 w-16 bg-warp-surfaceAlt rounded"></div>
          </div>
          <p v-else class="text-2xl font-bold text-warp-text">
            {{ formattedValue }}
          </p>
        </div>
      </div>
      <div :class="[
        'w-12 h-12 rounded-lg flex items-center justify-center',
        colorClasses[color]?.bg,
        colorClasses[color]?.icon
      ]">
        <svg class="w-6 h-6" :class="colorClasses[color]?.text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="iconPaths[icon]"></path>
        </svg>
      </div>
    </div>

    <!-- Trend indicator (optional) -->
    <div v-if="showTrend && !loading" class="mt-4 flex items-center">
      <svg class="w-4 h-4 mr-1" :class="trend.up ? 'text-green-500' : 'text-red-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="trend.up ? 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' : 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6'"></path>
      </svg>
      <span :class="trend.up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'" class="text-sm font-medium">
        {{ trend.value }}%
      </span>
      <span class="text-sm text-gray-500 dark:text-gray-400 ml-1">
        от прошлого месяца
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Props
const props = defineProps({
  title: {
    type: String,
    required: true
  },
  value: {
    type: [Number, String],
    default: 0
  },
  icon: {
    type: String,
    default: 'users'
  },
  color: {
    type: String,
    default: 'blue',
    validator: (value) => ['blue', 'green', 'purple', 'orange', 'red'].includes(value)
  },
  suffix: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  },
  showTrend: {
    type: Boolean,
    default: false
  }
})

// Color configurations
const colorClasses = {
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    icon: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-600 dark:text-blue-400'
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-900/20',
    icon: 'text-green-600 dark:text-green-400',
    text: 'text-green-600 dark:text-green-400'
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-900/20',
    icon: 'text-purple-600 dark:text-purple-400',
    text: 'text-purple-600 dark:text-purple-400'
  },
  orange: {
    bg: 'bg-orange-100 dark:bg-orange-900/20',
    icon: 'text-orange-600 dark:text-orange-400',
    text: 'text-orange-600 dark:text-orange-400'
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-900/20',
    icon: 'text-red-600 dark:text-red-400',
    text: 'text-red-600 dark:text-red-400'
  }
}

// Icon paths
const iconPaths = {
  'users': 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
  'video-camera': 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  'phone': 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  'cpu-chip': 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z'
}

// Computed
const formattedValue = computed(() => {
  if (props.loading) return '...'

  const num = typeof props.value === 'string' ? parseInt(props.value) : props.value

  if (isNaN(num)) return props.value

  // Format large numbers
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }

  return num.toString() + props.suffix
})

const trend = computed(() => {
  if (!props.showTrend || props.loading) {
    return { up: true, value: 0 }
  }

  // Mock trend data - in real app this would come from props or API
  return {
    up: Math.random() > 0.5,
    value: Math.floor(Math.random() * 20) + 1
  }
})
</script>

<style scoped>
.stat-card {
  transition: all 0.2s ease-in-out;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* Loading animation */
@keyframes pulse-slow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse .bg-gray-200 {
  animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Dark mode specific styles */
.dark .stat-card {
  background-color: rgb(31 41 55);
  border-color: rgb(55 65 81);
}
</style>