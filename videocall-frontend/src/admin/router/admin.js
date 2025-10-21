// src/admin/router/admin.js - Admin panel router configuration
import { createRouter, createWebHistory } from 'vue-router'
import { useGlobalStore } from '@/stores/global'

// Lazy load admin components for better performance
const AdminLayout = () => import('../components/admin-layout/AdminLayout.vue')
const AdminDashboard = () => import('../views/AdminDashboard.vue')
const AdminRooms = () => import('../views/AdminRooms.vue')
const AdminUsers = () => import('../views/AdminUsers.vue')
const AdminSettings = () => import('../views/AdminSettings.vue')
const AdminAnalytics = () => import('../views/AdminAnalytics.vue')

// Lazy load new admin components
const UserManagement = () => import('../components/user-management/UserManagement.vue')
const UserList = () => import('../components/user-management/UserList.vue')
const UserEdit = () => import('../components/user-management/UserEdit.vue')
const UserActivity = () => import('../components/user-management/UserActivity.vue')
const RoomList = () => import('../components/room-management/RoomList.vue')
const RoomDetails = () => import('../components/room-management/RoomDetails.vue')
const RoomForceClose = () => import('../components/room-management/RoomForceClose.vue')
const RoomStats = () => import('../components/room-management/RoomStats.vue')
const AnalyticsCharts = () => import('../components/analytics-monitoring/AnalyticsCharts.vue')
const SystemMetrics = () => import('../components/analytics-monitoring/SystemMetrics.vue')

// Admin routes definition
const adminRoutes = [
  {
    path: '/admin',
    name: 'AdminLayout',
    component: AdminLayout,
    meta: {
      requiresAuth: true,
      isAdmin: true,
      title: 'Админ-панель',
      description: 'Панель управления видеозвонками',
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
]

// Create admin router instance
const adminRouter = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: adminRoutes,
  scrollBehavior(to, from, savedPosition) {
    // Handle scroll behavior for admin routes
    if (savedPosition) {
      return savedPosition
    } else if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    } else {
      return { top: 0, behavior: 'smooth' }
    }
  },
})

// Navigation guards for admin routes
adminRouter.beforeEach(async (to, from, next) => {
  const globalStore = useGlobalStore()

  console.log(`Admin navigation from ${from.name} to ${to.name}`)

  // Update document title
  if (to.meta.title) {
    document.title = `${to.meta.title} - Видеозвонки`
  }

  // Check authentication
  if (to.meta.requiresAuth && !globalStore.isAuthenticated) {
    await globalStore.checkAuthentication()

    if (!globalStore.isAuthenticated) {
      next({ name: 'Login', query: { redirect: to.fullPath } })
      return
    }
  }

  // Check admin permissions (mock implementation)
  if (to.meta.isAdmin) {
    // In real app, check if user has admin role
    const isAdmin = globalStore.user?.role === 'admin' || globalStore.user?.is_staff

    if (!isAdmin) {
      console.warn('Access denied: Admin permissions required')
      next({ name: 'Dashboard' })
      return
    }
  }

  // Show loading state for route transitions
  if (to.name !== from.name && to.name !== 'AdminLayout') {
    globalStore.setLoading(true, 'Загрузка...')
  }

  next()
})

adminRouter.beforeResolve(async (to, from, next) => {
  // This runs after all in-component guards and async route components are resolved
  console.log(`Resolving admin route: ${to.name}`)
  next()
})

adminRouter.afterEach((to, from, failure) => {
  const globalStore = useGlobalStore()

  // Clear loading state
  globalStore.setLoading(false)

  if (failure) {
    console.error('Admin navigation failed:', failure)
    globalStore.addNotification('Ошибка навигации', 'error', 3000)
  } else {
    console.log(`Successfully navigated to admin page: ${to.name}`)

    // Update breadcrumbs
    updateBreadcrumbs(to)
  }
})

