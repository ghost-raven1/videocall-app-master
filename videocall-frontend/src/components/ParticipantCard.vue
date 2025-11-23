<template>
  <div
    class="participant-card"
    :class="cardClasses"
    @click="handleCardClick"
  >
    <!-- Video element -->
    <video
      v-if="showVideo && participant.stream"
      ref="videoRef"
      autoplay
      playsinline
      muted
      :class="videoClasses"
      @loadedmetadata="onVideoLoaded"
    />

    <!-- Avatar placeholder when no video -->
    <div
      v-else
      class="participant-avatar"
      :class="avatarClasses"
    >
      <div class="avatar-content">
        <svg class="avatar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        <span v-if="participant.name" class="participant-name">{{ participantInitials }}</span>
      </div>
    </div>

    <!-- Connection status indicator -->
    <div class="connection-indicator" :class="connectionIndicatorClass">
      <div class="connection-dot"></div>
      <span class="connection-text">{{ connectionStatusText }}</span>
    </div>

    <!-- Participant info overlay -->
    <div class="participant-info" :class="{ 'show': showInfo || isHovered }">
      <div class="participant-details">
        <div class="participant-name-row">
          <span class="participant-name">{{ participant.name || 'Anonymous' }}</span>
          <span v-if="isLocal" class="local-indicator">(You)</span>
        </div>

        <!-- Audio level indicator -->
        <div v-if="showAudioLevel && participant.audioLevel > 0" class="audio-level">
          <div class="audio-bars">
            <div
              v-for="i in 5"
              :key="i"
              class="audio-bar"
              :class="{ 'active': participant.audioLevel >= i * 20 }"
            />
          </div>
          <span class="audio-level-text">Speaking</span>
        </div>

        <!-- Connection quality -->
        <div v-if="showConnectionQuality" class="connection-quality">
          <div
            class="quality-dot"
            :class="qualityIndicatorClass"
          />
          <span class="quality-text">{{ connectionQualityText }}</span>
        </div>
      </div>
    </div>

    <!-- Media controls -->
    <div v-if="showControls" class="media-controls" :class="{ 'show': showControls || isHovered }">
      <button
        @click.stop="toggleVideo"
        :class="['control-btn', 'video-btn', { 'active': participant.isVideoEnabled }]"
        :title="participant.isVideoEnabled ? 'Turn off camera' : 'Turn on camera'"
      >
        <svg v-if="participant.isVideoEnabled" class="control-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <svg v-else class="control-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 21l-1.5-1.5m-6.364-6.364L8.5 14.5 7 13l1.636-1.636m0 0L9 10.5" />
        </svg>
      </button>

      <button
        @click.stop="toggleAudio"
        :class="['control-btn', 'audio-btn', { 'active': participant.isAudioEnabled, 'muted': !participant.isAudioEnabled }]"
        :title="participant.isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'"
      >
        <svg v-if="participant.isAudioEnabled" class="control-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <svg v-else class="control-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1m0 0V7a3 3 0 013-3h8a3 3 0 013 3v2M4 9h1m11 0h5m-9 0a1 1 0 011-1v-1a1 1 0 011-1m-1 1v1a1 1 0 001 1M9 7h8a3 3 0 013 3v2" />
        </svg>
      </button>

      <!-- More options button -->
      <button
        v-if="showMoreOptions"
        @click.stop="toggleMoreOptions"
        class="control-btn more-btn"
        title="More options"
      >
        <svg class="control-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>
    </div>

    <!-- Recording indicator -->
    <div v-if="participant.isRecording" class="recording-indicator">
      <div class="recording-dot"></div>
      <span class="recording-text">REC</span>
    </div>

    <!-- Screen share indicator -->
    <div v-if="participant.isScreenSharing" class="screen-share-indicator">
      <svg class="screen-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <span class="screen-text">Screen</span>
    </div>

    <!-- Hand raised indicator -->
    <div v-if="participant.handRaised" class="hand-raised-indicator">
      <svg class="hand-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V9a1.5 1.5 0 00-3 0v3m6 0V9a1.5 1.5 0 00-3 0m6 0V9a1.5 1.5 0 00-3 0v3m-6 0h.01v4.01A1.5 1.5 0 0010 18.5h4a1.5 1.5 0 001.5-1.5V12H9z" />
      </svg>
    </div>

    <!-- Loading spinner for connecting state -->
    <div v-if="isConnecting" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

