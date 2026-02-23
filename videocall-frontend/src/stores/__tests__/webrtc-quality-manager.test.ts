/**
 * Tests for ConnectionQualityMonitor class
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { ConnectionQualityMonitor } from '../webrtc-quality'
import { useGlobalStore } from '../global'

describe('ConnectionQualityMonitor', () => {
  let monitor: ConnectionQualityMonitor
  let connectionMonitors: ReturnType<typeof ref<Map<string, string>>>
  let qualityMonitors: ReturnType<typeof ref<Map<string, ReturnType<typeof setInterval>>>>
  let fallbackLevels: ReturnType<typeof ref<Map<string, number>>>
  let remoteParticipants: ReturnType<typeof ref<any[]>>

  beforeEach(() => {
    setActivePinia(createPinia())
    
    connectionMonitors = ref(new Map<string, string>())
    qualityMonitors = ref(new Map<string, ReturnType<typeof setInterval>>())
    fallbackLevels = ref(new Map())
    remoteParticipants = ref([])

    monitor = new ConnectionQualityMonitor(
      connectionMonitors,
      qualityMonitors,
      fallbackLevels,
      remoteParticipants
    )

    // Mock webrtcRetryService
    vi.mock('../services/webrtc-retry', () => ({
      webrtcRetryService: {
        monitorConnectionState: vi.fn(() => 12345), // Return mock monitor ID
        stopQualityMonitor: vi.fn()
      }
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  describe('startQualityMonitoring', () => {
    it('should start quality monitoring for participant', () => {
      const participantId = 'participant-123'
      const mockPC = {
        getStats: vi.fn().mockResolvedValue(new Map()),
        connectionState: 'connected'
      } as any

      remoteParticipants.value.push({
        id: participantId,
        name: 'Test Participant',
        connectionState: 'new',
        connectionQuality: 0
      })

      monitor.startQualityMonitoring(participantId, mockPC)

      expect(connectionMonitors.value.has(participantId)).toBe(true)
      expect(qualityMonitors.value.has(participantId)).toBe(true)
    })

    it('should stop existing monitor before starting new one', () => {
      const participantId = 'participant-123'
      const mockPC = {
        getStats: vi.fn().mockResolvedValue(new Map()),
        connectionState: 'connected'
      } as any

      // Set existing monitor
      connectionMonitors.value.set(participantId, 'existing-monitor')
      qualityMonitors.value.set(participantId, 888 as any)

      monitor.startQualityMonitoring(participantId, mockPC)

      // Should have new monitor IDs
      expect(connectionMonitors.value.get(participantId)).not.toBe('existing-monitor')
      expect(qualityMonitors.value.get(participantId)).not.toBe(888)
    })

    it('should update participant connection quality from stats', async () => {
      const participantId = 'participant-123'
      
      remoteParticipants.value.push({
        id: participantId,
        name: 'Test Participant',
        connectionState: 'connected',
        connectionQuality: 0
      })

      // Mock stats with good quality
      const mockStats = new Map([
        ['inbound-rtp-video', {
          type: 'inbound-rtp',
          mediaType: 'video',
          packetsReceived: 1000,
          packetsLost: 10,
          framesPerSecond: 30,
          frameWidth: 1280,
          frameHeight: 720
        }],
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.05, // 50ms
          availableOutgoingBitrate: 1000000
        }]
      ])

      const mockPC = {
        getStats: vi.fn().mockResolvedValue(mockStats),
        connectionState: 'connected'
      } as any

      vi.useFakeTimers()
      monitor.startQualityMonitoring(participantId, mockPC)

      // Fast-forward past first monitoring interval (5000ms)
      await vi.advanceTimersByTimeAsync(5001)

      const participant = remoteParticipants.value.find(p => p.id === participantId)
      expect(participant?.connectionQuality).toBeGreaterThan(0)
      monitor.stopQualityMonitoring(participantId)
    })

    it('should set fallback level when quality is poor', async () => {
      const participantId = 'participant-123'
      
      remoteParticipants.value.push({
        id: participantId,
        name: 'Test Participant',
        connectionState: 'connected',
        connectionQuality: 0
      })

      // Mock stats with poor quality (high packet loss)
      const mockStats = new Map([
        ['inbound-rtp-video', {
          type: 'inbound-rtp',
          mediaType: 'video',
          packetsReceived: 100,
          packetsLost: 50, // 50% loss
          framesPerSecond: 5, // Very low FPS
          frameWidth: 640,
          frameHeight: 480
        }],
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.5, // 500ms - high latency
          availableOutgoingBitrate: 100000
        }]
      ])

      const mockPC = {
        getStats: vi.fn().mockResolvedValue(mockStats),
        connectionState: 'connected'
      } as any

      vi.useFakeTimers()
      monitor.startQualityMonitoring(participantId, mockPC)

      // Fast-forward past first monitoring interval
      await vi.advanceTimersByTimeAsync(5001)

      expect(fallbackLevels.value.has(participantId)).toBe(true)
      monitor.stopQualityMonitoring(participantId)
    })

    it('should show notification when quality is very poor', async () => {
      const participantId = 'participant-123'
      
      remoteParticipants.value.push({
        id: participantId,
        name: 'Test Participant',
        connectionState: 'connected',
        connectionQuality: 0
      })

      const globalStore = useGlobalStore()
      const addNotificationSpy = vi.spyOn(globalStore, 'addNotification')

      // Mock stats with very poor quality
      const mockStats = new Map([
        ['inbound-rtp-video', {
          type: 'inbound-rtp',
          mediaType: 'video',
          packetsReceived: 100,
          packetsLost: 80, // 80% loss
          framesPerSecond: 2, // Very low FPS
          frameWidth: 320,
          frameHeight: 240
        }],
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 1.0, // 1000ms - very high latency
          availableOutgoingBitrate: 50000
        }]
      ])

      const mockPC = {
        getStats: vi.fn().mockResolvedValue(mockStats),
        connectionState: 'connected'
      } as any

      vi.useFakeTimers()
      monitor.startQualityMonitoring(participantId, mockPC)

      // Fast-forward past first monitoring interval
      await vi.advanceTimersByTimeAsync(5001)

      expect(addNotificationSpy).toHaveBeenCalledWith(
        expect.stringContaining('Connection quality is poor'),
        'warning',
        4000
      )
      monitor.stopQualityMonitoring(participantId)
    })
  })

  describe('stopQualityMonitoring', () => {
    it('should stop quality monitoring for participant', () => {
      const participantId = 'participant-123'
      const monitorId = 'monitor-12345'
      const qualityMonitorId = 67890

      connectionMonitors.value.set(participantId, monitorId)
      qualityMonitors.value.set(participantId, qualityMonitorId as any)

      monitor.stopQualityMonitoring(participantId)

      expect(connectionMonitors.value.has(participantId)).toBe(false)
      expect(qualityMonitors.value.has(participantId)).toBe(false)
    })

    it('should not throw error if monitor does not exist', () => {
      const participantId = 'non-existent-participant'

      expect(() => monitor.stopQualityMonitoring(participantId)).not.toThrow()
    })
  })

  describe('stopAllMonitoring', () => {
    it('should stop all quality monitoring', () => {
      const participant1 = 'participant-1'
      const participant2 = 'participant-2'

      connectionMonitors.value.set(participant1, 'monitor-111')
      connectionMonitors.value.set(participant2, 'monitor-222')
      qualityMonitors.value.set(participant1, 333 as any)
      qualityMonitors.value.set(participant2, 444 as any)

      monitor.stopAllMonitoring()

      expect(connectionMonitors.value.size).toBe(0)
      expect(qualityMonitors.value.size).toBe(0)
    })
  })

  describe('handleConnectionQualityChange', () => {
    it('should update participant connection quality', () => {
      const participantId = 'participant-123'
      const quality = 75
      const state = 'connected'

      remoteParticipants.value.push({
        id: participantId,
        name: 'Test Participant',
        connectionState: 'new',
        connectionQuality: 0
      })

      monitor.handleConnectionQualityChange(participantId, quality, state)

      const participant = remoteParticipants.value.find(p => p.id === participantId)
      expect(participant?.connectionQuality).toBe(quality)
    })

    it('should set fallback level when quality is poor', () => {
      const participantId = 'participant-123'
      const quality = 35 // Poor quality
      const state = 'connected'

      remoteParticipants.value.push({
        id: participantId,
        name: 'Test Participant',
        connectionState: 'connected',
        connectionQuality: 0
      })

      monitor.handleConnectionQualityChange(participantId, quality, state)

      expect(fallbackLevels.value.has(participantId)).toBe(true)
    })

    it('should show notification when quality is very poor', () => {
      const participantId = 'participant-123'
      const quality = 25 // Very poor quality
      const state = 'connected'

      remoteParticipants.value.push({
        id: participantId,
        name: 'Test Participant',
        connectionState: 'connected',
        connectionQuality: 0
      })

      const globalStore = useGlobalStore()
      const addNotificationSpy = vi.spyOn(globalStore, 'addNotification')

      monitor.handleConnectionQualityChange(participantId, quality, state)

      expect(addNotificationSpy).toHaveBeenCalledWith(
        expect.stringContaining('Connection quality is poor'),
        'warning',
        4000
      )
    })

    it('should not show notification if state is failed', () => {
      const participantId = 'participant-123'
      const quality = 25 // Very poor quality
      const state = 'failed'

      remoteParticipants.value.push({
        id: participantId,
        name: 'Test Participant',
        connectionState: 'failed',
        connectionQuality: 0
      })

      const globalStore = useGlobalStore()
      const addNotificationSpy = vi.spyOn(globalStore, 'addNotification')

      monitor.handleConnectionQualityChange(participantId, quality, state)

      expect(addNotificationSpy).not.toHaveBeenCalled()
    })
  })
})