// Helper function to update breadcrumbs
function updateBreadcrumbs(route) {
  const breadcrumbs = []

  // Add admin root
  if (route.matched.some(record => record.meta.isAdmin)) {
    breadcrumbs.push({
      name: 'Админ-панель',
      path: '/admin',
    })
  }

  // Add current page
  if (route.meta.breadcrumb) {
    breadcrumbs.push({
      name: route.meta.breadcrumb,
      path: route.path,
    })
  }

  // Store breadcrumbs in global store or emit event
  console.log('Breadcrumbs:', breadcrumbs)
}

// Admin navigation helpers
export const adminNavigationHelpers = {
  /**
   * Navigate to admin section
   */
  goToAdminSection(section) {
    const routes = {
       dashboard: 'AdminDashboard',
       rooms: 'AdminRooms',
       'rooms/list': 'RoomList',
       users: 'AdminUsers',
       'users/management': 'UserManagement',
       'users/list': 'UserList',
       analytics: 'AdminAnalytics',
       'analytics/charts': 'AnalyticsCharts',
       'analytics/metrics': 'SystemMetrics',
       settings: 'AdminSettings',
     }

    const routeName = routes[section]
    if (routeName) {
      return adminRouter.push({ name: routeName })
    } else {
      console.warn(`Unknown admin section: ${section}`)
    }
  },

  /**
   * Check if current route is admin route
   */
  isAdminRoute(routeName) {
    return routeName?.startsWith('Admin')
  },

  /**
   * Get admin navigation items
   */
  getAdminNavItems() {
    return [
      {
        name: 'AdminDashboard',
        title: 'Панель управления',
        icon: 'home',
        path: '/admin',
      },
      {
        name: 'AdminRooms',
        title: 'Комнаты',
        icon: 'video-camera',
        path: '/admin/rooms',
        children: [
          {
            name: 'RoomList',
            title: 'Список комнат',
            path: '/admin/rooms/list',
          },
        ]
      },
      {
        name: 'AdminUsers',
        title: 'Пользователи',
        icon: 'users',
        path: '/admin/users',
        children: [
          {
            name: 'UserManagement',
            title: 'Управление пользователями',
            path: '/admin/users/management',
          },
          {
            name: 'UserList',
            title: 'Список пользователей',
            path: '/admin/users/list',
          },
        ]
      },
      {
        name: 'AdminAnalytics',
        title: 'Аналитика',
        icon: 'chart-bar',
        path: '/admin/analytics',
        children: [
          {
            name: 'AnalyticsCharts',
            title: 'Графики аналитики',
            path: '/admin/analytics/charts',
          },
          {
            name: 'SystemMetrics',
            title: 'Системные метрики',
            path: '/admin/analytics/metrics',
          },
        ]
      },
      {
        name: 'AdminSettings',
        title: 'Настройки',
        icon: 'cog',
        path: '/admin/settings',
      },
    ]
  },

  /**
   * Get current admin route info
   */
  getCurrentAdminRoute() {
    const route = adminRouter.currentRoute.value
    return {
      name: route.name,
      path: route.path,
      params: route.params,
      query: route.query,
      meta: route.meta,
      matched: route.matched,
    }
  },
}

// Error handling for admin router
adminRouter.onError((error, to, from) => {
  console.error('Admin router error:', error)

  const globalStore = useGlobalStore()
  globalStore.setLoading(false)

  if (error.name === 'ChunkLoadError') {
    globalStore.addNotification(
      'Ошибка загрузки страницы админ-панели. Попробуйте обновить страницу.',
      'error',
      8000
    )
  } else {
    globalStore.addNotification('Ошибка навигации в админ-панели', 'error', 5000)
  }
})

// Development helpers for admin router
if (import.meta.env.DEV) {
  // Add admin router debugging in development
  adminRouter.beforeEach((to, from, next) => {
    console.group('🔧 Admin Router Navigation')
    console.log('From:', from.name, from.path)
    console.log('To:', to.name, to.path)
    console.log('Params:', to.params)
    console.log('Meta:', to.meta)
    console.groupEnd()
    next()
  })

  // Expose admin router to global scope for debugging
  window.__adminRouter__ = adminRouter
  window.__adminNavigationHelpers__ = adminNavigationHelpers
}

export default adminRouter
export { adminRoutes }