// Props
const props = defineProps({
  participant: {
    type: Object,
    required: true
  },
  isLocal: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'medium', // tiny, small, medium, large, fullscreen, half
    validator: (value) => ['tiny', 'small', 'medium', 'large', 'fullscreen', 'half'].includes(value)
  },
  showControls: {
    type: Boolean,
    default: true
  },
  showAudioLevel: {
    type: Boolean,
    default: true
  },
  showConnectionQuality: {
    type: Boolean,
    default: true
  },
  showMoreOptions: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['toggle-video', 'toggle-audio', 'card-click'])

// Template refs
const videoRef = ref(null)

// Reactive state
const isHovered = ref(false)
const showInfo = ref(false)
const showMoreOptionsMenu = ref(false)

// Computed properties
const showVideo = computed(() => {
  return props.participant.stream && props.participant.isVideoEnabled
})

const cardClasses = computed(() => {
  return [
    `participant-card-${props.size}`,
    {
      'local': props.isLocal,
      'remote': !props.isLocal,
      'connecting': isConnecting.value,
      'connected': props.participant.connectionState === 'connected',
      'video-disabled': !showVideo.value,
      'audio-disabled': !props.participant.isAudioEnabled
    }
  ]
})

const videoClasses = computed(() => {
  return [
    'participant-video',
    {
      'mirror': props.isLocal && shouldMirrorLocal.value,
      'object-cover': true
    }
  ]
})

const avatarClasses = computed(() => {
  return [
    `avatar-${props.size}`,
    {
      'bg-gray-600': !props.participant.isVideoEnabled,
      'bg-red-600': !props.participant.isAudioEnabled && !props.participant.isVideoEnabled
    }
  ]
})

const participantInitials = computed(() => {
  if (!props.participant.name) return 'A'
  return props.participant.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
})

const connectionStatusText = computed(() => {
  switch (props.participant.connectionState) {
    case 'new': return 'Connecting...'
    case 'connecting': return 'Connecting...'
    case 'connected': return 'Connected'
    case 'disconnected': return 'Disconnected'
    case 'failed': return 'Failed'
    default: return 'Unknown'
  }
})

const connectionIndicatorClass = computed(() => {
  return `connection-${props.participant.connectionState}`
})

const isConnecting = computed(() => {
  return props.participant.connectionState === 'new' || props.participant.connectionState === 'connecting'
})

const connectionQualityText = computed(() => {
  const quality = props.participant.connectionQuality || 0
  if (quality >= 80) return 'Excellent'
  if (quality >= 60) return 'Good'
  if (quality >= 40) return 'Fair'
  return 'Poor'
})

const qualityIndicatorClass = computed(() => {
  const quality = props.participant.connectionQuality || 0
  if (quality >= 80) return 'quality-excellent'
  if (quality >= 60) return 'quality-good'
  if (quality >= 40) return 'quality-fair'
  return 'quality-poor'
})

const shouldMirrorLocal = computed(() => {
  return props.isLocal && props.size !== 'fullscreen'
})

// Methods
const onVideoLoaded = () => {
  // Handle video loaded event if needed
}

const toggleVideo = () => {
  emit('toggle-video', props.participant.id)
}

const toggleAudio = () => {
  emit('toggle-audio', props.participant.id)
}

const toggleMoreOptions = () => {
  showMoreOptionsMenu.value = !showMoreOptionsMenu.value
}

const handleCardClick = () => {
  emit('card-click', props.participant)
}

// Watchers
watch(() => props.participant.stream, (newStream) => {
  nextTick(() => {
    if (videoRef.value && newStream) {
      videoRef.value.srcObject = newStream
    }
  })
}, { immediate: true })

// Lifecycle
onMounted(() => {
  if (props.participant.stream && videoRef.value) {
    videoRef.value.srcObject = props.participant.stream
  }
})

onUnmounted(() => {
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
})
</script>

<style scoped>
.participant-card {
  @apply relative bg-gray-900 rounded-lg overflow-hidden transition-all duration-300;
  aspect-ratio: 16/9;
}

