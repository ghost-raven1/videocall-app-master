import { beforeAll, vi } from 'vitest'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock window.ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock MediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [
        {
          stop: vi.fn(),
          enabled: true,
          kind: 'video',
          getSettings: () => ({ width: 640, height: 480 })
        },
        {
          stop: vi.fn(),
          enabled: true,
          kind: 'audio',
          getSettings: () => ({ volume: 0.5 })
        }
      ]
    }),
    enumerateDevices: vi.fn().mockResolvedValue([
      { deviceId: 'camera1', kind: 'videoinput', label: 'Camera 1' },
      { deviceId: 'mic1', kind: 'audioinput', label: 'Microphone 1' },
      { deviceId: 'speaker1', kind: 'audiooutput', label: 'Speaker 1' }
    ])
  }
})

// Mock WebRTC
global.RTCPeerConnection = vi.fn().mockImplementation(() => ({
  createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'test-sdp' }),
  createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'test-sdp' }),
  setLocalDescription: vi.fn().mockResolvedValue(),
  setRemoteDescription: vi.fn().mockResolvedValue(),
  addIceCandidate: vi.fn().mockResolvedValue(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onicecandidate: null,
  ontrack: null,
  onconnectionstatechange: null
}))

global.RTCDataChannel = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onopen: null,
  onmessage: null,
  onclose: null
}))

// Mock Socket.IO client
vi.mock('socket.io-client', () => ({
  io: vi.fn().mockReturnValue({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
    id: 'socket-id-123'
  })
}))

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    create: vi.fn().mockReturnThis(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() }
    }
  }
}))

// Global test utilities
global.testUtils = {
  // Helper to wait for next tick
  nextTick: () => new Promise(resolve => setTimeout(resolve, 0)),

  // Helper to create mock events
  createEvent: (type, options = {}) => new Event(type, options),

  // Helper to create mock elements
  createElement: (tag, options = {}) => {
    const element = document.createElement(tag)
    Object.assign(element, options)
    return element
  }
}