import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock global and rooms stores used by the router
vi.mock('../../stores/global', () => {
  let isAuthenticated = false
  return {
    useGlobalStore: () => ({
      isAuthenticated,
      user: null,
      setLoading: vi.fn(),
      addNotification: vi.fn(),
      async checkAuthentication () {
        // keep falsy unless tests override
        return isAuthenticated
      },
      // helper to flip auth in tests
      __setAuth: (val) => { isAuthenticated = val }
    })
  }
})

vi.mock('../../stores/rooms', () => ({
  useRoomsStore: () => ({
    loadHistory: vi.fn(),
    currentRoom: null,
    async getRoomInfo () { return { success: true } }
  })
}))

// Import router after mocks
import router from '../../router/index.js'

// Helper: valid UUID v4 (matches validator in router) - "4" at start of 3rd block
const VALID_ROOM_ID = '123e4567-e89b-42d3-a456-426614174000'

describe('Router guards', () => {
  beforeEach(() => {
    // reset admin auth flag
    localStorage.removeItem('admin_authenticated')
  })

  it('redirects unauthenticated users from requiresAuth routes to Login', async () => {
    // Ensure user is not authenticated
    const { useGlobalStore } = await import('../../stores/global')
    const global = useGlobalStore()
    global.__setAuth(false)

    await router.push('/')
    await router.isReady?.()

    // Navigate to protected VideoCall
    await router.push({ name: 'VideoCall', params: { roomId: VALID_ROOM_ID } })

    const current = router.currentRoute.value
    expect(current.name).toBe('Login')
    expect(current.query?.redirect).toBe(`/call/${VALID_ROOM_ID}`)
  })

  it('allows authenticated users to access protected routes', async () => {
    const { useGlobalStore } = await import('../../stores/global')
    const global = useGlobalStore()
    global.__setAuth(true)

    await router.push('/')
    await router.isReady?.()

    await router.push({ name: 'VideoCall', params: { roomId: VALID_ROOM_ID } })
    const current = router.currentRoute.value
    expect(current.name).toBe('VideoCall')
    expect(current.params.roomId).toBe(VALID_ROOM_ID)
  })

  it('redirects /admin to AdminLogin when admin not authenticated', async () => {
    await router.push('/')
    await router.isReady?.()

    await router.push({ path: '/admin' })
    const current = router.currentRoute.value
    expect(current.name).toBe('AdminLogin')
  })

  it('has only one AdminLogin route registered', async () => {
    const routes = router.getRoutes().filter(r => r.name === 'AdminLogin')
    expect(routes.length).toBe(1)
    expect(routes[0].path).toBe('/admin/login')
  })

  it('does not expose insecure /room/:id route', async () => {
    const insecure = router.getRoutes().find(r => r.name === 'Room')
    expect(insecure).toBeUndefined()
  })
})
