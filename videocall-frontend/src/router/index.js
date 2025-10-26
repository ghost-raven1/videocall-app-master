// src/router/index.js - Complete Vue Router configuration with auth guards and transitions
import { createRouter, createWebHistory } from 'vue-router'
import { useGlobalStore } from '../stores/global'
import { useRoomsStore } from '../stores/rooms'

// Lazy load components for better performance using code splitting
const LoginForm = () => import(/* webpackChunkName: "login" */ '../components/LoginForm.vue')
const Dashboard = () => import(/* webpackChunkName: "dashboard" */ '../components/Dashboard.vue')
const VideoCall = () => import(/* webpackChunkName: "video-call" */ '../components/VideoCall.vue')
const NotFound = () => import(/* webpackChunkName: "not-found" */ '../components/NotFound.vue')
const JoinRoom = () => import(/* webpackChunkName: "join-room" */ '../components/JoinRoom.vue')
const LandingPage = () => import(/* webpackChunkName: "landing-page" */ '../components/LandingPage.vue')
const CallActions = () => import(/* webpackChunkName: "call-actions" */ '../components/CallActions.vue')

// Lazy load admin components
const AdminLayout = () => import('../admin/components/admin-layout/AdminLayout.vue')
const AdminDashboard = () => import('../admin/views/AdminDashboard.vue')
const AdminRooms = () => import('../admin/views/AdminRooms.vue')
const AdminUsers = () => import('../admin/views/AdminUsers.vue')
const AdminSettings = () => import('../admin/views/AdminSettings.vue')
const AdminAnalytics = () => import('../admin/views/AdminAnalytics.vue')

// Lazy load additional admin components
const UserManagement = () => import('../admin/components/user-management/UserManagement.vue')
const UserList = () => import('../admin/components/user-management/UserList.vue')
const UserEdit = () => import('../admin/components/user-management/UserEdit.vue')
const UserActivity = () => import('../admin/components/user-management/UserActivity.vue')
const RoomList = () => import('../admin/components/room-management/RoomList.vue')
const RoomDetails = () => import('../admin/components/room-management/RoomDetails.vue')
const RoomForceClose = () => import('../admin/components/room-management/RoomForceClose.vue')
const RoomStats = () => import('../admin/components/room-management/RoomStats.vue')
const AnalyticsCharts = () => import('../admin/components/analytics-monitoring/AnalyticsCharts.vue')
const SystemMetrics = () => import('../admin/components/analytics-monitoring/SystemMetrics.vue')

