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
            <svg class="w-16 h-16 text-warp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <!-- Focus layout: One large participant + others small -->
      <template v-if="layout === 'focus'">
        <!-- Focused participant (first remote or local if no remotes) -->
        <div class="focus-main">
          <ParticipantCard
            v-if="remoteParticipants.length > 0"
            :participant="remoteParticipants[0]"
            :is-local="false"
            :size="'large'"
            :show-controls="true"
            class="grid-item focus-participant"
            @toggle-video="onToggleParticipantVideo"
            @toggle-audio="onToggleParticipantAudio"
          />
          <ParticipantCard
            v-else-if="webrtcStore.hasLocalVideo"
            :participant="localParticipant"
            :is-local="true"
            :size="'large'"
            :show-controls="false"
            class="grid-item focus-participant"
          />
        </div>
        
        <!-- Other participants in sidebar -->
        <div class="focus-sidebar">
          <ParticipantCard
            v-if="webrtcStore.hasLocalVideo && remoteParticipants.length > 0"
            :participant="localParticipant"
            :is-local="true"
            :size="'small'"
            :show-controls="false"
            class="grid-item"
          />
          <ParticipantCard
            v-for="participant in remoteParticipants.slice(1)"
            :key="participant.id"
            :participant="participant"
            :is-local="false"
            :size="'small'"
            :show-controls="true"
            class="grid-item"
            @toggle-video="onToggleParticipantVideo"
            @toggle-audio="onToggleParticipantAudio"
          />
        </div>
      </template>

      <!-- Sidebar layout: Grid with sidebar -->
      <template v-else-if="layout === 'sidebar'">
        <!-- Main grid area -->
        <div class="sidebar-main-grid">
          <ParticipantCard
            v-for="participant in visibleRemoteParticipants.slice(0, Math.min(visibleRemoteParticipants.length, 6))"
            :key="participant.id"
            :participant="participant"
            :is-local="false"
            :size="participantCardSize"
            :show-controls="true"
            class="grid-item"
            @toggle-video="onToggleParticipantVideo"
            @toggle-audio="onToggleParticipantAudio"
          />
        </div>
        
        <!-- Sidebar with remaining participants -->
        <div class="sidebar-participants" v-if="visibleRemoteParticipants.length > 6 || webrtcStore.hasLocalVideo">
          <ParticipantCard
            v-if="webrtcStore.hasLocalVideo"
            :participant="localParticipant"
            :is-local="true"
            :size="'small'"
            :show-controls="false"
            class="grid-item"
          />
          <ParticipantCard
            v-for="participant in visibleRemoteParticipants.slice(6)"
            :key="participant.id"
            :participant="participant"
            :is-local="false"
            :size="'small'"
            :show-controls="true"
            class="grid-item"
            @toggle-video="onToggleParticipantVideo"
            @toggle-audio="onToggleParticipantAudio"
          />
        </div>
      </template>

        <!-- Grid/Auto layout: Standard grid -->
      <template v-else>
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

        <!-- Remote participants (paginated) -->
        <ParticipantCard
          v-for="participant in visibleRemoteParticipants"
          :key="participant.id"
          :participant="participant"
          :is-local="false"
          :size="participantCardSize"
          :show-controls="true"
          class="grid-item remote-participant"
          :class="{
            'dominant-speaker': participant.isDominantSpeaker,
            'pinned-participant': participant.id === pinnedParticipantId,
          }"
          @toggle-video="onToggleParticipantVideo"
          @toggle-audio="onToggleParticipantAudio"
        />
      </template>

      <!-- Grid overlay for participants count -->
      <div
        v-if="showParticipantsCount && participantCount > 4"
        class="participants-count-overlay"
      >
        <div class="participants-count">
          <div class="flex items-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <span>{{ participantCount }}</span>
          </div>
          <div v-if="hiddenCount > 0" class="text-[10px] opacity-80 mt-0.5">
            +{{ hiddenCount }} hidden
          </div>
        </div>
      </div>

        <!-- Simple pagination controls when we have multiple pages -->
        <div
          v-if="totalPages > 1"
          class="participants-pagination mt-2"
        >
          <button
            class="pagination-btn"
            :disabled="currentPage <= 1"
            @click="currentPage = Math.max(1, currentPage - 1)"
          >
            ‹
          </button>
          <span class="pagination-label">
            Page {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            class="pagination-btn"
            :disabled="currentPage >= totalPages"
            @click="currentPage = Math.min(totalPages, currentPage + 1)"
          >
            ›
          </button>
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
const props = defineProps({
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
  },
  layout: {
    type: String,
    default: 'auto', // 'auto', 'grid', 'focus', 'sidebar'
    validator: (value) => ['auto', 'grid', 'focus', 'sidebar'].includes(value)
  },
  pinnedParticipantId: {
    type: String,
    default: ''
  },
  maxParticipantsPerPage: {
    type: Number,
    default: 9,
  },
})

