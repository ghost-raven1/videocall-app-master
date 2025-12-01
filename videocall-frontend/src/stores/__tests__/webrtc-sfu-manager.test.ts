/**
 * Tests for SFUConnectionManager class
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { SFUConnectionManager } from '../webrtc-sfu'
import { useGlobalStore } from '../global'

describe('SFUConnectionManager', () => {
  let manager: SFUConnectionManager
  let sfuWebSocket: ReturnType<typeof ref<WebSocket | null>>
  let sfuPeerConnection: ReturnType<typeof ref<RTCPeerConnection | null>>
  let sfuRoomId: ReturnType<typeof ref<string | null>>
  let localStream: ReturnType<typeof ref<MediaStream | null>>
  let localParticipantId: ReturnType<typeof ref<string | null>>
  let remoteStreams: ReturnType<typeof ref<Map<string, MediaStream>>>
  let remoteParticipants: ReturnType<typeof ref<any[]>>
  let rtcConfiguration: RTCConfiguration

  beforeEach(() => {
    setActivePinia(createPinia())
    
    sfuWebSocket = ref(null)
    sfuPeerConnection = ref(null)
    sfuRoomId = ref(null)
    localStream = ref(null)
    localParticipantId = ref('test-peer-123')
    remoteStreams = ref(new Map())
    remoteParticipants = ref([])
    rtcConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      iceCandidatePoolSize: 10
    }

    manager = new SFUConnectionManager(
      sfuWebSocket,
      sfuPeerConnection,
      sfuRoomId,
      localStream,
      localParticipantId,
      remoteStreams,
      remoteParticipants,
      rtcConfiguration
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('checkSFUHealth', () => {
    it('should return true when SFU server is healthy', async () => {
      const roomInfo = {
        room_id: 'test-room-123',
        sfu_room_id: 'sfu-room-123'
      }

      // Mock API service
      const mockApiService = {
        getRoomHealth: vi.fn().mockResolvedValue({
          data: {
            sfu_health: {
              healthy: true
            }
          }
        }),
        getSFUServerStats: vi.fn()
      }

      vi.doMock('../services/api', () => ({
        apiService: mockApiService
      }))

      const result = await manager.checkSFUHealth(roomInfo)
      expect(result).toBe(true)
    })

    it('should return false when SFU server is unhealthy', async () => {
      const roomInfo = {
        room_id: 'test-room-123',
        sfu_room_id: 'sfu-room-123'
      }

      // Mock API service with unhealthy SFU
      const mockApiService = {
        getRoomHealth: vi.fn().mockResolvedValue({
          data: {
            sfu_health: {
              healthy: false
            }
          }
        }),
        getSFUServerStats: vi.fn()
      }

      vi.doMock('../services/api', () => ({
        apiService: mockApiService
      }))

      const globalStore = useGlobalStore()
      const addNotificationSpy = vi.spyOn(globalStore, 'addNotification')

      const result = await manager.checkSFUHealth(roomInfo)
      expect(result).toBe(false)
      expect(addNotificationSpy).toHaveBeenCalledWith(
        'SFU server unavailable, using P2P mode',
        'warning',
        5000
      )
    })

    it('should fallback to SFU server stats when room health check fails', async () => {
      const roomInfo = {
        room_id: 'test-room-123',
        sfu_room_id: 'sfu-room-123'
      }

      // Mock API service - room health fails, but server stats succeed
      const mockApiService = {
        getRoomHealth: vi.fn().mockRejectedValue(new Error('Health check failed')),
        getSFUServerStats: vi.fn().mockResolvedValue({
          data: {
            sfu_server: {
              healthy: true
            }
          }
        })
      }

      vi.doMock('../services/api', () => ({
        apiService: mockApiService
      }))

      const result = await manager.checkSFUHealth(roomInfo)
      expect(result).toBe(true)
    })
  })

  describe('connectToSFUWebSocket', () => {
    it('should connect to SFU WebSocket successfully', async () => {
      const sfuWsUrl = 'ws://localhost:8080/ws'
      const roomId = 'test-room-123'
      const peerId = 'test-peer-123'

      let mockOnOpen: (() => void) | null = null

      global.WebSocket = vi.fn().mockImplementation((url: string) => {
        const ws = {
          readyState: WebSocket.CONNECTING as number,
          send: vi.fn(),
          close: vi.fn(),
          onopen: null as ((event: Event) => void) | null,
          onerror: null as ((event: Event) => void) | null,
          onclose: null as ((event: CloseEvent) => void) | null,
          CONNECTING: 0,
          OPEN: 1,
          CLOSING: 2,
          CLOSED: 3
        }

        mockOnOpen = () => {
          ws.readyState = WebSocket.OPEN
          if (ws.onopen) {
            ws.onopen({} as Event)
          }
        }

        return ws
      }) as any

      const connectPromise = manager.connectToSFUWebSocket(sfuWsUrl, roomId, peerId)

      // Trigger onopen after a short delay
      setTimeout(() => {
        if (mockOnOpen) {
          mockOnOpen()
        }
      }, 10)

      await expect(connectPromise).resolves.toBeUndefined()
      expect(sfuWebSocket.value).toBeTruthy()
    })

    it('should reject on WebSocket error', async () => {
      const sfuWsUrl = 'ws://localhost:8080/ws'
      const roomId = 'test-room-123'
      const peerId = 'test-peer-123'

      global.WebSocket = vi.fn().mockImplementation(() => {
        const ws = {
          readyState: WebSocket.CONNECTING as number,
          send: vi.fn(),
          close: vi.fn(),
          onopen: null as ((event: Event) => void) | null,
          onerror: null as ((event: Event) => void) | null,
          onclose: null as ((event: CloseEvent) => void) | null,
          CONNECTING: 0,
          OPEN: 1,
          CLOSING: 2,
          CLOSED: 3
        }

        // Trigger error immediately
        setTimeout(() => {
          if (ws.onerror) {
            ws.onerror(new ErrorEvent('error'))
          }
        }, 10)

        return ws
      }) as any

      await expect(
        manager.connectToSFUWebSocket(sfuWsUrl, roomId, peerId)
      ).rejects.toThrow()
    })

    it('should timeout if connection takes too long', async () => {
      const sfuWsUrl = 'ws://localhost:8080/ws'
      const roomId = 'test-room-123'
      const peerId = 'test-peer-123'

      global.WebSocket = vi.fn().mockImplementation(() => {
        const ws = {
          readyState: WebSocket.CONNECTING as number,
          send: vi.fn(),
          close: vi.fn(),
          onopen: null,
          onerror: null,
          onclose: null,
          CONNECTING: 0,
          OPEN: 1,
          CLOSING: 2,
          CLOSED: 3
        }

        // Don't trigger onopen - let it timeout
        return ws
      }) as any

      // Use fake timers to control timeout
      vi.useFakeTimers()

      const connectPromise = manager.connectToSFUWebSocket(sfuWsUrl, roomId, peerId)

      // Fast-forward past timeout (15000ms)
      vi.advanceTimersByTime(15001)

      await expect(connectPromise).rejects.toThrow('SFU WebSocket connection timeout')

      vi.useRealTimers()
    })

    it('should use nginx proxy on default port when frontend runs on 3001', async () => {
      const originalLocation = window.location
      // Stub window.location to simulate dev server on :3001
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'http:',
          hostname: 'localhost',
          host: 'localhost:3001',
          port: '3001'
        } as any,
        configurable: true
      })

      const sfuWsUrl = 'ws://localhost:8080/ws'
      const roomId = 'room-x'
      const peerId = 'peer-y'

      let capturedUrl: string | null = null

      global.WebSocket = vi.fn().mockImplementation((url: string) => {
        capturedUrl = url
        const ws = {
          readyState: WebSocket.OPEN as number,
          send: vi.fn(),
          close: vi.fn(),
          onopen: null,
          onerror: null,
          onclose: null,
          CONNECTING: 0,
          OPEN: 1,
          CLOSING: 2,
          CLOSED: 3
        }
        // Immediately invoke onopen if present
        setTimeout(() => {
          if (ws.onopen) ws.onopen({} as Event)
        }, 0)
        return ws
      }) as any

      await expect(manager.connectToSFUWebSocket(sfuWsUrl, roomId, peerId)).resolves.toBeUndefined()
      expect(capturedUrl).toBeTruthy()
      // Expect proxy to target default port (no explicit port) without trailing slash
      expect(capturedUrl).toMatch(/ws:\/\/localhost\/sfu\/ws\?/) // query must follow immediately

      // Restore original location
      Object.defineProperty(window, 'location', { value: originalLocation })
    })
  })

  describe('createSFUPeerConnection', () => {
    it('should create SFU peer connection with local tracks', () => {
      const mockStream = {
        getTracks: () => [
          {
            kind: 'video',
            enabled: true,
            stop: vi.fn()
          },
          {
            kind: 'audio',
            enabled: true,
            stop: vi.fn()
          }
        ]
      } as any

      localStream.value = mockStream

      const mockPC = {
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null,
        close: vi.fn()
      }

      global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPC) as any

      const pc = manager.createSFUPeerConnection()

      expect(pc).toBe(mockPC)
      expect(sfuPeerConnection.value).toBe(mockPC)
      expect(mockPC.addTrack).toHaveBeenCalledTimes(2)
    })

    it('should throw error if local stream is not available', () => {
      localStream.value = null

      expect(() => manager.createSFUPeerConnection()).toThrow(
        'Local media stream not available'
      )
    })

    it('should handle remote tracks from SFU', () => {
      const mockStream = {
        getTracks: () => []
      } as any

      localStream.value = mockStream

      const mockPC = {
        addTrack: vi.fn(),
        ontrack: null as ((event: RTCTrackEvent) => void) | null,
        onicecandidate: null,
        onconnectionstatechange: null,
        close: vi.fn()
      }

      global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPC) as any

      manager.createSFUPeerConnection()

      // Simulate track event
      const mockTrack = {
        id: 'track-123',
        kind: 'video'
      } as any

      const mockEvent = {
        streams: [{
          getTracks: () => [mockTrack]
        }],
        track: mockTrack
      } as any

      if (mockPC.ontrack) {
        mockPC.ontrack(mockEvent)
      }

      expect(remoteStreams.value.has('track-123')).toBe(true)
      expect(remoteParticipants.value.length).toBeGreaterThan(0)
    })
  })

  describe('createAndSendOffer', () => {
    it('should create and send offer to SFU', async () => {
      const mockPC = {
        createOffer: vi.fn().mockResolvedValue({
          type: 'offer',
          sdp: 'test-sdp'
        }),
        setLocalDescription: vi.fn().mockResolvedValue(undefined),
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null,
        close: vi.fn()
      }

      sfuPeerConnection.value = mockPC as any
      sfuRoomId.value = 'test-room-123'
      localParticipantId.value = 'test-peer-123'

      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn()
      }

      sfuWebSocket.value = mockWebSocket as any

      await manager.createAndSendOffer()

      expect(mockPC.createOffer).toHaveBeenCalled()
      expect(mockPC.setLocalDescription).toHaveBeenCalled()
      expect(mockWebSocket.send).toHaveBeenCalled()
    })

    it('should throw error if peer connection is not created', async () => {
      sfuPeerConnection.value = null

      await expect(manager.createAndSendOffer()).rejects.toThrow(
        'SFU peer connection not created'
      )
    })
  })

  describe('sendSFUWebSocketMessage', () => {
    it('should send message when WebSocket is open', () => {
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn()
      }

      sfuWebSocket.value = mockWebSocket as any

      const message = {
        type: 'test-message',
        room_id: 'test-room-123',
        peer_id: 'test-peer-123'
      }

      manager.sendSFUWebSocketMessage(message)

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message))
    })

    it('should not send message when WebSocket is not open', () => {
      const mockWebSocket = {
        readyState: WebSocket.CLOSED,
        send: vi.fn(),
        close: vi.fn()
      }

      sfuWebSocket.value = mockWebSocket as any

      const message = {
        type: 'test-message'
      }

      manager.sendSFUWebSocketMessage(message)

      expect(mockWebSocket.send).not.toHaveBeenCalled()
    })
  })

  describe('handleSFUWebSocketMessage', () => {
    it('should handle answer message', async () => {
      const mockPC = {
        setRemoteDescription: vi.fn().mockResolvedValue(undefined),
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null,
        close: vi.fn()
      }

      sfuPeerConnection.value = mockPC as any

      const message = {
        type: 'answer',
        data: {
          sdp: 'test-answer-sdp'
        }
      }

      await manager.handleSFUWebSocketMessage(message)

      expect(mockPC.setRemoteDescription).toHaveBeenCalled()
    })

    it('should handle ice-candidate message', async () => {
      const mockPC = {
        addIceCandidate: vi.fn().mockResolvedValue(undefined),
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null,
        close: vi.fn()
      }

      sfuPeerConnection.value = mockPC as any

      const message = {
        type: 'ice-candidate',
        data: {
          candidate: 'test-candidate',
          sdpMLineIndex: 0,
          sdpMid: '0'
        }
      }

      await manager.handleSFUWebSocketMessage(message)

      expect(mockPC.addIceCandidate).toHaveBeenCalled()
    })

    it('should handle peer-joined message', () => {
      const globalStore = useGlobalStore()
      const addNotificationSpy = vi.spyOn(globalStore, 'addNotification')

      const message = {
        type: 'peer-joined',
        peer_id: 'new-peer-123'
      }

      manager.handleSFUWebSocketMessage(message)

      expect(addNotificationSpy).toHaveBeenCalledWith(
        'New participant joined',
        'info',
        3000
      )
    })

    it('should handle peer-left message', () => {
      const participantId = 'peer-to-remove'
      const mockStream = {
        getTracks: () => [
          {
            stop: vi.fn()
          }
        ]
      } as any

      remoteStreams.value.set(participantId, mockStream)
      remoteParticipants.value.push({
        id: participantId,
        name: 'Test Participant'
      })

      const globalStore = useGlobalStore()
      const addNotificationSpy = vi.spyOn(globalStore, 'addNotification')

      const message = {
        type: 'peer-left',
        peer_id: participantId
      }

      manager.handleSFUWebSocketMessage(message)

      expect(remoteStreams.value.has(participantId)).toBe(false)
      expect(remoteParticipants.value.find(p => p.id === participantId)).toBeUndefined()
      expect(addNotificationSpy).toHaveBeenCalledWith(
        'Participant left',
        'info',
        3000
      )
    })
  })

  describe('closeSFUConnections', () => {
    it('should close SFU WebSocket and peer connection', () => {
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn()
      }

      const mockPC = {
        close: vi.fn()
      }

      sfuWebSocket.value = mockWebSocket as any
      sfuPeerConnection.value = mockPC as any
      sfuRoomId.value = 'test-room-123'

      manager.closeSFUConnections()

      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Switching to P2P mode')
      expect(mockPC.close).toHaveBeenCalled()
      expect(sfuWebSocket.value).toBeNull()
      expect(sfuPeerConnection.value).toBeNull()
      expect(sfuRoomId.value).toBeNull()
    })
  })

  describe('cleanupSFUStreams', () => {
    it('should cleanup SFU remote streams', () => {
      const sfuStream1 = {
        getTracks: () => [{ stop: vi.fn() }]
      } as any

      const sfuStream2 = {
        getTracks: () => [{ stop: vi.fn() }]
      } as any

      const p2pStream = {
        getTracks: () => [{ stop: vi.fn() }]
      } as any

      remoteStreams.value.set('sfu_participant1', sfuStream1)
      remoteStreams.value.set('sfu_participant2', sfuStream2)
      remoteStreams.value.set('p2p_participant1', p2pStream)

      remoteParticipants.value.push(
        { id: 'sfu_participant1', name: 'SFU Participant 1' },
        { id: 'sfu_participant2', name: 'SFU Participant 2' },
        { id: 'p2p_participant1', name: 'P2P Participant 1' }
      )

      manager.cleanupSFUStreams()

      expect(remoteStreams.value.has('sfu_participant1')).toBe(false)
      expect(remoteStreams.value.has('sfu_participant2')).toBe(false)
      expect(remoteStreams.value.has('p2p_participant1')).toBe(true) // P2P stream should remain
      expect(remoteParticipants.value.length).toBe(1) // Only P2P participant should remain
    })
  })
})
