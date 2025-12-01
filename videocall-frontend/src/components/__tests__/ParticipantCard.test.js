/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ParticipantCard from '../ParticipantCard.vue'

describe('ParticipantCard', () => {
  let playSpy

  beforeEach(() => {
    // Spy on HTMLMediaElement.play to verify it is called
    playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  })

  it('mutes local video element to allow autoplay', async () => {
    const mockStream = {
      getVideoTracks: () => [{ enabled: true }],
      getAudioTracks: () => [{ enabled: true }],
      active: true
    }

    const participant = {
      id: 'local',
      name: 'Local User',
      stream: mockStream,
      isVideoEnabled: true,
      isAudioEnabled: true,
      connectionState: 'connected',
      audioLevel: 0
    }

    const wrapper = mount(ParticipantCard, {
      props: {
        participant,
        isLocal: true,
        size: 'medium',
        showControls: false
      }
    })

    await wrapper.vm.$nextTick()

    const videoEl = wrapper.find('video').element
    expect(videoEl).toBeTruthy()
    // Ensure the video element is muted for local preview
    expect(videoEl.muted).toBe(true)
    // Autoplay should be attempted at least once via play()
    expect(playSpy).toHaveBeenCalled()
  })
})