// Route definitions with comprehensive metadata
const routes = [
  {
    path: '/',
    name: 'CallActions',
    component: CallActions,
    meta: {
      requiresAuth: false,
      title: 'Создать или присоединиться к звонку',
      description: 'Создайте новый звонок или присоединитесь к существующему',
      showInNav: false,
    },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: {
      requiresAuth: false, // Изменено для прямого доступа
      title: 'Video Call Dashboard',
      description: 'Create or join video calls',
      showInNav: true,
      icon: 'home',
    },
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginForm,
    meta: {
      requiresAuth: false,
      title: 'Sign In - Video Call',
      description: 'Access the video calling platform',
      hideForAuth: true, // Hide this route if user is already authenticated
      showInNav: false,
    },
  },
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('../components/AdminLogin.vue'),
    meta: {
      requiresAuth: false,
      title: 'Вход в админ-панель',
      description: 'Вход в панель управления',
      showInNav: false,
    },
  },
  {
    path: '/admin',
    redirect: '/admin/login',
  },
  {
    path: '/call/:roomId',
    name: 'VideoCall',
    component: VideoCall,
    meta: {
      requiresAuth: true,
      title: 'Video Call',
      description: 'Active video call session',
      showInNav: false,
      fullScreen: true,
      preventLeave: true, // Show confirmation before leaving
    },
    props: true,
    beforeEnter: async (to, from, next) => {
      // Validate room ID format (UUID v4)
      const roomIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

      if (!roomIdPattern.test(to.params.roomId)) {
        console.warn('Invalid room ID format:', to.params.roomId)
        next({ name: 'NotFound' })
        return
      }

      next()
    },
  },
  {
    path: '/join/:shortCode',
    name: 'JoinRoom',
    component: JoinRoom,
    meta: {
      requiresAuth: true,
      title: 'Join Room',
      description: 'Join video call by room code',
      showInNav: false,
    },
    props: true,
    beforeEnter: (to, from, next) => {
      // Validate short code format (6-8 alphanumeric characters)
      const shortCodePattern = /^[A-Z0-9]{6,8}$/i

      if (!shortCodePattern.test(to.params.shortCode)) {
        console.warn('Invalid short code format:', to.params.shortCode)
        next({ name: 'NotFound' })
        return
      }

      next()
    },
  },
  {
    path: '/room/:identifier',
    redirect: (to) => {
      // Redirect old room URLs to appropriate new format
      const identifier = to.params.identifier

      // Check if it looks like a UUID (room ID)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (uuidPattern.test(identifier)) {
        return { name: 'VideoCall', params: { roomId: identifier } }
      }

      // Otherwise assume it's a short code
      return { name: 'JoinRoom', params: { shortCode: identifier } }
    },
  },
  // {
  //   path: '/privacy',
  //   name: 'Privacy',
  //   component: () => import('../components/Privacy.vue'),
  //   meta: {
  //     requiresAuth: false,
  //     title: 'Privacy Policy',
  //     description: 'Our privacy policy and data handling practices',
  //     showInNav: true,
  //     icon: 'shield',
  //   },
  // },
  // {
  //   path: '/terms',
  //   name: 'Terms',
  //   component: () => import('../components/Terms.vue'),
  //   meta: {
  //     requiresAuth: false,
  //     title: 'Terms of Service',
  //     description: 'Terms and conditions of use',
  //     showInNav: true,
  //     icon: 'document',
  //   },
  // },
  // {
  //   path: '/help',
  //   name: 'Help',
  //   component: () => import('../components/Help.vue'),
  //   meta: {
  //     requiresAuth: false,
  //     title: 'Help & Support',
  //     description: 'Get help with using the video calling platform',
  //     showInNav: true,
  //     icon: 'question',
  //   },
  // },
  // Admin login route
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('../admin/views/AdminLogin.vue'),
    meta: {
      requiresAuth: false,
      title: 'Вход в админ-панель',
      description: 'Страница входа в панель администратора',
      showInNav: false,
    }
  },
  {
    path: '/room/:id',
    name: 'Room',
    component: VideoCall,
    meta: {
      requiresAuth: false, // Изменено для прямого доступа
      title: 'Video Call Room',
      description: 'Secure video conferencing room',
      showInNav: false,
    },
  },
  // Admin routes (lazy loaded for better performance)
  {
    path: '/admin',
    name: 'Admin',
    component: AdminLayout,
    meta: {
      requiresAuth: true,
      isAdmin: true,
      title: 'Админ-панель',
      description: 'Панель управления видеозвонками',
      showInNav: false, // Admin panel has its own navigation
      breadcrumb: 'Админ-панель',
    },
    children: [
      {
        path: '',
        name: 'AdminDashboard',
        component: AdminDashboard,
        meta: {
          title: 'Панель управления',
          description: 'Главная страница админ-панели',
          breadcrumb: 'Панель управления',
        },
      },
      {
        path: 'rooms',
        name: 'AdminRooms',
        component: AdminRooms,
        meta: {
          title: 'Управление комнатами',
          description: 'Создание и управление комнатами',
          breadcrumb: 'Комнаты',
        },
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: AdminUsers,
        meta: {
          title: 'Управление пользователями',
          description: 'Управление пользователями системы',
          breadcrumb: 'Пользователи',
        },
      },
      {
        path: 'analytics',
        name: 'AdminAnalytics',
        component: AdminAnalytics,
        meta: {
          title: 'Аналитика',
          description: 'Статистика и аналитика системы',
          breadcrumb: 'Аналитика',
        },
      },
      {
        path: 'settings',
        name: 'AdminSettings',
        component: AdminSettings,
        meta: {
          title: 'Настройки',
          description: 'Системные настройки',
          breadcrumb: 'Настройки',
        },
      },
      // User Management Routes
      {
        path: 'users/management',
        name: 'UserManagement',
        component: UserManagement,
        meta: {
          title: 'Управление пользователями',
          description: 'Полное управление пользователями системы',
          breadcrumb: 'Управление пользователями',
        },
      },
      {
        path: 'users/list',
        name: 'UserList',
        component: UserList,
        meta: {
          title: 'Список пользователей',
          description: 'Список всех пользователей с пагинацией',
          breadcrumb: 'Список пользователей',
        },
      },
      {
        path: 'users/edit/:id?',
        name: 'UserEdit',
        component: UserEdit,
        meta: {
          title: 'Редактирование пользователя',
          description: 'Создание или редактирование пользователя',
          breadcrumb: 'Редактирование',
        },
      },
      {
        path: 'users/activity/:id',
        name: 'UserActivity',
        component: UserActivity,
        meta: {
          title: 'Активность пользователя',
          description: 'Детальная информация об активности пользователя',
          breadcrumb: 'Активность',
        },
      },
      {
        path: 'rooms/list',
        name: 'RoomList',
        component: RoomList,
        meta: {
          title: 'Список комнат',
          description: 'Список всех комнат',
          breadcrumb: 'Список комнат',
        },
      },
      {
        path: 'rooms/details/:id',
        name: 'RoomDetails',
        component: RoomDetails,
        meta: {
          title: 'Детали комнаты',
          description: 'Детальная информация о комнате',
          breadcrumb: 'Детали комнаты',
        },
      },
      {
        path: 'rooms/force-close/:id',
        name: 'RoomForceClose',
        component: RoomForceClose,
        meta: {
          title: 'Принудительное закрытие',
          description: 'Принудительное закрытие комнаты',
          breadcrumb: 'Закрытие комнаты',
        },
      },
      {
        path: 'rooms/stats/:id',
        name: 'RoomStats',
        component: RoomStats,
        meta: {
          title: 'Статистика комнаты',
          description: 'Детальная статистика комнаты',
          breadcrumb: 'Статистика',
        },
      },
      // Analytics and Monitoring Routes
      {
        path: 'analytics/charts',
        name: 'AnalyticsCharts',
        component: AnalyticsCharts,
        meta: {
          title: 'Графики аналитики',
          description: 'Детальные графики и аналитика',
          breadcrumb: 'Графики',
        },
      },
      {
        path: 'analytics/metrics',
        name: 'SystemMetrics',
        component: SystemMetrics,
        meta: {
          title: 'Системные метрики',
          description: 'Мониторинг системных показателей',
          breadcrumb: 'Метрики',
        },
      },
    ],
  },
  // Catch-all route for 404
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound,
    meta: {
      requiresAuth: false,
      title: '404 - Page Not Found',
      description: 'The requested page could not be found',
      showInNav: false,
    },
  },
]

