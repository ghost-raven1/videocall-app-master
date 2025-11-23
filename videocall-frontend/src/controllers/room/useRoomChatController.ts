/**
 * Controller for managing room chat functionality
 * Handles messages, file sharing, and chat state
 */
import { ref, computed, type Ref } from 'vue'
import { useGlobalStore } from '@/stores/global'

export interface ChatMessage {
  id: string
  room_id: string
  participant_id: string
  participant_name: string
  message: string
  timestamp: string
  message_type: 'text' | 'file' | 'system'
  file_url?: string
  file_name?: string
  file_size?: number
  reply_to?: string
}

export interface RoomChatController {
  // State
  messages: Ref<ChatMessage[]>
  unreadCount: Ref<number>
  isOpen: Ref<boolean>
  isSending: Ref<boolean>
  error: Ref<string | null>
  
  // Computed
  hasUnreadMessages: Ref<boolean>
  lastMessage: Ref<ChatMessage | null>
  
  // Methods
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
  sendMessage: (message: string, replyTo?: string) => Promise<{ success: boolean; error?: string }>
  sendFile: (file: File) => Promise<{ success: boolean; error?: string }>
  addMessage: (message: ChatMessage) => void
  markAsRead: () => void
  clearMessages: () => void
  loadHistory: (roomId: string) => Promise<void>
  reset: () => void
}

/**
 * Creates a room chat controller
 */
export function useRoomChatController(): RoomChatController {
  const globalStore = useGlobalStore()
  
  const messages = ref<ChatMessage[]>([])
  const unreadCount = ref(0)
  const isOpen = ref(false)
  const isSending = ref(false)
  const error = ref<string | null>(null)

  /**
   * Computed: Has unread messages
   */
  const hasUnreadMessages = computed(() => {
    return unreadCount.value > 0
  })

  /**
   * Computed: Last message
   */
  const lastMessage = computed(() => {
    return messages.value.length > 0 ? messages.value[messages.value.length - 1] : null
  })

  /**
   * Open chat
   */
  const openChat = (): void => {
    isOpen.value = true
    markAsRead()
  }

  /**
   * Close chat
   */
  const closeChat = (): void => {
    isOpen.value = false
  }

  /**
   * Toggle chat open/closed
   */
  const toggleChat = (): void => {
    if (isOpen.value) {
      closeChat()
    } else {
      openChat()
    }
  }

  /**
   * Send text message
   */
  const sendMessage = async (
    message: string,
    replyTo?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!message.trim()) {
      return { success: false, error: 'Message cannot be empty' }
    }

    if (isSending.value) {
      return { success: false, error: 'Message is already being sent' }
    }

    try {
      isSending.value = true
      error.value = null

      // This would typically send via WebSocket or API
      // For now, we'll create a local message that will be sent
      const newMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        room_id: '', // Will be set by caller
        participant_id: '', // Will be set by caller
        participant_name: '', // Will be set by caller
        message: message.trim(),
        timestamp: new Date().toISOString(),
        message_type: 'text',
        reply_to: replyTo
      }

      // Add message to local state (will be confirmed when received from server)
      addMessage(newMessage)

      // TODO: Send via WebSocket or API
      // await sendMessageViaWebSocket(newMessage)

      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = errorMessage
      globalStore.addNotification(`Failed to send message: ${errorMessage}`, 'error', 3000)
      return { success: false, error: errorMessage }
    } finally {
      isSending.value = false
    }
  }

  /**
   * Send file
   */
  const sendFile = async (file: File): Promise<{ success: boolean; error?: string }> => {
    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      const errorMsg = 'File size exceeds 50MB limit'
      error.value = errorMsg
      globalStore.addNotification(errorMsg, 'error', 5000)
      return { success: false, error: errorMsg }
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      const errorMsg = 'File type not allowed'
      error.value = errorMsg
      globalStore.addNotification(errorMsg, 'error', 5000)
      return { success: false, error: errorMsg }
    }

    if (isSending.value) {
      return { success: false, error: 'File is already being sent' }
    }

    try {
      isSending.value = true
      error.value = null

      // Create file message
      const fileMessage: ChatMessage = {
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        room_id: '', // Will be set by caller
        participant_id: '', // Will be set by caller
        participant_name: '', // Will be set by caller
        message: `Shared file: ${file.name}`,
        timestamp: new Date().toISOString(),
        message_type: 'file',
        file_name: file.name,
        file_size: file.size
      }

      // TODO: Upload file and get URL
      // const uploadResult = await uploadFile(file)
      // fileMessage.file_url = uploadResult.url

      // Add message to local state
      addMessage(fileMessage)

      // TODO: Send via WebSocket or API
      // await sendMessageViaWebSocket(fileMessage)

      globalStore.addNotification('File sent successfully', 'success', 2000)
      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = errorMessage
      globalStore.addNotification(`Failed to send file: ${errorMessage}`, 'error', 5000)
      return { success: false, error: errorMessage }
    } finally {
      isSending.value = false
    }
  }

  /**
   * Add message to chat
   */
  const addMessage = (message: ChatMessage): void => {
    messages.value.push(message)
    
    // Increment unread count if chat is closed
    if (!isOpen.value) {
      unreadCount.value++
    }
  }

  /**
   * Mark all messages as read
   */
  const markAsRead = (): void => {
    unreadCount.value = 0
  }

  /**
   * Clear all messages
   */
  const clearMessages = (): void => {
    messages.value = []
    unreadCount.value = 0
  }

  /**
   * Load chat history
   */
  const loadHistory = async (roomId: string): Promise<void> => {
    try {
      error.value = null
      
      // TODO: Load from API
      // const response = await apiService.getChatHistory(roomId)
      // messages.value = response.data.messages
      
      // For now, just clear and reset
      clearMessages()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = errorMessage
      console.error('Failed to load chat history:', err)
    }
  }

  /**
   * Reset controller state
   */
  const reset = (): void => {
    clearMessages()
    isOpen.value = false
    isSending.value = false
    error.value = null
  }

  return {
    // State
    messages,
    unreadCount,
    isOpen,
    isSending,
    error,
    
    // Computed
    hasUnreadMessages,
    lastMessage,
    
    // Methods
    openChat,
    closeChat,
    toggleChat,
    sendMessage,
    sendFile,
    addMessage,
    markAsRead,
    clearMessages,
    loadHistory,
    reset
  }
}

