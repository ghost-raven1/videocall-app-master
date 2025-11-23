/**
 * Tests for useMediaController
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMediaController } from '../video-call/useMediaController'
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

describe('useMediaController', () => {
  let controller: ReturnType<typeof useMediaController>
  let mockWebRTCStore: any
  let mockGlobalStore: any

  beforeEach(() => {
    setActivePinia(createPinia())

    // Mock WebRTC store
    mockWebRTCStore = {
      localStream: null,
      isVideoEnabled: true,
      isAudioEnabled: true,
      hasLocalVideo: false,
      initializeLocalMedia: vi.fn().mockResolvedValue({ success: true }),
      toggleVideo: vi.fn().mockResolvedValue(undefined),
      toggleAudio: vi.fn().mockResolvedValue(undefined),
      endCall: vi.fn().mockResolvedValue(undefined),
      mediaConstraints: {
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true }
      }
    }

    // Mock Global store
    mockGlobalStore = {
      addNotification: vi.fn()
    }

    vi.mocked(useWebRTCStore).mockReturnValue(mockWebRTCStore as any)
    vi.mocked(useGlobalStore).mockReturnValue(mockGlobalStore as any)

    controller = useMediaController()
  })

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(controller.localStream.value).toBeNull()
      expect(controller.isVideoEnabled.value).toBe(true)
      expect(controller.isAudioEnabled.value).toBe(true)
    })

    it('should have computed properties', () => {
      expect(controller.canToggleVideo.value).toBe(false) // No stream yet
      expect(controller.canToggleAudio.value).toBe(false) // No stream yet
    })
  })

  describe('initializeMedia', () => {
    it('should initialize media successfully', async () => {
      const mockStream = {
        getTracks: () => [
          { kind: 'video', enabled: true },
          { kind: 'audio', enabled: true }
        ]
      }
      mockWebRTCStore.localStream = mockStream
      mockWebRTCStore.initializeLocalMedia.mockResolvedValue({ success: true })

      const result = await controller.initializeMedia()

      expect(result.success).toBe(true)
      expect(mockWebRTCStore.initializeLocalMedia).toHaveBeenCalled()
    })

    it('should handle initialization failure', async () => {
      mockWebRTCStore.initializeLocalMedia.mockResolvedValue({
        success: false,
        error: 'Permission denied'
      })

      const result = await controller.initializeMedia()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Permission denied')
      expect(mockGlobalStore.addNotification).toHaveBeenCalled()
    })

    it('should prevent concurrent initialization', async () => {
      mockWebRTCStore.initializeLocalMedia.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      )

      const promise1 = controller.initializeMedia()
      const promise2 = controller.initializeMedia()

      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(false)
      expect(result2.error).toContain('already in progress')
    })
  })

  describe('toggleVideo', () => {
    it('should toggle video on/off', async () => {
      mockWebRTCStore.localStream = { getTracks: () => [] }
      mockWebRTCStore.isVideoEnabled = true

      await controller.toggleVideo()

      expect(mockWebRTCStore.toggleVideo).toHaveBeenCalled()
      expect(mockGlobalStore.addNotification).toHaveBeenCalled()
    })

    it('should handle toggle failure', async () => {
      mockWebRTCStore.localStream = { getTracks: () => [] }
      mockWebRTCStore.toggleVideo.mockRejectedValue(new Error('Toggle failed'))

      await controller.toggleVideo()

      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'Failed to toggle camera',
        'error',
        3000
      )
    })
  })

  describe('toggleAudio', () => {
    it('should toggle audio on/off', async () => {
      mockWebRTCStore.localStream = { getTracks: () => [] }
      mockWebRTCStore.isAudioEnabled = true

      await controller.toggleAudio()

      expect(mockWebRTCStore.toggleAudio).toHaveBeenCalled()
      expect(mockGlobalStore.addNotification).toHaveBeenCalled()
    })
  })

  describe('stopMedia', () => {
    it('should stop all media tracks', async () => {
      const mockTrack1 = { stop: vi.fn() }
      const mockTrack2 = { stop: vi.fn() }
      mockWebRTCStore.localStream = {
        getTracks: () => [mockTrack1, mockTrack2]
      }

      await controller.stopMedia()

      expect(mockTrack1.stop).toHaveBeenCalled()
      expect(mockTrack2.stop).toHaveBeenCalled()
      expect(mockWebRTCStore.endCall).toHaveBeenCalled()
    })
  })

  describe('replaceVideoTrack', () => {
    it('should replace video track', async () => {
      const oldTrack = { kind: 'video', stop: vi.fn() }
      const newTrack = { kind: 'video' }
      mockWebRTCStore.localStream = {
        getVideoTracks: () => [oldTrack],
        removeTrack: vi.fn(),
        addTrack: vi.fn()
      }

      await controller.replaceVideoTrack(newTrack as any)

      expect(mockWebRTCStore.localStream.removeTrack).toHaveBeenCalledWith(oldTrack)
      expect(oldTrack.stop).toHaveBeenCalled()
      expect(mockWebRTCStore.localStream.addTrack).toHaveBeenCalledWith(newTrack)
    })

    it('should handle error when no stream available', async () => {
      mockWebRTCStore.localStream = null

      await expect(controller.replaceVideoTrack({} as any)).rejects.toThrow(
        'No local stream available'
      )
    })
  })

  describe('replaceAudioTrack', () => {
    it('should replace audio track', async () => {
      const oldTrack = { kind: 'audio', stop: vi.fn() }
      const newTrack = { kind: 'audio' }
      mockWebRTCStore.localStream = {
        getAudioTracks: () => [oldTrack],
        removeTrack: vi.fn(),
        addTrack: vi.fn()
      }

      await controller.replaceAudioTrack(newTrack as any)

      expect(mockWebRTCStore.localStream.removeTrack).toHaveBeenCalledWith(oldTrack)
      expect(oldTrack.stop).toHaveBeenCalled()
      expect(mockWebRTCStore.localStream.addTrack).toHaveBeenCalledWith(newTrack)
    })
  })
})

