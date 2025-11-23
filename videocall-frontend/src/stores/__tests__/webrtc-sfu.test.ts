/**
 * Tests for SFU and P2P mode switching functionality
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWebRTCStore } from '../webrtc'
import { useGlobalStore } from '../global'

describe('WebRTC Store - SFU Mode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with P2P mode', () => {
    const store = useWebRTCStore()
    expect(store.sfuMode).toBe(false)
  })

  it('should have switchToSFUMode function', () => {
    const store = useWebRTCStore()
    expect(typeof store.switchToSFUMode).toBe('function')
  })

  it('should have switchToP2PMode function', () => {
    const store = useWebRTCStore()
    expect(typeof store.switchToP2PMode).toBe('function')
  })

  it('should switch to SFU mode when room info has SFU enabled', async () => {
    const store = useWebRTCStore()
    const globalStore = useGlobalStore()

    // Mock room info with SFU enabled
    const roomInfo = {
      room_id: 'test-room-123',
      sfu_enabled: true,
      sfu_ws_url: 'ws://localhost:8080/ws?room=test-room-123',
      sfu_room_id: 'sfu-room-123'
    }

    // Mock WebSocket
    const mockWebSocket = {
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
    
    global.WebSocket = vi.fn().mockImplementation(() => {
      setTimeout(() => {
        if (mockWebSocket.onopen) mockWebSocket.onopen({} as Event)
      }, 0)
      return mockWebSocket
    }) as any

    // Mock RTCPeerConnection
    const mockPeerConnection = {
      addTrack: vi.fn(),
      createOffer: vi.fn().mockResolvedValue({
        type: 'offer',
        sdp: 'test-sdp'
      }),
      setLocalDescription: vi.fn().mockResolvedValue(undefined),
      setRemoteDescription: vi.fn().mockResolvedValue(undefined),
      addIceCandidate: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      connectionState: 'new',
      onicecandidate: null,
      ontrack: null,
      onconnectionstatechange: null,
      generateCertificate: vi.fn()
    }
    
    global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPeerConnection) as any

    // Mock getUserMedia
    // Delete existing property if it exists
    if (global.navigator.mediaDevices) {
      delete (global.navigator as any).mediaDevices
    }
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [],
          getVideoTracks: () => [],
          getAudioTracks: () => []
        })
      },
      writable: true,
      configurable: true
    })

    // Initialize local media first
    await store.initializeLocalMedia()

    // Switch to SFU mode
    const result = await store.switchToSFUMode(roomInfo)

    expect(result.success).toBe(true)
    expect(store.sfuMode).toBe(true)
  })

  it('should handle SFU mode switch failure gracefully', async () => {
    const store = useWebRTCStore()

    // Mock room info without SFU enabled
    const roomInfo = {
      room_id: 'test-room-123',
      sfu_enabled: false
    }

    const result = await store.switchToSFUMode(roomInfo)

    expect(result.success).toBe(false)
    expect(store.sfuMode).toBe(false)
  })

  it('should switch back to P2P mode', async () => {
    const store = useWebRTCStore()

    // Set SFU mode first
    store.sfuMode = true

    const result = await store.switchToP2PMode()

    expect(result.success).toBe(true)
    expect(store.sfuMode).toBe(false)
  })

  it('should close SFU connections when ending call', async () => {
    const store = useWebRTCStore()

    // Set SFU mode
    store.sfuMode = true

    await store.endCall()

    expect(store.sfuMode).toBe(false)
  })
})

describe('WebRTC Store - P2P Fallback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should handle P2P fallback when SFU is unavailable', async () => {
    const store = useWebRTCStore()

    // Mock room info with SFU enabled but invalid URL
    const roomInfo = {
      room_id: 'test-room-123',
      sfu_enabled: true,
      sfu_ws_url: null  // Invalid URL
    }

    const result = await store.switchToSFUMode(roomInfo)

    expect(result.success).toBe(false)
    expect(store.sfuMode).toBe(false)
  })

  it('should restore P2P connections when switching from SFU', async () => {
    const store = useWebRTCStore()

    // Set up SFU mode
    store.sfuMode = true

    // Mock WebSocket for P2P
    store.websocket = {
      readyState: WebSocket.OPEN
    } as any

    // Mock participants
    store.remoteParticipants = [
      { id: 'participant-1', name: 'User 1' },
      { id: 'participant-2', name: 'User 2' }
    ]

    const result = await store.switchToP2PMode()

    expect(result.success).toBe(true)
    expect(store.sfuMode).toBe(false)
  })
})

