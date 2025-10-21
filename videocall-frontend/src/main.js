// src/main.js - Vue.js application entry point with PWA support
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import ru from './locales/ru';
import en from './locales/en';
import router from './router'
import App from './App.vue'
import { apiService } from './services/api'
import { errorReportingService, ErrorReportingPlugin } from './services/error-reporting'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

// Global error handler for Vue application errors
app.config.errorHandler = (error, instance, info) => {
  console.error('Vue Error Handler:', {
    error: error.message,
    stack: error.stack,
    component: instance?.$?.type?.name || 'Unknown',
    info,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  })

  // Report to error reporting service
  errorReportingService.captureError(error, {
    type: 'vue-error',
    component: instance?.$?.type?.name || 'Unknown',
    info,
    severity: 'error',
  })

  // Show user-friendly error notification
  const globalStore = useGlobalStore()
  globalStore.addNotification(
    'An unexpected error occurred. Please refresh the page if the problem persists.',
    'error',
    8000
  )
}

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', {
    reason: event.reason?.message || event.reason,
    stack: event.reason?.stack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  })

  // Report to error reporting service
  errorReportingService.captureError(event.reason, {
    type: 'unhandled-rejection',
    severity: 'error',
  })

  // Show user-friendly error notification
  const globalStore = useGlobalStore()
  globalStore.addNotification(
    'A background operation failed. Please try again or refresh the page.',
    'error',
    8000
  )

  // Prevent the default browser behavior (logging to console)
  event.preventDefault()
})

// Global handler for JavaScript errors
window.addEventListener('error', (event) => {
  console.error('Global JavaScript Error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  })

  // Report to error reporting service
  errorReportingService.captureError(event.error || new Error(event.message), {
    type: 'javascript-error',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    severity: 'error',
  })

  // Show user-friendly error notification for script errors
  if (event.filename && !event.filename.includes('chrome-extension')) {
    const globalStore = useGlobalStore()
    globalStore.addNotification(
      'A script error occurred. Please refresh the page if the problem persists.',
      'error',
      8000
    )
  }
})

// Initialize i18n first with default settings
const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'ru',
  fallbackLocale: 'en',
  messages: {
    en: en,
    ru: ru
  }
})

app.use(pinia)
app.use(router)
app.use(i18n)
app.use(ErrorReportingPlugin)

// Now initialize the global store and set up language synchronization
const globalStore = useGlobalStore()
globalStore.initializeLanguage()

// Listen for language changes from store and update i18n
window.addEventListener('language-changed', (event) => {
  i18n.global.locale.value = event.detail.language
})

// Initialize API service with CSRF token
apiService
  .initialize()
  .then(() => {
    console.log('API service initialized')
  })
  .catch((error) => {
    console.warn('Failed to initialize API service:', error)
  })

app.mount('#app')

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  // Use dynamic import to handle virtual modules
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        onNeedRefresh() {
          // Show update available notification
          console.log('App update available')

          // You can show a custom notification here
          const shouldUpdate = confirm('New version available! Click OK to update.')
          if (shouldUpdate) {
            updateSW(true)
          }
        },
        onOfflineReady() {
          console.log('App ready for offline use')

          // Optional: Show offline ready notification
          // You can integrate this with your notification system
        },
        onRegisterError(error) {
          console.error('Service Worker registration failed:', error)
        },
      })

      // Optional: Periodic update checks (every 60 seconds)
      setInterval(() => {
        updateSW()
      }, 60000)
    })
    .catch((error) => {
      console.error('Failed to register service worker:', error)
    })
}

// Network status monitoring for PWA
window.addEventListener('online', () => {
  console.log('App is online')
})

window.addEventListener('offline', () => {
  console.log('App is offline')
})

// Install prompt handling
let deferredPrompt
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault()
  // Stash the event so it can be triggered later
  deferredPrompt = e
  console.log('PWA install prompt available')
})

// Handle app installation
window.addEventListener('appinstalled', () => {
  console.log('PWA was installed')
  deferredPrompt = null
})

// Export install prompt function for components to use
window.showInstallPrompt = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log(`User response to install prompt: ${outcome}`)
    deferredPrompt = null
    return outcome === 'accepted'
  }
  return false
}
