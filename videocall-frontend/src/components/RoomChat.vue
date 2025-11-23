<template>
  <div class="room-chat flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
    <!-- Chat Header -->
    <div class="chat-header flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center space-x-2">
        <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Chat</h3>
      </div>
      
      <div class="flex items-center space-x-2">
        <!-- File attachments button -->
        <button
          @click="showAttachments = !showAttachments"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          :class="{ 'bg-blue-100 dark:bg-blue-900': showAttachments }"
          title="View attachments"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        
        <!-- Close chat button -->
        <button
          @click="$emit('close')"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Close chat"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Attachments Panel -->
    <div v-if="showAttachments" class="attachments-panel p-4 border-b border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Shared Files</h4>
      <div v-if="attachments.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
        No files shared yet
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="attachment in attachments"
          :key="attachment.id"
          class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          <div class="flex items-center space-x-2 flex-1 min-w-0">
            <svg class="w-5 h-5 flex-shrink-0" :class="getFileIconColor(attachment.file_type)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ attachment.original_filename }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatFileSize(attachment.file_size) }} • {{ attachment.uploaded_by }}
              </p>
            </div>
          </div>
          <button
            @click="downloadAttachment(attachment)"
            class="ml-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
            title="Download"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Messages Container -->
    <div ref="messagesContainer" class="messages-container flex-1 overflow-y-auto p-4 space-y-3">
      <div v-if="messages.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-8">
        No messages yet. Start the conversation!
      </div>
      
      <div
        v-for="message in messages"
        :key="message.id"
        class="message"
        :class="{ 'message-own': isOwnMessage(message) }"
      >
        <!-- System message -->
        <div v-if="message.message_type === 'system'" class="text-center">
          <span class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
            {{ message.content }}
          </span>
        </div>
        
        <!-- Regular message -->
        <div v-else class="flex" :class="{ 'justify-end': isOwnMessage(message) }">
          <div class="max-w-[70%]">
            <!-- Sender name (if not own message) -->
            <div v-if="!isOwnMessage(message)" class="text-xs text-gray-600 dark:text-gray-400 mb-1 px-1">
              {{ message.participant?.display_name || 'Unknown' }}
            </div>
            
            <!-- Reply preview -->
            <div v-if="message.reply_to" class="mb-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs border-l-2 border-blue-500">
              <span class="text-gray-600 dark:text-gray-400">Replying to:</span>
              <p class="text-gray-800 dark:text-gray-200 truncate">{{ getReplyContent(message.reply_to) }}</p>
            </div>
            
            <!-- Message bubble -->
            <div
              class="message-bubble px-4 py-2 rounded-2xl"
              :class="isOwnMessage(message) 
                ? 'bg-blue-500 text-white rounded-br-none' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none'"
            >
              <!-- File attachment -->
              <div v-if="message.message_type === 'file' && message.attachments.length > 0" class="space-y-2">
                <div
                  v-for="attachment in message.attachments"
                  :key="attachment.id"
                  class="flex items-center space-x-2 p-2 bg-white bg-opacity-20 rounded-lg"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">{{ attachment.original_filename }}</p>
                    <p class="text-xs opacity-75">{{ formatFileSize(attachment.file_size) }}</p>
                  </div>
                </div>
              </div>
              
              <!-- Text content -->
              <p v-if="message.content" class="text-sm whitespace-pre-wrap break-words">
                {{ message.content }}
              </p>
              
              <!-- Message metadata -->
              <div class="flex items-center justify-between mt-1 space-x-2">
                <span class="text-xs opacity-75">
                  {{ formatTime(message.created_at) }}
                  <span v-if="message.edited_at" class="ml-1">(edited)</span>
                </span>
                
                <!-- Message actions -->
                <div v-if="isOwnMessage(message)" class="flex items-center space-x-1">
                  <button
                    @click="editMessage(message)"
                    class="p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
                    title="Edit"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    @click="deleteMessage(message)"
                    class="p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
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
                  class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
    <div v-if="replyingTo" class="reply-preview p-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
      <div class="flex items-center justify-between">
        <div class="flex-1 min-w-0">
          <p class="text-xs text-gray-600 dark:text-gray-400">Replying to {{ replyingTo.participant?.display_name }}</p>
          <p class="text-sm text-gray-900 dark:text-white truncate">{{ replyingTo.content }}</p>
        </div>
        <button
          @click="cancelReply"
          class="ml-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Message Input -->
    <div class="message-input p-4 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-end space-x-2">
        <!-- File upload button -->
        <label class="cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <input
            ref="fileInput"
            type="file"
            class="hidden"
            @change="handleFileSelect"
            :accept="acceptedFileTypes"
          />
          <svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </label>

        <!-- Text input -->
        <div class="flex-1 relative">
          <textarea
            ref="messageInput"
            v-model="newMessage"
            @keydown.enter.exact.prevent="sendMessage"
            @keydown.shift.enter.exact="newMessage += '\n'"
            placeholder="Type a message..."
            rows="1"
            class="w-full px-4 py-2 pr-12 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            style="max-height: 120px;"
          ></textarea>
          
          <!-- Emoji button (placeholder) -->
          <button
            class="absolute right-2 bottom-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Emoji (coming soon)"
          >
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        <!-- Send button -->
        <button
          @click="sendMessage"
          :disabled="!newMessage.trim() && !selectedFile"
          class="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Send message (Enter)"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
      
      <!-- File upload preview -->
      <div v-if="selectedFile" class="mt-2 p-2 bg-blue-50 dark:bg-blue-900 rounded-lg">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center space-x-2 flex-1 min-w-0">
            <svg class="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <div class="flex-1 min-w-0">
              <span class="text-sm text-gray-900 dark:text-white block truncate">{{ selectedFile.name }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400">({{ formatFileSize(selectedFile.size) }})</span>
            </div>
          </div>
          <button
            v-if="!isUploading"
            @click="clearFileSelection"
            class="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors ml-2 flex-shrink-0"
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
            <span class="text-xs text-gray-600 dark:text-gray-400">Uploading...</span>
            <span class="text-xs text-gray-600 dark:text-gray-400">{{ uploadProgress }}%</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              class="bg-blue-500 h-2 rounded-full transition-all duration-300"
              :style="{ width: uploadProgress + '%' }"
            ></div>
          </div>
        </div>
        
        <!-- Upload error -->
        <div v-if="uploadError" class="mt-2 p-2 bg-red-50 dark:bg-red-900 rounded-lg">
          <div class="flex items-center space-x-2">
            <svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-xs text-red-700 dark:text-red-300">{{ uploadError }}</span>
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
      uploadError: null
    }
  },
  mounted() {
    this.loadChatHistory()
    this.loadAttachments()
    this.setupWebSocketListeners()
  },
  methods: {
    async loadChatHistory() {
      try {
        const response = await fetch(`/api/rooms/chat/messages/history/?room_code=${this.roomCode}&limit=100`)
        const data = await response.json()
        if (data.success) {
          this.messages = data.messages
          this.$nextTick(() => this.scrollToBottom())
        }
      } catch (error) {
        console.error('Failed to load chat history:', error)
      }
    },
    
    async loadAttachments() {
      try {
        const response = await fetch(`/api/rooms/chat/attachments/list_by_room/?room_code=${this.roomCode}`)
        const data = await response.json()
        if (data.success) {
          this.attachments = data.attachments
        }
      } catch (error) {
        console.error('Failed to load attachments:', error)
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
    
    async sendMessage() {
      if (!this.newMessage.trim() && !this.selectedFile) return
      
      try {
        if (this.selectedFile) {
          await this.uploadFile()
        } else {
          const response = await fetch('/api/rooms/chat/messages/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              room_code: this.roomCode,
              participant_id: this.participantId,
              content: this.newMessage,
              message_type: 'text',
              reply_to: this.replyingTo?.id
            })
          })
          
          const data = await response.json()
          if (data.success) {
            // Broadcast via WebSocket
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
              this.websocket.send(JSON.stringify({
                type: 'chat_message',
                message: data.message
              }))
            }
            
            this.newMessage = ''
            this.replyingTo = null
          }
        }
      } catch (error) {
        console.error('Failed to send message:', error)
      }
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
              if (data.success) {
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
              } else {
                this.uploadError = data.error || 'Upload failed'
              }
            } catch (error) {
              this.uploadError = 'Failed to parse server response'
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText)
              this.uploadError = errorData.error || `Upload failed with status ${xhr.status}`
            } catch {
              this.uploadError = `Upload failed with status ${xhr.status}`
            }
          }
          this.isUploading = false
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
    
    isOwnMessage(message) {
      return message.participant?.id === this.participantId
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
        image: 'text-green-500',
        document: 'text-blue-500',
        archive: 'text-yellow-500',
        other: 'text-gray-500'
      }
      return colors[fileType] || colors.other
    },
    
    scrollToBottom() {
      if (this.$refs.messagesContainer) {
        this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight
      }
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
  scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
}

.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.7);
}

textarea {
  field-sizing: content;
}
</style>
