<template>
  <div class="multi-user-controls">
    <!-- Main controls bar -->
    <div class="controls-bar">
      <div class="controls-section left-controls">
        <!-- Layout controls -->
        <div class="control-group">
          <button
            @click="toggleLayout"
            class="control-btn layout-btn"
            :class="{ 'active': currentLayout !== 'auto' }"
            title="Change layout"
          >
            <svg class="control-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span class="control-label">{{ layoutLabel }}</span>
          </button>

          <!-- Layout options dropdown -->
          <div v-if="showLayoutOptions" v-click-outside="closeLayoutDropdown" class="dropdown layout-dropdown">
            <button
              v-for="layout in availableLayouts"
              :key="layout.id"
              @click="selectLayout(layout.id)"
              class="dropdown-item"
              :class="{ 'active': currentLayout === layout.id }"
            >
              <svg class="dropdown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="layout.icon" />
              </svg>
              {{ layout.label }}
            </button>
          </div>
        </div>

        <!-- Screen share controls -->
        <div class="control-group">
          <button
            @click="toggleScreenShare"
            class="control-btn screen-btn"
            :class="{ 'active': isScreenSharing }"
            title="Share screen"
          >
            <svg class="control-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span class="control-label">{{ isScreenSharing ? 'Stop' : 'Share' }}</span>
          </button>
        </div>
      </div>

      <div class="controls-section center-controls">
        <!-- Recording controls -->
        <div class="control-group">
          <button
            @click="toggleRecording"
            class="control-btn record-btn"
            :class="{ 'active': isRecording, 'recording': isRecording }"
            title="Start/Stop recording"
          >
            <div v-if="isRecording" class="recording-dot"></div>
            <svg class="control-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span class="control-label">{{ isRecording ? 'Stop' : 'Record' }}</span>
          </button>
        </div>

        <!-- Participants sidebar toggle -->
        <div class="control-group">
          <button
            @click="toggleParticipantsSidebar"
            class="control-btn participants-btn"
            :class="{ 'active': showParticipantsSidebar }"
            title="Show participants"
          >
            <svg class="control-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <span class="participants-count">{{ participantCount }}</span>
          </button>
        </div>
      </div>

      <div class="controls-section right-controls">
        <!-- Quality settings -->
        <div class="control-group">
          <button
            @click="toggleQualitySettings"
            class="control-btn quality-btn"
            title="Quality settings"
          >
            <div class="relative flex items-center">
              <svg class="control-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <!-- Small badge when adaptive is active & quality is auto -->
              <span
                v-if="videoQuality === 'auto'"
                class="quality-badge"
              >
                {{ adaptiveLevelLabel.charAt(0) }}
              </span>
            </div>
            <span class="control-label">Settings</span>
          </button>
        </div>

        <!-- More options -->
        <div class="control-group">
          <button
            @click="toggleMoreOptions"
            class="control-btn more-btn"
            title="More options"
          >
            <svg class="control-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Participants sidebar -->
    <div v-if="showParticipantsSidebar" class="participants-sidebar" v-click-outside="closeParticipantsSidebar">
      <div class="sidebar-header">
        <h3 class="sidebar-title">Participants ({{ participantCount }})</h3>
        <button @click="closeParticipantsSidebar" class="sidebar-close">
          <svg class="close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="participants-list">
        <!-- Local participant -->
        <div class="participant-item local-participant">
          <div class="participant-avatar">
            <svg class="avatar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div class="participant-info">
            <span class="participant-name">You</span>
            <div class="participant-status">
              <span class="status-indicator you">You</span>
            </div>
          </div>
          <div class="participant-controls">
            <button
              @click="toggleLocalVideo"
              :class="['control-small', { 'active': webrtcStore.isVideoEnabled }]"
              :title="webrtcStore.isVideoEnabled ? 'Turn off camera' : 'Turn on camera'"
            >
              <svg v-if="webrtcStore.isVideoEnabled" class="control-icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <svg v-else class="control-icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 21l-1.5-1.5m-6.364-6.364L8.5 14.5 7 13l1.636-1.636m0 0L9 10.5" />
              </svg>
            </button>
            <button
              @click="toggleLocalAudio"
              :class="['control-small', { 'active': webrtcStore.isAudioEnabled, 'muted': !webrtcStore.isAudioEnabled }]"
              :title="webrtcStore.isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'"
            >
              <svg v-if="webrtcStore.isAudioEnabled" class="control-icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <svg v-else class="control-icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1m0 0V7a3 3 0 013-3h8a3 3 0 013 3v2M4 9h1m11 0h5m-9 0a1 1 0 011-1v-1a1 1 0 011-1m-1 1v1a1 1 0 001 1M9 7h8a3 3 0 013 3v2" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Remote participants -->
        <div
          v-for="participant in remoteParticipants"
          :key="participant.id"
          class="participant-item remote-participant"
          :class="{ 'speaking': participant.audioLevel > 50 }"
        >
          <div class="participant-avatar">
            <img
              v-if="participant.avatar"
              :src="participant.avatar"
              :alt="participant.name"
              class="avatar-image"
            />
            <svg v-else class="avatar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div class="participant-info">
            <span class="participant-name">{{ participant.name || 'Anonymous' }}</span>
            <div class="participant-status">
              <span
                class="status-indicator"
                :class="getConnectionStatusClass(participant.connectionState)"
              >
                {{ getConnectionStatusText(participant.connectionState) }}
              </span>
              <span v-if="participant.isRecording" class="status-indicator recording">REC</span>
            </div>
          </div>
          <div class="participant-controls">
            <button
              @click="toggleParticipantVideo(participant.id)"
              :class="['control-small', { 'active': participant.isVideoEnabled }]"
              :title="participant.isVideoEnabled ? 'Turn off participant camera' : 'Turn on participant camera'"
            >
              <svg v-if="participant.isVideoEnabled" class="control-icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <svg v-else class="control-icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 21l-1.5-1.5m-6.364-6.364L8.5 14.5 7 13l1.636-1.636m0 0L9 10.5" />
              </svg>
            </button>
            <button
              @click="toggleParticipantAudio(participant.id)"
              :class="['control-small', { 'active': participant.isAudioEnabled, 'muted': !participant.isAudioEnabled }]"
              :title="participant.isAudioEnabled ? 'Mute participant' : 'Unmute participant'"
            >
              <svg v-if="participant.isAudioEnabled" class="control-icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <svg v-else class="control-icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1m0 0V7a3 3 0 013-3h8a3 3 0 013 3v2M4 9h1m11 0h5m-9 0a1 1 0 011-1v-1a1 1 0 011-1m-1 1v1a1 1 0 001 1M9 7h8a3 3 0 013 3v2" />
              </svg>
            </button>
            <button
              @click="pinParticipant(participant.id)"
              class="control-small pin-btn"
              :class="{ 'active': participant.isPinned }"
              title="Pin participant"
            >
              <svg class="control-icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quality settings panel -->
    <div v-if="showQualitySettings" class="quality-settings" v-click-outside="closeQualitySettings">
      <div class="settings-header">
        <h3 class="settings-title">Quality Settings</h3>
        <button @click="closeQualitySettings" class="settings-close">
          <svg class="close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="settings-content">
        <div class="setting-group">
          <label class="setting-label">Video Quality</label>
          <select v-model="videoQuality" class="setting-select">
            <option value="low">Low (480p)</option>
            <option value="medium">Medium (720p)</option>
            <option value="high">High (1080p)</option>
            <option value="auto">Auto</option>
          </select>
          <p v-if="videoQuality === 'auto'" class="setting-help">
            Adaptive: currently <span class="setting-help-highlight">{{ adaptiveLevelLabel }}</span>
          </p>
        </div>

        <div class="setting-group">
          <label class="setting-label">Max Participants per Page</label>
          <input
            v-model.number="maxParticipantsPerPage"
            type="number"
            min="4"
            max="25"
            class="setting-input"
          />
        </div>

        <div class="setting-group">
          <label class="checkbox-label">
            <input
              v-model="adaptiveQuality"
              type="checkbox"
              class="setting-checkbox"
            />
            Adaptive quality based on connection
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useWebRTCStore } from '../stores/webrtc'

