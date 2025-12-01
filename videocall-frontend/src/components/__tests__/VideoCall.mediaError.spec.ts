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
      remoteParticipants: [],
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

const updateSpy = vi.fn()
vi.mock('@/controllers/video-call/useVideoCallController', () => ({
  useVideoCallController: () => ({
    callState: ref({}),
    screenShare: ref({}),
    recording: ref({}),
    refreshConnection: vi.fn(),
    media: {
      updateMediaConstraints: updateSpy,
    },
  }),
}))

vi.mock('@/controllers/room/useRoomChatController', () => ({
  useRoomChatController: () => ({ chat: { markAsRead: vi.fn() } }),
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
    const audioOnlyBtn = banner.find('button:contains("Join with audio only")')
    const videoOnlyBtn = banner.find('button:contains("Join with camera only")')

    // Vue Test Utils doesn't support :contains selector; fallback to text checks
    const buttons = banner.findAll('button')
    const hasAudioOnly = buttons.some(b => b.text() === 'Join with audio only')
    const hasVideoOnly = buttons.some(b => b.text() === 'Join with camera only')

    expect(hasAudioOnly).toBe(true)
    expect(hasVideoOnly).toBe(true)

    // Click audio-only and verify updateMediaConstraints called
    const audioBtn = buttons.find(b => b.text() === 'Join with audio only')
    const videoBtn = buttons.find(b => b.text() === 'Join with camera only')
    expect(audioBtn).toBeTruthy()
    expect(videoBtn).toBeTruthy()

    await audioBtn!.trigger('click')
    await videoBtn!.trigger('click')

    expect(updateSpy).toHaveBeenCalled()
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ video: false })
    )
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ audio: false })
    )

    wrapper.unmount()
  })
})
