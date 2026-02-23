/**
 * Tests for VideoCallHeader component
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoCallHeader from '../VideoCallHeader.vue'

// Mock AudioSettings component
vi.mock('@/components/AudioSettings.vue', () => ({
  default: {
    name: 'AudioSettings',
    template: '<div class="audio-settings-stub">Audio Settings</div>',
    emits: ['settings-changed']
  }
}))

// Mock utils service
vi.mock('@/services/utils', () => ({
  utils: {
    formatDuration: vi.fn((seconds) => {
      const hrs = Math.floor(seconds / 3600)
      const mins = Math.floor((seconds % 3600) / 60)
      const secs = Math.floor(seconds % 60)
      if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      } else {
        return `${mins}:${secs.toString().padStart(2, '0')}`
      }
    })
  }
}))

describe('VideoCallHeader', () => {
  let wrapper

  const defaultProps = {
    roomCode: 'ABC123',
    connectionStatusText: 'Connected',
    connectionStatusColor: 'bg-green-400',
    callDuration: 0,
    participantCount: 2,
    unreadMessages: 0,
    isScreenSharing: false,
    isRecording: false,
    showMenu: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createWrapper = (props = {}) => {
    return mount(VideoCallHeader, {
      props: {
        ...defaultProps,
        ...props
      },
      global: {
        directives: {
          'click-outside': {
            mounted: () => {},
            unmounted: () => {}
          }
        }
      },
    })
  }

  it('should render room code', () => {
    wrapper = createWrapper({ roomCode: 'TEST123' })
    expect(wrapper.text()).toContain('Room TEST123')
  })

  it('should display connection status', () => {
    wrapper = createWrapper({
      connectionStatusText: 'Connecting...',
      connectionStatusColor: 'bg-yellow-400'
    })
    expect(wrapper.text()).toContain('Connecting...')
    const statusDot = wrapper.find('.w-2.h-2')
    expect(statusDot.classes()).toContain('bg-yellow-400')
  })

  it('should display call duration when greater than 0', () => {
    wrapper = createWrapper({ callDuration: 125 })
    expect(wrapper.text()).toContain('2:05')
  })

  it('should not display call duration when 0', () => {
    wrapper = createWrapper({ callDuration: 0 })
    const durationElement = wrapper.find('.text-sm.text-warp-muted.font-mono')
    expect(durationElement.exists()).toBe(false)
  })

  it('should display participant count', () => {
    wrapper = createWrapper({ participantCount: 5 })
    expect(wrapper.text()).toContain('5')
  })

  it('should display unread messages badge', () => {
    wrapper = createWrapper({ unreadMessages: 3 })
    const badge = wrapper.find('.bg-red-500')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('3')
  })

  it('should display 9+ for more than 9 unread messages', () => {
    wrapper = createWrapper({ unreadMessages: 15 })
    const badge = wrapper.find('.bg-red-500')
    expect(badge.text()).toBe('9+')
  })

  it('should emit toggle-chat when chat button is clicked', async () => {
    wrapper = createWrapper()
    const chatButton = wrapper.find('[data-test="toggle-chat-button"]')
    expect(chatButton.exists()).toBe(true)
    await chatButton.trigger('click')
    expect(wrapper.emitted('toggle-chat')).toBeTruthy()
    expect(wrapper.emitted('toggle-chat')).toHaveLength(1)
  })

  it('should emit toggle-screen-share when screen share button is clicked', async () => {
    wrapper = createWrapper()
    const screenShareButton = wrapper.find('[data-test="toggle-screen-share-button"]')
    expect(screenShareButton.exists()).toBe(true)
    await screenShareButton.trigger('click')
    expect(wrapper.emitted('toggle-screen-share')).toBeTruthy()
    expect(wrapper.emitted('toggle-screen-share')).toHaveLength(1)
  })

  it('should show active state for screen sharing', () => {
    wrapper = createWrapper({ isScreenSharing: true })
    const screenShareButton = wrapper.find('[data-test="toggle-screen-share-button"]')
    expect(screenShareButton.exists()).toBe(true)
    expect(screenShareButton.classes()).toContain('bg-warp-accent2')
  })

  it('should emit toggle-menu when menu button is clicked', async () => {
    wrapper = createWrapper()
    const menuBtn = wrapper.find('[data-test="toggle-menu-button"]')
    expect(menuBtn.exists()).toBe(true)
    await menuBtn.trigger('click')
    expect(wrapper.emitted('toggle-menu')).toBeTruthy()
  })

  it('should show dropdown menu when showMenu is true', () => {
    wrapper = createWrapper({ showMenu: true })
    const menu = wrapper.find('.absolute.right-0.mt-2')
    expect(menu.exists()).toBe(true)
  })

  it('should not show dropdown menu when showMenu is false', () => {
    wrapper = createWrapper({ showMenu: false })
    const menu = wrapper.find('.absolute.right-0.mt-2')
    expect(menu.exists()).toBe(false)
  })

  it('should emit share-room when share button in menu is clicked', async () => {
    wrapper = createWrapper({ showMenu: true })
    const shareButton = wrapper.find('[data-test="share-room-button"]')
    expect(shareButton.exists()).toBe(true)
    await shareButton.trigger('click')
    expect(wrapper.emitted('share-room')).toBeTruthy()
  })

  it('should emit toggle-recording when recording button in menu is clicked', async () => {
    wrapper = createWrapper({ showMenu: true })
    const recordingButton = wrapper.find('[data-test="toggle-recording-button"]')
    expect(recordingButton.exists()).toBe(true)
    await recordingButton.trigger('click')
    expect(wrapper.emitted('toggle-recording')).toBeTruthy()
  })

  it('should show "Остановить запись" when recording is active', () => {
    wrapper = createWrapper({ showMenu: true, isRecording: true })
    expect(wrapper.text()).toContain('Остановить запись')
  })

  it('should show "Начать запись" when recording is not active', () => {
    wrapper = createWrapper({ showMenu: true, isRecording: false })
    expect(wrapper.text()).toContain('Начать запись')
  })

  it('should emit toggle-stats when stats button in menu is clicked', async () => {
    wrapper = createWrapper({ showMenu: true })
    const statsButton = wrapper.find('[data-test="toggle-stats-button"]')
    expect(statsButton.exists()).toBe(true)
    await statsButton.trigger('click')
    expect(wrapper.emitted('toggle-stats')).toBeTruthy()
  })

  it('should emit end-call when end call button in menu is clicked', async () => {
    wrapper = createWrapper({ showMenu: true })
    const endCallButton = wrapper.find('[data-test="end-call-button"]')
    expect(endCallButton.exists()).toBe(true)
    await endCallButton.trigger('click')
    expect(wrapper.emitted('end-call')).toBeTruthy()
  })

  it('should emit audio-settings-changed when AudioSettings emits settings-changed', async () => {
    wrapper = createWrapper()
    const audioSettings = wrapper.findComponent({ name: 'AudioSettings' })
    if (audioSettings.exists()) {
      await audioSettings.vm.$emit('settings-changed', { volume: 0.8 })
      expect(wrapper.emitted('audio-settings-changed')).toBeTruthy()
      expect(wrapper.emitted('audio-settings-changed')[0][0]).toEqual({ volume: 0.8 })
    }
  })
})
