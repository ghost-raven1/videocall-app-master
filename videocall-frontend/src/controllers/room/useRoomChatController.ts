/**
 * Controller for managing room chat functionality
 * Handles messages, file sharing, and chat state
 */
import { ref, computed, type Ref } from 'vue'
import { useGlobalStore } from '@/stores/global'
import { apiService } from '@/services/api'

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
  loadHistory: (roomCode?: string, limit?: number) => Promise<void>
  reset: () => void
  updateContext: (roomCode?: string, participantId?: string, participantName?: string, websocket?: WebSocket | null) => void
}

/**
 * Creates a room chat controller
 */
export function useRoomChatController(
  roomCode?: string,
  participantId?: string,
  participantName?: string,
  websocket?: WebSocket | null
): RoomChatController {
  const globalStore = useGlobalStore()
  
  const messages = ref<ChatMessage[]>([])
  const unreadCount = ref(0)
  const isOpen = ref(false)
  const isSending = ref(false)
  const error = ref<string | null>(null)
  
  // Store room context
  const currentRoomCode = ref(roomCode || '')
  const currentParticipantId = ref(participantId || '')
  const currentParticipantName = ref(participantName || '')
  const currentWebSocket = ref<WebSocket | null>(websocket || null)

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

    if (!currentRoomCode.value || !currentParticipantId.value) {
      return { success: false, error: 'Room code and participant ID are required' }
    }

    if (isSending.value) {
      return { success: false, error: 'Message is already being sent' }
    }

    try {
      isSending.value = true
      error.value = null

      // Create optimistic message
      const optimisticMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        room_id: currentRoomCode.value,
        participant_id: currentParticipantId.value,
        participant_name: currentParticipantName.value,
        message: message.trim(),
        timestamp: new Date().toISOString(),
        message_type: 'text',
        reply_to: replyTo
      }

      // Add message to local state (optimistic update)
      addMessage(optimisticMessage)

      // Send via API
      const response = await apiService.sendChatMessage(
        currentRoomCode.value,
        currentParticipantId.value,
        message.trim(),
        'text',
        replyTo
      )
      const responseData = response?.data ?? response

      if (responseData?.success) {
        // Update message with server response
        const serverMessage = responseData.message
        const index = messages.value.findIndex(m => m.id === optimisticMessage.id)
        if (index !== -1 && serverMessage) {
          messages.value[index] = {
            ...optimisticMessage,
            id: serverMessage.id || optimisticMessage.id,
            timestamp: serverMessage.created_at || optimisticMessage.timestamp
          }
        }

        // Broadcast via WebSocket if available
        if (
          serverMessage &&
          currentWebSocket.value &&
          currentWebSocket.value.readyState === WebSocket.OPEN
        ) {
          currentWebSocket.value.send(JSON.stringify({
            type: 'chat_message',
            message: serverMessage
          }))
        }

        return { success: true }
      } else {
        // Remove optimistic message on failure
        const index = messages.value.findIndex(m => m.id === optimisticMessage.id)
        if (index !== -1) {
          messages.value.splice(index, 1)
        }
        throw new Error(responseData?.error || 'Failed to send message')
      }
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

      if (!currentRoomCode.value || !currentParticipantId.value) {
        return { success: false, error: 'Room code and participant ID are required' }
      }

      // Upload file via API
      const uploadResponse = await apiService.uploadChatFile(
        currentRoomCode.value,
        currentParticipantId.value,
        file
      )
      const uploadData = uploadResponse?.data ?? uploadResponse

      if (uploadData?.success) {
        const serverMessage = uploadData.message || {}
        const attachment = uploadData.attachment || {}
        const attachmentFile = attachment.file
        const attachmentUrl =
          typeof attachmentFile === 'string'
            ? attachmentFile
            : attachmentFile?.url

        // Create file message from server response
        const fileMessage: ChatMessage = {
          id: serverMessage.id || `file_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          room_id: currentRoomCode.value,
          participant_id: currentParticipantId.value,
          participant_name: currentParticipantName.value || 'You',
          message: serverMessage.content || `Shared file: ${file.name}`,
          timestamp: serverMessage.created_at || new Date().toISOString(),
          message_type: 'file',
          file_name: attachment.original_filename || file.name,
          file_size: attachment.file_size || file.size,
          file_url: attachmentUrl
        }

        // Add message to local state
        addMessage(fileMessage)

        // Broadcast via WebSocket if available
        if (currentWebSocket.value && currentWebSocket.value.readyState === WebSocket.OPEN) {
          currentWebSocket.value.send(JSON.stringify({
            type: 'file_uploaded',
            attachment: attachment,
            message: serverMessage
          }))
        }

        globalStore.addNotification('File sent successfully', 'success', 2000)
        return { success: true }
      } else {
        throw new Error(uploadData?.error || 'Failed to upload file')
      }
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
  const loadHistory = async (roomCode?: string, limit: number = 100): Promise<void> => {
    try {
      error.value = null
      
      const roomCodeToUse = roomCode || currentRoomCode.value
      if (!roomCodeToUse) {
        console.warn('Cannot load chat history: room code not provided')
        return
      }
      
      const response = await apiService.getChatHistory(roomCodeToUse, limit)
      const historyData = response?.data ?? response
      
      if (historyData?.success) {
        // Convert server messages to ChatMessage format
        interface ServerMessage {
          id: string
          room_id: string
          sender_id: string
          content: string
          message_type: 'text' | 'file' | 'system'
          created_at: string
          attachments?: Array<{
            id: string
            file: { url?: string } | string
            original_filename: string
            file_size: number
          }>
          reply_to?: { id: string } | null
          participant?: { display_name?: string }
        }
        
        messages.value = ((historyData.messages || []) as ServerMessage[]).map((msg) => ({
          ...(() => {
            const firstAttachment = msg.attachments?.[0]
            const attachmentFile = firstAttachment?.file
            const attachmentUrl =
              typeof attachmentFile === 'string'
                ? attachmentFile
                : attachmentFile?.url
            return {
              file_url: attachmentUrl,
              file_name: firstAttachment?.original_filename,
              file_size: firstAttachment?.file_size,
            }
          })(),
          id: msg.id,
          room_id: msg.room_id,
          participant_id: msg.sender_id,
          participant_name: msg.participant?.display_name || 'Unknown',
          message: msg.content,
          timestamp: msg.created_at,
          message_type: msg.message_type || 'text',
          reply_to: msg.reply_to?.id
        }))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = errorMessage
      console.error('Failed to load chat history:', err)
      globalStore.addNotification('Failed to load chat history', 'error', 3000)
    }
  }
  
  /**
   * Update room context
   */
  const updateContext = (roomCode?: string, participantId?: string, participantName?: string, websocket?: WebSocket | null) => {
    if (roomCode) currentRoomCode.value = roomCode
    if (participantId) currentParticipantId.value = participantId
    if (participantName) currentParticipantName.value = participantName
    if (websocket !== undefined) currentWebSocket.value = websocket
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
    reset,
    updateContext
  }
}
