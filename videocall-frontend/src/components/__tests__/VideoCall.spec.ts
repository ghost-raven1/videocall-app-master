import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

// Mock stores and controllers heavily to render minimal template state
vi.mock('@/stores/webrtc', () => {
  const fakeStream: MediaStream = {
    active: true,
    id: 'local-stream',
    getVideoTracks: () => [{ enabled: true, readyState: 'live' } as any],
    getAudioTracks: () => [{ enabled: true, readyState: 'live' } as any],
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
  } as unknown as MediaStream

  return {
    useWebRTCStore: () => ({
      localStream: fakeStream,
      hasLocalVideo: true,
      isVideoEnabled: true,
      isAudioEnabled: true,
      remoteParticipants: [],
    }),
  }
})

vi.mock('@/stores/rooms', () => ({ useRoomsStore: () => ({}) }))
vi.mock('@/stores/global', () => ({ useGlobalStore: () => ({}) }))

vi.mock('@/controllers/video-call/useVideoCallController', () => ({
  useVideoCallController: () => ({
    callState: ref({}),
    screenShare: ref({}),
    recording: ref({}),
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

describe('VideoCall.vue', () => {
  it('renders local video with muted attribute for autoplay', async () => {
    const wrapper = mount(VideoCall, {
      attachTo: document.body,
    })

    // Find local video in single-user layout
    const videos = wrapper.findAll('video')
    expect(videos.length).toBeGreaterThan(0)

    // At least one local video element should be muted to satisfy autoplay
    const hasMuted = videos.some((v) => (v.element as HTMLVideoElement).muted === true)
    expect(hasMuted).toBe(true)

    wrapper.unmount()
  })
})

