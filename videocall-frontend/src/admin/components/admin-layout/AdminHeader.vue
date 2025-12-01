// src/admin/components/admin-layout/AdminHeader.vue - Admin header component
<template>
  <header class="admin-header bg-warp-surface text-warp-text shadow-warp-sm border-b border-warp-border">
    <div class="admin-container flex items-center justify-between h-16 px-6">
      <!-- Left side - Mobile menu button and title -->
      <div class="flex items-center space-x-4">
        <!-- Mobile menu button -->
        <button
          @click="$emit('toggle-sidebar')"
          class="lg:hidden p-2 rounded-md text-warp-muted hover:text-warp-text hover:bg-warp-surface focus:outline-none focus:ring-2 focus:ring-warp-accent"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="!sidebarOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>

        <!-- Page title -->
        <h1 class="text-xl font-semibold text-warp-text lg:block hidden">
          {{ title }}
        </h1>

        <!-- Mobile title -->
        <h1 class="text-lg font-semibold text-warp-text lg:hidden">
          {{ $t('admin.common.adminPanel') }}
        </h1>
      </div>

      <!-- Right side - Actions and user menu -->
      <div class="flex items-center space-x-4">
        <!-- Search button -->
        <button class="p-2 text-warp-muted hover:text-warp-text hover:bg-warp-surface rounded-md transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </button>

        <!-- Language Switcher -->
        <LanguageSwitcher />

        <!-- Notifications -->
        <button class="relative p-2 text-warp-muted hover:text-warp-text hover:bg-warp-surface rounded-md transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5v-5zM15 17H9a6 6 0 01-6-6V7a6 6 0 016-6h6a6 6 0 016 6v4a6 6 0 01-6 6z"></path>
          </svg>
          <!-- Notification badge -->
          <span class="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            3
          </span>
        </button>

        <!-- User menu -->
        <div class="relative">
          <button
            @click="showUserMenu = !showUserMenu"
            class="flex items-center space-x-2 p-2 rounded-md text-warp-muted hover:text-warp-text hover:bg-warp-surface transition-colors focus:outline-none focus:ring-2 focus:ring-warp-accent"
          >
            <div class="w-8 h-8 bg-warp-accent rounded-full flex items-center justify-center">
              <span class="text-white font-medium text-sm">{{ userInitial }}</span>
            </div>
            <span class="hidden md:block text-sm font-medium text-warp-text">
              {{ $t('admin.common.administrator') }}
            </span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>

          <!-- User dropdown menu -->
          <div
            v-if="showUserMenu"
            class="absolute right-0 mt-2 w-48 bg-warp-surfaceAlt rounded-md shadow-lg py-1 z-50 border border-warp-border"
          >
            <div class="px-4 py-2 border-b border-warp-border">
              <p class="text-sm font-medium text-warp-text">{{ $t('admin.common.administrator') }}</p>
              <p class="text-xs text-warp-muted">{{ userEmail || '—' }}</p>
            </div>

            <button class="block w-full text-left px-4 py-2 text-sm text-warp-text hover:bg-warp-surface">
              {{ $t('admin.common.profile') }}
            </button>

            <button class="block w-full text-left px-4 py-2 text-sm text-warp-text hover:bg-warp-surface">
              {{ $t('admin.common.settings') }}
            </button>

            <button
              @click="handleLogout"
              class="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10"
            >
              {{ $t('admin.common.logout') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Click outside to close user menu -->
    <div
      v-if="showUserMenu"
      class="fixed inset-0 z-40"
      @click="showUserMenu = false"
    ></div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import { useGlobalStore } from '@/stores/global'

const globalStore = useGlobalStore()
const userEmail = computed(() => {
  const user = globalStore.user
  return user?.email || ''
})
const userInitial = computed(() => {
  const user = globalStore.user
  const email = user?.email
  if (email && email.length > 0) {
    return email.charAt(0).toUpperCase()
  }
  return 'A'
})

// Props
defineProps({
  title: {
    type: String,
    default: ''
  },
  sidebarOpen: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['toggle-sidebar', 'logout'])

// Reactive state
const showUserMenu = ref(false)

// Methods
const handleLogout = () => {
  showUserMenu.value = false
  emit('logout')
}

// Close user menu on escape key
const handleEscapeKey = (event) => {
  if (event.key === 'Escape') {
    showUserMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey)
})
</script>

<style scoped>
.admin-header {
  position: relative;
  z-index: 35;
}

.admin-container {
  max-width: 100%;
}

/* Smooth transitions */
.admin-header * {
  transition: all 0.2s ease-in-out;
}

/* Focus styles for accessibility */
.admin-header button:focus {
  outline: none;
}

/* Dark mode handled via Warp theme background; keep for potential tweaks */
.dark .admin-header {
}

/* User menu animation */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.absolute.right-0 {
  animation: slideDown 0.2s ease-out;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .admin-container {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}
</style>
