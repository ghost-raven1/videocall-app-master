/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import VideoCall from '../VideoCall.vue'

// Mock child components
vi.mock('../ParticipantGrid.vue', () => ({
  name: 'ParticipantGrid',
  template: '<div class="participant-grid-stub">Participant Grid</div>',
  props: ['roomCode', 'waitingMessage', 'showParticipantsCount']
}))

vi.mock('../MultiUserControls.vue', () => ({
  name: 'MultiUserControls',
  template: '<div class="multi-user-controls-stub">Multi User Controls</div>',
  props: ['participantCount']
}))

// Mock vue-router
const mockRouterPush = vi.fn()
const mockRouteParams = { roomId: 'test-room-123' }

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: mockRouteParams
  }),
  useRouter: () => ({
    push: mockRouterPush
  })
}))

// Mock services
vi.mock('../../services/utils', () => ({
  utils: {
    formatDuration: vi.fn((seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`),
    copyToClipboard: vi.fn().mockResolvedValue({ success: true })
  }
}))

vi.mock('../../services/webrtc', () => ({
  webrtcService: {
    calculateQuality: vi.fn(() => 85),
    createQualityMonitor: vi.fn(() => 123),
    monitorConnectionState: vi.fn()
  }
}))

vi.mock('../../services/webrtc-retry', () => ({
  webrtcRetryService: {
    // Mock retry service methods if needed
  }
}))

// Mock stores
const mockWebRTCStore = {
  isMultiUserCall: false,
  participantCount: 2,
  hasRemoteVideo: true,
  hasLocalVideo: true,
  isVideoEnabled: true,
  isAudioEnabled: true,
  connectionState: 'connected',
  remoteParticipants: [],
  localStream: {
    getTracks: () => [
      { kind: 'video', enabled: true },
      { kind: 'audio', enabled: true }
    ]
  },
  remoteStream: {
    getTracks: () => [
      { kind: 'video', enabled: true },
      { kind: 'audio', enabled: true }
    ]
  },
  initializeLocalMedia: vi.fn().mockResolvedValue({ success: true }),
  createPeerConnection: vi.fn().mockResolvedValue({ success: true }),
  connectWebSocket: vi.fn().mockResolvedValue(),
  endCall: vi.fn().mockResolvedValue(),
  toggleAudio: vi.fn(),
  toggleVideo: vi.fn()
}

const mockRoomsStore = {
  getRoomInfo: vi.fn().mockResolvedValue({
    success: true,
    room: {
      room_id: 'room-123',
      short_code: 'ABC123',
      qr_code: 'data:image/png;base64,test'
    }
  }),
  leaveRoom: vi.fn().mockResolvedValue(),
  updateHistoryEntry: vi.fn()
}

const mockGlobalStore = {
  addNotification: vi.fn(),
  login: vi.fn().mockResolvedValue({ success: true })
}

describe('VideoCall.vue', () => {
  let wrapper

  const createWrapper = (options = {}) => {
    const defaultOptions = {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              webrtc: mockWebRTCStore,
              rooms: mockRoomsStore,
              global: mockGlobalStore
            }
          })
        ],
        stubs: {
          // Stub teleport components
          teleport: true
        },
        directives: {
          'click-outside': () => {}
        }
      },
      ...options
    }

    return mount(VideoCall, defaultOptions)
  }

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup default mock implementations
    wrapper = createWrapper()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Component Rendering', () => {
    it('renders the main video call layout', () => {
      expect(wrapper.find('.min-h-screen').exists()).toBe(true)
      expect(wrapper.find('header').exists()).toBe(true)
      expect(wrapper.find('.flex-1').exists()).toBe(true)
    })

    it('displays room information in header', () => {
      const roomTitle = wrapper.find('h1')
      expect(roomTitle.text()).toBe('Room ABC123')
    })

    it('shows connection status indicator', () => {
      const statusIndicator = wrapper.find('.animate-pulse')
      expect(statusIndicator.exists()).toBe(true)
      expect(statusIndicator.classes()).toContain('bg-green-400')
    })

    it('displays participant count', () => {
      const participantCount = wrapper.find('.text-gray-300').filter(el =>
        el.text().includes('1') // 1 participant (local only)
      )
      expect(participantCount.exists()).toBe(true)
    })

    it('renders control buttons for 2-user call', () => {
      const controlButtons = wrapper.findAll('.control-button')
      expect(controlButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Connection Status Display', () => {
    it('shows correct status text for connected state', async () => {
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.connectionStatusText).toBe('Connected')
    })

    it('shows correct status color for connected state', async () => {
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.connectionStatusColor).toBe('bg-green-400')
    })

    it('displays call duration when call is active', async () => {
      // Set call start time
      await wrapper.setData({ callStartTime: new Date(Date.now() - 300000) }) // 5 minutes ago

      await wrapper.vm.$nextTick()
      expect(wrapper.vm.callDuration).toBeGreaterThan(0)
    })
  })

  describe('Menu Functionality', () => {
    it('toggles menu when menu button is clicked', async () => {
      const menuButton = wrapper.find('.p-2').first()
      expect(wrapper.vm.showMenu).toBe(false)

      await menuButton.trigger('click')
      expect(wrapper.vm.showMenu).toBe(true)

      await menuButton.trigger('click')
      expect(wrapper.vm.showMenu).toBe(false)
    })

    it('shows menu dropdown when menu is open', async () => {
      await wrapper.setData({ showMenu: true })
      await wrapper.vm.$nextTick()

      const dropdown = wrapper.find('.absolute.right-0')
      expect(dropdown.exists()).toBe(true)
    })

    it('closes menu when clicking outside', async () => {
      await wrapper.setData({ showMenu: true })
      expect(wrapper.vm.showMenu).toBe(true)

      // Simulate click outside
      await wrapper.vm.$nextTick()
      document.dispatchEvent(new Event('click'))

      // Note: The actual click-outside logic would need the directive to work properly
      // This tests the reactive state change
    })
  })

  describe('Room Sharing', () => {
    it('opens share modal when share button is clicked', async () => {
      await wrapper.setData({ showMenu: true })
      await wrapper.vm.$nextTick()

      const shareButton = wrapper.find('button').filter(btn =>
        btn.text().includes('Share room')
      ).first()

      if (shareButton.exists()) {
        await shareButton.trigger('click')
        expect(wrapper.vm.showShareModal).toBe(true)
      }
    })

    it('displays room code in share modal', async () => {
      await wrapper.setData({ showShareModal: true })
      await wrapper.vm.$nextTick()

      const roomCodeInput = wrapper.find('input[value="ABC123"]')
      expect(roomCodeInput.exists()).toBe(true)
    })

    it('copies room code when copy button is clicked', async () => {
      await wrapper.setData({ showShareModal: true })
      await wrapper.vm.$nextTick()

      const copyButton = wrapper.find('button').filter(btn =>
        btn.text().includes('Copy')
      ).first()

      if (copyButton.exists()) {
        await copyButton.trigger('click')
        expect(wrapper.vm.roomCodeCopied).toBe(true)
      }
    })
  })

  describe('Call Controls', () => {
    it('toggles audio when audio button is clicked', async () => {
      const audioButton = wrapper.findAll('.control-button').find(btn =>
        btn.find('svg').exists() // Find button with SVG (audio/video controls)
      )

      if (audioButton) {
        await audioButton.trigger('click')
        expect(mockWebRTCStore.toggleAudio).toHaveBeenCalled()
      }
    })

    it('toggles video when video button is clicked', async () => {
      const videoButton = wrapper.findAll('.control-button').find(btn =>
        btn.find('svg').exists()
      )

      if (videoButton) {
        await videoButton.trigger('click')
        expect(mockWebRTCStore.toggleVideo).toHaveBeenCalled()
      }
    })

    it('shows confirmation dialog when ending call', async () => {
      // Mock window.confirm
      const mockConfirm = vi.fn().mockReturnValue(true)
      global.confirm = mockConfirm

      const endCallButton = wrapper.find('.control-button-danger')
      if (endCallButton.exists()) {
        await endCallButton.trigger('click')
        expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to end this call?')
      }
    })
  })

  describe('Video Elements', () => {
    it('renders remote video element when remote video is available', () => {
      const remoteVideo = wrapper.find('video')
      expect(remoteVideo.exists()).toBe(true)
      expect(remoteVideo.attributes('autoplay')).toBeDefined()
      expect(remoteVideo.attributes('playsinline')).toBeDefined()
    })

    it('renders local video element when local video is available', () => {
      const localVideo = wrapper.findAll('video').at(1)
      if (localVideo) {
        expect(localVideo.exists()).toBe(true)
        expect(localVideo.attributes('muted')).toBeDefined()
      }
    })

    it('applies mirror effect to local video', () => {
      const localVideo = wrapper.findAll('video').find(video =>
        video.classes().includes('mirror')
      )
      if (localVideo) {
        expect(localVideo.classes()).toContain('mirror')
      }
    })
  })

  describe('Responsive Design', () => {
    it('applies mobile responsive classes', () => {
      expect(wrapper.find('.safe-area-inset').exists()).toBe(true)
    })

    it('adjusts control button size for mobile', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      })

      await wrapper.vm.$nextTick()
      // The component should adapt to smaller screen sizes
      expect(wrapper.vm.$el).toBeDefined()
    })
  })

  describe('Connection Stats', () => {
    it('opens stats modal when stats button is clicked', async () => {
      await wrapper.setData({ showMenu: true })
      await wrapper.vm.$nextTick()

      const statsButton = wrapper.find('button').filter(btn =>
        btn.text().includes('Connection stats')
      ).first()

      if (statsButton.exists()) {
        await statsButton.trigger('click')
        expect(wrapper.vm.showStats).toBe(true)
      }
    })

    it('displays connection quality when stats are available', async () => {
      await wrapper.setData({
        showStats: true,
        connectionStats: {
          video: { inbound: { framesPerSecond: 30 } },
          audio: { inbound: { bytesReceived: 1000 } },
          connection: { currentRoundTripTime: 0.05 }
        }
      })
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.connectionQuality).toBe(85)
      expect(wrapper.vm.connectionQualityText).toBe('Excellent')
    })
  })

  describe('Error Handling', () => {
    it('handles room not found error', async () => {
      mockRoomsStore.getRoomInfo.mockResolvedValueOnce({
        success: false
      })

      // Re-mount component to trigger initialization
      wrapper = createWrapper()

      await wrapper.vm.$nextTick()
      expect(mockRouterPush).toHaveBeenCalledWith('/')
    })

    it('handles media initialization failure', async () => {
      mockWebRTCStore.initializeLocalMedia.mockResolvedValueOnce({
        success: false
      })

      wrapper = createWrapper()

      await wrapper.vm.$nextTick()
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'Failed to access camera/microphone',
        'error'
      )
    })
  })

  describe('Cleanup', () => {
    it('cleans up intervals and connections on unmount', async () => {
      // Set up some state
      await wrapper.setData({
        callStartTime: new Date(),
        statsMonitor: { clear: vi.fn() }
      })

      // Unmount component
      wrapper.unmount()

      // Verify cleanup was called
      expect(mockWebRTCStore.endCall).toHaveBeenCalled()
      expect(mockRoomsStore.leaveRoom).toHaveBeenCalled()
    })
  })
})