const webrtcStore = useWebRTCStore()

// Props
const props = defineProps({
  participantCount: {
    type: Number,
    default: 1,
  },
  isScreenSharing: {
    type: Boolean,
    default: false,
  },
  // Use real recording state from parent (controller) so UI stays in sync
  isRecording: {
    type: Boolean,
    default: false,
  },
  // Current adaptive level from parent ('low' | 'medium' | 'high')
  adaptiveLevel: {
    type: String,
    default: 'high',
  },
})

// Emits
const emit = defineEmits([
  'layout-changed',
  'screen-share-toggled',
  'recording-toggled',
  'participant-pinned',
  'quality-settings-changed',
])

// Reactive state (UI only)
const currentLayout = ref('auto')
const showLayoutOptions = ref(false)
const showParticipantsSidebar = ref(false)
const showQualitySettings = ref(false)
const videoQuality = ref('auto')
const maxParticipantsPerPage = ref(9)
const adaptiveQuality = ref(true)

// Computed properties
const remoteParticipants = computed(() => webrtcStore.remoteParticipants)

const availableLayouts = computed(() => [
  { id: 'auto', label: 'Auto', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { id: 'grid', label: 'Grid', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { id: 'focus', label: 'Focus', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'sidebar', label: 'Sidebar', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' }
])

const layoutLabel = computed(() => {
  const layout = availableLayouts.value.find(l => l.id === currentLayout.value)
  return layout ? layout.label : 'Auto'
})

const adaptiveLevelLabel = computed(() => {
  const level = (props.adaptiveLevel || 'high').toLowerCase()
  if (level === 'low') return 'Low'
  if (level === 'medium') return 'Medium'
  return 'High'
})

// Methods
const toggleLayout = () => {
  showLayoutOptions.value = !showLayoutOptions.value
}

const closeLayoutDropdown = () => {
  showLayoutOptions.value = false
}

const selectLayout = (layoutId) => {
  currentLayout.value = layoutId
  showLayoutOptions.value = false
  emit('layout-changed', layoutId)
}

const toggleScreenShare = () => {
  // Let parent manage actual screen share state via controller
  emit('screen-share-toggled', !props.isScreenSharing)
}

const toggleRecording = () => {
  // Let parent/controller manage real recording state; we only emit desired next state
  emit('recording-toggled', !props.isRecording)
}

const toggleParticipantsSidebar = () => {
  showParticipantsSidebar.value = !showParticipantsSidebar.value
}

const closeParticipantsSidebar = () => {
  showParticipantsSidebar.value = false
}

const toggleQualitySettings = () => {
  showQualitySettings.value = !showQualitySettings.value
}

const closeQualitySettings = () => {
  showQualitySettings.value = false
}

const toggleMoreOptions = () => {
  // Toggle between showing participants sidebar or quality settings
  if (showParticipantsSidebar.value) {
    showParticipantsSidebar.value = false
    showQualitySettings.value = true
  } else if (showQualitySettings.value) {
    showQualitySettings.value = false
    showParticipantsSidebar.value = true
  } else {
    showParticipantsSidebar.value = true
  }
}

const toggleLocalVideo = () => {
  webrtcStore.toggleVideo()
}

const toggleLocalAudio = () => {
  webrtcStore.toggleAudio()
}

const toggleParticipantVideo = (participantId) => {
  webrtcStore.toggleParticipantVideo(participantId)
}

const toggleParticipantAudio = (participantId) => {
  webrtcStore.toggleParticipantAudio(participantId)
}

const pinParticipant = (participantId) => {
  emit('participant-pinned', participantId)
}

// Apply video quality changes to local media constraints and track
const applyVideoQuality = async (quality) => {
  try {
    const constraintsMap = {
      low: { width: 640, height: 360, frameRate: 15 },
      medium: { width: 1280, height: 720, frameRate: 30 },
      high: { width: 1920, height: 1080, frameRate: 60 },
      auto: { width: 1280, height: 720, frameRate: 30 },
    }

    const preset = constraintsMap[quality] || constraintsMap.auto

    // Update store media constraints for future getUserMedia calls
    const mc = webrtcStore.mediaConstraints
    if (mc && mc.video) {
      mc.video.width = { ideal: preset.width, max: preset.width }
      mc.video.height = { ideal: preset.height, max: preset.height }
      mc.video.frameRate = { ideal: preset.frameRate, max: preset.frameRate }
    }

    // Apply constraints to current local video track if available
    const stream = webrtcStore.localStream
    if (stream && stream.getVideoTracks && stream.getVideoTracks().length > 0) {
      const track = stream.getVideoTracks()[0]
      if (track && track.applyConstraints) {
        await track.applyConstraints({
          width: { ideal: preset.width, max: preset.width },
          height: { ideal: preset.height, max: preset.height },
          frameRate: { ideal: preset.frameRate, max: preset.frameRate },
        })
      }
    }
  } catch (error) {
    // Non-fatal; log for debugging
    console.warn('Failed to apply video quality constraints', quality, error)
  }
}

// React when user changes quality setting
watch(videoQuality, (newQuality) => {
  applyVideoQuality(newQuality)
})

// Emit consolidated quality settings whenever user changes controls
watch(
  [videoQuality, maxParticipantsPerPage, adaptiveQuality],
  ([q, max, adaptive]) => {
    emit('quality-settings-changed', {
      videoQuality: q,
      maxParticipantsPerPage: max,
      adaptiveQuality: !!adaptive,
    })
  },
)

const getConnectionStatusClass = (state) => {
  switch (state) {
    case 'connected': return 'connected'
    case 'connecting': return 'connecting'
    case 'disconnected': return 'disconnected'
    case 'failed': return 'failed'
    default: return 'unknown'
  }
}

const getConnectionStatusText = (state) => {
  switch (state) {
    case 'connected': return 'Connected'
    case 'connecting': return 'Connecting'
    case 'disconnected': return 'Offline'
    case 'failed': return 'Error'
    default: return 'Unknown'
  }
}

// Click outside directive
const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value()
      }
    }
    document.addEventListener('click', el._clickOutside)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside)
  },
}
</script>

