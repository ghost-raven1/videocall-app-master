// src/admin/components/admin-layout/AdminSidebar.vue - Admin sidebar navigation
<template>
  <aside
    :class="[
      'admin-sidebar fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out',
      isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      !isOpen ? 'lg:w-0 lg:shadow-none' : ''
    ]"
  >
    <div class="flex flex-col h-full">
      <!-- Logo/Brand -->
      <div class="flex items-center justify-center h-16 px-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center space-x-2">
          <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </div>
          <h1 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.common.adminPanel') }}</h1>
        </div>
      </div>

      <!-- Navigation Menu -->
      <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <div
          v-for="item in navigationItems"
          :key="item.name"
          @click="handleNavigation(item.name)"
          :class="[
            'nav-item flex items-center px-4 py-3 text-sm font-medium rounded-lg cursor-pointer transition-colors duration-200',
            isActiveRoute(item.name)
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
          ]"
        >
          <component
            :is="item.icon"
            class="w-5 h-5 mr-3"
            :class="isActiveRoute(item.name) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'"
          />
          {{ item.title }}
          <span v-if="item.badge" class="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            {{ item.badge }}
          </span>
        </div>
      </nav>

      <!-- User info / Logout -->
      <div class="p-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex items-center px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
            <span class="text-white font-medium text-xs">A</span>
          </div>
          <div class="flex-1">
            <p class="font-medium">{{ $t('admin.common.administrator') }}</p>
            <p class="text-xs opacity-75">admin@example.com</p>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import {
  HomeIcon,
  UsersIcon,
  VideoCameraIcon,
  ChartBarIcon,
  CogIcon,
} from '@heroicons/vue/24/outline'

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  currentRoute: {
    type: String,
    default: ''
  }
})

// Emits
const emit = defineEmits(['toggle', 'navigate'])

// Navigation items
const navigationItems = [
  {
    name: 'AdminDashboard',
    title: $t('admin.navigation.dashboard'),
    icon: HomeIcon,
  },
  {
    name: 'AdminRooms',
    title: $t('admin.navigation.rooms'),
    icon: VideoCameraIcon,
    badge: null,
  },
  {
    name: 'AdminUsers',
    title: $t('admin.navigation.users'),
    icon: UsersIcon,
    badge: null,
  },
  {
    name: 'AdminAnalytics',
    title: $t('admin.navigation.analytics'),
    icon: ChartBarIcon,
    badge: null,
  },
  {
    name: 'AdminSettings',
    title: $t('admin.navigation.systemSettings'),
    icon: CogIcon,
    badge: null,
  },
]


// Computed
const isActiveRoute = (routeName) => {
  return props.currentRoute === routeName
}

// Methods
const handleNavigation = (routeName) => {
  emit('navigate', routeName)
}
</script>

<style scoped>
.admin-sidebar {
  /* Custom scrollbar for sidebar */
  scrollbar-width: thin;
  scrollbar-color: rgb(156 163 175) transparent;
}

.admin-sidebar::-webkit-scrollbar {
  width: 4px;
}

.admin-sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.admin-sidebar::-webkit-scrollbar-thumb {
  background-color: rgb(156 163 175);
  border-radius: 2px;
}

.nav-item {
  user-select: none;
}

.nav-item:hover {
  transform: translateX(2px);
}

/* Mobile responsive adjustments */
@media (max-width: 1024px) {
  .admin-sidebar {
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }
}
</style>
