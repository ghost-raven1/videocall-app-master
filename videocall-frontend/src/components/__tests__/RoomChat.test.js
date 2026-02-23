import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RoomChat from '../RoomChat.vue'
import { apiService } from '@/services/api'

vi.mock('@/services/api', () => ({
  apiService: {
    sendChatMessage: vi.fn(),
  },
}))

describe('RoomChat', () => {
  let wrapper
  let fetchMock
  let originalXMLHttpRequest

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
    originalXMLHttpRequest = global.XMLHttpRequest
    fetchMock = vi.fn()
    global.fetch = fetchMock
    fetchMock.mockResolvedValue({
      json: async () => ({ success: true, messages: [], attachments: [] }),
    })
    wrapper = createWrapper()
  })

  afterEach(() => {
    wrapper.unmount()
    global.XMLHttpRequest = originalXMLHttpRequest
    vi.clearAllMocks()
  })

  it('keeps Send button enabled when there is no text or file', async () => {
    const sendButton = wrapper.find('button[title="Send message (Enter)"]')
    expect(sendButton.exists()).toBe(true)
    expect(sendButton.attributes('disabled')).toBeUndefined()
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

  it('deduplicates repeated chat_message events from WebSocket', async () => {
    const listeners = new Map()
    const websocket = {
      addEventListener: vi.fn((type, handler) => listeners.set(type, handler)),
      removeEventListener: vi.fn((type) => listeners.delete(type)),
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    }

    wrapper.unmount()
    wrapper = createWrapper({ websocket })

    const payload = {
      type: 'chat_message',
      message: {
        id: 'msg-1',
        sender_id: 'participant-2',
        content: 'Hello',
        created_at: new Date().toISOString(),
        message_type: 'text',
      },
    }

    const onMessage = listeners.get('message')
    onMessage({ data: JSON.stringify(payload) })
    onMessage({ data: JSON.stringify(payload) })
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.messages.length).toBe(1)
    expect(wrapper.vm.messages[0].content).toBe('Hello')
  })

  it('broadcasts sent chat message with normalized server payload', async () => {
    const listeners = new Map()
    const websocket = {
      addEventListener: vi.fn((type, handler) => listeners.set(type, handler)),
      removeEventListener: vi.fn((type) => listeners.delete(type)),
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    }

    wrapper.unmount()
    wrapper = createWrapper({ websocket })

    apiService.sendChatMessage.mockResolvedValue({
      status: 201,
      data: {
        success: true,
        message: {
          id: 'msg-server-1',
          sender_id: 'participant-1',
          content: 'Test payload',
          created_at: new Date().toISOString(),
          message_type: 'text',
        },
      },
    })

    await wrapper.setData({ newMessage: 'Test payload' })
    await wrapper.vm.handleSendMessage()

    expect(apiService.sendChatMessage).toHaveBeenCalled()
    expect(websocket.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"chat_message"')
    )
    expect(websocket.send).toHaveBeenCalledWith(
      expect.stringContaining('"id":"msg-server-1"')
    )
    expect(wrapper.vm.messages.length).toBe(1)
  })

  it('uploads file once and clears uploading state', async () => {
    const listeners = {}
    const uploadListeners = {}
    const sentPayloads = []
    const websocket = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      readyState: WebSocket.OPEN,
      send: vi.fn((payload) => sentPayloads.push(payload)),
    }

    const createdAt = new Date().toISOString()
    class MockXHR {
      constructor() {
        this.upload = {
          addEventListener: (name, cb) => {
            uploadListeners[name] = cb
          },
        }
        this.status = 201
        this.responseText = JSON.stringify({
          success: true,
          attachment: {
            id: 'att-1',
            original_filename: 'test.txt',
            file_size: 4,
            file_type: 'document',
            file_url: '/media/test.txt',
          },
          message: {
            id: 'file-msg-1',
            sender_id: 'participant-1',
            content: 'Sent a file: test.txt',
            created_at: createdAt,
            message_type: 'file',
            attachments: [
              {
                id: 'att-1',
                original_filename: 'test.txt',
                file_size: 4,
                file_type: 'document',
                file_url: '/media/test.txt',
              },
            ],
          },
        })
      }

      addEventListener(name, cb) {
        listeners[name] = cb
      }

      open() {}

      send() {
        if (uploadListeners.progress) {
          uploadListeners.progress({
            lengthComputable: true,
            loaded: 4,
            total: 4,
          })
        }
        listeners.load()
      }
    }

    global.XMLHttpRequest = MockXHR

    wrapper.unmount()
    wrapper = createWrapper({ websocket })

    await wrapper.setData({
      selectedFile: new File(['test'], 'test.txt', { type: 'text/plain' }),
    })
    await wrapper.vm.handleSendMessage()

    expect(wrapper.vm.isUploading).toBe(false)
    expect(wrapper.vm.uploadError).toBeNull()
    expect(wrapper.vm.selectedFile).toBeNull()
    expect(sentPayloads.join('')).toContain('"type":"file_uploaded"')
  })

  it('adds a single newline on Shift+Enter', async () => {
    await wrapper.setData({ newMessage: 'Hello' })

    const mockTarget = {
      selectionStart: 5,
      selectionEnd: 5,
    }
    const preventDefault = vi.fn()

    wrapper.vm.handleShiftEnter({ target: mockTarget, preventDefault })

    expect(preventDefault).toHaveBeenCalled()
    expect(wrapper.vm.newMessage).toBe('Hello\n')
  })

  it('rejects unsupported file extension by exact match', async () => {
    const file = new File(['alert(1)'], 'script.js', { type: 'application/javascript' })
    const event = {
      target: {
        files: [file],
      },
    }

    wrapper.vm.handleFileSelect(event)
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.selectedFile).toBeNull()
    expect(wrapper.vm.uploadError).toContain('File type not supported')
  })

  it('downloads attachment through fetch/blob flow', async () => {
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn()
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn()
    }

    const createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:test')
    const revokeObjectURLSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {})
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')
    const originalCreateElement = document.createElement.bind(document)
    const anchor = originalCreateElement('a')
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {})
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName.toLowerCase() === 'a') {
        return anchor
      }
      return originalCreateElement(tagName)
    })

    fetchMock.mockImplementation((url) => {
      if (String(url).includes('/download/')) {
        return Promise.resolve({
          ok: true,
          blob: async () => new Blob(['test']),
        })
      }
      return Promise.resolve({
        json: async () => ({ success: true, messages: [], attachments: [] }),
      })
    })

    await wrapper.vm.downloadAttachment({
      id: 'att-1',
      original_filename: 'report.txt',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/rooms/chat/attachments/att-1/download/')
    expect(createObjectURLSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test')
    expect(appendSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()

    createElementSpy.mockRestore()
    clickSpy.mockRestore()
    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