// Emits
const emit = defineEmits(['participant-count-changed'])

// Reactive state
const isTransitioning = ref(false)

// Computed properties
const participantCount = computed(() => webrtcStore.participantCount)

// Filter participants: show all participants, but prioritize pinned and those with video enabled
const remoteParticipants = computed(() => {
  const participants = webrtcStore.remoteParticipants || []
  const pinnedId = props.pinnedParticipantId
  // Sort: pinned first, then participants with video enabled, then by connection state
  return [...participants].sort((a, b) => {
    if (pinnedId) {
      if (a.id === pinnedId && b.id !== pinnedId) return -1
      if (b.id === pinnedId && a.id !== pinnedId) return 1
    }
    // Then sort by video enabled
    if (a.isVideoEnabled && !b.isVideoEnabled) return -1
    if (!a.isVideoEnabled && b.isVideoEnabled) return 1
    // Then by connection state
    const stateOrder = { connected: 0, connecting: 1, new: 2, disconnected: 3, failed: 4 }
    return (stateOrder[a.connectionState] || 5) - (stateOrder[b.connectionState] || 5)
  })
})

// Pagination for large rooms based on maxParticipantsPerPage
const currentPage = ref(1)

const maxPerPage = computed(() => {
  const raw = Number(props.maxParticipantsPerPage) || 9
  return Math.max(1, raw)
})

const totalPages = computed(() => {
  if (remoteParticipants.value.length === 0) return 1
  return Math.max(1, Math.ceil(remoteParticipants.value.length / maxPerPage.value))
})

const visibleRemoteParticipants = computed(() => {
  if (remoteParticipants.value.length <= maxPerPage.value) {
    return remoteParticipants.value
  }
  const page = Math.min(currentPage.value, totalPages.value)
  const start = (page - 1) * maxPerPage.value
  return remoteParticipants.value.slice(start, start + maxPerPage.value)
})

const hiddenCount = computed(() => {
  const total = remoteParticipants.value.length
  const visible = visibleRemoteParticipants.value.length
  return Math.max(0, total - visible)
})

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
  // If layout is explicitly set, use it
  if (props.layout === 'grid') {
    const count = participantCount.value
    if (count <= 4) return 'grid-small'
    if (count <= 9) return 'grid-medium'
    return 'grid-large'
  }
  
  // Auto layout - calculate based on participant count
  if (props.layout === 'auto') {
    const count = participantCount.value
    if (count <= 4) return 'grid-small'
    if (count <= 9) return 'grid-medium'
    return 'grid-large'
  }
  
  // Focus layout - show one participant large, others small
  if (props.layout === 'focus') {
    return 'focus-layout'
  }
  
  // Sidebar layout
  if (props.layout === 'sidebar') {
    return 'sidebar-layout'
  }
  
  // Default to auto
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
  // Reset page when participant count shrinks
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
  }
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

watch(maxPerPage, () => {
  // Reset to first page when page size changes
  currentPage.value = 1
  updateGridLayout()
})