// Create router instance with configuration
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // Handle scroll behavior for different scenarios
    if (savedPosition) {
      // When using browser back/forward buttons
      return savedPosition
    } else if (to.hash) {
      // When navigating to an anchor
      return { el: to.hash, behavior: 'smooth' }
    } else if (to.name !== from.name) {
      // When navigating to a different page
      return { top: 0, behavior: 'smooth' }
    }
    // Otherwise maintain current scroll position
    return {}
  },
  // Configure link active classes
  linkActiveClass: 'router-link-active',
  linkExactActiveClass: 'router-link-exact-active',
  // Add page transition settings
  pageTransition: {
    name: 'page',
    mode: 'out-in',
    appear: true,
    css: true
  }
})

// Global navigation guards
router.beforeEach(async (to, from, next) => {
  const globalStore = useGlobalStore()
  const roomsStore = useRoomsStore()

  console.log(`Navigating from ${from.name} to ${to.name}`)

  // Set document title and meta tags
  updateDocumentMeta(to)

  // Handle loading state
  if (to.name !== from.name) {
    globalStore.setLoading(true, 'Loading page...')
  }

  // Check authentication requirement
  const hideForAuth = to.meta.hideForAuth
  const isAuthenticated = globalStore.isAuthenticated

  // If route should be hidden for authenticated users
  if (hideForAuth && isAuthenticated) {
    const redirectTo = to.query.redirect || from.fullPath || '/'
    next(redirectTo)
    return
  }

  // Authentication check removed to allow direct access

  // Check admin permissions
  if (to.meta.isAdmin) {
    // In real app, check if user has admin role
    const isAdmin = globalStore.user?.role === 'admin' || globalStore.user?.is_staff
    const isAdminAuthenticated = localStorage.getItem('admin_authenticated') === 'true'
    
    if (!isAdmin && !isAdminAuthenticated) {
      console.warn('Access denied: Admin permissions required')
      globalStore.addNotification('Доступ запрещен: требуются права администратора', 'error', 5000)
      next({ name: 'AdminLogin' })
      return
    }
  }
  
  // Redirect from admin root to admin login if not authenticated
  if (to.path === '/admin' && !localStorage.getItem('admin_authenticated')) {
    next({ name: 'AdminLogin' })
    return
  }

  // Handle special route logic
  await handleSpecialRoutes(to, from, next, { globalStore, roomsStore })
})


router.beforeResolve(async (to, from, next) => {
  // This runs after all in-component guards and async route components are resolved
  console.log(`Resolving route: ${to.name}`)
  next()
})

