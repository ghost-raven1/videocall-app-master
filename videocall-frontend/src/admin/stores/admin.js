// src/admin/stores/admin.js - Admin panel state management with Pinia
import { defineStore } from 'pinia'
import { useGlobalStore } from '../../stores/global'

// API client for admin endpoints
const api = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      withCredentials: true, // Include httpOnly cookies for JWT
      ...options
    }

    try {
      const response = await fetch(url, config)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  },

  get(endpoint, params = {}) {
    const searchParams = new URLSearchParams(params)
    const queryString = searchParams.toString()
    const url = queryString ? `${endpoint}?${queryString}` : endpoint

    return this.request(url, { method: 'GET' })
  },

  post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' })
  }
}

export const useAdminStore = defineStore('admin', {
  state: () => ({
    // API client instance
    api,

    // Dashboard stats
    stats: {
      activeRooms: 0,
      onlineUsers: 0,
      totalCalls: 0,
      serverLoad: 0,
    },

    // System status
    systemStatus: {
      websocket: { status: 'online', lastCheck: null },
      sfu: { status: 'online', lastCheck: null },
      database: { status: 'online', lastCheck: null },
    },

    // Recent activity
    recentActivity: [],

    // Rooms management
    rooms: {
      list: [],
      loading: false,
      total: 0,
      currentPage: 1,
      perPage: 20,
    },

    // Users management
    users: {
      list: [],
      loading: false,
      total: 0,
      currentPage: 1,
      perPage: 20,
    },

    // Analytics data
    analytics: {
      callsByHour: [],
      usersByDay: [],
      roomsByStatus: [],
      loading: false,
    },

    // Settings
    settings: {
      data: {},
      loading: false,
      saving: false,
    },

    // User management state
    userManagement: {
      users: [],
      loading: false,
      saving: false,
      deleting: false,
      error: null,
      total: 0,
      currentPage: 1,
      perPage: 20,
      filters: {},
      sort: {
        field: 'username',
        direction: 'asc'
      }
    },

    // Room management state
    roomManagement: {
      rooms: [],
      loading: false,
      saving: false,
      deleting: false,
      error: null,
      total: 0,
      currentPage: 1,
      perPage: 20,
      filters: {},
      sort: {
        field: 'created_at',
        direction: 'desc'
      }
    },

    // Analytics state
    analyticsData: {
      charts: {
        callsOverTime: [],
        userActivity: [],
        peakHours: []
      },
      metrics: {
        systemHealth: {},
        performance: {},
        connections: {}
      },
      loading: false,
      error: null,
      lastUpdate: null
    },

    // Real-time monitoring
    realTimeMonitor: {
      active: false,
      data: {
        websocketConnections: 0,
        activeRooms: 0,
        cpuUsage: 0,
        memoryUsage: 0
      },
      interval: null
    },

    // UI state
    ui: {
      sidebarCollapsed: false,
      activeModal: null,
      loading: false,
    },

    // Cache timestamps
    cache: {
      stats: null,
      rooms: null,
      users: null,
      analytics: null,
    },
  }),

  getters: {
    // Check if stats are stale (older than 5 minutes)
    areStatsStale: (state) => {
      if (!state.cache.stats) return true
      return Date.now() - state.cache.stats > 5 * 60 * 1000
    },

    // Get system health status
    systemHealth: (state) => {
      const services = Object.values(state.systemStatus)
      const onlineServices = services.filter(service => service.status === 'online')
      const healthPercentage = (onlineServices.length / services.length) * 100

      return {
        percentage: healthPercentage,
        status: healthPercentage === 100 ? 'healthy' : healthPercentage > 50 ? 'warning' : 'critical',
        services: state.systemStatus,
      }
    },

    // Get room statistics
    roomStats: (state) => {
      const rooms = state.rooms.list
      return {
        total: rooms.length,
        active: rooms.filter(room => room.status === 'active').length,
        inactive: rooms.filter(room => room.status === 'inactive').length,
        error: rooms.filter(room => room.status === 'error').length,
      }
    },

    // Get user statistics
    userStats: (state) => {
      const users = state.users.list
      return {
        total: users.length,
        online: users.filter(user => user.is_online).length,
        offline: users.filter(user => !user.is_online).length,
        admins: users.filter(user => user.role === 'admin').length,
      }
    },

    // Check if any data is loading
    isLoading: (state) => {
      return state.rooms.loading ||
             state.users.loading ||
             state.analytics.loading ||
             state.settings.loading ||
             state.ui.loading
    },
  },

  actions: {
    // Dashboard actions
    async loadDashboardStats() {
      if (!this.areStatsStale) {
        console.log('Using cached stats')
        return
      }

      this.ui.loading = true

      try {
        // Real API integration
        const response = await this.api.get('/admin/dashboard/stats')
        this.stats = response.data

        this.cache.stats = Date.now()
      } catch (error) {
        console.error('Failed to load dashboard stats:', error)

        // Fallback to mock data if API fails
        await new Promise(resolve => setTimeout(resolve, 1000))

        this.stats = {
          activeRooms: Math.floor(Math.random() * 50) + 10,
          onlineUsers: Math.floor(Math.random() * 200) + 50,
          totalCalls: Math.floor(Math.random() * 1000) + 500,
          serverLoad: Math.floor(Math.random() * 40) + 10,
        }

        this.cache.stats = Date.now()
      } finally {
        this.ui.loading = false
      }
    },

    async loadSystemStatus() {
      try {
        // Mock system status check
        await new Promise(resolve => setTimeout(resolve, 500))

        this.systemStatus = {
          websocket: {
            status: Math.random() > 0.1 ? 'online' : 'offline',
            lastCheck: new Date(),
          },
          sfu: {
            status: Math.random() > 0.1 ? 'online' : 'offline',
            lastCheck: new Date(),
          },
          database: {
            status: Math.random() > 0.1 ? 'online' : 'offline',
            lastCheck: new Date(),
          },
        }
      } catch (error) {
        console.error('Failed to load system status:', error)
      }
    },

    async loadRecentActivity() {
      try {
        // Mock recent activity
        await new Promise(resolve => setTimeout(resolve, 300))

        this.recentActivity = [
          {
            id: 1,
            type: 'room_created',
            description: 'Создана новая комната: ABC123',
            timestamp: new Date(Date.now() - 2 * 60 * 1000),
          },
          {
            id: 2,
            type: 'user_login',
            description: 'Пользователь вошел в систему',
            timestamp: new Date(Date.now() - 5 * 60 * 1000),
          },
          {
            id: 3,
            type: 'room_ended',
            description: 'Завершен звонок в комнате: XYZ789',
            timestamp: new Date(Date.now() - 10 * 60 * 1000),
          },
        ]
      } catch (error) {
        console.error('Failed to load recent activity:', error)
      }
    },

    // Rooms management actions
    async loadRooms(params = {}) {
      this.rooms.loading = true

      try {
        const {
          page = 1,
          perPage = 20,
          search = '',
          status = '',
        } = params

        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 800))

        // Mock data
        const mockRooms = Array.from({ length: 25 }, (_, i) => ({
          id: i + 1,
          room_id: `room-${i + 1}`,
          short_code: `ABC${(i + 100).toString().padStart(3, '0')}`,
          name: `Комната ${i + 1}`,
          status: ['active', 'inactive', 'error'][Math.floor(Math.random() * 3)],
          participants: Math.floor(Math.random() * 10),
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          last_activity: new Date(Date.now() - Math.random() * 60 * 60 * 1000),
        }))

        this.rooms.list = mockRooms.slice((page - 1) * perPage, page * perPage)
        this.rooms.total = mockRooms.length
        this.rooms.currentPage = page
        this.rooms.perPage = perPage

        this.cache.rooms = Date.now()
      } catch (error) {
        console.error('Failed to load rooms:', error)
        throw error
      } finally {
        this.rooms.loading = false
      }
    },

    async createRoom(roomData) {
      try {
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 500))

        const newRoom = {
          id: Date.now(),
          room_id: `room-${Date.now()}`,
          short_code: `NEW${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
          name: roomData.name || 'Новая комната',
          status: 'active',
          participants: 0,
          created_at: new Date(),
          last_activity: new Date(),
        }

        this.rooms.list.unshift(newRoom)
        this.rooms.total += 1

        return { success: true, room: newRoom }
      } catch (error) {
        console.error('Failed to create room:', error)
        throw error
      }
    },

    async deleteRoom(roomId) {
      try {
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 300))

        const index = this.rooms.list.findIndex(room => room.id === roomId)
        if (index > -1) {
          this.rooms.list.splice(index, 1)
          this.rooms.total -= 1
        }

        return { success: true }
      } catch (error) {
        console.error('Failed to delete room:', error)
        throw error
      }
    },

    // Users management actions
    async loadUsers(params = {}) {
      this.users.loading = true

      try {
        const {
          page = 1,
          perPage = 20,
          search = '',
          role = '',
        } = params

        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 600))

        // Mock data
        const mockUsers = Array.from({ length: 35 }, (_, i) => ({
          id: i + 1,
          username: `user${i + 1}`,
          email: `user${i + 1}@example.com`,
          role: i === 0 ? 'admin' : ['user', 'moderator'][Math.floor(Math.random() * 2)],
          is_online: Math.random() > 0.3,
          last_login: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          created_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        }))

        this.users.list = mockUsers.slice((page - 1) * perPage, page * perPage)
        this.users.total = mockUsers.length
        this.users.currentPage = page
        this.users.perPage = perPage

        this.cache.users = Date.now()
      } catch (error) {
        console.error('Failed to load users:', error)
        throw error
      } finally {
        this.users.loading = false
      }
    },

    // Analytics actions
    async loadAnalytics() {
      this.analytics.loading = true

      try {
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Mock analytics data
        this.analytics = {
          callsByHour: Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            calls: Math.floor(Math.random() * 50),
          })),
          usersByDay: Array.from({ length: 7 }, (_, i) => ({
            day: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i],
            users: Math.floor(Math.random() * 200) + 50,
          })),
          roomsByStatus: [
            { status: 'active', count: Math.floor(Math.random() * 20) + 10 },
            { status: 'inactive', count: Math.floor(Math.random() * 15) + 5 },
            { status: 'error', count: Math.floor(Math.random() * 5) },
          ],
        }

        this.cache.analytics = Date.now()
      } catch (error) {
        console.error('Failed to load analytics:', error)
        throw error
      } finally {
        this.analytics.loading = false
      }
    },

    // Settings actions
    async loadSettings() {
      this.settings.loading = true

      try {
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 400))

        this.settings.data = {
          maxRoomParticipants: 50,
          allowGuestAccess: true,
          enableRecording: false,
          maintenanceMode: false,
          notifications: {
            email: true,
            push: true,
            sms: false,
          },
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
        throw error
      } finally {
        this.settings.loading = false
      }
    },

    async saveSettings(newSettings) {
      this.settings.saving = true

      try {
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 800))

        this.settings.data = { ...this.settings.data, ...newSettings }

        return { success: true }
      } catch (error) {
        console.error('Failed to save settings:', error)
        throw error
      } finally {
        this.settings.saving = false
      }
    },

    // UI actions
    toggleSidebar() {
      this.ui.sidebarCollapsed = !this.ui.sidebarCollapsed
    },

    setActiveModal(modalName) {
      this.ui.activeModal = modalName
    },

    closeModal() {
      this.ui.activeModal = null
    },

    // Utility actions
    clearCache() {
      this.cache = {
        stats: null,
        rooms: null,
        users: null,
        analytics: null,
      }
    },



   async exportUsers(format = 'csv', userIds = []) {
     try {
       const response = await this.api.post('/admin/users/export', {
         format,
         user_ids: userIds,
         filters: this.userManagement.filters
       })

       return { success: true, data: response.data }
     } catch (error) {
       console.error('Failed to export users:', error)
       throw error
     }
   },

    async createUser(userData) {
      this.userManagement.saving = true
      this.userManagement.error = null

      try {
        const response = await this.api.post('/admin/users', userData)

        // Add new user to the list
        this.userManagement.users.unshift(response.user)
        this.userManagement.total += 1

        return { success: true, user: response.user }
      } catch (error) {
        console.error('Failed to create user:', error)
        this.userManagement.error = 'Не удалось создать пользователя'
        throw error
      } finally {
        this.userManagement.saving = false
      }
    },

    async updateUser(userId, userData) {
      this.userManagement.saving = true
      this.userManagement.error = null

      try {
        const response = await this.api.put(`/admin/users/${userId}`, userData)

        // Update user in the list
        const index = this.userManagement.users.findIndex(u => u.id === userId)
        if (index > -1) {
          this.userManagement.users[index] = { ...this.userManagement.users[index], ...response.user }
        }

        return { success: true, user: response.user }
      } catch (error) {
        console.error('Failed to update user:', error)
        this.userManagement.error = 'Не удалось обновить пользователя'
        throw error
      } finally {
        this.userManagement.saving = false
      }
    },

    async deleteUser(userId) {
      this.userManagement.deleting = true
      this.userManagement.error = null

      try {
        await this.api.delete(`/admin/users/${userId}`)

        // Remove user from the list
        const index = this.userManagement.users.findIndex(u => u.id === userId)
        if (index > -1) {
          this.userManagement.users.splice(index, 1)
          this.userManagement.total -= 1
        }

        return { success: true }
      } catch (error) {
        console.error('Failed to delete user:', error)
        this.userManagement.error = 'Не удалось удалить пользователя'
        throw error
      } finally {
        this.userManagement.deleting = false
      }
    },

    async getUserActivity(userId) {
      try {
        const response = await this.api.get(`/admin/users/${userId}/activity`)
        return response.data
      } catch (error) {
        console.error('Failed to load user activity:', error)
        // Return mock data
        return {
          loginHistory: [],
          roomActivity: [],
          stats: {
            totalLogins: 0,
            totalRoomsJoined: 0,
            totalTimeInRooms: 0,
            lastLogin: null
          }
        }
      }
    },

    async bulkUpdateUsers(userIds, action) {
      try {
        const response = await this.api.post('/admin/users/bulk', {
          user_ids: userIds,
          action
        })

        // Reload users list
        await this.loadUsers()

        return { success: true, updated: response.updated || 0 }
      } catch (error) {
        console.error('Failed to bulk update users:', error)
        throw error
      }
    },



    async updateRoom(roomId, roomData) {
      this.roomManagement.saving = true
      this.roomManagement.error = null

      try {
        const response = await this.api.put(`/admin/rooms/${roomId}`, roomData)

        // Update room in the list
        const index = this.roomManagement.rooms.findIndex(r => r.id === roomId)
        if (index > -1) {
          this.roomManagement.rooms[index] = { ...this.roomManagement.rooms[index], ...response.room }
        }

        return { success: true, room: response.room }
      } catch (error) {
        console.error('Failed to update room:', error)
        this.roomManagement.error = 'Не удалось обновить комнату'
        throw error
      } finally {
        this.roomManagement.saving = false
      }
    },


    async forceCloseRoom(roomId, reason = '') {
      try {
        const response = await this.api.post(`/admin/rooms/${roomId}/force-close`, { reason })

        // Update room status
        const index = this.roomManagement.rooms.findIndex(r => r.id === roomId)
        if (index > -1) {
          this.roomManagement.rooms[index].status = 'inactive'
        }

        return { success: true, room: response.room }
      } catch (error) {
        console.error('Failed to force close room:', error)
        throw error
      }
    },

    async getRoomDetails(roomId) {
      try {
        const response = await this.api.get(`/admin/rooms/${roomId}`)
        return response.data
      } catch (error) {
        console.error('Failed to load room details:', error)
        throw error
      }
    },

    async getRoomStats(roomId) {
      try {
        const response = await this.api.get(`/admin/rooms/${roomId}/stats`)
        return response.data
      } catch (error) {
        console.error('Failed to load room stats:', error)
        // Return mock stats
        return {
          totalParticipants: 0,
          totalDuration: 0,
          totalSessions: 0,
          lastActivity: null
        }
      }
    },

    async bulkUpdateRooms(roomIds, action) {
      try {
        const response = await this.api.post('/admin/rooms/bulk', {
          room_ids: roomIds,
          action
        })

        // Reload rooms list
        await this.loadRooms()

        return { success: true, updated: response.updated || 0 }
      } catch (error) {
        console.error('Failed to bulk update rooms:', error)
        throw error
      }
    },

    async exportRooms(format = 'csv', roomIds = []) {
      try {
        const response = await this.api.post('/admin/rooms/export', {
          format,
          room_ids: roomIds,
          filters: this.roomManagement.filters
        })

        return { success: true, data: response.data }
      } catch (error) {
        console.error('Failed to export rooms:', error)
        throw error
      }
    },


    // Real-time monitoring
    startRealTimeMonitoring() {
      if (this.realTimeMonitor.active) return

      this.realTimeMonitor.active = true

      // Update every 5 seconds
      this.realTimeMonitor.interval = setInterval(async () => {
        try {
          const response = await this.api.get('/admin/monitoring/realtime')

          this.realTimeMonitor.data = {
            websocketConnections: response.websocket_connections || 0,
            activeRooms: response.active_rooms || 0,
            cpuUsage: response.cpu_usage || 0,
            memoryUsage: response.memory_usage || 0
          }
        } catch (error) {
          console.error('Failed to update real-time data:', error)
          // Use mock data as fallback
          this.realTimeMonitor.data = {
            websocketConnections: Math.floor(Math.random() * 20) + 140,
            activeRooms: Math.floor(Math.random() * 5) + 20,
            cpuUsage: Math.floor(Math.random() * 20) + 30,
            memoryUsage: Math.floor(Math.random() * 15) + 55
          }
        }
      }, 5000)
    },

    stopRealTimeMonitoring() {
      if (this.realTimeMonitor.interval) {
        clearInterval(this.realTimeMonitor.interval)
        this.realTimeMonitor.interval = null
      }
      this.realTimeMonitor.active = false
    },


    // Initialize admin store
    async initialize() {
      const globalStore = useGlobalStore()

      // Check if user has admin permissions
      if (!globalStore.user?.role === 'admin' && !globalStore.user?.is_staff) {
        throw new Error('Admin access required')
      }

      // Load initial data
      await Promise.all([
        this.loadDashboardStats(),
        this.loadSystemStatus(),
        this.loadRecentActivity(),
      ])

      console.log('Admin store initialized')
    },
  },
})