<style scoped>
.multi-user-controls {
  @apply bg-warp-surface/95 backdrop-blur-md border-t border-warp-border/80 shadow-warp-md;
}

.controls-bar {
  @apply flex items-center justify-between p-4 max-w-6xl mx-auto;
}

.controls-section {
  @apply flex items-center space-x-4;
}

.control-group {
  @apply relative;
}

.control-btn {
  @apply flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200;
  @apply bg-warp-surfaceAlt hover:bg-warp-surface text-warp-text;
}

.control-btn.active {
  @apply bg-warp-accent2 hover:bg-emerald-500 text-white;
}

.control-btn.recording {
  @apply bg-red-600 hover:bg-red-700 text-white;
}

.control-icon {
  @apply w-5 h-5;
}

.quality-badge {
  @apply absolute -top-1 -right-1 text-[10px] leading-none px-1.5 py-0.5 rounded-full;
  @apply bg-emerald-500 text-white shadow;
}

.control-label {
  @apply text-sm font-medium;
}

.participants-count {
  @apply bg-warp-surfaceAlt text-warp-text text-xs px-2 py-1 rounded-full ml-1;
}

/* Layout dropdown */
.layout-dropdown {
  @apply absolute bottom-full left-0 mb-2 bg-warp-surfaceAlt rounded-lg shadow-xl border border-warp-border py-2 z-50 min-w-48;
}

