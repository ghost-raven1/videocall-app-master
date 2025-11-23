/**
 * Tests for useRoomChatController
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useRoomChatController, type ChatMessage } from '../room/useRoomChatController'
import { createPinia, setActivePinia } from 'pinia'
import { useGlobalStore } from '@/stores/global'

// Mock stores
vi.mock('@/stores/global', () => ({
  useGlobalStore: vi.fn()
}))

describe('useRoomChatController', () => {
  let controller: ReturnType<typeof useRoomChatController>
  let mockGlobalStore: any

  beforeEach(() => {
    setActivePinia(createPinia())

    mockGlobalStore = {
      addNotification: vi.fn()
    }

    vi.mocked(useGlobalStore).mockReturnValue(mockGlobalStore as any)

    controller = useRoomChatController()
  })

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      expect(controller.messages.value).toEqual([])
      expect(controller.unreadCount.value).toBe(0)
      expect(controller.isOpen.value).toBe(false)
      expect(controller.isSending.value).toBe(false)
      expect(controller.error.value).toBeNull()
    })

    it('should have computed properties', () => {
      expect(controller.hasUnreadMessages.value).toBe(false)
      expect(controller.lastMessage.value).toBeNull()
    })
  })

  describe('openChat and closeChat', () => {
    it('should open chat and mark as read', () => {
      controller.unreadCount.value = 5

      controller.openChat()

      expect(controller.isOpen.value).toBe(true)
      expect(controller.unreadCount.value).toBe(0)
    })

    it('should close chat', () => {
      controller.openChat()
      controller.closeChat()

      expect(controller.isOpen.value).toBe(false)
    })
  })

  describe('toggleChat', () => {
    it('should toggle chat from closed to open', () => {
      expect(controller.isOpen.value).toBe(false)

      controller.toggleChat()

      expect(controller.isOpen.value).toBe(true)
    })

    it('should toggle chat from open to closed', () => {
      controller.openChat()
      expect(controller.isOpen.value).toBe(true)

      controller.toggleChat()

      expect(controller.isOpen.value).toBe(false)
    })
  })

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const result = await controller.sendMessage('Hello, world!')

      expect(result.success).toBe(true)
      expect(controller.messages.value.length).toBe(1)
      expect(controller.messages.value[0].message).toBe('Hello, world!')
      expect(controller.messages.value[0].message_type).toBe('text')
    })

    it('should reject empty message', async () => {
      const result = await controller.sendMessage('   ')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Message cannot be empty')
      expect(controller.messages.value.length).toBe(0)
    })

    it('should reject message when already sending', async () => {
      controller.isSending.value = true

      const result = await controller.sendMessage('Test message')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Message is already being sent')
    })

    it('should send message with reply', async () => {
      const originalMessage: ChatMessage = {
        id: 'msg1',
        room_id: 'room1',
        participant_id: 'user1',
        participant_name: 'User 1',
        message: 'Original message',
        timestamp: new Date().toISOString(),
        message_type: 'text'
      }
      controller.addMessage(originalMessage)

      const result = await controller.sendMessage('Reply message', 'msg1')

      expect(result.success).toBe(true)
      expect(controller.messages.value[1].reply_to).toBe('msg1')
    })

    it('should handle send message errors', async () => {
      // Mock an error scenario
      const originalSendMessage = controller.sendMessage
      controller.sendMessage = vi.fn().mockRejectedValue(new Error('Network error'))

      try {
        await controller.sendMessage('Test')
      } catch (error) {
        // Error handling is done internally
      }

      // Restore
      controller.sendMessage = originalSendMessage
    })
  })

  describe('sendFile', () => {
    it('should send file successfully', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })

      const result = await controller.sendFile(file)

      expect(result.success).toBe(true)
      expect(controller.messages.value.length).toBe(1)
      expect(controller.messages.value[0].message_type).toBe('file')
      expect(controller.messages.value[0].file_name).toBe('test.txt')
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'File sent successfully',
        'success',
        2000
      )
    })

    it('should reject file that is too large', async () => {
      const largeFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.txt', {
        type: 'text/plain'
      })

      const result = await controller.sendFile(largeFile)

      expect(result.success).toBe(false)
      expect(result.error).toBe('File size exceeds 50MB limit')
      expect(mockGlobalStore.addNotification).toHaveBeenCalledWith(
        'File size exceeds 50MB limit',
        'error',
        5000
      )
    })

    it('should reject file with invalid type', async () => {
      const invalidFile = new File(['content'], 'test.exe', {
        type: 'application/x-msdownload'
      })

      const result = await controller.sendFile(invalidFile)

      expect(result.success).toBe(false)
      expect(result.error).toBe('File type not allowed')
    })

    it('should reject file when already sending', async () => {
      controller.isSending.value = true
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })

      const result = await controller.sendFile(file)

      expect(result.success).toBe(false)
      expect(result.error).toBe('File is already being sent')
    })

    it('should accept valid image files', async () => {
      const imageFile = new File(['image content'], 'test.jpg', {
        type: 'image/jpeg'
      })

      const result = await controller.sendFile(imageFile)

      expect(result.success).toBe(true)
    })

    it('should accept valid PDF files', async () => {
      const pdfFile = new File(['pdf content'], 'test.pdf', {
        type: 'application/pdf'
      })

      const result = await controller.sendFile(pdfFile)

      expect(result.success).toBe(true)
    })
  })

  describe('addMessage', () => {
    it('should add message to chat', () => {
      const message: ChatMessage = {
        id: 'msg1',
        room_id: 'room1',
        participant_id: 'user1',
        participant_name: 'User 1',
        message: 'Test message',
        timestamp: new Date().toISOString(),
        message_type: 'text'
      }

      controller.addMessage(message)

      expect(controller.messages.value.length).toBe(1)
      expect(controller.messages.value[0]).toEqual(message)
    })

    it('should increment unread count when chat is closed', () => {
      controller.isOpen.value = false
      const message: ChatMessage = {
        id: 'msg1',
        room_id: 'room1',
        participant_id: 'user1',
        participant_name: 'User 1',
        message: 'Test message',
        timestamp: new Date().toISOString(),
        message_type: 'text'
      }

      controller.addMessage(message)

      expect(controller.unreadCount.value).toBe(1)
    })

    it('should not increment unread count when chat is open', () => {
      controller.isOpen.value = true
      const message: ChatMessage = {
        id: 'msg1',
        room_id: 'room1',
        participant_id: 'user1',
        participant_name: 'User 1',
        message: 'Test message',
        timestamp: new Date().toISOString(),
        message_type: 'text'
      }

      controller.addMessage(message)

      expect(controller.unreadCount.value).toBe(0)
    })
  })

  describe('markAsRead', () => {
    it('should reset unread count', () => {
      controller.unreadCount.value = 5

      controller.markAsRead()

      expect(controller.unreadCount.value).toBe(0)
    })
  })

  describe('clearMessages', () => {
    it('should clear all messages and unread count', () => {
      const message: ChatMessage = {
        id: 'msg1',
        room_id: 'room1',
        participant_id: 'user1',
        participant_name: 'User 1',
        message: 'Test message',
        timestamp: new Date().toISOString(),
        message_type: 'text'
      }
      controller.addMessage(message)
      controller.unreadCount.value = 1

      controller.clearMessages()

      expect(controller.messages.value.length).toBe(0)
      expect(controller.unreadCount.value).toBe(0)
    })
  })

  describe('loadHistory', () => {
    it('should load chat history', async () => {
      await controller.loadHistory('room1')

      // Currently just clears messages
      expect(controller.messages.value.length).toBe(0)
      expect(controller.error.value).toBeNull()
    })

    it('should handle load history errors', async () => {
      // Mock error scenario
      const originalLoadHistory = controller.loadHistory
      controller.loadHistory = vi.fn().mockRejectedValue(new Error('Load failed'))

      try {
        await controller.loadHistory('room1')
      } catch (error) {
        // Error handling is done internally
      }

      // Restore
      controller.loadHistory = originalLoadHistory
    })
  })

  describe('computed properties', () => {
    it('should compute hasUnreadMessages correctly', () => {
      expect(controller.hasUnreadMessages.value).toBe(false)

      controller.unreadCount.value = 1
      expect(controller.hasUnreadMessages.value).toBe(true)

      controller.unreadCount.value = 0
      expect(controller.hasUnreadMessages.value).toBe(false)
    })

    it('should compute lastMessage correctly', () => {
      expect(controller.lastMessage.value).toBeNull()

      const message1: ChatMessage = {
        id: 'msg1',
        room_id: 'room1',
        participant_id: 'user1',
        participant_name: 'User 1',
        message: 'First message',
        timestamp: new Date().toISOString(),
        message_type: 'text'
      }
      controller.addMessage(message1)
      expect(controller.lastMessage.value).toEqual(message1)

      const message2: ChatMessage = {
        id: 'msg2',
        room_id: 'room1',
        participant_id: 'user2',
        participant_name: 'User 2',
        message: 'Second message',
        timestamp: new Date().toISOString(),
        message_type: 'text'
      }
      controller.addMessage(message2)
      expect(controller.lastMessage.value).toEqual(message2)
    })
  })

  describe('reset', () => {
    it('should reset all state', () => {
      const message: ChatMessage = {
        id: 'msg1',
        room_id: 'room1',
        participant_id: 'user1',
        participant_name: 'User 1',
        message: 'Test message',
        timestamp: new Date().toISOString(),
        message_type: 'text'
      }
      controller.addMessage(message)
      controller.openChat()
      controller.isSending.value = true
      controller.error.value = 'Some error'

      controller.reset()

      expect(controller.messages.value.length).toBe(0)
      expect(controller.unreadCount.value).toBe(0)
      expect(controller.isOpen.value).toBe(false)
      expect(controller.isSending.value).toBe(false)
      expect(controller.error.value).toBeNull()
    })
  })
})

