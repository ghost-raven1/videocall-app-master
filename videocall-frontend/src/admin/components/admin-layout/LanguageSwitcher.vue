<template>
  <div class="relative">
    <button
      @click="toggleLanguageMenu"
      class="flex items-center space-x-2 p-2 rounded-md text-warp-muted hover:text-warp-text hover:bg-warp-surfaceAlt transition-colors focus:outline-none focus:ring-2 focus:ring-warp-accent"
      :aria-label="$t('admin.common.language', 'Language')"
      :title="$t('admin.common.language', 'Language')"
    >
      <!-- Current language flag/icon -->
      <div class="w-6 h-4 rounded-sm overflow-hidden border border-warp-border/60">
        <img
          :src="currentLanguage.flag"
          :alt="currentLanguage.name"
          class="w-full h-full object-cover"
        />
      </div>

      <!-- Language code -->
      <span class="hidden sm:block text-sm font-medium text-warp-text">
        {{ currentLanguage.code.toUpperCase() }}
      </span>

      <!-- Dropdown arrow -->
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </button>

    <!-- Language dropdown menu -->
    <div
      v-if="showLanguageMenu"
      class="absolute right-0 mt-2 w-48 bg-warp-surface rounded-md shadow-warp-md py-1 z-50 border border-warp-border/70"
      role="menu"
      aria-labelledby="language-menu"
    >
      <div class="px-4 py-2 border-b border-warp-border/70">
        <p class="text-sm font-medium text-warp-text">
          {{ $t('admin.common.selectLanguage', 'Select Language') }}
        </p>
      </div>

      <button
        v-for="language in availableLanguages"
        :key="language.code"
        @click="switchLanguage(language.code)"
        class="flex items-center space-x-3 w-full text-left px-4 py-2 text-sm hover:bg-warp-surfaceAlt transition-colors"
        :class="{
          'bg-warp-accent2/10 text-warp-accent2': language.code === currentLanguageCode,
          'text-warp-muted': language.code !== currentLanguageCode
        }"
        role="menuitem"
        :aria-current="language.code === currentLanguageCode ? 'true' : 'false'"
      >
        <!-- Language flag -->
        <div class="w-5 h-4 rounded-sm overflow-hidden border border-warp-border/60">
          <img
            :src="language.flag"
            :alt="language.name"
            class="w-full h-full object-cover"
          />
        </div>

        <!-- Language name -->
        <span class="flex-1">{{ language.name }}</span>

        <!-- Current language indicator -->
        <svg
          v-if="language.code === currentLanguageCode"
          class="w-4 h-4 text-blue-600 dark:text-blue-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
        </svg>
      </button>
    </div>

    <!-- Click outside to close -->
    <div
      v-if="showLanguageMenu"
      class="fixed inset-0 z-40"
      @click="closeLanguageMenu"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

// Available languages configuration
const availableLanguages = [
  {
    code: 'en',
    name: 'English',
    flag: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyNCAxOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjE4IiBmaWxsPSIjMDA1MkI0Ii8+CjxyZWN0IHk9IjMiIHdpZHRoPSIyNCIgaGVpZ2h0PSIzIiBmaWxsPSJ3aGl0ZSIvPgo8cmVjdCB5PSI2IiB3aWR0aD0iMjQiIGhlaWdodD0iMyIgZmlsbD0iI0VFMTEzNyIvPgo8cmVjdCB5PSI5IiB3aWR0aD0iMjQiIGhlaWdodD0iMyIgZmlsbD0id2hpdGUiLz4KPHJlY3QgeT0iMTIiIHdpZHRoPSIyNCIgaGVpZ2h0PSIzIiBmaWxsPSIjRUUxMTM3Ii8+CjxyZWN0IHk9IjE1IiB3aWR0aD0iMjQiIGhlaWdodD0iMyIgZmlsbD0id2hpdGUiLz4KPHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMDA1MkI0Ii8+Cjwvc3ZnPgo='
  },
  {
    code: 'ru',
    name: 'Русский',
    flag: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyNCAxOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjE4IiBmaWxsPSIjRkZGRkZGIi8+CjxyZWN0IHg9IjgiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMwMDU5Q0IiLz4KPHJlY3QgeT0iOCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjEwIiBmaWxsPSIjRkYwMDAwIi8+Cjwvc3ZnPgo='
  }
]

// Reactive state
const showLanguageMenu = ref(false)

// i18n instance
const { locale } = useI18n()

// Computed properties
const currentLanguageCode = computed(() => locale.value)

const currentLanguage = computed(() =>
  availableLanguages.find(lang => lang.code === currentLanguageCode.value) || availableLanguages[0]
)

// Methods
const toggleLanguageMenu = () => {
  showLanguageMenu.value = !showLanguageMenu.value
}

const closeLanguageMenu = () => {
  showLanguageMenu.value = false
}

const switchLanguage = (languageCode) => {
  locale.value = languageCode
  closeLanguageMenu()

  // Dispatch custom event for other components to listen to
  window.dispatchEvent(new CustomEvent('language-changed', {
    detail: { language: languageCode }
  }))

  // Store language preference
  localStorage.setItem('preferred-language', languageCode)
}

// Close menu on escape key
const handleEscapeKey = (event) => {
  if (event.key === 'Escape') {
    closeLanguageMenu()
  }
}

// Initialize language from localStorage or default
const initializeLanguage = () => {
  const savedLanguage = localStorage.getItem('preferred-language')
  if (savedLanguage && availableLanguages.some(lang => lang.code === savedLanguage)) {
    locale.value = savedLanguage
  }
}

// Lifecycle hooks
onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey)
  initializeLanguage()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey)
})
</script>

<style scoped>
/* Language menu animation */
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

/* Smooth transitions */
.transition-colors {
  transition: all 0.2s ease-in-out;
}

/* Focus styles for accessibility */
button:focus {
  outline: none;
}

/* Dark mode styles */
.dark .border-gray-300 {
  border-color: rgb(55 65 81);
}

.dark .bg-white {
  background-color: rgb(31 41 55);
}

.dark .border-gray-200 {
  border-color: rgb(55 65 81);
}
</style>