<template>
  <div class="room-chat card flex flex-col h-full overflow-hidden">
    <!-- Chat Header -->
    <div class="chat-header flex items-center justify-between px-4 py-3 sm:p-4 border-b border-warp-border/70 bg-warp-surfaceAlt/80">
      <div class="flex items-center space-x-2">
        <svg class="w-5 h-5 text-warp-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <h3 class="text-xs font-semibold tracking-[0.18em] uppercase text-warp-muted">Chat</h3>
      </div>
      
      <div class="flex items-center space-x-1.5">
        <!-- File attachments button -->
        <button
          @click="toggleAttachments"
          class="p-2 rounded-lg hover:bg-warp-surfaceAlt/80 transition-colors border border-transparent"
          :class="{ 'border-warp-accent/70 bg-warp-surfaceAlt/90': showAttachments }"
          title="View attachments"
        >
          <svg class="w-5 h-5 text-warp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        
        <!-- Close chat button -->
        <button
          @click="$emit('close')"
          class="p-2 rounded-lg hover:bg-warp-surfaceAlt/80 transition-colors"
          title="Close chat"
        >
          <svg class="w-5 h-5 text-warp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Attachments Panel -->
    <div
      v-if="showAttachments"
      class="attachments-panel px-4 py-3 sm:p-4 border-b border-warp-border/70 max-h-48 overflow-y-auto bg-warp-surface/80"
    >
      <h4 class="text-xs font-semibold tracking-wide text-warp-muted uppercase mb-2">Shared Files</h4>
      <div v-if="!attachments || attachments.length === 0" class="text-sm text-warp-muted">
        No files shared yet
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="attachment in attachments"
          :key="attachment.id"
          class="flex items-center justify-between p-2 bg-warp-surfaceAlt/80 rounded-lg hover:bg-warp-surfaceAlt transition-colors border border-warp-border/40"
        >
          <div class="flex items-center space-x-2 flex-1 min-w-0">
            <svg class="w-5 h-5 flex-shrink-0" :class="getFileIconColor(attachment.file_type)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-warp-text truncate">
                {{ attachment.original_filename }}
              </p>
              <p class="text-xs text-warp-muted">
                {{ formatFileSize(attachment.file_size) }} • {{ attachment.uploaded_by }}
              </p>
            </div>
          </div>
          <button
            @click="downloadAttachment(attachment)"
            class="ml-2 p-1 rounded hover:bg-warp-surfaceAlt/80 transition-colors"
            title="Download"
          >
            <svg class="w-4 h-4 text-warp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Messages Container -->
    <div ref="messagesContainer" class="messages-container flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-transparent">
      <div v-if="!messages || messages.length === 0" class="text-center text-warp-muted py-8 text-sm">
        No messages yet. Start the conversation!
      </div>
      
      <div
        v-for="message in messages || []"
        :key="message.id"
        class="message"
        :class="{ 'message-own': isOwnMessage(message) }"
      >
        <!-- System message -->
        <div v-if="message.message_type === 'system'" class="text-center">
          <span class="badge badge-muted text-xs">
            {{ message.content }}
          </span>
        </div>
        
        <!-- Regular message -->
        <div v-else class="flex" :class="{ 'justify-end': isOwnMessage(message) }">
            <div class="max-w-[70%]">
            <!-- Sender name (if not own message) -->
            <div v-if="!isOwnMessage(message)" class="text-[11px] text-warp-muted mb-1 px-1">
              {{ getSenderName(message) }}
            </div>
            
            <!-- Reply preview -->
            <div
              v-if="message.reply_to"
              class="mb-1 px-3 py-1 bg-warp-surfaceAlt/80 rounded-lg text-[11px] border-l-2 border-warp-accent/80"
            >
              <span class="text-warp-muted">Replying to:</span>
              <p class="text-warp-text truncate">{{ getReplyContent(message.reply_to) }}</p>
            </div>
            
            <!-- Message bubble -->
            <div
              class="message-bubble px-3.5 py-2 rounded-2xl shadow-warp-sm border border-transparent"
              :class="isOwnMessage(message)
                ? 'bg-warp-accent2 text-white rounded-br-none border-warp-accent/70'
                : 'bg-warp-surfaceAlt/80 text-warp-text rounded-bl-none border-warp-border/40'"
            >
              <!-- File attachment -->
              <div
                v-if="message.message_type === 'file' && message.attachments && message.attachments.length > 0"
                class="space-y-2 mb-1"
              >
                <div
                  v-for="attachment in message.attachments"
                  :key="attachment.id"
                  class="flex items-center space-x-2 p-2 bg-warp-surface/60 rounded-lg border border-warp-border/30"
                >
                  <svg class="w-5 h-5 text-warp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">{{ attachment.original_filename }}</p>
                    <p class="text-[11px] text-warp-muted">{{ formatFileSize(attachment.file_size) }}</p>
                  </div>
                </div>
              </div>
              
              <!-- Text content -->
              <p v-if="message.content" class="text-sm whitespace-pre-wrap break-words">
                {{ message.content }}
              </p>
              
              <!-- Message metadata -->
              <div class="flex items-center justify-between mt-1 space-x-2 text-[11px] text-warp-muted">
                <span>
                  {{ formatTime(message.created_at) }}
                  <span v-if="message.edited_at" class="ml-1 opacity-75">(edited)</span>
                </span>
                
                <!-- Message actions -->
                <div v-if="isOwnMessage(message)" class="flex items-center space-x-1">
                  <button
                    @click="editMessage(message)"
                    class="p-1 rounded hover:bg-warp-surface/40 transition-colors"
                    title="Edit"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    @click="deleteMessage(message)"
                    class="p-1 rounded hover:bg-warp-surface/40 transition-colors"
                    title="Delete"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <button
                  v-else
                  @click="replyToMessage(message)"
                  class="p-1 rounded hover:bg-warp-surface/40 transition-colors"
                  title="Reply"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reply Preview -->
    <div
      v-if="replyingTo"
      class="reply-preview px-4 py-3 bg-warp-surface/90 border-t border-warp-border/70 flex-shrink-0"
    >
      <div class="flex items-center justify-between">
        <div class="flex-1 min-w-0">
          <p class="text-[11px] text-warp-muted mb-0.5">
            Replying to {{ getSenderName(replyingTo) }}
          </p>
          <p class="text-sm text-warp-text truncate">{{ replyingTo.content }}</p>
        </div>
        <button
          @click="cancelReply"
          class="ml-2 p-1 rounded hover:bg-warp-surfaceAlt/80 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Message Input -->
    <div class="message-input px-3 py-3 sm:p-4 border-t border-warp-border/70 bg-warp-surface/90 flex-shrink-0">
      <div class="flex items-end space-x-2">
        <!-- File upload button -->
        <label class="cursor-pointer p-2 rounded-lg hover:bg-warp-surfaceAlt/80 transition-colors">
          <input
            ref="fileInput"
            type="file"
            class="hidden"
            @change="handleFileSelect"
            :accept="acceptedFileTypes"
          />
          <svg class="w-6 h-6 text-warp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </label>

        <!-- Text input -->
        <div class="flex-1 relative">
          <textarea
            ref="messageInput"
            :value="newMessage"
            @input="onMessageChange"
            @keydown.enter.exact.prevent="handleSendMessage"
            @keydown.enter.shift.exact="handleShiftEnter"
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            rows="1"
            class="w-full px-3.5 py-2 pr-10 bg-warp-surfaceAlt/80 text-warp-text placeholder:text-warp-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-warp-accent/70 resize-none transition-all"
            style="max-height: 120px; overflow-y: auto;"
          ></textarea>
          
          <!-- Emoji button (placeholder) -->
          <button
            class="absolute right-1.5 bottom-1.5 p-1 rounded hover:bg-warp-surface/60 transition-colors"
            title="Emoji (coming soon)"
          >
            <svg class="w-4 h-4 text-warp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        <!-- Send button -->
        <button
          @click="handleSendMessage"
          :disabled="isSending || !canSend"
          class="btn-primary flex items-center justify-center min-w-[44px] h-11 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          :title="isSending ? 'Sending...' : 'Send message (Enter)'"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
      
      <!-- File upload preview -->
      <div v-if="selectedFile" class="mt-3 p-2.5 bg-warp-surfaceAlt/80 rounded-lg border border-warp-border/60">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center space-x-2 flex-1 min-w-0">
            <svg class="w-5 h-5 text-warp-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <div class="flex-1 min-w-0">
              <span class="text-sm text-warp-text block truncate">{{ selectedFile?.name || '' }}</span>
              <span class="text-xs text-warp-muted">({{ selectedFile?.size ? formatFileSize(selectedFile.size) : '' }})</span>
            </div>
          </div>
          <button
            v-if="!isUploading"
            @click="clearFileSelection"
            class="p-1 rounded hover:bg-warp-surface/60 transition-colors ml-2 flex-shrink-0"
            title="Remove file"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Upload progress bar -->
        <div v-if="isUploading" class="mt-2">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] text-warp-muted">Uploading...</span>
            <span class="text-[11px] text-warp-muted">{{ uploadProgress }}%</span>
          </div>
          <div class="w-full bg-warp-surface/80 rounded-full h-1.5 overflow-hidden">
            <div
              class="bg-warp-accent h-1.5 rounded-full transition-all duration-300"
              :style="{ width: uploadProgress + '%' }"
            ></div>
          </div>
        </div>
        
        <!-- Upload error -->
        <div v-if="uploadError" class="mt-2 p-2 bg-red-500/10 rounded-lg">
          <div class="flex items-center space-x-2">
            <svg class="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-xs text-red-300">{{ uploadError }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RoomChat',
  props: {
    roomCode: {
      type: String,
      required: true
    },
    participantId: {
      type: String,
      required: true
    },
    websocket: {
      type: Object,
      default: null
    }
  },
  data() {
    // Ensure reactive data object
    return {
      messages: [],
      attachments: [],
      newMessage: '',
      selectedFile: null,
      replyingTo: null,
      editingMessage: null,
      showAttachments: false,
      acceptedFileTypes: '.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,.csv,.json',
      maxFileSize: 50 * 1024 * 1024, // 50MB
      uploadProgress: 0,
      isUploading: false,
      isSending: false,
      uploadError: null
    }
  },
  mounted() {
    this.loadChatHistory()
    this.loadAttachments()
    this.setupWebSocketListeners()
  },
  methods: {
    toggleAttachments() {
      this.showAttachments = !this.showAttachments
    },
    async loadChatHistory() {
      try {
        const response = await fetch(`/api/rooms/chat/messages/history/?room_code=${this.roomCode}&limit=100`)
        const data = await response.json()
        if (data.success && data.messages) {
          this.messages = Array.isArray(data.messages) ? data.messages : []
          this.$nextTick(() => this.scrollToBottom())
        } else {
          this.messages = []
        }
      } catch (error) {
        console.error('Failed to load chat history:', error)
        this.messages = []
      }
    },
    
    async loadAttachments() {
      try {
        const response = await fetch(`/api/rooms/chat/attachments/list_by_room/?room_code=${this.roomCode}`)
        const data = await response.json()
        if (data.success && data.attachments) {
          this.attachments = Array.isArray(data.attachments) ? data.attachments : []
        } else {
          this.attachments = []
        }
      } catch (error) {
        console.error('Failed to load attachments:', error)
        this.attachments = []
      }
    },
    
    setupWebSocketListeners() {
      if (this.websocket) {
        this.websocket.addEventListener('message', this.handleWebSocketMessage)
      }
    },
    
    handleWebSocketMessage(event) {
      const data = JSON.parse(event.data)
      
      if (data.type === 'chat_message') {
        this.messages.push(data.message)
        this.$nextTick(() => this.scrollToBottom())
      } else if (data.type === 'chat_message_edited') {
        const index = this.messages.findIndex(m => m.id === data.message.id)
        if (index !== -1) {
          this.messages[index] = data.message
        }
      } else if (data.type === 'chat_message_deleted') {
        const index = this.messages.findIndex(m => m.id === data.message_id)
        if (index !== -1) {
          this.messages[index].is_deleted = true
          this.messages[index].content = '[Deleted]'
        }
      } else if (data.type === 'file_uploaded') {
        this.attachments.push(data.attachment)
        if (data.message) {
          this.messages.push(data.message)
          this.$nextTick(() => this.scrollToBottom())
        }
      }
    },
    
    // v-model handles syncing; we only adjust sizing on input
    handleMessageInput() {
      // Auto-resize textarea based on content
      this.$nextTick(() => {
        if (this.$refs.messageInput) {
          this.$refs.messageInput.style.height = 'auto'
          this.$refs.messageInput.style.height = Math.min(this.$refs.messageInput.scrollHeight, 120) + 'px'
        }
      })
    },

    onMessageChange(event) {
      // Manual sync of textarea value to reactive state
      const val = event && event.target ? event.target.value : ''
      this.newMessage = typeof val === 'string' ? val : ''
      this.handleMessageInput()
    },

    
    handleShiftEnter(event) {
      // Shift+Enter should allow newline - insert newline at cursor position
      const textarea = event && event.target
      if (!textarea || typeof textarea.selectionStart !== 'number') {
        this.newMessage = (this.newMessage || '') + '\n'
        this.handleMessageInput()
        return
      }
      const cursorPos = textarea.selectionStart
      const textBefore = (this.newMessage || '').substring(0, cursorPos)
      const textAfter = (this.newMessage || '').substring(cursorPos)
      this.newMessage = textBefore + '\n' + textAfter
      this.$nextTick(() => {
        textarea.selectionStart = textarea.selectionEnd = cursorPos + 1
        this.handleMessageInput()
      })
    },
    
    async handleSendMessage() {
      // Prevent double-sending
      if (this.isSending) {
        return
      }
      
      // Get message text and trim
      const messageText = (this.newMessage && typeof this.newMessage === 'string') ? this.newMessage.trim() : ''
      
      // Check if we have something to send
      if (!this.canSend) {
        return
      }
      
      // Set sending state
      this.isSending = true
      this.uploadError = null
      
      try {
        if (this.selectedFile) {
          await this.uploadFile()
        } else {
          // Use apiService instead of fetch
          const { apiService } = await import('@/services/api')
          
          const response = await apiService.sendChatMessage(
            this.roomCode,
            this.participantId,
            messageText,
            'text',
            this.replyingTo?.id
          )
          
          if (response && (response.status === 201 || response.status === 200 || response.data?.success)) {
            // Add message to local list immediately for better UX
            const messageData = response.data?.message || response.data
            if (messageData) {
              this.messages.push({
                id: messageData.id || `msg_${Date.now()}`,
                room_id: this.roomCode,
                participant_id: messageData.sender_id || this.participantId,
                participant_name: messageData.participant?.display_name || 'You',
                message: messageData.content || messageText,
                timestamp: messageData.created_at || new Date().toISOString(),
                message_type: 'text',
                reply_to: this.replyingTo?.id
              })
            }
            
            // Broadcast via WebSocket
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
              this.websocket.send(JSON.stringify({
                type: 'chat_message',
                room_id: this.roomCode,
                participant_id: this.participantId,
                message: messageText,
                timestamp: new Date().toISOString(),
                reply_to: this.replyingTo?.id
              }))
            }
            
            // Clear message input after successful send
            this.newMessage = ''
            this.replyingTo = null
            
            // Clear textarea and reset height
            this.$nextTick(() => {
              if (this.$refs.messageInput) {
                this.$refs.messageInput.value = ''
                this.$refs.messageInput.style.height = 'auto'
                this.$refs.messageInput.focus()
              }
              // Scroll to bottom to show new message
              this.scrollToBottom()
            })
          } else {
            const errorMsg = response?.data?.error || response?.data?.message || 'Unknown error'
            console.error('Failed to send message:', errorMsg)
            this.uploadError = `Failed to send message: ${errorMsg}`
            setTimeout(() => { this.uploadError = null }, 5000)
          }
        }
      } catch (error) {
        console.error('Failed to send message:', error)
        const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error'
        this.uploadError = `Failed to send message: ${errorMsg}`
        setTimeout(() => { this.uploadError = null }, 5000)
      } finally {
        this.isSending = false
      }
    },
    
    async sendMessage() {
      // Alias for backward compatibility
      await this.handleSendMessage()
    },
    
    canSendMessage() {
      // Backward-compatible alias: keep method for any external callers
      const hasText = typeof this.newMessage === 'string' && this.newMessage.trim().length > 0
      const hasFile = !!(this.selectedFile && this.selectedFile.name)
      return hasText || hasFile
    },

    async uploadFile() {
      if (!this.selectedFile) return
      
      // Validate file size again before upload
      if (this.selectedFile.size > this.maxFileSize) {
        this.uploadError = `File too large. Maximum size is ${this.formatFileSize(this.maxFileSize)}`
        this.clearFileSelection()
        return
      }
      
      const formData = new FormData()
      formData.append('file', this.selectedFile)
      formData.append('room_code', this.roomCode)
      formData.append('participant_id', this.participantId)
      
      this.isUploading = true
      this.uploadProgress = 0
      this.uploadError = null
      
      try {
        const xhr = new XMLHttpRequest()
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            this.uploadProgress = Math.round((e.loaded / e.total) * 100)
          }
        })
        
        // Handle completion
        xhr.addEventListener('load', () => {
          if (xhr.status === 200 || xhr.status === 201) {
            try {
              const data = JSON.parse(xhr.responseText)
              if (data.success || data.message) {
                // Add message to local list immediately for better UX
                if (data.message) {
                  this.messages.push(data.message)
                }
                
                // Broadcast via WebSocket
                if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                  this.websocket.send(JSON.stringify({
                    type: 'file_uploaded',
                    attachment: data.attachment,
                    message: data.message
                  }))
                }
                
                this.clearFileSelection()
                this.newMessage = ''
                this.uploadProgress = 0
                this.uploadError = null
              } else {
                this.uploadError = data.error || 'Upload failed'
                this.isUploading = false
              }
            } catch (error) {
              console.error('Failed to parse server response:', error)
              this.uploadError = 'Failed to parse server response'
              this.isUploading = false
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText)
              this.uploadError = errorData.error || `Upload failed with status ${xhr.status}`
            } catch {
              this.uploadError = `Upload failed with status ${xhr.status}`
            }
            this.isUploading = false
          }
        })
        
        // Handle errors
        xhr.addEventListener('error', () => {
          this.uploadError = 'Network error during upload'
          this.isUploading = false
          this.uploadProgress = 0
        })
        
        // Handle abort
        xhr.addEventListener('abort', () => {
          this.uploadError = 'Upload cancelled'
          this.isUploading = false
          this.uploadProgress = 0
        })
        
        xhr.open('POST', '/api/rooms/chat/attachments/')
        xhr.send(formData)
        
      } catch (error) {
        console.error('Failed to upload file:', error)
        this.uploadError = error.message || 'Upload failed'
        this.isUploading = false
        this.uploadProgress = 0
      }
    },
    
    handleFileSelect(event) {
      const file = event.target.files[0]
      if (file) {
        // Validate file size on frontend before upload
        if (file.size > this.maxFileSize) {
          this.uploadError = `File too large. Maximum size is ${this.formatFileSize(this.maxFileSize)}`
          this.$nextTick(() => {
            setTimeout(() => {
              this.uploadError = null
            }, 5000)
          })
          // Clear file input
          if (this.$refs.fileInput) {
            this.$refs.fileInput.value = ''
          }
          return
        }
        
        // Validate file type
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase()
        if (!this.acceptedFileTypes.includes(fileExtension)) {
          this.uploadError = `File type not supported. Allowed types: ${this.acceptedFileTypes}`
          this.$nextTick(() => {
            setTimeout(() => {
              this.uploadError = null
            }, 5000)
          })
          if (this.$refs.fileInput) {
            this.$refs.fileInput.value = ''
          }
          return
        }
        
        this.selectedFile = file
        this.uploadError = null
      }
    },
    
    clearFileSelection() {
      this.selectedFile = null
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = ''
      }
    },
    
    replyToMessage(message) {
      this.replyingTo = message
      this.$refs.messageInput.focus()
    },
    
    cancelReply() {
      this.replyingTo = null
    },
    
    async editMessage(message) {
      const newContent = prompt('Edit message:', message.content)
      if (newContent && newContent !== message.content) {
        try {
          const response = await fetch(`/api/rooms/chat/messages/${message.id}/edit/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              participant_id: this.participantId,
              content: newContent
            })
          })
          
          const data = await response.json()
          if (data.success && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
              type: 'chat_message_edited',
              message: data.message
            }))
          }
        } catch (error) {
          console.error('Failed to edit message:', error)
        }
      }
    },
    
    async deleteMessage(message) {
      if (confirm('Delete this message?')) {
        try {
          const response = await fetch(`/api/rooms/chat/messages/${message.id}/soft_delete/`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              participant_id: this.participantId
            })
          })
          
          const data = await response.json()
          if (data.success && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
              type: 'chat_message_deleted',
              message_id: message.id
            }))
          }
        } catch (error) {
          console.error('Failed to delete message:', error)
        }
      }
    },
    
    async downloadAttachment(attachment) {
      window.open(`/api/rooms/chat/attachments/${attachment.id}/download/`, '_blank')
    },
    
    getSenderId(message) {
      // Normalized sender/participant id from different payload shapes
      const rawId = message.participant_id || message.sender_id || message.participant?.id || null
      return rawId != null ? String(rawId) : ''
    },

    isOwnMessage(message) {
      const senderId = this.getSenderId(message)
      return senderId && senderId === String(this.participantId)
    },

    getSenderName(message) {
      if (this.isOwnMessage(message)) {
        return 'You'
      }

      if (message.participant_name) {
        return message.participant_name
      }

      if (message.participant && message.participant.display_name) {
        return message.participant.display_name
      }

      if (message.sender_id) {
        const id = String(message.sender_id)
        return `User ${id.slice(-4)}`
      }

      return 'Participant'
    },
    
    getReplyContent(replyToId) {
      const message = this.messages.find(m => m.id === replyToId)
      return message ? message.content : 'Message not found'
    },
    
    formatTime(timestamp) {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    },
    
    formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    },
    
    getFileIconColor(fileType) {
      const colors = {
        image: 'text-emerald-400',
        document: 'text-blue-400',
        archive: 'text-amber-400',
        other: 'text-warp-muted'
      }
      return colors[fileType] || colors.other
    },
    
    scrollToBottom() {
      if (this.$refs.messagesContainer) {
        this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight
      }
    }
  },
  computed: {
    // Prefer computed property in template to avoid calling possibly shadowed option
    canSend() {
      const hasText = typeof this.newMessage === 'string' && this.newMessage.trim().length > 0
      const hasFile = !!(this.selectedFile && this.selectedFile.name)
      return hasText || hasFile
    }
  },
  beforeUnmount() {
    if (this.websocket) {
      this.websocket.removeEventListener('message', this.handleWebSocketMessage)
    }
  }
}
</script>

<style scoped>
.messages-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.6) transparent;
}

.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, rgba(79, 70, 229, 0.5), rgba(56, 189, 248, 0.5));
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to bottom, rgba(79, 70, 229, 0.8), rgba(56, 189, 248, 0.8));
}

textarea {
  field-sizing: content;
}
</style>