router.afterEach((to, from, failure) => {
  const globalStore = useGlobalStore()

  // Clear loading state
  globalStore.setLoading(false)

  if (failure) {
    console.error('Navigation failed:', failure)
    globalStore.addNotification('Navigation failed', 'error', 3000)
  } else {
    console.log(`Successfully navigated to ${to.name}`)

    // Track page view (could integrate with analytics here)
    trackPageView(to)
  }

  // Handle route-specific post-navigation logic
  handlePostNavigation(to, from)
})

// Route-specific handlers
async function handleSpecialRoutes(to, from, next, { globalStore, roomsStore }) {
  switch (to.name) {
    case 'VideoCall':
      // Special handling for video call routes
      if (from.name !== 'JoinRoom' && from.name !== 'Dashboard') {
        // If coming from external source, show warning about media permissions
        globalStore.addNotification(
          'Please allow camera and microphone access when prompted',
          'info',
          5000,
        )
      }
      break

    case 'JoinRoom':
      // Check if we already have room info
      const shortCode = to.params.shortCode
      if (roomsStore.currentRoom?.short_code === shortCode) {
        // Redirect directly to video call if already in this room
        next({ name: 'VideoCall', params: { roomId: roomsStore.currentRoom.room_id } })
        return
      }
      break

    case 'Dashboard':
      // Load room history when entering dashboard
      roomsStore.loadHistory()
      break
  }

  next()
}

function updateDocumentMeta(to) {
  // Update document title
  if (to.meta.title) {
    document.title = to.meta.title
  }

  // Update meta description
  if (to.meta.description) {
    let metaDescription = document.querySelector('meta[name="description"]')
    if (!metaDescription) {
      metaDescription = document.createElement('meta')
      metaDescription.setAttribute('name', 'description')
      document.head.appendChild(metaDescription)
    }
    metaDescription.setAttribute('content', to.meta.description)
  }

  // Update Open Graph tags
  updateOpenGraphTags(to)
}

function updateOpenGraphTags(to) {
  const ogTags = [
    { property: 'og:title', content: to.meta.title },
    { property: 'og:description', content: to.meta.description },
    { property: 'og:url', content: window.location.href },
  ]

  ogTags.forEach(({ property, content }) => {
    if (!content) return

    let tag = document.querySelector(`meta[property="${property}"]`)
    if (!tag) {
      tag = document.createElement('meta')
      tag.setAttribute('property', property)
      document.head.appendChild(tag)
    }
    tag.setAttribute('content', content)
  })
}

function trackPageView(to) {
  // Basic page view tracking (could be enhanced with analytics)
  if (typeof gtag !== 'undefined') {
    gtag('config', 'GA_MEASUREMENT_ID', {
      page_title: to.meta.title,
      page_location: window.location.href,
      page_path: to.path,
    })
  }

  // Custom analytics could go here
  console.log('Page view:', {
    path: to.path,
    name: to.name,
    title: to.meta.title,
    timestamp: new Date().toISOString(),
  })
}

function handlePostNavigation(to, from) {
  // Handle route-specific post-navigation tasks

  // Add body classes for styling
  document.body.className = document.body.className
    .replace(/route-\S+/g, '') // Remove existing route classes
    .trim()

  if (to.name) {
    document.body.classList.add(`route-${to.name.toLowerCase()}`)
  }

  // Handle full-screen routes
  if (to.meta.fullScreen) {
    document.body.classList.add('fullscreen-route')
  } else {
    document.body.classList.remove('fullscreen-route')
  }

  // Handle prevent leave for important routes
  if (to.meta.preventLeave) {
    setupBeforeUnloadHandler()
  } else {
    removeBeforeUnloadHandler()
  }
}

// Prevent leaving important pages accidentally
let beforeUnloadHandler = null

function setupBeforeUnloadHandler() {
  beforeUnloadHandler = (event) => {
    const message = 'Are you sure you want to leave this video call?'
    event.preventDefault()
    event.returnValue = message
    return message
  }

  window.addEventListener('beforeunload', beforeUnloadHandler)
}

function removeBeforeUnloadHandler() {
  if (beforeUnloadHandler) {
    window.removeEventListener('beforeunload', beforeUnloadHandler)
    beforeUnloadHandler = null
  }
}

