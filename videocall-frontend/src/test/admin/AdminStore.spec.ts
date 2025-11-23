import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAdminStore } from '@/admin/stores/admin.js'

describe('AdminStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('геттер areStatsStale корректно определяет устаревание кэша', () => {
    const store = useAdminStore()
    expect(store.areStatsStale).toBe(true)

    store.cache.stats = Date.now()
    expect(store.areStatsStale).toBe(false)

    // Симулируем устаревание данных старше 5 минут
    store.cache.stats = Date.now() - 6 * 60 * 1000
    expect(store.areStatsStale).toBe(true)
  })

  it('геттер systemHealth считает процент и статус', () => {
    const store = useAdminStore()
    store.systemStatus = {
      websocket: { status: 'online', lastCheck: null },
      sfu: { status: 'offline', lastCheck: null },
      database: { status: 'online', lastCheck: null },
    }

    const health = store.systemHealth
    expect(health.percentage).toBeCloseTo((2 / 3) * 100)
    expect(['healthy', 'warning', 'critical']).toContain(health.status)
  })

  it('геттеры roomStats и userStats возвращают корректные подсчеты', () => {
    const store = useAdminStore()
    store.rooms.list = [
      { id: 'r1', status: 'active' },
      { id: 'r2', status: 'inactive' },
      { id: 'r3', status: 'error' },
      { id: 'r4', status: 'active' }
    ]
    store.users.list = [
      { id: 'u1', is_online: true, role: 'user' },
      { id: 'u2', is_online: false, role: 'admin' },
      { id: 'u3', is_online: true, role: 'admin' }
    ]

    const rs = store.roomStats
    expect(rs.total).toBe(4)
    expect(rs.active).toBe(2)
    expect(rs.inactive).toBe(1)
    expect(rs.error).toBe(1)

    const us = store.userStats
    expect(us.total).toBe(3)
    expect(us.online).toBe(2)
    expect(us.offline).toBe(1)
    expect(us.admins).toBe(2)
  })

  it('геттер isLoading отражает состояние загрузки', () => {
    const store = useAdminStore()
    store.rooms.loading = true
    expect(store.isLoading).toBe(true)

    store.rooms.loading = false
    store.users.loading = false
    store.analytics.loading = false
    store.settings.loading = false
    store.ui.loading = false
    expect(store.isLoading).toBe(false)
  })

  it('UI-действия: toggleSidebar, setActiveModal, closeModal, clearCache', () => {
    const store = useAdminStore()
    expect(store.ui.sidebarCollapsed).toBe(false)
    store.toggleSidebar()
    expect(store.ui.sidebarCollapsed).toBe(true)
    store.toggleSidebar()
    expect(store.ui.sidebarCollapsed).toBe(false)

    store.setActiveModal('settings')
    expect(store.ui.activeModal).toBe('settings')
    store.closeModal()
    expect(store.ui.activeModal).toBe(null)

    store.cache.stats = Date.now()
    store.cache.rooms = Date.now()
    store.clearCache()
    expect(store.cache.stats).toBe(null)
    expect(store.cache.rooms).toBe(null)
  })

  it('loadDashboardStats грузит данные и устанавливает кэш', async () => {
    const store = useAdminStore()
    const mockData = { activeRooms: 5, onlineUsers: 10, totalCalls: 100, serverLoad: 20 }
    store.api.get = vi.fn().mockResolvedValue({ data: mockData })

    await store.loadDashboardStats()

    expect(store.api.get).toHaveBeenCalledWith('/admin/dashboard/stats')
    expect(store.stats).toEqual(mockData)
    expect(store.cache.stats).not.toBe(null)
    expect(store.ui.loading).toBe(false)
  })

  it('loadDashboardStats не вызывает API если кэш свежий', async () => {
    const store = useAdminStore()
    store.cache.stats = Date.now()
    store.api.get = vi.fn()

    await store.loadDashboardStats()
    expect(store.api.get).not.toHaveBeenCalled()
  })

  it('exportUsers отправляет POST и возвращает результат', async () => {
    const store = useAdminStore()
    store.userManagement.filters = { role: 'admin' }
    store.api.post = vi.fn().mockResolvedValue({ data: { url: '/export.csv' } })

    const res = await store.exportUsers('csv', ['u1', 'u2'])
    expect(store.api.post).toHaveBeenCalledWith('/admin/users/export', {
      format: 'csv',
      user_ids: ['u1', 'u2'],
      filters: { role: 'admin' }
    })
    expect(res).toEqual({ success: true, data: { url: '/export.csv' } })
  })

  it('getUserActivity возвращает данные при успехе и мок при ошибке', async () => {
    const store = useAdminStore()
    store.api.get = vi.fn().mockResolvedValue({ data: { loginHistory: [1], roomActivity: [], stats: {} } })
    const ok = await store.getUserActivity('u1')
    expect(ok.loginHistory).toEqual([1])

    store.api.get = vi.fn().mockRejectedValue(new Error('fail'))
    const fallback = await store.getUserActivity('u1')
    expect(fallback.stats).toBeDefined()
    expect(Array.isArray(fallback.loginHistory)).toBe(true)
  })
})
