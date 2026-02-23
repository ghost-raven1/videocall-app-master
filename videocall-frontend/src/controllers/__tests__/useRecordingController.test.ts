/**
 * Tests for useRecordingController
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useRecordingController, type Recording } from '../recording/useRecordingController'
import { createPinia, setActivePinia } from 'pinia'
import { useGlobalStore } from '@/stores/global'
import axios from 'axios'

// Mock stores
vi.mock('@/stores/global', () => ({
  useGlobalStore: vi.fn()
}))

// Mock axios
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    isAxiosError: (err: unknown) => !!(err && typeof err === 'object' && ('response' in (err as Record<string, unknown>) || 'message' in (err as Record<string, unknown>)))
  }
}))

describe('useRecordingController', () => {
  let controller: ReturnType<typeof useRecordingController>
  let mockGlobalStore: any

  beforeEach(() => {
    setActivePinia(createPinia())

    mockGlobalStore = {
      addNotification: vi.fn()
    }

    vi.mocked(useGlobalStore).mockReturnValue(mockGlobalStore as any)
    vi.clearAllMocks()

    controller = useRecordingController()
  })

  afterEach(() => {
    controller.reset()
    vi.useRealTimers()
  })

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      expect(controller.isRecording.value).toBe(false)
      expect(controller.isProcessing.value).toBe(false)
      expect(controller.recordingDuration.value).toBe('00:00')
      expect(controller.recordings.value).toEqual([])
      expect(controller.currentRecordingId.value).toBeNull()
      expect(controller.error.value).toBeNull()
      expect(controller.showRecordingsList.value).toBe(false)
    })

    it('should have computed properties', () => {
      expect(controller.hasRecordings.value).toBe(false)
      expect(controller.currentRecording.value).toBeNull()
    })
  })

  describe('startRecording', () => {
    it('should start recording successfully', async () => {
      const mockRecording: Recording = {
        id: 'rec1',
        room_id: 'room1',
        room_code: 'TEST123',
        participant_id: 'user1',
        started_at: new Date().toISOString(),
        status: 'recording',
        include_audio: true,
        include_video: true,
        include_screen_share: true
      }

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          success: true,
          recording: mockRecording
        }
      })

      const result = await controller.startRecording('TEST123', 'user1')

      expect(result.success).toBe(true)
      expect(result.recording).toEqual(mockRecording)
      expect(controller.isRecording.value).toBe(true)
      expect(controller.currentRecordingId.value).toBe('rec1')
      expect(controller.recordings.value.length).toBe(1)
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'Recording started',
        'success',
        2000
      )
    })

    it('should reject if already recording', async () => {
      controller.isRecording.value = true

      const result = await controller.startRecording('TEST123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Recording is already in progress')
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('should reject if processing', async () => {
      controller.isProcessing.value = true

      const result = await controller.startRecording('TEST123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Recording operation already in progress')
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      vi.mocked(axios.post).mockRejectedValue({
        response: {
          data: {
            error: 'Permission denied'
          }
        }
      })

      const result = await controller.startRecording('TEST123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Permission denied')
      expect(controller.isRecording.value).toBe(false)
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start recording'),
        'error',
        5000
      )
    })

    it('should handle network errors', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Network error'))

      const result = await controller.startRecording('TEST123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('should start duration timer when recording starts', async () => {
      vi.useFakeTimers()

      const mockRecording: Recording = {
        id: 'rec1',
        room_id: 'room1',
        room_code: 'TEST123',
        participant_id: 'user1',
        started_at: new Date().toISOString(),
        status: 'recording',
        include_audio: true,
        include_video: true,
        include_screen_share: true
      }

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          success: true,
          recording: mockRecording
        }
      })

      await controller.startRecording('TEST123')

      expect(controller.recordingDuration.value).toBe('00:00')

      vi.advanceTimersByTime(1000)
      expect(controller.recordingDuration.value).toBe('00:01')

      vi.advanceTimersByTime(60000)
      expect(controller.recordingDuration.value).toBe('01:01')
    })

    it('should accept recording options', async () => {
      const mockRecording: Recording = {
        id: 'rec1',
        room_id: 'room1',
        room_code: 'TEST123',
        participant_id: 'user1',
        started_at: new Date().toISOString(),
        status: 'recording',
        include_audio: false,
        include_video: true,
        include_screen_share: false
      }

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          success: true,
          recording: mockRecording
        }
      })

      await controller.startRecording('TEST123', 'user1', {
        includeAudio: false,
        includeVideo: true,
        includeScreenShare: false
      })

      expect(axios.post).toHaveBeenCalledWith(
        '/api/recordings/start/',
        expect.objectContaining({
          include_audio: false,
          include_video: true,
          include_screen_share: false
        })
      )
    })
  })

  describe('stopRecording', () => {
    it('should stop recording successfully', async () => {
      // Start recording first
      const mockRecording: Recording = {
        id: 'rec1',
        room_id: 'room1',
        room_code: 'TEST123',
        participant_id: 'user1',
        started_at: new Date().toISOString(),
        status: 'recording',
        include_audio: true,
        include_video: true,
        include_screen_share: true
      }

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: {
          success: true,
          recording: mockRecording
        }
      })

      await controller.startRecording('TEST123', 'user1')

      // Now stop it
      const stoppedRecording: Recording = {
        ...mockRecording,
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration: 60
      }

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: {
          success: true,
          recording: stoppedRecording
        }
      })

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          success: true,
          recordings: [stoppedRecording]
        }
      })

      const result = await controller.stopRecording()

      expect(result.success).toBe(true)
      expect(result.recording).toEqual(stoppedRecording)
      expect(controller.isRecording.value).toBe(false)
      expect(controller.currentRecordingId.value).toBeNull()
      expect(controller.recordingDuration.value).toBe('00:00')
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'Recording stopped',
        'success',
        2000
      )
    })

    it('should reject if not recording', async () => {
      const result = await controller.stopRecording()

      expect(result.success).toBe(false)
      expect(result.error).toBe('No active recording to stop')
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('should reject if processing', async () => {
      controller.isRecording.value = true
      controller.currentRecordingId.value = 'rec1'
      controller.isProcessing.value = true

      const result = await controller.stopRecording()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Recording operation already in progress')
    })

    it('should handle stop errors', async () => {
      controller.isRecording.value = true
      controller.currentRecordingId.value = 'rec1'

      vi.mocked(axios.post).mockRejectedValue({
        response: {
          data: {
            error: 'Recording not found'
          }
        }
      })

      const result = await controller.stopRecording()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Recording not found')
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        expect.stringContaining('Failed to stop recording'),
        'error',
        5000
      )
    })

    it('should refresh recordings list after stopping', async () => {
      controller.isRecording.value = true
      controller.currentRecordingId.value = 'rec1'

      const stoppedRecording: Recording = {
        id: 'rec1',
        room_id: 'room1',
        room_code: 'TEST123',
        participant_id: 'user1',
        started_at: new Date().toISOString(),
        status: 'completed',
        include_audio: true,
        include_video: true,
        include_screen_share: true
      }

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          success: true,
          recording: stoppedRecording
        }
      })

      vi.mocked(axios.get).mockResolvedValue({
        data: {
          success: true,
          recordings: [stoppedRecording]
        }
      })

      await controller.stopRecording()

      expect(axios.get).toHaveBeenCalledWith(
        '/api/rooms/recordings/list_by_room/',
        expect.objectContaining({
          params: { room_code: 'TEST123' }
        })
      )
    })
  })

  describe('toggleRecording', () => {
    it('should start when not recording', async () => {
      const mockRecording: Recording = {
        id: 'rec1',
        room_id: 'room1',
        room_code: 'TEST123',
        participant_id: 'user1',
        started_at: new Date().toISOString(),
        status: 'recording',
        include_audio: true,
        include_video: true,
        include_screen_share: true
      }

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          success: true,
          recording: mockRecording
        }
      })

      await controller.toggleRecording('TEST123', 'user1')

      expect(controller.isRecording.value).toBe(true)
    })

    it('should stop when recording', async () => {
      controller.isRecording.value = true
      controller.currentRecordingId.value = 'rec1'

      const stoppedRecording: Recording = {
        id: 'rec1',
        room_id: 'room1',
        room_code: 'TEST123',
        participant_id: 'user1',
        started_at: new Date().toISOString(),
        status: 'completed',
        include_audio: true,
        include_video: true,
        include_screen_share: true
      }

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          success: true,
          recording: stoppedRecording
        }
      })

      vi.mocked(axios.get).mockResolvedValue({
        data: {
          success: true,
          recordings: [stoppedRecording]
        }
      })

      await controller.toggleRecording('TEST123', 'user1')

      expect(controller.isRecording.value).toBe(false)
    })
  })

  describe('loadRecordings', () => {
    it('should load recordings successfully', async () => {
      const mockRecordings: Recording[] = [
        {
          id: 'rec1',
          room_id: 'room1',
          room_code: 'TEST123',
          participant_id: 'user1',
          started_at: new Date().toISOString(),
          status: 'completed',
          include_audio: true,
          include_video: true,
          include_screen_share: true
        }
      ]

      vi.mocked(axios.get).mockResolvedValue({
        data: {
          success: true,
          recordings: mockRecordings
        }
      })

      await controller.loadRecordings('TEST123')

      expect(controller.recordings.value).toEqual(mockRecordings)
      expect(controller.error.value).toBeNull()
    })

    it('should handle load errors', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Network error'))

      await controller.loadRecordings('TEST123')

      expect(controller.error.value).toBe('Network error')
      expect(controller.recordings.value).toEqual([])
    })

    it('should handle API response without recordings', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: {
          success: false,
          error: 'Room not found'
        }
      })

      await controller.loadRecordings('TEST123')

      expect(controller.recordings.value).toEqual([])
    })
  })

  describe('downloadRecording', () => {
    it('downloads recording via fetch and triggers success notification', async () => {
      const mockBlob = new Blob(['test'], { type: 'video/webm' })
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        headers: { get: () => 'attachment; filename="recording.webm"' },
        blob: vi.fn().mockResolvedValue(mockBlob),
      } as any)
      ;(window.URL as any).createObjectURL = (window.URL as any).createObjectURL || vi.fn()
      ;(window.URL as any).revokeObjectURL = (window.URL as any).revokeObjectURL || vi.fn()
      const createObjectURLSpy = vi.spyOn(window.URL as any, 'createObjectURL').mockReturnValue('blob:test')
      const revokeObjectURLSpy = vi.spyOn(window.URL as any, 'revokeObjectURL').mockImplementation(() => {})

      await controller.downloadRecording('rec1')

      expect(fetchSpy).toHaveBeenCalledWith('/api/rooms/recordings/rec1/download/', expect.objectContaining({ method: 'GET' }))
      expect(createObjectURLSpy).toHaveBeenCalled()
      expect(revokeObjectURLSpy).toHaveBeenCalled()
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'Recording downloaded successfully',
        'success',
        2000
      )
    })

    it('should handle download errors', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Download failed'))

      await controller.downloadRecording('rec1')

      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download recording'),
        'error',
        3000
      )
    })
  })

  describe('formatDate', () => {
    it('should format date string correctly', () => {
      const dateString = '2025-01-27T12:00:00Z'
      const formatted = controller.formatDate(dateString)

      expect(formatted).toBeTruthy()
      expect(typeof formatted).toBe('string')
    })
  })

  describe('computed properties', () => {
    it('should compute hasRecordings correctly', () => {
      expect(controller.hasRecordings.value).toBe(false)

      controller.recordings.value = [
        {
          id: 'rec1',
          room_id: 'room1',
          room_code: 'TEST123',
          participant_id: 'user1',
          started_at: new Date().toISOString(),
          status: 'completed',
          include_audio: true,
          include_video: true,
          include_screen_share: true
        }
      ]

      expect(controller.hasRecordings.value).toBe(true)
    })

    it('should compute currentRecording correctly', () => {
      expect(controller.currentRecording.value).toBeNull()

      const mockRecording: Recording = {
        id: 'rec1',
        room_id: 'room1',
        room_code: 'TEST123',
        participant_id: 'user1',
        started_at: new Date().toISOString(),
        status: 'recording',
        include_audio: true,
        include_video: true,
        include_screen_share: true
      }

      controller.recordings.value = [mockRecording]
      controller.currentRecordingId.value = 'rec1'

      expect(controller.currentRecording.value).toEqual(mockRecording)
    })
  })

  describe('reset', () => {
    it('should reset all state', async () => {
      // Set up some state
      const mockRecording: Recording = {
        id: 'rec1',
        room_id: 'room1',
        room_code: 'TEST123',
        participant_id: 'user1',
        started_at: new Date().toISOString(),
        status: 'recording',
        include_audio: true,
        include_video: true,
        include_screen_share: true
      }

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          success: true,
          recording: mockRecording
        }
      })

      await controller.startRecording('TEST123')
      controller.showRecordingsList.value = true
      controller.error.value = 'Some error'

      controller.reset()

      expect(controller.isRecording.value).toBe(false)
      expect(controller.isProcessing.value).toBe(false)
      expect(controller.currentRecordingId.value).toBeNull()
      expect(controller.recordingDuration.value).toBe('00:00')
      expect(controller.error.value).toBeNull()
      expect(controller.showRecordingsList.value).toBe(false)
    })
  })

  describe('duration timer', () => {
    it('should stop timer on reset', () => {
      vi.useFakeTimers()

      const mockRecording: Recording = {
        id: 'rec1',
        room_id: 'room1',
        room_code: 'TEST123',
        participant_id: 'user1',
        started_at: new Date().toISOString(),
        status: 'recording',
        include_audio: true,
        include_video: true,
        include_screen_share: true
      }

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          success: true,
          recording: mockRecording
        }
      })

      controller.startRecording('TEST123').then(() => {
        vi.advanceTimersByTime(5000)
        expect(controller.recordingDuration.value).toBe('00:05')

        controller.reset()
        vi.advanceTimersByTime(1000)
        expect(controller.recordingDuration.value).toBe('00:00')
      })
    })
  })
})