.dropdown-item {
  @apply w-full text-left px-4 py-2 text-sm text-warp-text hover:bg-warp-surface flex items-center space-x-3;
}

.dropdown-item.active {
  @apply bg-warp-accent2 text-white;
}

.dropdown-icon {
  @apply w-4 h-4;
}

/* Participants sidebar */
.participants-sidebar {
  @apply absolute top-0 right-0 w-80 h-full bg-warp-surface border-l border-warp-border shadow-warp-md z-40;
}


.sidebar-title {
  @apply text-warp-text font-medium;
}

.sidebar-close {
  @apply p-2 hover:bg-warp-surfaceAlt rounded-lg transition-colors;
}

.close-icon {
  @apply w-5 h-5 text-warp-muted;
}

.participants-list {
  @apply p-4 space-y-3 max-h-96 overflow-y-auto;
}

.participant-item {
  @apply flex items-center space-x-3 p-3 rounded-lg transition-colors;
}

.participant-item.speaking {
  @apply bg-emerald-500/10 border border-emerald-500/60;
}

.local-participant {
  @apply bg-warp-surfaceAlt;
}

.participant-avatar {
  @apply w-10 h-10 rounded-full bg-warp-surfaceAlt flex items-center justify-center;
}

.avatar-image {
  @apply w-full h-full rounded-full object-cover;
}

