<template>
  <div class="screen-share-controls">
    <!-- Screen Share Button -->
    <button
      v-if="!isSharing"
      @click="startScreenShare"
      class="btn-screen-share flex items-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
      title="Share your screen"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <span>Share Screen</span>
    </button>

    <!-- Stop Sharing Button -->
    <button
      v-else
      @click="stopScreenShare"
      class="btn-stop-share flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors animate-pulse"
      title="Stop sharing"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
      <span>Stop Sharing</span>
    </button>

    <!-- Active Screen Shares List -->
    <div v-if="hasActiveSessions" class="mt-4 space-y-2">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Active Screen Shares:</h4>
      <div
        v-for="session in activeSessions"
        :key="session.id"
        class="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-lg"
      >
        <div class="flex items-center space-x-3">
          <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span class="text-sm font-medium text-gray-900 dark:text-white">
            {{ session.participant.display_name }}
          </span>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ formatDuration(session.started_at) }}
          </span>
        </div>
        <button
          @click="viewScreenShare(session)"
          class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
        >
          View
        </button>
      </div>
    </div>

    <!-- Screen Share Viewer Modal -->
    <div
      v-if="viewingSession"
      class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      @click.self="closeViewer"
    >
      <div class="relative w-full h-full max-w-7xl max-h-screen p-4">
        <!-- Close Button -->
        <button
          @click="closeViewer"
          class="absolute top-6 right-6 z-10 p-2 bg-gray-900 bg-opacity-50 hover:bg-opacity-75 text-white rounded-full transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Screen Share Info -->
        <div class="absolute top-6 left-6 z-10 px-4 py-2 bg-gray-900 bg-opacity-75 text-white rounded-lg">
          <p class="text-sm font-medium">{{ viewingSession.participant.display_name }}'s screen</p>
        </div>

        <!-- Video Element -->
        <video
          ref="screenShareVideo"
          autoplay
          playsinline
          class="w-full h-full object-contain bg-black rounded-lg"
        ></video>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ScreenShareControls',
  props: {
    roomCode: {
      type: String,
      required: true
    },
    participantId: {
      type: String,
      default: ''
    },
    peerConnection: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      isSharing: false,
      screenStream: null,
      currentSession: null,
      activeSessions: [],
      viewingSession: null
    }
  },
  computed: {
    hasActiveSessions() {
      return Array.isArray(this.activeSessions) && this.activeSessions.length > 0
    }
  },
  mounted() {
    this.loadActiveSessions()
    this.setupWebSocketListeners()
  },
  methods: {
    async startScreenShare() {
      try {
        // Request screen capture
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        })

        // Get stream ID
        const streamId = this.screenStream.id

        // Create screen share session
        const response = await fetch('/api/rooms/screen-share/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_code: this.roomCode,
            participant_id: this.participantId,
            stream_id: streamId
          })
        })

        const data = await response.json()
        if (data.success) {
          this.currentSession = data.session
          this.isSharing = true

          // Add tracks to peer connection
          if (this.peerConnection) {
            this.screenStream.getTracks().forEach(track => {
              this.peerConnection.addTrack(track, this.screenStream)
            })
          }

          // Emit event
          this.$emit('screen-share-started', {
            session: this.currentSession,
            stream: this.screenStream
          })

          // Handle stream end
          this.screenStream.getVideoTracks()[0].addEventListener('ended', () => {
            this.stopScreenShare()
          })
        }
      } catch (error) {
        console.error('Failed to start screen share:', error)
        if (error.name === 'NotAllowedError') {
          alert('Screen sharing permission denied')
        } else {
          alert('Failed to start screen sharing: ' + error.message)
        }
      }
    },

    async stopScreenShare() {
      if (!this.screenStream) return

      try {
        // Stop all tracks
        this.screenStream.getTracks().forEach(track => track.stop())

        // Stop session on server
        if (this.currentSession) {
          await fetch(`/api/rooms/screen-share/${this.currentSession.id}/stop/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              participant_id: this.participantId
            })
          })
        }

        // Emit event
        this.$emit('screen-share-stopped', {
          session: this.currentSession
        })

        // Reset state
        this.screenStream = null
        this.currentSession = null
        this.isSharing = false
      } catch (error) {
        console.error('Failed to stop screen share:', error)
      }
    },

    async loadActiveSessions() {
      try {
        const response = await fetch(`/api/rooms/screen-share/active_sessions/?room_code=${this.roomCode}`)
        const data = await response.json()
        if (data.success && Array.isArray(data.sessions)) {
          this.activeSessions = data.sessions
        } else {
          this.activeSessions = []
        }
      } catch (error) {
        console.error('Failed to load active sessions:', error)
        this.activeSessions = []
      }
    },

    setupWebSocketListeners() {
      // Listen for screen share events from WebSocket
      window.addEventListener('screen-share-started', (event) => {
        if (event.detail.room_code === this.roomCode) {
          this.loadActiveSessions()
        }
      })

      window.addEventListener('screen-share-stopped', (event) => {
        if (event.detail.room_code === this.roomCode) {
          this.loadActiveSessions()
        }
      })
    },

    viewScreenShare(session) {
      this.viewingSession = session
      
      // In a real implementation, you would:
      // 1. Request the screen share stream from the peer
      // 2. Set it as the source for the video element
      // For now, this is a placeholder
      
      this.$nextTick(() => {
        if (this.$refs.screenShareVideo) {
          // This would be set from the WebRTC stream
          console.log('Viewing screen share:', session)
        }
      })
    },

    closeViewer() {
      this.viewingSession = null
    },

    formatDuration(startTime) {
      const start = new Date(startTime)
      const now = new Date()
      const diff = Math.floor((now - start) / 1000) // seconds
      
      if (diff < 60) return `${diff}s`
      if (diff < 3600) return `${Math.floor(diff / 60)}m`
      return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
    }
  },
  beforeUnmount() {
    if (this.isSharing) {
      this.stopScreenShare()
    }
  }
}
</script>

<style scoped>
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
