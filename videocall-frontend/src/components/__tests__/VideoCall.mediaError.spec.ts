import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

// Mock stores and controllers to render minimal template state
vi.mock('@/stores/webrtc', () => {
  return {
    useWebRTCStore: () => ({
      localStream: null,
      isVideoEnabled: false,
      isAudioEnabled: false,
      isMultiUserCall: false,
      participantCount: 1,
      hasRemoteVideo: false,
      hasLocalVideo: false,
      remoteStream: null,
      remoteParticipants: [],
      remoteScreenShareStreams: new Map(),
      peerConnections: new Map(),
      sfuMode: false,
      sfuPeerConnection: null,
      sfuManager: null,
      localScreenShareStream: null,
      toggleAudio: vi.fn(),
      toggleVideo: vi.fn(),
      connectionState: 'new',
      mediaConstraints: {
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      },
    }),
  }
})

vi.mock('@/stores/rooms', () => ({ useRoomsStore: () => ({}) }))
vi.mock('@/stores/global', () => ({ useGlobalStore: () => ({}) }))

const updateSpy = vi.fn().mockResolvedValue({ success: true })
const initializeCallSpy = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/controllers/video-call/useVideoCallController', () => ({
  useVideoCallController: () => ({
    roomInfo: ref(null),
    initializeCall: initializeCallSpy,
    handleEndCall: vi.fn(),
    reset: vi.fn(),
    callState: {
      connectionStatusText: ref('Connected'),
      connectionStatusColor: ref('bg-green-400'),
      callDuration: ref(0),
      isConnecting: ref(false),
      connectingMessage: ref(''),
      connectingSubMessage: ref(''),
      callStartTime: ref(null),
    },
    screenShare: {
      isScreenSharing: ref(false),
      screenShareStream: ref(null),
      toggleScreenShare: vi.fn(),
    },
    recording: {
      isRecording: ref(false),
      loadRecordings: vi.fn(),
      toggleRecording: vi.fn(),
      reset: vi.fn(),
    },
    refreshConnection: vi.fn(),
    media: {
      updateMediaConstraints: updateSpy,
    },
  }),
}))

vi.mock('@/controllers/room/useRoomChatController', () => ({
  useRoomChatController: () => ({
    isOpen: ref(false),
    unreadCount: ref(0),
    addMessage: vi.fn(),
    markAsRead: vi.fn(),
    updateContext: vi.fn(),
    reset: vi.fn(),
    toggleChat: vi.fn(),
    closeChat: vi.fn(),
  }),
}))

vi.mock('@/services/webrtc', () => ({ webrtcService: {} }))
vi.mock('@/services/utils', () => ({ utils: { normalizeRouteParam: (v: any) => String(v ?? '').trim() } }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { roomId: 'test-room' } }) }))

// Stub heavy child components
vi.mock('@/components/ParticipantGrid.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/VideoCallHeader.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/VideoCallControls.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/VideoCallSidebar.vue', () => ({ default: { template: '<div />' } }))

import VideoCall from '@/components/VideoCall.vue'

describe('VideoCall.vue media error banner', () => {
  it('renders fallback buttons when device is busy (NotReadableError)', async () => {
    const wrapper = mount(VideoCall, { attachTo: document.body })

    // Simulate busy device error
    // Matches store message: "Camera or microphone is already in use by another application."
    ;(wrapper.vm as any).mediaError = 'Camera or microphone is already in use by another application.'
    await wrapper.vm.$nextTick()

    const banner = wrapper.find('[data-test="media-error-banner"]')
    expect(banner.exists()).toBe(true)

    // Check for fallback buttons
    const buttons = banner.findAll('button')
    const hasAudioOnly = buttons.some(b => b.text() === 'Join with audio only')
    const hasVideoOnly = buttons.some(b => b.text() === 'Join with camera only')

    expect(hasAudioOnly).toBe(true)
    expect(hasVideoOnly).toBe(true)

    // Click fallback actions and verify they trigger full call initialization
    const audioBtn = buttons.find(b => b.text() === 'Join with audio only')
    const videoBtn = buttons.find(b => b.text() === 'Join with camera only')
    expect(audioBtn).toBeTruthy()
    expect(videoBtn).toBeTruthy()

    await audioBtn!.trigger('click')
    await videoBtn!.trigger('click')

    expect(updateSpy).not.toHaveBeenCalled()
    expect(initializeCallSpy).toHaveBeenCalled()
    // 1 initial mount call + 2 fallback button clicks
    expect(initializeCallSpy.mock.calls.length).toBeGreaterThanOrEqual(3)

    wrapper.unmount()
  })
})
