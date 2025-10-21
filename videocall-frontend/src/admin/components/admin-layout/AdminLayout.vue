// src/admin/components/admin-layout/AdminLayout.vue - Main admin layout component
<template>
  <div class="admin-layout min-h-screen bg-gray-100 dark:bg-gray-900">
    <!-- Sidebar -->
    <AdminSidebar
      :is-open="sidebarOpen"
      :current-route="currentRoute"
      @toggle="sidebarOpen = !sidebarOpen"
      @navigate="handleNavigation"
    />

    <!-- Main content area -->
    <div class="main-content" :class="{ 'sidebar-open': sidebarOpen }">
      <!-- Header -->
      <AdminHeader
        :title="currentRouteTitle"
        :sidebar-open="sidebarOpen"
        @toggle-sidebar="sidebarOpen = !sidebarOpen"
        @logout="handleLogout"
      />

      <!-- Page content -->
      <main class="admin-main">
        <div class="admin-container">
          <router-view />
        </div>
      </main>
    </div>

    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="mobile-overlay"
      @click="sidebarOpen = false"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGlobalStore } from '@/stores/global'
import AdminSidebar from './AdminSidebar.vue'
import AdminHeader from './AdminHeader.vue'

const router = useRouter()
const route = useRoute()
const globalStore = useGlobalStore()

// Reactive state
const sidebarOpen = ref(false)

// Computed properties
const currentRoute = computed(() => route.name)

const currentRouteTitle = computed(() => {
  const routeTitles = {
    'AdminDashboard': $t('admin.navigation.dashboard'),
    'AdminRooms': $t('admin.navigation.rooms'),
    'AdminUsers': $t('admin.navigation.users'),
    'AdminSettings': $t('admin.navigation.systemSettings'),
    'AdminAnalytics': $t('admin.navigation.analytics'),
  }
  return routeTitles[route.name] || $t('admin.common.adminPanel')
})

// Methods
const handleNavigation = (routeName) => {
  router.push({ name: routeName })
  sidebarOpen.value = false // Close sidebar on mobile after navigation
}

const handleLogout = async () => {
  await globalStore.logout()
  router.push('/login')
}

// Handle responsive behavior
const handleResize = () => {
  if (window.innerWidth >= 1024) { // lg breakpoint
    sidebarOpen.value = true
  } else {
    sidebarOpen.value = false
  }
}

onMounted(() => {
  handleResize()

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.admin-layout {
  @apply flex;
}

.main-content {
  @apply flex-1 flex flex-col transition-all duration-300 ease-in-out;
}

.main-content.sidebar-open {
  @apply lg:ml-64;
}

.admin-main {
  @apply flex-1 p-6;
}

.admin-container {
  @apply max-w-7xl mx-auto w-full;
}

.mobile-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden;
}

/* Custom scrollbar for admin panel */
.admin-main::-webkit-scrollbar {
  width: 6px;
}

.admin-main::-webkit-scrollbar-track {
  @apply bg-gray-100 dark:bg-gray-800;
}

.admin-main::-webkit-scrollbar-thumb {
  @apply bg-gray-300 dark:bg-gray-600 rounded-full;
}

.admin-main::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400 dark:bg-gray-500;
}

/* Dark mode adjustments */
.dark .admin-layout {
  @apply bg-gray-900;
}
</style>