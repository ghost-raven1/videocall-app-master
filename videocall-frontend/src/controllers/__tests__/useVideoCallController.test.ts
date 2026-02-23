/**
 * Tests for useVideoCallController
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useVideoCallController } from '../video-call/useVideoCallController'
import { createPinia, setActivePinia } from 'pinia'
import { useWebRTCStore } from '@/stores/webrtc'
import { useRoomsStore } from '@/stores/rooms'
import { useGlobalStore } from '@/stores/global'
import { useRoute, useRouter } from 'vue-router'
import { useMediaController } from '../video-call/useMediaController'

// Mock stores
vi.mock('@/stores/webrtc', () => ({
  useWebRTCStore: vi.fn()
}))

vi.mock('@/stores/rooms', () => ({
  useRoomsStore: vi.fn()
}))

vi.mock('@/stores/global', () => ({
  useGlobalStore: vi.fn()
}))

// Mock Vue Router
vi.mock('vue-router', () => ({
  useRoute: vi.fn(),
  useRouter: vi.fn()
}))

// Mock sub-controllers
vi.mock('../video-call/useCallStateController', () => ({
  useCallStateController: vi.fn(() => ({
    startCall: vi.fn(),
    endCall: vi.fn(),
    setConnectingMessage: vi.fn(),
    setConnectionProgress: vi.fn(),
    updateConnectionState: vi.fn(),
    reset: vi.fn()
  }))
}))

vi.mock('../video-call/useMediaController', () => ({
  useMediaController: vi.fn(() => ({
    initializeMedia: vi.fn().mockResolvedValue({ success: true }),
    stopMedia: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.mock('../video-call/useScreenShareController', () => ({
  useScreenShareController: vi.fn(() => ({
    isScreenSharing: { value: false },
    stopScreenShare: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn()
  }))
}))

describe('useVideoCallController', () => {
  let controller: ReturnType<typeof useVideoCallController>
  let mockWebRTCStore: any
  let mockRoomsStore: any
  let mockGlobalStore: any
  let mockRouter: any

  beforeEach(() => {
    setActivePinia(createPinia())

    // Mock route
    vi.mocked(useRoute).mockReturnValue({
      params: { roomId: 'test-room-123' }
    } as any)

    // Mock router
    mockRouter = {
      push: vi.fn()
    }
    vi.mocked(useRouter).mockReturnValue(mockRouter as any)

    // Mock WebRTC store
    mockWebRTCStore = {
      connectionState: 'new',
      isConnected: false,
      connectWebSocket: vi.fn().mockResolvedValue(undefined),
      endCall: vi.fn().mockResolvedValue(undefined)
    }

    // Mock Rooms store
    mockRoomsStore = {
      getRoomInfo: vi.fn().mockResolvedValue({
        success: true,
        room: { room_id: 'test-room-123', name: 'Test Room', short_code: 'ABC123' }
      }),
      joinRoom: vi.fn().mockResolvedValue({ success: true }),
      leaveRoom: vi.fn().mockResolvedValue(undefined)
    }

    // Mock Global store
    mockGlobalStore = {
      addNotification: vi.fn()
    }

    vi.mocked(useWebRTCStore).mockReturnValue(mockWebRTCStore as any)
    vi.mocked(useRoomsStore).mockReturnValue(mockRoomsStore as any)
    vi.mocked(useGlobalStore).mockReturnValue(mockGlobalStore as any)
    vi.mocked(useMediaController).mockReturnValue({
      initializeMedia: vi.fn().mockResolvedValue({ success: true, fallbackMode: null }),
      stopMedia: vi.fn().mockResolvedValue(undefined),
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      controller = useVideoCallController()

      expect(controller.roomInfo.value).toBeNull()
      expect(controller.isInitialized.value).toBe(false)
      expect(controller.callState).toBeDefined()
      expect(controller.media).toBeDefined()
      expect(controller.screenShare).toBeDefined()
    })

    it('should use provided room ID', () => {
      controller = useVideoCallController('custom-room-id')
      expect(controller).toBeDefined()
    })
  })

  describe('initializeCall', () => {
    it('should initialize call successfully', async () => {
      controller = useVideoCallController('test-room-123')

      const result = await controller.initializeCall()

      expect(result.success).toBe(true)
      expect(mockRoomsStore.getRoomInfo).toHaveBeenCalledWith('test-room-123')
      expect(mockRoomsStore.joinRoom).toHaveBeenCalledWith('ABC123')
      expect(controller.isInitialized.value).toBe(true)
      expect(controller.roomInfo.value).toBeDefined()
    })

    it('should fail when room ID is missing', async () => {
      vi.mocked(useRoute).mockReturnValue({
        params: {}
      } as any)

      controller = useVideoCallController()

      const result = await controller.initializeCall()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Room ID is required')
    })

    it('should handle room not found error', async () => {
      mockRoomsStore.getRoomInfo.mockResolvedValue({
        success: false,
        error: 'Room not found'
      })

      controller = useVideoCallController('non-existent-room')

      const result = await controller.initializeCall()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Room not found')
      expect(mockRouter.push).toHaveBeenCalledWith('/')
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'Room not found or expired',
        'error'
      )
    })

    it('should handle media initialization failure', async () => {
      vi.mocked(useMediaController).mockReturnValue({
        initializeMedia: vi.fn().mockResolvedValue({
          success: false,
          error: 'Permission denied'
        }),
        stopMedia: vi.fn()
      } as any)

      controller = useVideoCallController('test-room-123')

      const result = await controller.initializeCall()

      expect(result.success).toBe(true)
      expect(result.fallbackMode).toBe('chat_only')
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'Camera/microphone unavailable. Joined in chat-only mode.',
        'warning',
        7000
      )
    })

    it('should handle join room failure', async () => {
      mockRoomsStore.joinRoom.mockResolvedValue({ success: false, error: 'Room is closed' })

      controller = useVideoCallController('test-room-123')

      const result = await controller.initializeCall()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Room is closed')
      expect(mockRouter.push).toHaveBeenCalledWith('/')
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith('Room is closed', 'error')
    })

    it('should handle WebSocket connection failure', async () => {
      mockWebRTCStore.connectWebSocket.mockRejectedValue(
        new Error('WebSocket connection failed')
      )

      controller = useVideoCallController('test-room-123')

      const result = await controller.initializeCall()

      expect(result.success).toBe(false)
      expect(result.error).toBe('WebSocket connection failed')
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'Failed to connect to room. Please try again.',
        'error'
      )
    })

    it('should handle general errors', async () => {
      mockRoomsStore.getRoomInfo.mockRejectedValue(
        new Error('Network error')
      )

      controller = useVideoCallController('test-room-123')

      const result = await controller.initializeCall()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
      expect(mockRouter.push).toHaveBeenCalledWith('/')
    })
  })

  describe('handleEndCall', () => {
    it('should end call successfully', async () => {
      controller = useVideoCallController('test-room-123')
      await controller.initializeCall()

      mockWebRTCStore.isConnected = true
      window.confirm = vi.fn().mockReturnValue(true)

      await controller.handleEndCall()

      expect(mockWebRTCStore.endCall).toHaveBeenCalled()
      expect(mockRoomsStore.leaveRoom).toHaveBeenCalled()
      expect(mockRouter.push).toHaveBeenCalledWith('/')
    })

    it('should cancel end call if user declines', async () => {
      controller = useVideoCallController('test-room-123')
      await controller.initializeCall()

      mockWebRTCStore.isConnected = true
      window.confirm = vi.fn().mockReturnValue(false)

      await controller.handleEndCall()

      expect(mockWebRTCStore.endCall).not.toHaveBeenCalled()
      expect(mockRouter.push).not.toHaveBeenCalled()
    })

    it('should end call without confirmation if not connected', async () => {
      controller = useVideoCallController('test-room-123')
      await controller.initializeCall()

      mockWebRTCStore.isConnected = false

      await controller.handleEndCall()

      expect(mockWebRTCStore.endCall).toHaveBeenCalled()
      expect(mockRouter.push).toHaveBeenCalledWith('/')
    })

    it('should stop screen sharing when ending call', async () => {
      const { useScreenShareController } = await import('../video-call/useScreenShareController')
      const stopScreenShareMock = vi.fn().mockResolvedValue(undefined)
      
      vi.mocked(useScreenShareController).mockReturnValue({
        isScreenSharing: { value: true },
        stopScreenShare: stopScreenShareMock,
        reset: vi.fn()
      } as any)

      controller = useVideoCallController('test-room-123')
      await controller.initializeCall()

      await controller.handleEndCall()

      expect(stopScreenShareMock).toHaveBeenCalled()
    })

    it('should handle errors when ending call', async () => {
      controller = useVideoCallController('test-room-123')
      await controller.initializeCall()

      mockWebRTCStore.endCall.mockRejectedValue(new Error('End call failed'))

      await controller.handleEndCall()

      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'Error ending call',
        'error'
      )
    })
  })

  describe('refreshConnection', () => {
    it('should refresh connection successfully', async () => {
      controller = useVideoCallController('test-room-123')
      await controller.initializeCall()

      await controller.refreshConnection()

      expect(mockWebRTCStore.endCall).toHaveBeenCalled()
      expect(mockRoomsStore.getRoomInfo).toHaveBeenCalled()
    })

    it('should handle refresh errors', async () => {
      controller = useVideoCallController('test-room-123')
      await controller.initializeCall()

      mockRoomsStore.getRoomInfo.mockRejectedValue(new Error('Refresh failed'))

      await controller.refreshConnection()

      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'Failed to refresh connection',
        'error'
      )
    })
  })

  describe('reset', () => {
    it('should reset all state', () => {
      controller = useVideoCallController('test-room-123')
      controller.roomInfo.value = { room_id: 'test' }
      controller.isInitialized.value = true

      controller.reset()

      expect(controller.roomInfo.value).toBeNull()
      expect(controller.isInitialized.value).toBe(false)
    })
  })
})
