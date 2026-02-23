/**
 * Tests for P2PConnectionManager class
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { P2PConnectionManager } from '../webrtc-p2p'
import { useGlobalStore } from '../global'

describe('P2PConnectionManager', () => {
  let manager: P2PConnectionManager
  let peerConnections: ReturnType<typeof ref<Map<string, RTCPeerConnection>>>
  let localStream: ReturnType<typeof ref<MediaStream | null>>
  let remoteStreams: ReturnType<typeof ref<Map<string, MediaStream>>>
  let remoteParticipants: ReturnType<typeof ref<any[]>>
  let websocket: ReturnType<typeof ref<WebSocket | null>>
  let localParticipantId: ReturnType<typeof ref<string | null>>
  let rtcConfiguration: RTCConfiguration

  beforeEach(() => {
    setActivePinia(createPinia())
    
    peerConnections = ref(new Map())
    localStream = ref(null)
    remoteStreams = ref(new Map())
    remoteParticipants = ref([])
    websocket = ref(null)
    localParticipantId = ref('local-peer-123')
    rtcConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      iceCandidatePoolSize: 10
    }

    manager = new P2PConnectionManager(
      peerConnections,
      localStream,
      remoteStreams,
      remoteParticipants,
      websocket,
      localParticipantId,
      rtcConfiguration
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('createPeerConnectionForParticipant', () => {
    it('should create peer connection for participant', async () => {
      const participantId = 'participant-123'
      const mockStream = {
        getTracks: () => [
          { kind: 'video', enabled: true, stop: vi.fn() },
          { kind: 'audio', enabled: true, stop: vi.fn() }
        ]
      } as any

      localStream.value = mockStream

      const mockPC = {
        addTrack: vi.fn(),
        ontrack: null as ((event: RTCTrackEvent) => void) | null,
        onicecandidate: null as ((event: RTCPeerConnectionIceEvent) => void) | null,
        onconnectionstatechange: null as (() => void) | null,
        close: vi.fn(),
        connectionState: 'new'
      }

      global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPC) as any

      const pc = await manager.createPeerConnectionForParticipant(participantId)

      expect(pc).toBe(mockPC)
      expect(peerConnections.value.has(participantId)).toBe(true)
      expect(mockPC.addTrack).toHaveBeenCalledTimes(2)
    })

    it('should close existing connection before creating new one', async () => {
      const participantId = 'participant-123'
      const existingPC = {
        close: vi.fn(),
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null
      }

      peerConnections.value.set(participantId, existingPC as any)

      const mockPC = {
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null,
        close: vi.fn()
      }

      global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPC) as any

      await manager.createPeerConnectionForParticipant(participantId)

      expect(existingPC.close).toHaveBeenCalled()
    })

    it('should handle remote tracks', async () => {
      const participantId = 'participant-123'
      const mockStream = {
        getTracks: () => []
      } as any

      localStream.value = mockStream

      let onTrackHandler: ((event: RTCTrackEvent) => void) | null = null

      const mockPC = {
        addTrack: vi.fn(),
        ontrack: null as ((event: RTCTrackEvent) => void) | null,
        onicecandidate: null,
        onconnectionstatechange: null,
        close: vi.fn()
      }

      Object.defineProperty(mockPC, 'ontrack', {
        get: () => onTrackHandler,
        set: (value) => { onTrackHandler = value },
        configurable: true
      })

      global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPC) as any

      await manager.createPeerConnectionForParticipant(participantId)

      // Simulate track event
      const remoteStream = {
        getTracks: () => []
      } as any

      const mockEvent = {
        streams: [remoteStream],
        track: { id: 'track-123' } as any
      } as any

      if (onTrackHandler) {
        onTrackHandler(mockEvent)
      }

      expect(remoteStreams.value.has(participantId)).toBe(true)
    })

    it('should send ICE candidates via WebSocket', async () => {
      const participantId = 'participant-123'
      const mockStream = {
        getTracks: () => []
      } as any

      localStream.value = mockStream

      let onIceCandidateHandler: ((event: RTCPeerConnectionIceEvent) => void) | null = null

      const mockPC = {
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null as ((event: RTCPeerConnectionIceEvent) => void) | null,
        onconnectionstatechange: null,
        close: vi.fn()
      }

      Object.defineProperty(mockPC, 'onicecandidate', {
        get: () => onIceCandidateHandler,
        set: (value) => { onIceCandidateHandler = value },
        configurable: true
      })

      global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPC) as any

      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn()
      }

      websocket.value = mockWebSocket as any

      await manager.createPeerConnectionForParticipant(participantId)

      // Simulate ICE candidate event
      const mockCandidate = {
        candidate: 'test-candidate',
        sdpMLineIndex: 0,
        sdpMid: '0'
      } as any

      const mockEvent = {
        candidate: mockCandidate
      } as any

      if (onIceCandidateHandler) {
        onIceCandidateHandler(mockEvent)
      }

      expect(mockWebSocket.send).toHaveBeenCalled()
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0])
      expect(sentMessage.type).toBe('ice_candidate')
      expect(sentMessage.target).toBe(participantId)
    })
  })

  describe('createOfferForParticipant', () => {
    it('should create and send offer for participant', async () => {
      const participantId = 'participant-123'
      const mockOffer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'test-offer-sdp'
      }

      const mockPC = {
        createOffer: vi.fn().mockResolvedValue(mockOffer),
        setLocalDescription: vi.fn().mockResolvedValue(undefined),
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null,
        close: vi.fn()
      }

      peerConnections.value.set(participantId, mockPC as any)

      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn()
      }

      websocket.value = mockWebSocket as any

      await manager.createOfferForParticipant(participantId)

      expect(mockPC.createOffer).toHaveBeenCalled()
      expect(mockPC.setLocalDescription).toHaveBeenCalledWith(mockOffer)
      expect(mockWebSocket.send).toHaveBeenCalled()
    })

    it('should throw error if peer connection does not exist', async () => {
      const participantId = 'non-existent-participant'

      await expect(manager.createOfferForParticipant(participantId)).rejects.toThrow(
        'Peer connection not found'
      )
    })
  })

  describe('handleOffer', () => {
    it('should handle incoming offer and send answer', async () => {
      const participantId = 'participant-123'
      const mockOffer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'test-offer-sdp'
      }

      const mockAnswer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: 'test-answer-sdp'
      }

      const mockPC = {
        setRemoteDescription: vi.fn().mockResolvedValue(undefined),
        createAnswer: vi.fn().mockResolvedValue(mockAnswer),
        setLocalDescription: vi.fn().mockResolvedValue(undefined),
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null,
        close: vi.fn()
      }

      global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPC) as any

      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn()
      }

      websocket.value = mockWebSocket as any

      await manager.handleOffer(participantId, mockOffer)

      expect(mockPC.setRemoteDescription).toHaveBeenCalled()
      expect(mockPC.createAnswer).toHaveBeenCalled()
      expect(mockPC.setLocalDescription).toHaveBeenCalledWith(mockAnswer)
      expect(mockWebSocket.send).toHaveBeenCalled()
    })

    it('should create peer connection if it does not exist', async () => {
      const participantId = 'new-participant-123'
      const mockOffer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'test-offer-sdp'
      }

      const mockStream = {
        getTracks: () => []
      } as any

      localStream.value = mockStream

      const mockPC = {
        setRemoteDescription: vi.fn().mockResolvedValue(undefined),
        createAnswer: vi.fn().mockResolvedValue({
          type: 'answer',
          sdp: 'test-answer-sdp'
        }),
        setLocalDescription: vi.fn().mockResolvedValue(undefined),
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null,
        close: vi.fn()
      }

      global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPC) as any

      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn()
      }

      websocket.value = mockWebSocket as any

      await manager.handleOffer(participantId, mockOffer)

      expect(peerConnections.value.has(participantId)).toBe(true)
    })
  })

  describe('handleAnswer', () => {
    it('should handle incoming answer', async () => {
      const participantId = 'participant-123'
      const mockAnswer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: 'test-answer-sdp'
      }

      const mockPC = {
        setRemoteDescription: vi.fn().mockResolvedValue(undefined),
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null,
        close: vi.fn()
      }

      peerConnections.value.set(participantId, mockPC as any)

      await manager.handleAnswer(participantId, mockAnswer)

      expect(mockPC.setRemoteDescription).toHaveBeenCalled()
    })

    it('should not throw error if peer connection does not exist', async () => {
      const participantId = 'non-existent-participant'
      const mockAnswer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: 'test-answer-sdp'
      }

      await expect(manager.handleAnswer(participantId, mockAnswer)).resolves.not.toThrow()
    })
  })

  describe('handleICECandidate', () => {
    it('should handle incoming ICE candidate', async () => {
      const participantId = 'participant-123'
      const mockCandidate = {
        candidate: 'test-candidate',
        sdpMLineIndex: 0,
        sdpMid: '0'
      }

      const mockPC = {
        addIceCandidate: vi.fn().mockResolvedValue(undefined),
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null,
        close: vi.fn()
      }

      peerConnections.value.set(participantId, mockPC as any)

      await manager.handleICECandidate(participantId, mockCandidate)

      expect(mockPC.addIceCandidate).toHaveBeenCalled()
    })

    it('should not throw error if peer connection does not exist', async () => {
      const participantId = 'non-existent-participant'
      const mockCandidate = {
        candidate: 'test-candidate',
        sdpMLineIndex: 0,
        sdpMid: '0'
      }

      await expect(manager.handleICECandidate(participantId, mockCandidate)).resolves.not.toThrow()
    })
  })

  describe('closePeerConnection', () => {
    it('should close peer connection and cleanup stream', () => {
      const participantId = 'participant-123'
      const mockPC = {
        close: vi.fn(),
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null
      }

      const mockStream = {
        getTracks: () => [
          { stop: vi.fn() }
        ]
      } as any

      peerConnections.value.set(participantId, mockPC as any)
      remoteStreams.value.set(participantId, mockStream)

      manager.closePeerConnection(participantId)

      expect(mockPC.close).toHaveBeenCalled()
      expect(peerConnections.value.has(participantId)).toBe(false)
      expect(remoteStreams.value.has(participantId)).toBe(false)
    })
  })

  describe('closeAllConnections', () => {
    it('should close all peer connections', () => {
      const participant1 = 'participant-1'
      const participant2 = 'participant-2'

      const mockPC1 = {
        close: vi.fn(),
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null
      }

      const mockPC2 = {
        close: vi.fn(),
        addTrack: vi.fn(),
        ontrack: null,
        onicecandidate: null,
        onconnectionstatechange: null
      }

      peerConnections.value.set(participant1, mockPC1 as any)
      peerConnections.value.set(participant2, mockPC2 as any)

      manager.closeAllConnections()

      expect(mockPC1.close).toHaveBeenCalled()
      expect(mockPC2.close).toHaveBeenCalled()
      expect(peerConnections.value.size).toBe(0)
    })
  })
})