.participant-card:hover {
  @apply shadow-xl;
}

/* Size variants */
.participant-card-tiny {
  @apply w-24 h-16;
}

.participant-card-small {
  @apply w-32 h-24;
}

.participant-card-medium {
  @apply w-48 h-36;
}

.participant-card-large {
  @apply w-64 h-48;
}

.participant-card-fullscreen {
  @apply w-full h-full;
}

.participant-card-half {
  @apply w-full h-full;
}

/* Video styles */
.participant-video {
  @apply w-full h-full;
}

.participant-video.mirror {
  transform: scaleX(-1);
}

/* Avatar styles */
.participant-avatar {
  @apply w-full h-full flex items-center justify-center;
}

.avatar-content {
  @apply text-center;
}

.avatar-icon {
  @apply w-12 h-12 text-gray-300 mb-2;
}

.participant-name {
  @apply text-white text-sm font-medium;
}

/* Connection indicator */
.connection-indicator {
  @apply absolute top-2 left-2 flex items-center space-x-1 text-xs;
}

.connection-dot {
  @apply w-2 h-2 rounded-full;
}

.connection-new .connection-dot,
.connection-connecting .connection-dot {
  @apply bg-yellow-400 animate-pulse;
}

.connection-connected .connection-dot {
  @apply bg-green-400;
}

.connection-disconnected .connection-dot,
.connection-failed .connection-dot {
  @apply bg-red-400;
}

.connection-text {
  @apply text-white font-medium;
}

/* Participant info overlay */
.participant-info {
  @apply absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3 opacity-0 transition-opacity duration-300;
}

.participant-info.show {
  @apply opacity-100;
}

.participant-details {
  @apply space-y-1;
}

.participant-name-row {
  @apply flex items-center space-x-2;
}

.participant-name {
  @apply text-white font-medium text-sm;
}

.local-indicator {
  @apply text-green-400 text-xs;
}

/* Audio level indicator */
.audio-level {
  @apply flex items-center space-x-2;
}

.audio-bars {
  @apply flex space-x-1;
}

.audio-bar {
  @apply w-1 bg-gray-400 transition-all duration-150;
  height: 12px;
}

.audio-bar.active {
  @apply bg-green-400;
}

.audio-level-text {
  @apply text-green-400 text-xs;
}

/* Connection quality */
.connection-quality {
  @apply flex items-center space-x-1;
}

.quality-dot {
  @apply w-2 h-2 rounded-full;
}

.quality-excellent {
  @apply bg-green-400;
}

.quality-good {
  @apply bg-yellow-400;
}

.quality-fair {
  @apply bg-orange-400;
}

.quality-poor {
  @apply bg-red-400;
}

.quality-text {
  @apply text-white text-xs;
}

/* Media controls */
.media-controls {
  @apply absolute top-2 right-2 flex space-x-1 opacity-0 transition-opacity duration-300;
}

.media-controls.show {
  @apply opacity-100;
}

.control-btn {
  @apply p-2 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full transition-all duration-200;
}

.control-btn.active {
  @apply bg-green-500 bg-opacity-100;
}

.control-btn.muted {
  @apply bg-red-500 bg-opacity-100;
}

.control-icon {
  @apply w-4 h-4 text-white;
}

/* Recording indicator */
.recording-indicator {
  @apply absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center space-x-1;
}

.recording-dot {
  @apply w-2 h-2 bg-white rounded-full animate-pulse;
}

/* Screen share indicator */
.screen-share-indicator {
  @apply absolute bottom-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center space-x-1;
}

.screen-icon {
  @apply w-3 h-3;
}

/* Hand raised indicator */
.hand-raised-indicator {
  @apply absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-500 text-white p-2 rounded-full;
}

.hand-icon {
  @apply w-4 h-4;
}

/* Loading overlay */
.loading-overlay {
  @apply absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center;
}

.loading-spinner {
  @apply w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .participant-card-small {
    @apply w-20 h-16;
  }

  .participant-card-medium {
    @apply w-32 h-24;
  }

  .media-controls {
    top: 1px;
    right: 1px;
  }

  .control-btn {
    @apply p-1;
  }

  .control-icon {
    @apply w-3 h-3;
  }
}
</style>
