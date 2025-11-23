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
    // Increase timeout for this test
    const store = useWebRTCStore()
    const globalStore = useGlobalStore()

    // Mock room info with SFU enabled
    const roomInfo = {
      room_id: 'test-room-123',
      sfu_enabled: true,
      sfu_ws_url: 'ws://localhost:8080/ws?room=test-room-123',
      sfu_room_id: 'sfu-room-123'
    }

    // Mock WebSocket with proper async handling
    let mockWebSocket: any = null
    
    global.WebSocket = vi.fn().mockImplementation(() => {
      mockWebSocket = {
        readyState: 0, // CONNECTING initially
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
      
      // Auto-open after a short delay
      setTimeout(() => {
        if (mockWebSocket) {
          mockWebSocket.readyState = 1 // OPEN
          if (mockWebSocket.onopen) {
            mockWebSocket.onopen({} as Event)
          }
        }
      }, 5)
      
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

    // Mock getUserMedia - override method in existing object
    const mockStream = {
      getTracks: () => [],
      getVideoTracks: () => [],
      getAudioTracks: () => []
    }
    
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

    // Initialize local media first
    await store.initializeLocalMedia()

    // Switch to SFU mode - wait for WebSocket to connect
    const resultPromise = store.switchToSFUMode(roomInfo)
    
    // Wait for WebSocket to open and process
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Wait for the result with timeout
    const result = await Promise.race([
      resultPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    ]) as any

    expect(result.success).toBe(true)
    expect(store.sfuMode).toBe(true)
  }, 10000) // 10 second timeout

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

    // Mock WebSocket for P2P - websocket is a ref, so we need to set it properly
    const mockWebSocket = {
      readyState: WebSocket.OPEN,
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
    // In Pinia stores with Composition API, refs are auto-unwrapped when accessed
    // But we need to set the value directly
    if (store.websocket && typeof store.websocket === 'object' && 'value' in store.websocket) {
      (store.websocket as any).value = mockWebSocket
    } else {
      store.websocket = mockWebSocket as any
    }

    // Mock participants
    store.remoteParticipants = [
      { id: 'participant-1', name: 'User 1' },
      { id: 'participant-2', name: 'User 2' }
    ]

    // Mock RTCPeerConnection for P2P connections
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
      onconnectionstatechange: null
    }
    
    global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPeerConnection) as any

    const result = await store.switchToP2PMode()

    expect(result.success).toBe(true)
    expect(store.sfuMode).toBe(false)
  })
})

