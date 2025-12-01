// src/stores/global.js - Global application state management
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/api'

export const useGlobalStore = defineStore('global', () => {
  // State
  const isAuthenticated = ref(false)
  const user = ref<any | null>(null)
  const isLoading = ref(false)
  const loadingMessage = ref('')
  const notifications = ref([])
  const isDarkMode = ref(false)
  const isOnline = ref(navigator.onLine)
  const currentLanguage = ref('ru')
  const availableLanguages = ref([
    { code: 'en', name: 'English' },
    { code: 'ru', name: 'Русский' }
  ])

  // Computed
  const canUseApp = computed(() => isAuthenticated.value && isOnline.value)

  // Actions
  const setAuthenticated = (value, userData: any | null = null) => {
    isAuthenticated.value = value
    user.value = userData
  }

  const setLoading = (loading, message = '') => {
    isLoading.value = loading
    loadingMessage.value = message
  }

  const addNotification = (message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random()
    const notification = { id, message, type }

    notifications.value.push(notification)

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    }

    return id
  }

  const removeNotification = (id) => {
    const index = notifications.value.findIndex((n) => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  const clearNotifications = () => {
    notifications.value = []
  }

  const setDarkMode = (dark) => {
    isDarkMode.value = dark
    document.documentElement.classList.toggle('dark', dark)
  }

  const setNetworkStatus = (online) => {
    isOnline.value = online
    if (online) {
      addNotification('Connection restored', 'success', 3000)
    } else {
      addNotification('Connection lost. Some features may not work.', 'error', 0)
    }
  }

  const checkAuth = async () => {
    try {
      setLoading(true, 'Checking authentication...')
      const response = await apiService.checkAuth()
      const userData = response.data.user || null
      setAuthenticated(response.data.authenticated, userData)

      // Listen for token expiration events
      window.addEventListener('auth:token-expired', () => {
        setAuthenticated(false)
        addNotification('Session expired. Please log in again.', 'warning', 5000)
      })

      return response.data.authenticated
    } catch (error) {
      console.error('Auth check failed:', error)
      setAuthenticated(false)
      return false
    } finally {
      setLoading(false)
    }
  }
  
  // Функция для установки гостевого доступа
  const setGuestAccess = () => {
    // Устанавливаем базовый доступ без аутентификации
    setAuthenticated(true) // Разрешаем доступ к функциям приложения
    addNotification('Вы вошли как гость. Для доступа к админ-функциям требуется авторизация.', 'info', 5000)
  }

  const login = async (password) => {
    try {
      setLoading(true, 'Authenticating...')
      const response = await apiService.login(password)

      if (response.data.success) {
        const userData = (response.data && response.data.user) || null
        setAuthenticated(true, userData)
        addNotification('Login successful', 'success', 3000)
        return { success: true }
      } else {
        return { success: false, error: 'Login failed' }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Authentication failed'
      addNotification(errorMessage, 'error', 5000)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await apiService.logout()
      setAuthenticated(false, null)
      addNotification('Logged out successfully', 'info', 3000)
    } catch (error) {
      console.error('Logout failed:', error)
      // Force logout even if API call fails
      setAuthenticated(false, null)
      addNotification('Logged out', 'info', 3000)
    }
  }

  // Language management functions
  const setLanguage = (languageCode) => {
    if (availableLanguages.value.some(lang => lang.code === languageCode)) {
      currentLanguage.value = languageCode
      localStorage.setItem('preferred-language', languageCode)

      // Dispatch custom event for components to react
      // Компоненты, использующие i18n, могут слушать это событие и обновлять локаль
      window.dispatchEvent(new CustomEvent('language-changed', {
        detail: { language: languageCode }
      }))

      addNotification(`Language switched to ${availableLanguages.value.find(l => l.code === languageCode)?.name}`, 'success', 2000)
    }
  }

  const initializeLanguage = () => {
    const savedLanguage = localStorage.getItem('preferred-language')
    const browserLanguage = navigator.language.split('-')[0]

    let languageToSet = 'ru' // default

    if (savedLanguage && availableLanguages.value.some(lang => lang.code === savedLanguage)) {
      languageToSet = savedLanguage
    } else if (availableLanguages.value.some(lang => lang.code === browserLanguage)) {
      languageToSet = browserLanguage
    }

    setLanguage(languageToSet)
  }

  const getCurrentLanguage = () => {
    return availableLanguages.value.find(lang => lang.code === currentLanguage.value) || availableLanguages.value[0]
  }

  return {
    // State
    isAuthenticated,
    user,
    isLoading,
    loadingMessage,
    notifications,
    isDarkMode,
    isOnline,
    currentLanguage,
    availableLanguages,

    // Computed
    canUseApp,

    // Actions
    setAuthenticated,
    setLoading,
    addNotification,
    removeNotification,
    clearNotifications,
    setDarkMode,
    setOnline: setNetworkStatus,
    checkAuth,
    setGuestAccess,
    login,
    logout,
    setLanguage,
    initializeLanguage,
    getCurrentLanguage,
  }
})
