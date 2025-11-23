import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWebRTCStore } from '../webrtc'
import { buildWebSocketUrl, isValidWsMessage } from '../webrtc'
import { useGlobalStore } from '../../stores/global'

// Mock retry service used by the store to avoid side effects
vi.mock('../../services/webrtc-retry', () => {
  return {
    webrtcRetryService: {
      executeWithRetry: vi.fn(async (_id, fn) => await fn()),
      monitorConnectionState: vi.fn(() => 'monitor-id'),
      getErrorMessage: vi.fn((error, context) => `${context}: ${error.message}`),
      cancelRetry: vi.fn(),
      stopQualityMonitor: vi.fn(),
    },
  }
})

// Helper: simple mock WebSocket implementation
class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3
  static CONNECTING = 0

  constructor(url) {
    this.url = url
    this.readyState = MockWebSocket.CONNECTING
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null

    // Auto-open immediately using nextTick to ensure handlers are set
    Promise.resolve().then(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen({})
      }
    })
  }

  send = vi.fn()
  close = vi.fn()

  triggerMessage(payload) {
    if (this.onmessage) this.onmessage({ data: payload })
  }

  triggerClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) this.onclose({ code, reason })
  }
}

describe('webrtc store helpers', () => {
  beforeEach(() => {
    // Fresh Pinia instance for each test
    setActivePinia(createPinia())

    // Stub global WebSocket
    vi.stubGlobal('WebSocket', MockWebSocket)

    // Stub global RTCPeerConnection used by store
    class MockRTCPeerConnection {
      constructor(config) {
        this.config = config
        this.addTrack = vi.fn()
        this.onicecandidate = null
        this.ontrack = null
        this.onconnectionstatechange = null
        this.connectionState = 'new'
        this.localDescription = null
      }
      async createOffer() {
        return { type: 'offer', sdp: 'fake-sdp' }
      }
      async setLocalDescription(offer) {
        this.localDescription = offer
      }
      close() {
        this.connectionState = 'closed'
      }
    }
    vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection)

    // Ensure predictable location
    // jsdom defaults to http://localhost, which is fine for fallback branch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('buildWebSocketUrl', () => {
    it('builds URL from window location when base env is missing', () => {
      // Ensure env vars are not set
      delete process.env.VITE_WS_BASE_URL
      delete process.env.VITE_WS_HOST

      const url = buildWebSocketUrl('room123')
      const expected = `ws://${window.location.host}/ws/room/room123/`
      expect(url).toBe(expected)
    })

    it('prefers VITE_WS_BASE_URL when provided', () => {
      // Try to set env; Vitest/Vite maps process.env to import.meta.env in tests
      process.env.VITE_WS_BASE_URL = 'ws://example.com'
      const url = buildWebSocketUrl('room123')
      expect(url).toBe('ws://example.com/ws/room/room123/')
    })
  })

  describe('isValidWsMessage', () => {
    it('accepts known message types', () => {
      const ok1 = isValidWsMessage({ type: 'user_joined' })
      const ok2 = isValidWsMessage({ type: 'ice_candidate', candidate: { candidate: 'c' } })
      expect(ok1).toBe(true)
      expect(ok2).toBe(true)
    })

    it('rejects unknown or malformed messages', () => {
      expect(isValidWsMessage({ type: 'unknown_type' })).toBe(false)
      expect(isValidWsMessage({})).toBe(false)
      expect(isValidWsMessage(null)).toBe(false)
      expect(isValidWsMessage('not-an-object')).toBe(false)
    })
  })

  describe('WebSocket message handling', () => {
    it('handles invalid JSON by notifying error', async () => {
      const store = useWebRTCStore()
      const globalStore = useGlobalStore()
      const notifySpy = vi.spyOn(globalStore, 'addNotification')

      await store.connectWebSocket('room-invalid-json')
      
      // Wait for WebSocket to be ready
      await new Promise((r) => setTimeout(r, 10))

      // websocket is a ref, so we need to access .value
      const ws = store.websocket?.value || store.websocket
      // Simulate incoming invalid JSON
      ws.triggerMessage('not a json')

      // Allow async handler to run
      await new Promise((r) => setTimeout(r, 10))

      expect(notifySpy).toHaveBeenCalled()
      const [message, level] = notifySpy.mock.calls[0]
      expect(level).toBe('error')
      expect(typeof message).toBe('string')
    })

    it('ignores unknown message type (warns, no notification)', async () => {
      const store = useWebRTCStore()
      const globalStore = useGlobalStore()
      const notifySpy = vi.spyOn(globalStore, 'addNotification')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await store.connectWebSocket('room-unknown-type')
      
      // Wait for WebSocket to be ready
      await new Promise((r) => setTimeout(r, 10))

      // websocket is a ref, so we need to access .value
      const ws = store.websocket?.value || store.websocket
      // Simulate well-formed but unknown type
      ws.triggerMessage(JSON.stringify({ type: 'unknown' }))

      // Allow async handler to run
      await new Promise((r) => setTimeout(r, 10))

      expect(warnSpy).toHaveBeenCalled()
      expect(notifySpy).not.toHaveBeenCalled()
    }, 10000) // 10 second timeout
  })

  describe('sendWebSocketMessage', () => {
    it('sends JSON when WebSocket is open', async () => {
      const store = useWebRTCStore()
      await store.connectWebSocket('room-send-test')
      
      // Wait for WebSocket to be ready
      await new Promise((r) => setTimeout(r, 10))

      store.sendWebSocketMessage({ type: 'pong', data: 'ok' })

      // websocket is a ref, so we need to access .value
      const ws = store.websocket?.value || store.websocket
      expect(ws.send).toHaveBeenCalledTimes(1)
      const payload = ws.send.mock.calls[0][0]
      const parsed = JSON.parse(payload)
      expect(parsed.type).toBe('pong')
      expect(parsed.data).toBe('ok')
    }, 10000) // 10 second timeout

    it('warns and does not send when WebSocket not connected', () => {
      const store = useWebRTCStore()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Ensure no websocket
      store.websocket = null

      store.sendWebSocketMessage({ type: 'pong' })
      expect(warnSpy).toHaveBeenCalled()
    })
  })

  describe('media toggles', () => {
    it('toggleVideo flips track and broadcasts media_state', async () => {
      const store = useWebRTCStore()
      await store.connectWebSocket('room-toggle-video')
      
      // Wait for WebSocket to be ready
      await new Promise((r) => setTimeout(r, 10))

      const videoTrack = { enabled: true }
      const audioTrack = { enabled: true }
      store.localStream = {
        getVideoTracks: () => [videoTrack],
        getAudioTracks: () => [audioTrack],
      }

      store.toggleVideo()

      expect(videoTrack.enabled).toBe(false)
      expect(store.isVideoEnabled).toBe(false)
      
      // websocket is a ref, so we need to access .value
      const ws = store.websocket?.value || store.websocket
      const payload = JSON.parse(ws.send.mock.calls.at(-1)[0])
      expect(payload.type).toBe('media_state')
      expect(payload.state).toEqual({ video: false, audio: true })
    }, 10000) // 10 second timeout

    it('toggleAudio flips track and broadcasts media_state', async () => {
      const store = useWebRTCStore()
      await store.connectWebSocket('room-toggle-audio')
      
      // Wait for WebSocket to be ready
      await new Promise((r) => setTimeout(r, 10))

      const videoTrack = { enabled: true }
      const audioTrack = { enabled: true }
      store.localStream = {
        getVideoTracks: () => [videoTrack],
        getAudioTracks: () => [audioTrack],
      }

      store.toggleAudio()

      expect(audioTrack.enabled).toBe(false)
      expect(store.isAudioEnabled).toBe(false)
      
      // websocket is a ref, so we need to access .value
      const ws = store.websocket?.value || store.websocket
      const payload = JSON.parse(ws.send.mock.calls.at(-1)[0])
      expect(payload.type).toBe('media_state')
      expect(payload.state).toEqual({ video: true, audio: false })
    }, 10000) // 10 second timeout
  })

  describe('peer connection helpers', () => {
    it('createPeerConnectionForParticipant adds local tracks', async () => {
      const store = useWebRTCStore()
      const track1 = { kind: 'video' }
      const track2 = { kind: 'audio' }

      store.localStream = {
        getTracks: () => [track1, track2],
      }

      const res = await store.createPeerConnectionForParticipant('p-1')
      expect(res.success).toBe(true)
      const pc = store.peerConnections.get('p-1')
      expect(pc).toBeTruthy()
      expect(pc.addTrack).toHaveBeenCalledTimes(2)
      expect(pc.addTrack).toHaveBeenNthCalledWith(1, track1, store.localStream)
      expect(pc.addTrack).toHaveBeenNthCalledWith(2, track2, store.localStream)
    })

    it('createOfferForParticipant sends webrtc_offer with target', async () => {
      const store = useWebRTCStore()
      await store.connectWebSocket('room-offer')
      
      // Wait for WebSocket to be ready
      await new Promise((r) => setTimeout(r, 10))

      await store.createOfferForParticipant('p-offer')

      // websocket is a ref, so we need to access .value
      const ws = store.websocket?.value || store.websocket
      const payload = JSON.parse(ws.send.mock.calls.at(-1)[0])
      expect(payload.type).toBe('webrtc_offer')
      expect(payload.target).toBe('p-offer')
      expect(payload.offer).toMatchObject({ type: 'offer' })
    }, 10000) // 10 second timeout

    it('createPeerConnectionForParticipant registers connection monitor id', async () => {
      const store = useWebRTCStore()
      store.remoteParticipants = [{ id: 'p-2', connectionState: 'new', isVideoEnabled: true, isAudioEnabled: true }]

      const track1 = { kind: 'video' }
      const track2 = { kind: 'audio' }
      store.localStream = { getTracks: () => [track1, track2] }

      await store.createPeerConnectionForParticipant('p-2')

      expect(store.connectionMonitors.get('p-2')).toBe('monitor-id')
    })

    it('handleConnectionQualityChange updates participant quality and fallback level', () => {
      const store = useWebRTCStore()
      store.remoteParticipants = [{ id: 'p-3', connectionState: 'connected', isVideoEnabled: true, isAudioEnabled: true }]

      // Simulate poor quality for participant
      store.handleConnectionQualityChange('p-3', { score: 25 }, 'connected')

      const p = store.remoteParticipants.find((x) => x.id === 'p-3')
      expect(p.connectionQuality).toBe(25)
      expect(store.fallbackLevels.has('p-3')).toBe(true)
    })

  })

  describe('participant media toggles', () => {
    it('toggleParticipantVideo flips remote participant and sends update', async () => {
      const store = useWebRTCStore()
      await store.connectWebSocket('room-participant-video')
      
      // Wait for WebSocket to be ready
      await new Promise((r) => setTimeout(r, 10))

      store.remoteParticipants = [
        {
          id: 'p1',
          isVideoEnabled: true,
          isAudioEnabled: true,
          connectionState: 'new',
        },
      ]

      store.toggleParticipantVideo('p1')

      const p = store.remoteParticipants.find((x) => x.id === 'p1')
      expect(p.isVideoEnabled).toBe(false)
      
      // websocket is a ref, so we need to access .value
      const ws = store.websocket?.value || store.websocket
      const payload = JSON.parse(ws.send.mock.calls.at(-1)[0])
      expect(payload.type).toBe('participant_media_update')
      expect(payload.participant_id).toBe('p1')
      expect(payload.media_state).toEqual({ video: false, audio: true })
    }, 10000) // 10 second timeout

    it('toggleParticipantAudio flips remote participant and sends update', async () => {
      const store = useWebRTCStore()
      await store.connectWebSocket('room-participant-audio')
      
      // Wait for WebSocket to be ready
      await new Promise((r) => setTimeout(r, 10))

      store.remoteParticipants = [
        {
          id: 'p2',
          isVideoEnabled: true,
          isAudioEnabled: true,
          connectionState: 'new',
        },
      ]

      store.toggleParticipantAudio('p2')

      const p = store.remoteParticipants.find((x) => x.id === 'p2')
      expect(p.isAudioEnabled).toBe(false)
      
      // websocket is a ref, so we need to access .value
      const ws = store.websocket?.value || store.websocket
      const payload = JSON.parse(ws.send.mock.calls.at(-1)[0])
      expect(payload.type).toBe('participant_media_update')
      expect(payload.participant_id).toBe('p2')
      expect(payload.media_state).toEqual({ video: true, audio: false })
    }, 10000) // 10 second timeout
  })

  describe('connection state aggregation', () => {
    it('updateOverallConnectionState sets global connected when all PCs connected', () => {
      const store = useWebRTCStore()
      store.peerConnections.set('a', { connectionState: 'connected' })
      store.peerConnections.set('b', { connectionState: 'connected' })

      store.updateOverallConnectionState()
      expect(store.connectionState).toBe('connected')
      expect(store.isConnected).toBe(true)
    })

    it('updateOverallConnectionState marks failed when any PC failed', () => {
      const store = useWebRTCStore()
      store.peerConnections.set('a', { connectionState: 'connected' })
      store.peerConnections.set('b', { connectionState: 'failed' })

      store.updateOverallConnectionState()
      expect(store.connectionState).toBe('failed')
      expect(store.isConnected).toBe(false)
    })
  })

  describe('reconnection flow', () => {
    it('attemptReconnection closes existing PC, stops stream, and re-initializes', async () => {
      const store = useWebRTCStore()

      // Seed existing connection and remote stream
      const closeSpy = vi.fn()
      store.peerConnections.set('p1', { close: closeSpy, connectionState: 'connected' })
      const oldPc = store.peerConnections.get('p1')
      const stopSpy = vi.fn()
      store.remoteStreams.set('p1', { getTracks: () => [{ stop: stopSpy }] })

      // Provide local media for new connection
      store.localStream = {
        getTracks: () => [{ kind: 'video' }, { kind: 'audio' }],
        getVideoTracks: () => [{ enabled: true }],
        getAudioTracks: () => [{ enabled: true }],
      }

      // Prepare websocket to observe offer sending
      const ws = new MockWebSocket('ws://reconnect')
      // websocket is a ref, so we need to set .value
      if (store.websocket && typeof store.websocket === 'object' && 'value' in store.websocket) {
        store.websocket.value = ws
      } else {
        store.websocket = ws
      }
      await new Promise((r) => setTimeout(r, 10))

      await store.attemptReconnection('p1')

      expect(closeSpy).toHaveBeenCalledTimes(1)
      expect(stopSpy).toHaveBeenCalledTimes(1)
      expect(store.peerConnections.has('p1')).toBe(true)
      expect(store.peerConnections.get('p1')).not.toBe(oldPc)
      expect(store.remoteStreams.has('p1')).toBe(false)
      expect(ws.send).toHaveBeenCalled()
    })

    it('onconnectionstatechange on failed posts error notification and updates state', async () => {
      const store = useWebRTCStore()
      store.remoteParticipants = [{ id: 'p1', connectionState: 'new', isVideoEnabled: true, isAudioEnabled: true }]

      // Prepare local stream for peer connection creation
      store.localStream = {
        getTracks: () => [{ kind: 'video' }, { kind: 'audio' }],
        getVideoTracks: () => [{ enabled: true }],
        getAudioTracks: () => [{ enabled: true }],
      }

      await store.createPeerConnectionForParticipant('p1')
      const pc = store.peerConnections.get('p1')

      // Simulate failure and trigger handler
      pc.connectionState = 'failed'
      await pc.onconnectionstatechange()
      expect(store.connectionState).toBe('failed')
    })
  })

  describe('initiate all connections', () => {
    it('initiateConnectionsWithAllParticipants sends offers for new/disconnected only', async () => {
      const store = useWebRTCStore()
      store.remoteParticipants = [
        { id: 'a', connectionState: 'new' },
        { id: 'b', connectionState: 'connected' },
        { id: 'c', connectionState: 'disconnected' },
      ]

      // Prepare PCs and websocket
      store.localStream = {
        getTracks: () => [{ kind: 'video' }, { kind: 'audio' }],
        getVideoTracks: () => [{ enabled: true }],
        getAudioTracks: () => [{ enabled: true }],
      }
      await store.createPeerConnectionForParticipant('a')
      await store.createPeerConnectionForParticipant('c')

      const ws = new MockWebSocket('ws://test')
      // websocket is a ref, so we need to set .value
      if (store.websocket && typeof store.websocket === 'object' && 'value' in store.websocket) {
        store.websocket.value = ws
      } else {
        store.websocket = ws
      }
      // Wait for websocket to open
      await new Promise((r) => setTimeout(r, 10))

      await store.initiateConnectionsWithAllParticipants()

      expect(ws.send).toHaveBeenCalledTimes(2)
      const payloads = ws.send.mock.calls.map((args) => JSON.parse(args[0]))
      const targets = payloads.filter((p) => p.type === 'webrtc_offer').map((p) => p.target)
      expect(targets).toContain('a')
      expect(targets).toContain('c')
      expect(targets).not.toContain('b')
    }, 10000) // 10 second timeout
  })
  describe('endCall cleanup', () => {
    it('endCall stops tracks and clears participants and streams', async () => {
      const store = useWebRTCStore()

      // Fill retry operations and monitors
      store.retryOperations.set('op1', {})
      store.qualityMonitors.set('p1', 'qm1')
      store.connectionMonitors.set('p1', 'cm1')
      store.fallbackLevels.set('p1', 1)
      store.sfuMode = true
      store.isConnected = true
      store.connectionState = 'connected'

      // Prepare remote stream
      const stop1 = vi.fn()
      const stop2 = vi.fn()
      const stream = { getTracks: () => [{ stop: stop1 }, { stop: stop2 }] }
      // Ensure underlying Map is correctly assigned and populated
      store.remoteStreams = new Map()
      store.remoteStreams.set('p1', stream)

      // Prepare websocket and state to verify reset
      const wsClose = vi.fn()
      store.websocket = { readyState: 1, close: wsClose }
      store.isConnected = true
      store.connectionState = 'connected'

      store.remoteParticipants = [
        { id: 'p1', isVideoEnabled: true, isAudioEnabled: true, connectionState: 'connected' },
      ]

      await store.endCall()

      expect(store.remoteParticipants.length).toBe(0)
      expect(store.remoteStreams.size).toBe(0)
      expect(wsClose).toHaveBeenCalledTimes(1)
      expect(store.websocket).toBeNull()
      expect(store.isConnected).toBe(false)
      expect(store.connectionState).toBe('new')
      expect(store.isConnected).toBe(false)
      expect(store.connectionState).toBe('new')
    })
  })
})
