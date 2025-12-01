// src/App.vue - Main application component
<template>
  <div id="app" class="warp-page transition-colors">
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>

    <!-- Global loading indicator -->
    <Teleport to="body">
      <div
        v-if="globalStore.isLoading"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div class="card rounded-2xl p-6 shadow-warp-md bg-warp-surface">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-warp-accent mx-auto"></div>
          <p class="mt-4 text-warp-muted text-sm">{{ globalStore.loadingMessage }}</p>
        </div>
      </div>
    </Teleport>

    <!-- Global notifications -->
    <Teleport to="body">
      <div class="fixed top-4 right-4 z-40 space-y-2">
        <div
          v-for="notification in globalStore.notifications"
          :key="notification.id"
          :class="[
            'notification text-white p-4 rounded-lg shadow-warp-md max-w-sm animate-slide-in',
            notification.type === 'error' ? 'bg-red-600/95' :
            notification.type === 'success' ? 'bg-emerald-600/95' : 'bg-warp-accent/95'
          ]"
        >
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">{{ notification.message }}</p>
            <button
              @click="globalStore.removeNotification(notification.id)"
              class="ml-2 text-white hover:text-gray-200 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useGlobalStore } from './stores/global'

const globalStore = useGlobalStore()

onMounted(async () => {
  // Проверка аутентификации опциональна, но сохраняем для админ-функций
  if (localStorage.getItem('token')) {
    await globalStore.checkAuth()
  } else {
    // Устанавливаем базовый доступ для неаутентифицированных пользователей
    globalStore.setGuestAccess()
  }

  // Set up dark mode detection
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  globalStore.setDarkMode(mediaQuery.matches)

  mediaQuery.addEventListener('change', (e) => {
    globalStore.setDarkMode(e.matches)
  })

  // Set up network status monitoring
  window.addEventListener('online', () => {
    globalStore.setOnline(true)
  })

  window.addEventListener('offline', () => {
    globalStore.setOnline(false)
  })
})
</script>

<style scoped>
.notification {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
