/**
 * Tests for VideoCallSidebar component
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoCallSidebar from '../VideoCallSidebar.vue'

// Mock RoomChat component
vi.mock('@/components/RoomChat.vue', () => ({
  default: {
    name: 'RoomChat',
    template: '<div class="room-chat-stub">Room Chat</div>',
    props: ['roomCode', 'participantId', 'websocket'],
    emits: ['close', 'new-message']
  }
}))

describe('VideoCallSidebar', () => {
  let wrapper

  const defaultProps = {
    showChat: false,
    roomCode: 'ABC123',
    participantId: 'participant-123',
    websocket: null
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createWrapper = (props = {}) => {
    return mount(VideoCallSidebar, {
      props: {
        ...defaultProps,
        ...props
      }
    })
  }

  it('should stay mounted but hidden when showChat is false', () => {
    wrapper = createWrapper({ showChat: false })
    const sidebar = wrapper.find('.absolute.right-0')
    expect(sidebar.exists()).toBe(true)
    expect(sidebar.classes()).toContain('translate-x-full')
    expect(sidebar.classes()).toContain('pointer-events-none')
    expect(sidebar.attributes('aria-hidden')).toBe('true')
  })

  it('should render when showChat is true', () => {
    wrapper = createWrapper({ showChat: true })
    const sidebar = wrapper.find('.absolute.right-0')
    expect(sidebar.exists()).toBe(true)
  })

  it('should have translate-x-0 class when showChat is true', () => {
    wrapper = createWrapper({ showChat: true })
    const sidebar = wrapper.find('.absolute.right-0')
    expect(sidebar.classes()).toContain('translate-x-0')
    expect(sidebar.classes()).toContain('pointer-events-auto')
    expect(sidebar.attributes('aria-hidden')).toBe('false')
  })

  it('should render RoomChat when showChat is true and roomCode is provided', () => {
    wrapper = createWrapper({ showChat: true, roomCode: 'ABC123' })
    const roomChat = wrapper.findComponent({ name: 'RoomChat' })
    expect(roomChat.exists()).toBe(true)
  })

  it('should not render RoomChat when roomCode is empty', () => {
    wrapper = createWrapper({ showChat: true, roomCode: '' })
    const roomChat = wrapper.findComponent({ name: 'RoomChat' })
    expect(roomChat.exists()).toBe(false)
  })

  it('should pass roomCode to RoomChat', () => {
    wrapper = createWrapper({ showChat: true, roomCode: 'TEST123' })
    const roomChat = wrapper.findComponent({ name: 'RoomChat' })
    expect(roomChat.props('roomCode')).toBe('TEST123')
  })

  it('should pass participantId to RoomChat', () => {
    wrapper = createWrapper({ 
      showChat: true, 
      participantId: 'test-participant' 
    })
    const roomChat = wrapper.findComponent({ name: 'RoomChat' })
    expect(roomChat.props('participantId')).toBe('test-participant')
  })

  it('should pass websocket to RoomChat', () => {
    const mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      close: vi.fn()
    }
    wrapper = createWrapper({ 
      showChat: true, 
      websocket: mockWebSocket 
    })
    const roomChat = wrapper.findComponent({ name: 'RoomChat' })
    expect(roomChat.props('websocket')).toEqual(mockWebSocket)
  })

  it('should emit close when RoomChat emits close', async () => {
    wrapper = createWrapper({ showChat: true })
    const roomChat = wrapper.findComponent({ name: 'RoomChat' })
    await roomChat.vm.$emit('close')
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('should emit new-message when RoomChat emits new-message', async () => {
    wrapper = createWrapper({ showChat: true })
    const roomChat = wrapper.findComponent({ name: 'RoomChat' })
    const message = { id: 'msg-123', text: 'Hello', sender: 'user-1' }
    await roomChat.vm.$emit('new-message', message)
    expect(wrapper.emitted('new-message')).toBeTruthy()
    expect(wrapper.emitted('new-message')[0][0]).toEqual(message)
  })

  it('should have correct CSS classes for sidebar', () => {
    wrapper = createWrapper({ showChat: true })
    const sidebar = wrapper.find('.absolute.right-0')
    expect(sidebar.classes()).toContain('absolute')
    expect(sidebar.classes()).toContain('right-0')
    expect(sidebar.classes()).toContain('top-0')
    expect(sidebar.classes()).toContain('bottom-0')
    expect(sidebar.classes()).toContain('w-full')
    expect(sidebar.classes()).toContain('md:w-96')
    expect(sidebar.classes()).toContain('bg-warp-surface')
    expect(sidebar.classes()).toContain('shadow-warp-md')
    expect(sidebar.classes()).toContain('border-l')
    expect(sidebar.classes()).toContain('z-20')
  })

  it('should have transition classes', () => {
    wrapper = createWrapper({ showChat: true })
    const sidebar = wrapper.find('.absolute.right-0')
    expect(sidebar.classes()).toContain('transform')
    expect(sidebar.classes()).toContain('transition-transform')
    expect(sidebar.classes()).toContain('duration-300')
  })
})