// Navigation helpers
export const navigationHelpers = {
  /**
   * Navigate to room by code or ID
   */
  async goToRoom(identifier, options = {}) {
    const { replace = false } = options

    // Determine if it's a room ID (UUID) or short code
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    const route = uuidPattern.test(identifier)
      ? { name: 'VideoCall', params: { roomId: identifier } }
      : { name: 'JoinRoom', params: { shortCode: identifier } }

    if (replace) {
      return router.replace(route)
    } else {
      return router.push(route)
    }
  },

  /**
   * Navigate back with fallback
   */
  goBack(fallbackRoute = { name: 'Dashboard' }) {
    if (window.history.length > 1) {
      router.go(-1)
    } else {
      router.push(fallbackRoute)
    }
  },

  /**
   * Get navigation items for menus
   */
  getNavigationItems(authenticated = false) {
    return routes
      .filter((route) => route.meta?.showInNav)
      .filter((route) => {
        if (route.meta?.requiresAuth && !authenticated) return false
        if (route.meta?.hideForAuth && authenticated) return false
        return true
      })
      .map((route) => ({
        name: route.name,
        path: route.path,
        title: route.meta?.title || route.name,
        icon: route.meta?.icon,
        description: route.meta?.description,
      }))
  },

  /**
   * Check if current route matches
   */
  isCurrentRoute(routeName) {
    return router.currentRoute.value.name === routeName
  },

  /**
   * Get current route info
   */
  getCurrentRoute() {
    const route = router.currentRoute.value
    return {
      name: route.name,
      path: route.path,
      params: route.params,
      query: route.query,
      meta: route.meta,
    }
  },
}

// Route transition configurations
export const routeTransitions = {
  // Default transition
  default: {
    name: 'fade',
    mode: 'out-in',
  },

  // Slide transition for mobile
  slide: {
    name: 'slide',
    mode: 'out-in',
  },

  // No transition for video calls
  none: {
    name: '',
    mode: 'out-in',
  },
}

// Route middleware system
const middlewares = {
  auth: async (to, from, next) => {
    const globalStore = useGlobalStore()

    if (!globalStore.isAuthenticated) {
      await globalStore.checkAuthentication()

      if (!globalStore.isAuthenticated) {
        next({ name: 'Login', query: { redirect: to.fullPath } })
        return
      }
    }

    next()
  },

  guest: (to, from, next) => {
    const globalStore = useGlobalStore()

    if (globalStore.isAuthenticated) {
      next({ name: 'Dashboard' })
      return
    }

    next()
  },

  validateRoom: async (to, from, next) => {
    const roomsStore = useRoomsStore()
    const roomId = to.params.roomId

    if (roomId) {
      const result = await roomsStore.getRoomInfo(roomId)

      if (!result.success) {
        next({ name: 'NotFound' })
        return
      }
    }

    next()
  },
}

// Apply middleware to routes
function applyMiddleware(to, from, next, middlewareList = []) {
  if (middlewareList.length === 0) {
    next()
    return
  }

  const middleware = middlewares[middlewareList[0]]

  if (!middleware) {
    console.warn(`Middleware ${middlewareList[0]} not found`)
    applyMiddleware(to, from, next, middlewareList.slice(1))
    return
  }

  middleware(to, from, (nextArg) => {
    if (nextArg) {
      next(nextArg)
    } else {
      applyMiddleware(to, from, next, middlewareList.slice(1))
    }
  })
}

// Error handling for navigation
router.onError((error, to, from) => {
  console.error('Router error:', error)

  const globalStore = useGlobalStore()
  globalStore.setLoading(false)

  // Handle specific error types
  if (error.name === 'ChunkLoadError') {
    // Handle code splitting errors
    globalStore.addNotification('Failed to load page. Please refresh and try again.', 'error', 8000)

    // Retry navigation after a short delay
    setTimeout(() => {
      window.location.reload()
    }, 2000)
  } else {
    globalStore.addNotification('Navigation error occurred', 'error', 5000)
  }
})

// Cleanup on app unmount
export function cleanupRouter() {
  removeBeforeUnloadHandler()
  document.body.className = document.body.className
    .replace(/route-\S+/g, '')
    .replace('fullscreen-route', '')
    .trim()
}

// Development helpers
if (import.meta.env.DEV) {
  // Add router debugging in development
  router.beforeEach((to, from, next) => {
    console.group('🧭 Router Navigation')
    console.log('From:', from.name, from.path)
    console.log('To:', to.name, to.path)
    console.log('Query:', to.query)
    console.log('Params:', to.params)
    console.log('Meta:', to.meta)
    console.groupEnd()
    next()
  })

  // Expose router to global scope for debugging
  window.__router__ = router
  window.__navigationHelpers__ = navigationHelpers
}

// Export router instance
export default router

// Export route configurations for testing
export { routes, middlewares }
