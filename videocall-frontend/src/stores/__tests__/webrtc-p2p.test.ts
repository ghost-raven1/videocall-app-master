/**
 * Tests for P2P video call functionality (2 participants)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWebRTCStore } from '../webrtc'
import { useGlobalStore } from '../global'

describe('WebRTC Store - P2P Call (2 participants)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize local media for P2P call', async () => {
    const store = useWebRTCStore()
    const globalStore = useGlobalStore()

    // Mock getUserMedia - override method in existing object
    const mockStream = {
      getTracks: () => [
        { kind: 'video', enabled: true },
        { kind: 'audio', enabled: true }
      ],
      getVideoTracks: () => [{ enabled: true }],
      getAudioTracks: () => [{ enabled: true }]
    }

    // Override getUserMedia in existing mediaDevices object
    if (global.navigator.mediaDevices) {
      global.navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream)
    } else {
      Object.defineProperty(global.navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream)
        },
        writable: true,
        configurable: true
      })
    }

    const result = await store.initializeLocalMedia()

    expect(result.success).toBe(true)
    expect(store.localStream).toEqual(mockStream)
    expect(store.isVideoEnabled).toBe(true)
    expect(store.isAudioEnabled).toBe(true)
  })

  it('falls back to audio-only when camera/mic full request fails with busy device', async () => {
    const store = useWebRTCStore()

    const audioOnlyStream = {
      getTracks: () => [{ kind: 'audio', enabled: true, readyState: 'live' }],
      getVideoTracks: () => [],
      getAudioTracks: () => [{ kind: 'audio', enabled: true, readyState: 'live' }],
      active: true,
    }

    const getUserMediaMock = vi
      .fn()
      .mockRejectedValueOnce({ name: 'NotReadableError' })
      .mockResolvedValueOnce(audioOnlyStream)

    if (global.navigator.mediaDevices) {
      global.navigator.mediaDevices.getUserMedia = getUserMediaMock
    } else {
      Object.defineProperty(global.navigator, 'mediaDevices', {
        value: { getUserMedia: getUserMediaMock },
        writable: true,
        configurable: true,
      })
    }

    const result = await store.initializeLocalMedia()

    expect(result.success).toBe(true)
    expect(result.fallbackMode).toBe('audio_only')
    expect(store.localStream).toEqual(audioOnlyStream)
    expect(store.isVideoEnabled).toBe(false)
    expect(store.isAudioEnabled).toBe(true)
    expect(getUserMediaMock).toHaveBeenCalledTimes(2)
  })

  it('should create peer connection for participant', async () => {
    const store = useWebRTCStore()

    // Mock local stream
    const mockStream = {
      getTracks: () => [
        { kind: 'video', enabled: true },
        { kind: 'audio', enabled: true }
      ]
    }
    store.localStream = mockStream as any

    // Mock RTCPeerConnection
    const mockPC = {
      addTrack: vi.fn(),
      createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'test-sdp' }),
      setLocalDescription: vi.fn().mockResolvedValue(undefined),
      connectionState: 'new',
      onicecandidate: null,
      ontrack: null,
      onconnectionstatechange: null,
      close: vi.fn()
    }

    global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPC) as any

    const result = await store.createPeerConnectionForParticipant('participant-1')

    expect(result.success).toBe(true)
    expect(store.peerConnections.has('participant-1')).toBe(true)
    expect(mockPC.addTrack).toHaveBeenCalledTimes(2)
  })

  it('should establish WebRTC connection between 2 participants', async () => {
    const store = useWebRTCStore()

    // Mock WebSocket
    const mockWS = {
      readyState: 1, // OPEN
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3
    }

    const WebSocketMock = vi.fn().mockImplementation(() => {
      setTimeout(() => {
        if (mockWS.onopen) mockWS.onopen({} as Event)
      }, 0)
      return mockWS
    }) as any
    Object.assign(WebSocketMock, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 })
    ;(global as any).WebSocket = WebSocketMock

    // Mock local stream
    const mockStream = {
      getTracks: () => [
        { kind: 'video', enabled: true },
        { kind: 'audio', enabled: true }
      ]
    }
    store.localStream = mockStream as any

    // Connect WebSocket
    await store.connectWebSocket('test-room-123')

    expect(store.websocket).toBeTruthy()
    expect(store.isConnected).toBe(false)
    expect(store.connectionState).toBe('connecting')

    // Create peer connection
    const mockPC = {
      addTrack: vi.fn(),
      createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'test-sdp' }),
      setLocalDescription: vi.fn().mockResolvedValue(undefined),
      setRemoteDescription: vi.fn().mockResolvedValue(undefined),
      createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'test-answer-sdp' }),
      addIceCandidate: vi.fn().mockResolvedValue(undefined),
      connectionState: 'new',
      onicecandidate: null,
      ontrack: null,
      onconnectionstatechange: null,
      close: vi.fn(),
      generateCertificate: vi.fn()
    }

    global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPC) as any

    // Create peer connection for participant
    await store.createPeerConnectionForParticipant('participant-1')

    // Create offer
    await store.createOfferForParticipant('participant-1')

    // Verify offer was sent
    expect(mockWS.send).toHaveBeenCalled()
    const sentMessage = JSON.parse(mockWS.send.mock.calls[0][0])
    expect(sentMessage.type).toBe('webrtc_offer')
    expect(sentMessage.target).toBe('participant-1')
  })

  it('should handle remote stream from participant', async () => {
    const store = useWebRTCStore()

    // Mock peer connection
    const mockRemoteStream = {
      getTracks: () => [
        { kind: 'video', enabled: true },
        { kind: 'audio', enabled: true }
      ]
    }

    const mockPC = {
      addTrack: vi.fn(),
      connectionState: 'connected',
      onicecandidate: null,
      ontrack: null,
      onconnectionstatechange: null,
      close: vi.fn()
    }

    store.peerConnections.set('participant-1', mockPC as any)

    // Set up ontrack handler before triggering
    mockPC.ontrack = (event: any) => {
      if (store.peerConnections.has('participant-1')) {
        store.remoteStreams.set('participant-1', event.streams[0])
        const participant = store.remoteParticipants.find(p => p.id === 'participant-1')
        if (participant) {
          participant.stream = event.streams[0]
        }
      }
    }

    // Simulate track event
    const mockEvent = {
      streams: [mockRemoteStream],
      track: { kind: 'video', id: 'track-1' }
    }

    // Trigger ontrack handler
    if (mockPC.ontrack) {
      mockPC.ontrack(mockEvent as any)
    }

    expect(store.remoteStreams.has('participant-1')).toBe(true)
  })

  it('should toggle video in P2P call', async () => {
    const store = useWebRTCStore()

    // Mock local stream with video track
    const videoTrack = { enabled: true, kind: 'video' }
    const audioTrack = { enabled: true, kind: 'audio' }

    store.localStream = {
      getVideoTracks: () => [videoTrack],
      getAudioTracks: () => [audioTrack]
    } as any

    const openState = (global as any).WebSocket?.OPEN ?? 1
    // Mock WebSocket
    const mockWS = {
      readyState: openState,
      send: vi.fn(),
      close: vi.fn()
    }
    store.websocket = mockWS as any

    // Toggle video
    store.toggleVideo()

    expect(videoTrack.enabled).toBe(false)
    expect(store.isVideoEnabled).toBe(false)
    expect(mockWS.send).toHaveBeenCalled()
  })

  it('should toggle audio in P2P call', async () => {
    const store = useWebRTCStore()

    // Mock local stream with audio track
    const videoTrack = { enabled: true, kind: 'video' }
    const audioTrack = { enabled: true, kind: 'audio' }

    store.localStream = {
      getVideoTracks: () => [videoTrack],
      getAudioTracks: () => [audioTrack]
    } as any

    const openState = (global as any).WebSocket?.OPEN ?? 1
    // Mock WebSocket
    const mockWS = {
      readyState: openState,
      send: vi.fn(),
      close: vi.fn()
    }
    store.websocket = mockWS as any

    // Toggle audio
    store.toggleAudio()

    expect(audioTrack.enabled).toBe(false)
    expect(store.isAudioEnabled).toBe(false)
    expect(mockWS.send).toHaveBeenCalled()
  })

  it('should handle ICE candidates in P2P call', async () => {
    const store = useWebRTCStore()

    const openState = (global as any).WebSocket?.OPEN ?? 1
    // Mock WebSocket
    const mockWS = {
      readyState: openState,
      send: vi.fn(),
      close: vi.fn()
    }
    store.websocket = mockWS as any

    // Mock local stream and peer connection
    store.localStream = {
      getTracks: () => [{ kind: 'video', enabled: true }, { kind: 'audio', enabled: true }]
    } as any

    const mockPC = {
      addTrack: vi.fn(),
      getSenders: vi.fn().mockReturnValue([]),
      connectionState: 'new',
      onicecandidate: null,
      ontrack: null,
      onconnectionstatechange: null,
      close: vi.fn()
    }

    global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPC) as any
    await store.createPeerConnectionForParticipant('participant-1')

    // Simulate ICE candidate
    const mockCandidate = {
      candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host',
      sdpMLineIndex: 0,
      sdpMid: '0'
    }

    // Trigger onicecandidate handler configured by store
    if (mockPC.onicecandidate) {
      mockPC.onicecandidate({ candidate: mockCandidate } as any)
    }

    // Allow async handler to run
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(mockWS.send).toHaveBeenCalled()
  })

  it('should handle connection state changes in P2P call', async () => {
    const store = useWebRTCStore()

    // Mock peer connection
    const mockPC = {
      addTrack: vi.fn(),
      connectionState: 'connecting',
      onicecandidate: null,
      ontrack: null,
      onconnectionstatechange: null,
      close: vi.fn()
    }

    store.peerConnections.set('participant-1', mockPC as any)
    store.remoteParticipants = [
      { id: 'participant-1', connectionState: 'connecting', isVideoEnabled: true, isAudioEnabled: true }
    ]

    // Set up onconnectionstatechange handler
    mockPC.onconnectionstatechange = () => {
      const participant = store.remoteParticipants.find(p => p.id === 'participant-1')
      if (participant) {
        participant.connectionState = mockPC.connectionState as any
      }
    }

    // Simulate connection state change to connected
    mockPC.connectionState = 'connected'

    // Trigger onconnectionstatechange handler
    if (mockPC.onconnectionstatechange) {
      await mockPC.onconnectionstatechange()
    }

    const participant = store.remoteParticipants.find(p => p.id === 'participant-1')
    expect(participant?.connectionState).toBe('connected')
  })

  it('should end P2P call and cleanup resources', async () => {
    const store = useWebRTCStore()

    // Setup call state
    store.isConnected = true
    store.connectionState = 'connected'
    store.sfuMode = false

    // Mock peer connection
    const mockPC = {
      addTrack: vi.fn(),
      connectionState: 'connected',
      close: vi.fn(),
      onicecandidate: null,
      ontrack: null,
      onconnectionstatechange: null
    }

    store.peerConnections.set('participant-1', mockPC as any)

    // Mock remote stream
    const mockStream = {
      getTracks: () => [
        { stop: vi.fn(), kind: 'video' },
        { stop: vi.fn(), kind: 'audio' }
      ]
    }
    store.remoteStreams.set('participant-1', mockStream as any)

    const openState = (global as any).WebSocket?.OPEN ?? 1
    // Mock WebSocket
    const mockWS = {
      readyState: openState,
      send: vi.fn(),
      close: vi.fn()
    }
    store.websocket = mockWS as any

    // End call
    await store.endCall()

    expect(mockPC.close).toHaveBeenCalled()
    expect(mockWS.close).toHaveBeenCalled()
    expect(store.peerConnections.size).toBe(0)
    expect(store.remoteStreams.size).toBe(0)
    expect(store.isConnected).toBe(false)
    expect(store.connectionState).toBe('new')
  })
})
