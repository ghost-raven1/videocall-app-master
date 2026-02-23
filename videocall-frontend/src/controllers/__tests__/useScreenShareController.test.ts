/**
 * Tests for useScreenShareController
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useScreenShareController } from '../video-call/useScreenShareController'
import { createPinia, setActivePinia } from 'pinia'
import { useWebRTCStore } from '@/stores/webrtc'
import { useGlobalStore } from '@/stores/global'

// Mock stores
vi.mock('@/stores/webrtc', () => ({
  useWebRTCStore: vi.fn()
}))

vi.mock('@/stores/global', () => ({
  useGlobalStore: vi.fn()
}))

// Mock navigator.mediaDevices
const mockGetDisplayMedia = vi.fn()

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getDisplayMedia: mockGetDisplayMedia
  },
  writable: true,
  configurable: true
})

describe('useScreenShareController', () => {
  let controller: ReturnType<typeof useScreenShareController>
  let mockGlobalStore: any

  beforeEach(() => {
    setActivePinia(createPinia())

    mockGlobalStore = {
      addNotification: vi.fn()
    }

    vi.mocked(useWebRTCStore).mockReturnValue({} as any)
    vi.mocked(useGlobalStore).mockReturnValue(mockGlobalStore as any)

    controller = useScreenShareController()
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(controller.isScreenSharing.value).toBe(false)
      expect(controller.screenShareStream.value).toBeNull()
      expect(controller.isStarting.value).toBe(false)
      expect(controller.isStopping.value).toBe(false)
      expect(controller.error.value).toBeNull()
    })

    it('should have computed properties', () => {
      expect(controller.canStartScreenShare.value).toBe(true)
      expect(controller.canStopScreenShare.value).toBe(false)
    })
  })

  describe('startScreenShare', () => {
    it('should start screen sharing successfully', async () => {
      const mockStream = {
        getVideoTracks: () => [
          {
            onended: null,
            readyState: 'live',
            stop: vi.fn()
          }
        ],
        getAudioTracks: () => []
      }

      mockGetDisplayMedia.mockResolvedValue(mockStream)

      const result = await controller.startScreenShare()

      expect(result.success).toBe(true)
      expect(controller.isScreenSharing.value).toBe(true)
      expect(controller.screenShareStream.value).toEqual(mockStream)
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'Screen sharing started',
        'success',
        3000
      )
    })

    it('should handle permission denied error', async () => {
      const error = new Error('Permission denied')
      error.name = 'NotAllowedError'
      mockGetDisplayMedia.mockRejectedValue(error)

      const result = await controller.startScreenShare()

      expect(result.success).toBe(false)
      expect(controller.error.value).toBe('Permission denied')
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'Screen sharing permission denied',
        'error',
        5000
      )
    })

    it('should handle no screen available error', async () => {
      const error = new Error('No screen available')
      error.name = 'NotFoundError'
      mockGetDisplayMedia.mockRejectedValue(error)

      const result = await controller.startScreenShare()

      expect(result.success).toBe(false)
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'No screen or window available for sharing',
        'error',
        5000
      )
    })

    it('should prevent concurrent start attempts', async () => {
      mockGetDisplayMedia.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ getVideoTracks: () => [], getAudioTracks: () => [] }), 100))
      )

      const promise1 = controller.startScreenShare()
      const promise2 = controller.startScreenShare()

      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(false)
      expect(result2.error).toContain('already in progress')
    })

    it('should stop sharing when track ends', async () => {
      const mockTrack = {
        onended: null,
        readyState: 'live',
        stop: vi.fn()
      }
      const mockStream = {
        getVideoTracks: () => [mockTrack],
        getAudioTracks: () => [],
        getTracks: () => [mockTrack]
      }

      mockGetDisplayMedia.mockResolvedValue(mockStream)

      await controller.startScreenShare()
      expect(controller.isScreenSharing.value).toBe(true)

      // Simulate track ending
      if (mockTrack.onended) {
        mockTrack.onended()
      }

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 0))
      await Promise.resolve()
      expect(controller.isScreenSharing.value).toBe(false)
      expect(controller.screenShareStream.value).toBeNull()
    })
  })

  describe('stopScreenShare', () => {
    it('should stop screen sharing', async () => {
      const mockTrack = { stop: vi.fn() }
      const mockStream = {
        getTracks: () => [mockTrack]
      }

      // Start sharing first
      mockGetDisplayMedia.mockResolvedValue(mockStream)
      await controller.startScreenShare()

      // Now stop
      await controller.stopScreenShare()

      expect(controller.isScreenSharing.value).toBe(false)
      expect(controller.screenShareStream.value).toBeNull()
      expect(mockTrack.stop).toHaveBeenCalled()
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'Screen sharing stopped',
        'info',
        2000
      )
    })

    it('should handle stop when not sharing', async () => {
      await controller.stopScreenShare()

      // Should not throw or show error
      expect(controller.isScreenSharing.value).toBe(false)
    })
  })

  describe('toggleScreenShare', () => {
    it('should start when not sharing', async () => {
      const mockStream = {
        getVideoTracks: () => [{ onended: null, readyState: 'live', stop: vi.fn() }],
        getAudioTracks: () => []
      }
      mockGetDisplayMedia.mockResolvedValue(mockStream)

      await controller.toggleScreenShare()

      expect(controller.isScreenSharing.value).toBe(true)
    })

    it('should stop when sharing', async () => {
      const mockStream = {
        getVideoTracks: () => [{ onended: null, readyState: 'live', stop: vi.fn() }],
        getAudioTracks: () => [],
        getTracks: () => [{ stop: vi.fn() }]
      }
      mockGetDisplayMedia.mockResolvedValue(mockStream)

      // Start first
      await controller.startScreenShare()

      // Then toggle to stop
      await controller.toggleScreenShare()

      expect(controller.isScreenSharing.value).toBe(false)
    })
  })

  describe('handleScreenShareError', () => {
    it('should handle NotAllowedError', () => {
      const error = new Error('Permission denied')
      error.name = 'NotAllowedError'

      controller.handleScreenShareError(error)

      expect(controller.error.value).toBe('Permission denied')
      expect(mockGlobalStore.addNotification).toHaveBeenCalled()
    })

    it('should handle NotFoundError', () => {
      const error = new Error('No screen')
      error.name = 'NotFoundError'

      controller.handleScreenShareError(error)

      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'No screen or window available for sharing',
        'error',
        5000
      )
    })
  })

  describe('reset', () => {
    it('should reset all state', async () => {
      const mockStream = {
        getVideoTracks: () => [{ onended: null, readyState: 'live', stop: vi.fn() }],
        getAudioTracks: () => [],
        getTracks: () => [{ stop: vi.fn() }]
      }
      mockGetDisplayMedia.mockResolvedValue(mockStream)

      await controller.startScreenShare()
      controller.reset()

      expect(controller.isScreenSharing.value).toBe(false)
      expect(controller.screenShareStream.value).toBeNull()
      expect(controller.isStarting.value).toBe(false)
      expect(controller.isStopping.value).toBe(false)
      expect(controller.error.value).toBeNull()
    })
  })
})
