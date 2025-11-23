/**
 * Tests for media controls functionality
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWebRTCStore } from '../webrtc'

describe('WebRTC Store - Media Controls', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should toggle video on/off', async () => {
    const store = useWebRTCStore()

    // Mock local stream with video track
    const videoTrack = { enabled: true, kind: 'video' }
    const audioTrack = { enabled: true, kind: 'audio' }

    store.localStream = {
      getVideoTracks: () => [videoTrack],
      getAudioTracks: () => [audioTrack]
    } as any

    // Mock WebSocket
    const mockWS = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn()
    }
    store.websocket = mockWS as any

    // Toggle video off
    store.toggleVideo()

    expect(videoTrack.enabled).toBe(false)
    expect(store.isVideoEnabled).toBe(false)

    // Toggle video on
    store.toggleVideo()

    expect(videoTrack.enabled).toBe(true)
    expect(store.isVideoEnabled).toBe(true)
  })

  it('should toggle audio on/off', async () => {
    const store = useWebRTCStore()

    // Mock local stream with audio track
    const videoTrack = { enabled: true, kind: 'video' }
    const audioTrack = { enabled: true, kind: 'audio' }

    store.localStream = {
      getVideoTracks: () => [videoTrack],
      getAudioTracks: () => [audioTrack]
    } as any

    // Mock WebSocket
    const mockWS = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn()
    }
    store.websocket = mockWS as any

    // Toggle audio off
    store.toggleAudio()

    expect(audioTrack.enabled).toBe(false)
    expect(store.isAudioEnabled).toBe(false)

    // Toggle audio on
    store.toggleAudio()

    expect(audioTrack.enabled).toBe(true)
    expect(store.isAudioEnabled).toBe(true)
  })

  it('should toggle participant video', async () => {
    const store = useWebRTCStore()

    // Mock participants
    store.remoteParticipants = [
      {
        id: 'participant-1',
        name: 'User 1',
        isVideoEnabled: true,
        isAudioEnabled: true,
        connectionState: 'connected'
      }
    ]

    // Mock WebSocket
    const mockWS = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn()
    }
    store.websocket = mockWS as any

    // Toggle participant video
    store.toggleParticipantVideo('participant-1')

    const participant = store.remoteParticipants.find(p => p.id === 'participant-1')
    expect(participant?.isVideoEnabled).toBe(false)
    expect(mockWS.send).toHaveBeenCalled()
  })

  it('should toggle participant audio', async () => {
    const store = useWebRTCStore()

    // Mock participants
    store.remoteParticipants = [
      {
        id: 'participant-1',
        name: 'User 1',
        isVideoEnabled: true,
        isAudioEnabled: true,
        connectionState: 'connected'
      }
    ]

    // Mock WebSocket
    const mockWS = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn()
    }
    store.websocket = mockWS as any

    // Toggle participant audio
    store.toggleParticipantAudio('participant-1')

    const participant = store.remoteParticipants.find(p => p.id === 'participant-1')
    expect(participant?.isAudioEnabled).toBe(false)
    expect(mockWS.send).toHaveBeenCalled()
  })

  it('should get participant stream', () => {
    const store = useWebRTCStore()

    // Mock remote stream
    const mockStream = {
      getTracks: () => [
        { kind: 'video', enabled: true },
        { kind: 'audio', enabled: true }
      ]
    }

    store.remoteStreams.set('participant-1', mockStream as any)

    const stream = store.getParticipantStream('participant-1')

    expect(stream).toStrictEqual(mockStream)
  })

  it('should get participant connection state', () => {
    const store = useWebRTCStore()

    // Mock participants
    store.remoteParticipants = [
      {
        id: 'participant-1',
        name: 'User 1',
        isVideoEnabled: true,
        isAudioEnabled: true,
        connectionState: 'connected'
      }
    ]

    const state = store.getParticipantConnectionState('participant-1')

    expect(state).toBe('connected')
  })

  it('should handle media constraints update', () => {
    const store = useWebRTCStore()

    // Update media constraints
    store.mediaConstraints = {
      video: {
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 60, max: 60 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    }

    expect(store.mediaConstraints.video.width.ideal).toBe(1920)
    expect(store.mediaConstraints.video.height.ideal).toBe(1080)
    expect(store.mediaConstraints.video.frameRate.ideal).toBe(60)
  })
})

