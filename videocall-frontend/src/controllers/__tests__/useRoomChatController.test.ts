/**
 * Tests for useRoomChatController
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGlobalStore } from '@/stores/global'
import { apiService } from '@/services/api'
import { useRoomChatController, type ChatMessage } from '../room/useRoomChatController'

vi.mock('@/stores/global', () => ({
  useGlobalStore: vi.fn(),
}))

vi.mock('@/services/api', () => ({
  apiService: {
    sendChatMessage: vi.fn(),
    uploadChatFile: vi.fn(),
    getChatHistory: vi.fn(),
  },
}))

describe('useRoomChatController', () => {
  let mockGlobalStore: { addNotification: ReturnType<typeof vi.fn> }
  let websocket: { readyState: number; send: ReturnType<typeof vi.fn> }

  const createController = () =>
    useRoomChatController('ROOM123', 'participant-1', 'Tester', websocket as unknown as WebSocket)

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())

    mockGlobalStore = {
      addNotification: vi.fn(),
    }
    vi.mocked(useGlobalStore).mockReturnValue(mockGlobalStore as any)

    websocket = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    }

    vi.mocked(apiService.sendChatMessage).mockResolvedValue({
      data: {
        success: true,
        message: {
          id: 'msg_server_1',
          created_at: '2026-02-23T12:00:00.000Z',
          content: 'Hello',
        },
      },
    } as any)

    vi.mocked(apiService.uploadChatFile).mockResolvedValue({
      data: {
        success: true,
        message: {
          id: 'msg_file_1',
          created_at: '2026-02-23T12:00:00.000Z',
          content: 'Shared file',
        },
        attachment: {
          original_filename: 'test.txt',
          file_size: 11,
          file: '/uploads/test.txt',
        },
      },
    } as any)

    vi.mocked(apiService.getChatHistory).mockResolvedValue({
      data: {
        success: true,
        messages: [],
      },
    } as any)
  })

  it('initializes with defaults', () => {
    const controller = createController()

    expect(controller.messages.value).toEqual([])
    expect(controller.unreadCount.value).toBe(0)
    expect(controller.isOpen.value).toBe(false)
    expect(controller.isSending.value).toBe(false)
    expect(controller.error.value).toBeNull()
    expect(controller.hasUnreadMessages.value).toBe(false)
    expect(controller.lastMessage.value).toBeNull()
  })

  it('opens and closes chat', () => {
    const controller = createController()
    controller.unreadCount.value = 3

    controller.openChat()
    expect(controller.isOpen.value).toBe(true)
    expect(controller.unreadCount.value).toBe(0)

    controller.closeChat()
    expect(controller.isOpen.value).toBe(false)
  })

  it('sends a text message and broadcasts to websocket', async () => {
    const controller = createController()

    const result = await controller.sendMessage('Hello world')

    expect(result.success).toBe(true)
    expect(apiService.sendChatMessage).toHaveBeenCalledWith(
      'ROOM123',
      'participant-1',
      'Hello world',
      'text',
      undefined
    )
    expect(controller.messages.value).toHaveLength(1)
    expect(controller.messages.value[0].id).toBe('msg_server_1')
    expect(controller.messages.value[0].message).toBe('Hello world')
    expect(websocket.send).toHaveBeenCalledTimes(1)
  })

  it('rejects empty text messages', async () => {
    const controller = createController()
    const result = await controller.sendMessage('   ')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Message cannot be empty')
    expect(apiService.sendChatMessage).not.toHaveBeenCalled()
  })

  it('returns context error when room/participant are missing', async () => {
    const controller = useRoomChatController()

    const result = await controller.sendMessage('Hello')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Room code and participant ID are required')
  })

  it('prevents duplicate sends while already sending', async () => {
    const controller = createController()
    controller.isSending.value = true

    const result = await controller.sendMessage('Hello')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Message is already being sent')
  })

  it('sends file message and stores attachment metadata', async () => {
    const controller = createController()
    const file = new File(['hello world'], 'test.txt', { type: 'text/plain' })

    const result = await controller.sendFile(file)

    expect(result.success).toBe(true)
    expect(apiService.uploadChatFile).toHaveBeenCalledWith('ROOM123', 'participant-1', file)
    expect(controller.messages.value).toHaveLength(1)
    expect(controller.messages.value[0].message_type).toBe('file')
    expect(controller.messages.value[0].file_name).toBe('test.txt')
    expect(controller.messages.value[0].file_url).toBe('/uploads/test.txt')
    expect(mockGlobalStore.addNotification).toHaveBeenCalledWith('File sent successfully', 'success', 2000)
  })

  it('rejects oversized files', async () => {
    const controller = createController()
    const huge = new File(['x'], 'huge.txt', { type: 'text/plain' })
    Object.defineProperty(huge, 'size', { value: 51 * 1024 * 1024 })

    const result = await controller.sendFile(huge)

    expect(result.success).toBe(false)
    expect(result.error).toBe('File size exceeds 50MB limit')
  })

  it('rejects unsupported file types', async () => {
    const controller = createController()
    const bad = new File(['x'], 'malware.exe', { type: 'application/x-msdownload' })

    const result = await controller.sendFile(bad)

    expect(result.success).toBe(false)
    expect(result.error).toBe('File type not allowed')
  })

  it('loads and normalizes chat history (including attachment url variants)', async () => {
    vi.mocked(apiService.getChatHistory).mockResolvedValue({
      data: {
        success: true,
        messages: [
          {
            id: 'h1',
            room_id: 'ROOM123',
            sender_id: 'participant-2',
            content: 'File one',
            message_type: 'file',
            created_at: '2026-02-23T12:01:00.000Z',
            attachments: [
              {
                id: 'a1',
                original_filename: 'a.txt',
                file_size: 10,
                file: '/files/a.txt',
              },
            ],
            participant: { display_name: 'Alice' },
          },
          {
            id: 'h2',
            room_id: 'ROOM123',
            sender_id: 'participant-3',
            content: 'File two',
            message_type: 'file',
            created_at: '2026-02-23T12:02:00.000Z',
            attachments: [
              {
                id: 'a2',
                original_filename: 'b.txt',
                file_size: 20,
                file: { url: '/files/b.txt' },
              },
            ],
            participant: { display_name: 'Bob' },
          },
        ],
      },
    } as any)

    const controller = createController()
    await controller.loadHistory()

    expect(controller.messages.value).toHaveLength(2)
    expect(controller.messages.value[0].file_url).toBe('/files/a.txt')
    expect(controller.messages.value[1].file_url).toBe('/files/b.txt')
    expect(controller.messages.value[0].participant_name).toBe('Alice')
  })

  it('increments unread count only when chat is closed', () => {
    const controller = createController()
    const message: ChatMessage = {
      id: 'm1',
      room_id: 'ROOM123',
      participant_id: 'participant-2',
      participant_name: 'Remote',
      message: 'Hi',
      timestamp: new Date().toISOString(),
      message_type: 'text',
    }

    controller.addMessage(message)
    expect(controller.unreadCount.value).toBe(1)

    controller.openChat()
    controller.addMessage({ ...message, id: 'm2' })
    expect(controller.unreadCount.value).toBe(0)
  })

  it('updateContext enables sending after dynamic context injection', async () => {
    const controller = useRoomChatController()
    controller.updateContext('ROOM777', 'participant-77', 'Dynamic User', websocket as unknown as WebSocket)

    const result = await controller.sendMessage('Dynamic hello')

    expect(result.success).toBe(true)
    expect(apiService.sendChatMessage).toHaveBeenCalledWith(
      'ROOM777',
      'participant-77',
      'Dynamic hello',
      'text',
      undefined
    )
  })

  it('reset clears state', () => {
    const controller = createController()
    controller.addMessage({
      id: 'm1',
      room_id: 'ROOM123',
      participant_id: 'participant-2',
      participant_name: 'Remote',
      message: 'Hi',
      timestamp: new Date().toISOString(),
      message_type: 'text',
    })
    controller.openChat()
    controller.error.value = 'err'

    controller.reset()

    expect(controller.messages.value).toEqual([])
    expect(controller.unreadCount.value).toBe(0)
    expect(controller.isOpen.value).toBe(false)
    expect(controller.isSending.value).toBe(false)
    expect(controller.error.value).toBeNull()
  })
})
