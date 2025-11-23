<template>
  <div class="participant-grid-container">
    <!-- Single participant view (fullscreen) -->
    <div
      v-if="participantCount === 1"
      class="single-participant"
    >
      <ParticipantCard
        v-if="remoteParticipants.length > 0"
        :participant="remoteParticipants[0]"
        :is-local="false"
        :size="'fullscreen'"
        :show-controls="true"
        @toggle-video="onToggleParticipantVideo"
        @toggle-audio="onToggleParticipantAudio"
      />
      <div v-else class="waiting-state">
        <div class="waiting-content">
          <div class="waiting-icon">
            <svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 class="waiting-title">{{ waitingMessage }}</h3>
          <p class="waiting-subtitle">Share the room code to invite someone</p>
          <div class="room-code-display">
            <code class="room-code">{{ roomCode }}</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Two participants view (split screen) -->
    <div
      v-else-if="participantCount === 2"
      class="two-participants"
    >
      <ParticipantCard
        v-for="participant in remoteParticipants"
        :key="participant.id"
        :participant="participant"
        :is-local="false"
        :size="'half'"
        :show-controls="true"
        class="grid-item"
        @toggle-video="onToggleParticipantVideo"
        @toggle-audio="onToggleParticipantAudio"
      />
    </div>

    <!-- Multiple participants grid -->
    <div
      v-else
      class="multi-participants"
      :class="gridClass"
    >
      <!-- Local participant (always in bottom right if video is enabled) -->
      <ParticipantCard
        v-if="webrtcStore.hasLocalVideo"
        :participant="localParticipant"
        :is-local="true"
        :size="'small'"
        :show-controls="false"
        class="local-participant"
        :class="localParticipantPosition"
      />

      <!-- Remote participants -->
      <ParticipantCard
        v-for="participant in remoteParticipants"
        :key="participant.id"
        :participant="participant"
        :is-local="false"
        :size="participantCardSize"
        :show-controls="true"
        class="grid-item remote-participant"
        :class="{ 'dominant-speaker': participant.isDominantSpeaker }"
        @toggle-video="onToggleParticipantVideo"
        @toggle-audio="onToggleParticipantAudio"
      />

      <!-- Grid overlay for participants count -->
      <div
        v-if="showParticipantsCount && participantCount > 4"
        class="participants-count-overlay"
      >
        <div class="participants-count">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          {{ participantCount }}
        </div>
      </div>
    </div>

    <!-- Loading overlay for grid transitions -->
    <div
      v-if="isTransitioning"
      class="grid-transition-overlay"
    >
      <div class="transition-spinner"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useWebRTCStore } from '../stores/webrtc'
import ParticipantCard from './ParticipantCard.vue'

const webrtcStore = useWebRTCStore()

// Props
defineProps({
  roomCode: {
    type: String,
    default: ''
  },
  waitingMessage: {
    type: String,
    default: 'Waiting for others to join...'
  },
  showParticipantsCount: {
    type: Boolean,
    default: true
  }
})

// Emits
const emit = defineEmits(['participant-count-changed'])

// Reactive state
const isTransitioning = ref(false)

// Computed properties
const participantCount = computed(() => webrtcStore.participantCount)

const remoteParticipants = computed(() => webrtcStore.remoteParticipants)

const localParticipant = computed(() => ({
  id: 'local',
  name: 'You',
  stream: webrtcStore.localStream,
  isVideoEnabled: webrtcStore.isVideoEnabled,
  isAudioEnabled: webrtcStore.isAudioEnabled,
  isLocal: true,
  connectionState: 'connected'
}))

const gridClass = computed(() => {
  const count = participantCount.value
  if (count <= 4) return 'grid-small'
  if (count <= 9) return 'grid-medium'
  return 'grid-large'
})

const participantCardSize = computed(() => {
  const count = participantCount.value
  if (count <= 4) return 'medium'
  if (count <= 9) return 'small'
  return 'tiny'
})

const localParticipantPosition = computed(() => {
  // Position local participant in bottom right corner
  return 'position-absolute'
})

// Methods
const onToggleParticipantVideo = (participantId) => {
  webrtcStore.toggleParticipantVideo(participantId)
}

const onToggleParticipantAudio = (participantId) => {
  webrtcStore.toggleParticipantAudio(participantId)
}

const updateGridLayout = () => {
  const count = participantCount.value
  isTransitioning.value = true

  // Calculate optimal grid dimensions
  const { cols, rows } = calculateGridDimensions(count)

  setTimeout(() => {
    isTransitioning.value = false
    emit('participant-count-changed', { count, cols, rows })
  }, 300)
}

const calculateGridDimensions = (participantCount) => {
  if (participantCount <= 1) return { cols: 1, rows: 1 }
  if (participantCount <= 2) return { cols: 2, rows: 1 }
  if (participantCount <= 4) return { cols: 2, rows: 2 }
  if (participantCount <= 9) return { cols: 3, rows: 3 }
  if (participantCount <= 16) return { cols: 4, rows: 4 }
  return { cols: 5, rows: Math.ceil(participantCount / 5) }
}

// Watchers
watch(participantCount, () => {
  updateGridLayout()
})

// Lifecycle
onMounted(() => {
  updateGridLayout()
})

onUnmounted(() => {
  // Cleanup if needed
})
</script>

<style scoped>
.participant-grid-container {
  @apply relative w-full h-full overflow-hidden;
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
}

.single-participant {
  @apply w-full h-full flex items-center justify-center;
}

.two-participants {
  @apply w-full h-full grid gap-1;
  grid-template-columns: 1fr 1fr;
}

.multi-participants {
  @apply w-full h-full relative;
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
}

.grid-small {
  @apply grid gap-2 p-4;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.grid-medium {
  @apply grid gap-1 p-2;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
}

.grid-large {
  @apply grid gap-1 p-1;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 1fr);
}

.local-participant {
  @apply absolute z-20 rounded-xl overflow-hidden shadow-2xl border-2;
  width: 180px;
  height: 135px;
  bottom: 20px;
  right: 20px;
  border-color: rgb(34, 197, 94);
}

.grid-item {
  @apply rounded-xl overflow-hidden transition-all duration-300;
}

.grid-item.dominant-speaker {
  @apply ring-2 ring-yellow-400;
}

.participants-count-overlay {
  @apply absolute top-4 right-4 z-30;
}

.participants-count {
  @apply bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg text-sm flex items-center space-x-2;
}

.waiting-state {
  @apply text-center text-white p-8;
}

.waiting-content {
  @apply max-w-md mx-auto;
}

.waiting-icon {
  @apply w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6;
  animation: bounce-gentle 2s ease-in-out infinite;
}

.waiting-title {
  @apply text-xl font-medium mb-2;
}

.waiting-subtitle {
  @apply text-gray-400 mb-4;
}

.room-code-display {
  @apply bg-gray-800 px-4 py-3 rounded-xl inline-block;
}

.room-code {
  @apply font-mono font-bold text-2xl tracking-wider text-green-400;
}

.grid-transition-overlay {
  @apply absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40;
}

.transition-spinner {
  @apply w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .local-participant {
    width: 120px;
    height: 90px;
    bottom: 10px;
    right: 10px;
  }

  .participants-count-overlay {
    top: 2px;
    right: 2px;
  }

  .grid-small,
  .grid-medium,
  .grid-large {
    gap: 0.5rem;
    padding: 0.5rem;
  }
}

@keyframes bounce-gentle {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}
</style>