.avatar-icon {
  @apply w-5 h-5 text-warp-muted;
}

.participant-info {
  @apply flex-1;
}

.participant-name {
  @apply text-white text-sm font-medium block;
}

.participant-status {
  @apply flex items-center space-x-2 mt-1;
}

.status-indicator {
  @apply text-xs px-2 py-1 rounded-full;
}

.status-indicator.you {
  @apply bg-green-600 text-white;
}

.status-indicator.connected {
  @apply bg-green-600 text-white;
}

.status-indicator.connecting {
  @apply bg-yellow-600 text-white;
}

.status-indicator.disconnected {
  @apply bg-warp-surfaceAlt text-warp-muted border border-warp-border/60;
}

.status-indicator.failed {
  @apply bg-red-600 text-white;
}

.status-indicator.recording {
  @apply bg-red-600 text-white;
}

.participant-controls {
  @apply flex space-x-1;
}

.control-small {
  @apply p-2 rounded-lg transition-colors;
  @apply bg-warp-surfaceAlt hover:bg-warp-surface text-warp-text;
}

.control-small.active {
  @apply bg-warp-accent2 hover:bg-emerald-500 text-white;
}

.control-small.muted {
  @apply bg-red-600 hover:bg-red-700 text-white;
}

.control-icon-small {
  @apply w-4 h-4 text-white;
}

.pin-btn.active {
  @apply bg-amber-500 hover:bg-amber-600 text-white shadow-warp-sm;
}

/* Quality settings */
.quality-settings {
  @apply absolute top-0 right-0 w-80 h-full bg-warp-surface border-l border-warp-border shadow-warp-md z-40;
}

.settings-header {
  @apply flex items-center justify-between p-4 border-b border-warp-border;
}

.settings-title {
  @apply text-warp-text font-medium;
}

.settings-close {
  @apply p-2 hover:bg-warp-surfaceAlt rounded-lg transition-colors;
}

.settings-content {
  @apply p-4 space-y-4;
}

.setting-group {
  @apply space-y-2;
}

.setting-label {
  @apply text-white text-sm font-medium block;
}

.setting-help {
  @apply mt-1 text-xs text-warp-muted;
}

.setting-help-highlight {
  @apply font-semibold text-warp-text;
}

.setting-select,
.setting-input {
  @apply w-full px-3 py-2 bg-warp-surfaceAlt border border-warp-border rounded-lg text-warp-text;
}

.setting-checkbox {
  @apply mr-2;
}

.checkbox-label {
  @apply text-warp-muted text-sm flex items-center;
}

.recording-dot {
  @apply w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2;
}

/* Responsive design */
@media (max-width: 768px) {
  .controls-bar {
    @apply p-2 flex-wrap gap-y-2;
  }

  .controls-section {
    @apply space-x-2;
  }

  .control-btn {
    @apply px-2 py-2;
  }

  .control-label {
    @apply hidden;
  }

  .participants-sidebar,
  .quality-settings {
    @apply w-full;
  }
}

@media (max-width: 480px) {
  .controls-bar {
    @apply flex-col items-stretch;
  }

  .controls-section {
    @apply w-full justify-between;
  }

  .control-btn {
    @apply flex-1 justify-center;
  }
}
</style>