// Watch for layout changes to trigger re-render
watch(() => props.layout, (newLayout, oldLayout) => {
  console.log('Layout prop changed in ParticipantGrid:', { old: oldLayout, new: newLayout })
  isTransitioning.value = true
  setTimeout(() => {
    isTransitioning.value = false
  }, 300)
}, { immediate: false })

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
  /* Warp-style deep space gradient instead of flat gray */
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.35), transparent 55%),
    radial-gradient(circle at bottom, rgba(147, 51, 234, 0.25), transparent 55%),
    #020617;
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
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.35), transparent 55%),
    radial-gradient(circle at bottom, rgba(147, 51, 234, 0.25), transparent 55%),
    #020617;
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

/* Focus layout */
.focus-layout {
  @apply flex gap-2 p-2;
}

.focus-main {
  @apply flex-1;
  min-width: 0;
}

.focus-participant {
  @apply w-full h-full;
}

.focus-sidebar {
  @apply w-64 flex flex-col gap-2 overflow-y-auto;
}

/* Sidebar layout */
.sidebar-layout {
  @apply flex gap-2 p-2;
}

.sidebar-main-grid {
  @apply flex-1 grid gap-2;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.sidebar-participants {
  @apply w-64 flex flex-col gap-2 overflow-y-auto;
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

.grid-item.pinned-participant {
  @apply ring-2 ring-emerald-400;
}

.participants-count-overlay {
  @apply absolute top-4 right-4 z-30;
}

.participants-count {
  @apply bg-warp-surfaceAlt/90 text-warp-text px-3 py-2 rounded-lg text-xs flex flex-col items-end space-y-0.5 border border-warp-border/70 shadow-warp-sm;
}

.participants-pagination {
  @apply flex items-center justify-end space-x-2 text-xs text-warp-muted pr-1;
}

.pagination-btn {
  @apply px-2 py-1 rounded bg-warp-surfaceAlt hover:bg-warp-surface text-warp-text border border-warp-border/70 disabled:opacity-40 disabled:cursor-not-allowed;
}

.pagination-label {
  @apply px-2 py-1 bg-warp-surfaceAlt/80 text-warp-text rounded border border-warp-border/60;
}

.participants-pagination {
  @apply flex items-center justify-end space-x-2 text-xs text-white pr-1;
}

.pagination-btn {
  @apply px-2 py-1 rounded bg-black bg-opacity-40 hover:bg-opacity-70 disabled:opacity-40 disabled:cursor-not-allowed;
}

.pagination-label {
  @apply px-2 py-1 bg-black bg-opacity-30 rounded;
}

.waiting-state {
  @apply text-center text-white p-8;
}

.waiting-content {
  @apply max-w-md mx-auto;
}

.waiting-icon {
  @apply w-32 h-32 bg-warp-surfaceAlt rounded-full flex items-center justify-center mx-auto mb-6 shadow-warp-md;
  animation: bounce-gentle 2s ease-in-out infinite;
}

.waiting-title {
  @apply text-xl font-medium mb-2 text-warp-text;
}

.waiting-subtitle {
  @apply text-sm text-warp-muted mb-4;
}

.room-code-display {
  @apply bg-warp-surfaceAlt px-4 py-3 rounded-xl inline-block border border-warp-border;
}

.room-code {
  @apply font-mono font-bold text-2xl tracking-wider text-warp-accent2;
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
    width: 112px;
    height: 84px;
    bottom: 8px;
    right: 8px;
  }

  .participants-count-overlay {
    top: 4px;
    right: 4px;
  }

  .grid-small,
  .grid-medium,
  .grid-large {
    gap: 0.5rem;
    padding: 0.5rem;
  }

  .focus-layout,
  .sidebar-layout {
    @apply flex-col;
  }

  .focus-sidebar,
  .sidebar-participants {
    @apply w-full flex-row overflow-x-auto overflow-y-hidden;
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
