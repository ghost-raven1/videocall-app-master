/**
 * Tests for VideoCallControls component
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoCallControls from '../VideoCallControls.vue'

// Mock child components
vi.mock('@/components/RecordingControls.vue', () => ({
  default: {
    name: 'RecordingControls',
    template: '<div class="recording-controls-stub">Recording Controls</div>',
    props: ['roomCode', 'participantId'],
    emits: ['recording-started', 'recording-stopped']
  }
}))

vi.mock('@/components/MultiUserControls.vue', () => ({
  default: {
    name: 'MultiUserControls',
    template: '<div class="multi-user-controls-stub">Multi User Controls</div>',
    props: ['participantCount'],
    emits: ['layout-changed', 'screen-share-toggled', 'recording-toggled', 'participant-pinned']
  }
}))

describe('VideoCallControls', () => {
  let wrapper

  const defaultProps = {
    roomCode: 'ABC123',
    participantId: 'participant-123',
    isMultiUserCall: false,
    participantCount: 2,
    isAudioEnabled: true,
    isVideoEnabled: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createWrapper = (props = {}) => {
    return mount(VideoCallControls, {
      props: {
        ...defaultProps,
        ...props
      }
    })
  }

  describe('Recording Controls', () => {
    it('should render RecordingControls when roomCode is provided', () => {
      wrapper = createWrapper({ roomCode: 'ABC123' })
      const recordingControls = wrapper.findComponent({ name: 'RecordingControls' })
      expect(recordingControls.exists()).toBe(true)
    })

    it('should not render RecordingControls when roomCode is empty', () => {
      wrapper = createWrapper({ roomCode: '' })
      const recordingControls = wrapper.findComponent({ name: 'RecordingControls' })
      expect(recordingControls.exists()).toBe(false)
    })

    it('should pass roomCode and participantId to RecordingControls', () => {
      wrapper = createWrapper({
        roomCode: 'TEST123',
        participantId: 'test-participant'
      })
      const recordingControls = wrapper.findComponent({ name: 'RecordingControls' })
      expect(recordingControls.props('roomCode')).toBe('TEST123')
      expect(recordingControls.props('participantId')).toBe('test-participant')
    })

    it('should emit recording-started when RecordingControls emits it', async () => {
      wrapper = createWrapper()
      const recordingControls = wrapper.findComponent({ name: 'RecordingControls' })
      await recordingControls.vm.$emit('recording-started', { recordingId: 'rec-123' })
      expect(wrapper.emitted('recording-started')).toBeTruthy()
      expect(wrapper.emitted('recording-started')[0][0]).toEqual({ recordingId: 'rec-123' })
    })

    it('should emit recording-stopped when RecordingControls emits it', async () => {
      wrapper = createWrapper()
      const recordingControls = wrapper.findComponent({ name: 'RecordingControls' })
      await recordingControls.vm.$emit('recording-stopped', { recordingId: 'rec-123' })
      expect(wrapper.emitted('recording-stopped')).toBeTruthy()
      expect(wrapper.emitted('recording-stopped')[0][0]).toEqual({ recordingId: 'rec-123' })
    })
  })

  describe('Multi-user controls', () => {
    it('should render MultiUserControls when isMultiUserCall is true', () => {
      wrapper = createWrapper({ isMultiUserCall: true, participantCount: 5 })
      const multiUserControls = wrapper.findComponent({ name: 'MultiUserControls' })
      expect(multiUserControls.exists()).toBe(true)
    })

    it('should not render MultiUserControls when isMultiUserCall is false', () => {
      wrapper = createWrapper({ isMultiUserCall: false })
      const multiUserControls = wrapper.findComponent({ name: 'MultiUserControls' })
      expect(multiUserControls.exists()).toBe(false)
    })

    it('should pass participantCount to MultiUserControls', () => {
      wrapper = createWrapper({ isMultiUserCall: true, participantCount: 7 })
      const multiUserControls = wrapper.findComponent({ name: 'MultiUserControls' })
      expect(multiUserControls.props('participantCount')).toBe(7)
    })

    it('should emit layout-changed when MultiUserControls emits it', async () => {
      wrapper = createWrapper({ isMultiUserCall: true })
      const multiUserControls = wrapper.findComponent({ name: 'MultiUserControls' })
      await multiUserControls.vm.$emit('layout-changed', { layout: 'grid' })
      expect(wrapper.emitted('layout-changed')).toBeTruthy()
      expect(wrapper.emitted('layout-changed')[0][0]).toEqual({ layout: 'grid' })
    })

    it('should emit screen-share-toggled when MultiUserControls emits it', async () => {
      wrapper = createWrapper({ isMultiUserCall: true })
      const multiUserControls = wrapper.findComponent({ name: 'MultiUserControls' })
      await multiUserControls.vm.$emit('screen-share-toggled', { enabled: true })
      expect(wrapper.emitted('screen-share-toggled')).toBeTruthy()
    })

    it('should emit recording-toggled when MultiUserControls emits it', async () => {
      wrapper = createWrapper({ isMultiUserCall: true })
      const multiUserControls = wrapper.findComponent({ name: 'MultiUserControls' })
      await multiUserControls.vm.$emit('recording-toggled', { enabled: true })
      expect(wrapper.emitted('recording-toggled')).toBeTruthy()
    })

    it('should emit participant-pinned when MultiUserControls emits it', async () => {
      wrapper = createWrapper({ isMultiUserCall: true })
      const multiUserControls = wrapper.findComponent({ name: 'MultiUserControls' })
      await multiUserControls.vm.$emit('participant-pinned', { participantId: 'participant-123' })
      expect(wrapper.emitted('participant-pinned')).toBeTruthy()
    })
  })

  describe('Standard controls (2-user calls)', () => {
    it('should render standard controls when isMultiUserCall is false', () => {
      wrapper = createWrapper({ isMultiUserCall: false })
      const toggleAudioButton = wrapper.findAll('button').find(btn => 
        btn.attributes('title')?.includes('microphone')
      )
      expect(toggleAudioButton).toBeTruthy()
    })

    it('should emit toggle-audio when audio button is clicked', async () => {
      wrapper = createWrapper({ isMultiUserCall: false })
      const audioButton = wrapper.findAll('button').find(btn => 
        btn.attributes('title')?.includes('microphone')
      )
      if (audioButton) {
        await audioButton.trigger('click')
        expect(wrapper.emitted('toggle-audio')).toBeTruthy()
      }
    })

    it('should show active state when audio is enabled', () => {
      wrapper = createWrapper({ isMultiUserCall: false, isAudioEnabled: true })
      const audioButton = wrapper.findAll('button').find(btn => 
        btn.attributes('title')?.includes('microphone')
      )
      if (audioButton) {
        expect(audioButton.classes()).toContain('control-button-active')
      }
    })

    it('should show danger state when audio is disabled', () => {
      wrapper = createWrapper({ isMultiUserCall: false, isAudioEnabled: false })
      const audioButton = wrapper.findAll('button').find(btn => 
        btn.attributes('title')?.includes('microphone')
      )
      if (audioButton) {
        expect(audioButton.classes()).toContain('control-button-danger')
      }
    })

    it('should emit toggle-video when video button is clicked', async () => {
      wrapper = createWrapper({ isMultiUserCall: false })
      const videoButton = wrapper.findAll('button').find(btn => 
        btn.attributes('title')?.includes('camera')
      )
      if (videoButton) {
        await videoButton.trigger('click')
        expect(wrapper.emitted('toggle-video')).toBeTruthy()
      }
    })

    it('should show active state when video is enabled', () => {
      wrapper = createWrapper({ isMultiUserCall: false, isVideoEnabled: true })
      const videoButton = wrapper.findAll('button').find(btn => 
        btn.attributes('title')?.includes('camera')
      )
      if (videoButton) {
        expect(videoButton.classes()).toContain('control-button-active')
      }
    })

    it('should show danger state when video is disabled', () => {
      wrapper = createWrapper({ isMultiUserCall: false, isVideoEnabled: false })
      const videoButton = wrapper.findAll('button').find(btn => 
        btn.attributes('title')?.includes('camera')
      )
      if (videoButton) {
        expect(videoButton.classes()).toContain('control-button-danger')
      }
    })

    it('should emit share-room when share button is clicked', async () => {
      wrapper = createWrapper({ isMultiUserCall: false })
      const shareButton = wrapper.findAll('button').find(btn => 
        btn.attributes('title') === 'Share room'
      )
      if (shareButton) {
        await shareButton.trigger('click')
        expect(wrapper.emitted('share-room')).toBeTruthy()
      }
    })

    it('should emit end-call when end call button is clicked', async () => {
      wrapper = createWrapper({ isMultiUserCall: false })
      const endCallButton = wrapper.findAll('button').find(btn => 
        btn.attributes('title') === 'End call'
      )
      if (endCallButton) {
        await endCallButton.trigger('click')
        expect(wrapper.emitted('end-call')).toBeTruthy()
      }
    })
  })
})

