import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RoomChat from '../RoomChat.vue'

describe('RoomChat', () => {
  let wrapper

  const defaultProps = {
    roomCode: 'TEST123',
    participantId: 'participant-1',
    websocket: null,
  }

  const createWrapper = (props = {}) => {
    return mount(RoomChat, {
      props: { ...defaultProps, ...props },
    })
  }

  beforeEach(() => {
    wrapper = createWrapper()
  })

  it('disables Send button when there is no text or file', async () => {
    const sendButton = wrapper.find('button[title="Send message (Enter)"]')
    expect(sendButton.exists()).toBe(true)
    expect(sendButton.attributes('disabled')).toBeDefined()
  })

  it('enables Send button when message text is present', async () => {
    await wrapper.setData({ newMessage: 'Hello' })
    await wrapper.vm.$nextTick()
    const sendButton = wrapper.find('button[title="Send message (Enter)"]')
    expect(sendButton.attributes('disabled')).toBeUndefined()
  })

  it('enables Send button when a file is selected', async () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    await wrapper.setData({ selectedFile: file })
    await wrapper.vm.$nextTick()
    const sendButton = wrapper.find('button[title="Send message (Enter)"]')
    expect(sendButton.attributes('disabled')).toBeUndefined()
  })
})

