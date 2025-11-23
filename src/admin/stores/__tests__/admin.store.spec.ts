import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAdminStore } from '../../stores/admin'

// Helper to flush microtasks
const flushPromises = () => new Promise(resolve => setTimeout(resolve))

describe('Admin Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('areStatsStale getter reflects cache freshness', () => {
    const store = useAdminStore()

    // Initially stale
    expect(store.areStatsStale).toBe(true)

    // Fresh cache
    store.cache.stats = Date.now()
    expect(store.areStatsStale).toBe(false)

    // Stale after 6 minutes
    store.cache.stats = Date.now() - 6 * 60 * 1000
    expect(store.areStatsStale).toBe(true)
  })

  it('systemHealth computes percentage and status', () => {
    const store = useAdminStore()
    store.systemStatus = {
      websocket: { status: 'online', lastCheck: null },
      sfu: { status: 'offline', lastCheck: null },
      database: { status: 'online', lastCheck: null },
    }

    const health = store.systemHealth
    expect(health.percentage).toBeCloseTo((2 / 3) * 100)
    expect(['healthy', 'warning', 'critical']).toContain(health.status)
    expect(health.status).toBe('warning')
  })

  it('roomStats and userStats compute aggregates', () => {
    const store = useAdminStore()
    store.rooms.list = [
      { id: 1, status: 'active' },
      { id: 2, status: 'inactive' },
      { id: 3, status: 'error' },
      { id: 4, status: 'active' },
    ] as any
    store.users.list = [
      { id: 1, is_online: true, role: 'admin' },
      { id: 2, is_online: false, role: 'user' },
      { id: 3, is_online: true, role: 'user' },
    ] as any

    expect(store.roomStats).toEqual({ total: 4, active: 2, inactive: 1, error: 1 })
    expect(store.userStats).toEqual({ total: 3, online: 2, offline: 1, admins: 1 })
  })

  it('isLoading reflects combined loading flags', () => {
    const store = useAdminStore()
    expect(store.isLoading).toBe(false)
    store.rooms.loading = true
    expect(store.isLoading).toBe(true)
    store.rooms.loading = false
    store.ui.loading = true
    expect(store.isLoading).toBe(true)
  })

  it('UI actions toggleSidebar, setActiveModal, closeModal', () => {
    const store = useAdminStore()
    expect(store.ui.sidebarCollapsed).toBe(false)
    store.toggleSidebar()
    expect(store.ui.sidebarCollapsed).toBe(true)
    store.toggleSidebar()
    expect(store.ui.sidebarCollapsed).toBe(false)

    store.setActiveModal('test')
    expect(store.ui.activeModal).toBe('test')
    store.closeModal()
    expect(store.ui.activeModal).toBe(null)
  })

  it('clearCache resets timestamps', () => {
    const store = useAdminStore()
    store.cache = { stats: Date.now(), rooms: Date.now(), users: Date.now(), analytics: Date.now() }
    store.clearCache()
    expect(store.cache).toEqual({ stats: null, rooms: null, users: null, analytics: null })
  })

  it('loadDashboardStats: success path updates stats and cache', async () => {
    const store = useAdminStore()
    const mockData = { activeRooms: 10, onlineUsers: 20, totalCalls: 30, serverLoad: 40 }
    store.api.get = vi.fn(async () => ({ data: mockData }))

    await store.loadDashboardStats()

    expect(store.stats).toEqual(mockData)
    expect(typeof store.cache.stats).toBe('number')
    expect(store.ui.loading).toBe(false)
    expect(store.api.get).toHaveBeenCalledWith('/admin/dashboard/stats')
  })

  it('loadDashboardStats: fallback path populates mock stats', async () => {
    const store = useAdminStore()
    store.api.get = vi.fn(async () => { throw new Error('Network') })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.useFakeTimers()

    const promise = store.loadDashboardStats()
    // advance mock delay inside fallback (1000ms)
    vi.advanceTimersByTime(1000)
    await promise
    await flushPromises()

    expect(store.stats).toEqual({
      activeRooms: 10,
      onlineUsers: 50,
      totalCalls: 500,
      serverLoad: 10,
    })
    expect(store.ui.loading).toBe(false)

    vi.useRealTimers()
    randomSpy.mockRestore()
  })

  it('exportUsers calls API and returns success', async () => {
    const store = useAdminStore()
    const payload = { data: { ok: true } }
    store.api.post = vi.fn(async () => payload)

    const res = await store.exportUsers('csv', [1, 2])
    expect(res).toEqual({ success: true, data: payload.data })
    expect(store.api.post).toHaveBeenCalledWith('/admin/users/export', {
      format: 'csv',
      user_ids: [1, 2],
      filters: store.userManagement.filters,
    })
  })

  it('getUserActivity returns fallback on error', async () => {
    const store = useAdminStore()
    store.api.get = vi.fn(async () => { throw new Error('Network') })
    const activity = await store.getUserActivity(123)
    expect(activity).toHaveProperty('loginHistory')
    expect(activity).toHaveProperty('roomActivity')
    expect(activity).toHaveProperty('stats')
  })
})

