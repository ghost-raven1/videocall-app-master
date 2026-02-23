<!-- src/components/VideoCallControls.vue - Controls component extracted from VideoCall.vue -->
<template>
  <div class="bg-warp-surface/95 backdrop-blur-md p-3 sm:p-4 safe-area-inset border-t border-warp-border/80 shadow-warp-md">
    <!-- Recording Controls (Enterprise feature) -->
    <div v-if="roomCode" class="mb-4 flex justify-center">
      <RecordingControls
        :room-code="roomCode"
        :participant-id="participantId"
        @recording-started="$emit('recording-started', $event)"
        @recording-stopped="$emit('recording-stopped', $event)"
      />
    </div>

    <!-- Multi-user controls for 3+ participants -->
    <MultiUserControls
      v-if="isMultiUserCall"
      :participant-count="participantCount"
      :is-screen-sharing="isScreenSharing"
      :is-recording="isRecording"
      :adaptive-level="adaptiveLevel"
      @layout-changed="$emit('layout-changed', $event)"
      @screen-share-toggled="$emit('screen-share-toggled', $event)"
      @recording-toggled="$emit('recording-toggled', $event)"
      @participant-pinned="$emit('participant-pinned', $event)"
      @quality-settings-changed="$emit('quality-settings-changed', $event)"
    />

    <!-- Standard controls for 2-user calls (backward compatibility) -->
    <div v-else class="max-w-md mx-auto flex items-center justify-center space-x-3 sm:space-x-6 px-2">
      <!-- Toggle Audio -->
      <button
        @click="$emit('toggle-audio')"
        data-test="toggle-audio-button"
        :class="[
          'control-button',
          isAudioEnabled ? 'control-button-active' : 'control-button-danger',
        ]"
        :title="isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'"
        :aria-label="isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'"
        :aria-pressed="String(isAudioEnabled)"
      >
        <svg
          v-if="isAudioEnabled"
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          ></path>
        </svg>
        <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1m0 0V7a3 3 0 013-3h8a3 3 0 013 3v2M4 9h1m11 0h5m-9 0a1 1 0 011-1v-1a1 1 0 011-1m-1 1v1a1 1 0 001 1M9 7h8a3 3 0 013 3v2"
          ></path>
        </svg>
      </button>

      <!-- Toggle Video -->
      <button
        @click="$emit('toggle-video')"
        data-test="toggle-video-button"
        :class="[
          'control-button',
          isVideoEnabled ? 'control-button-active' : 'control-button-danger',
        ]"
        :title="isVideoEnabled ? 'Turn off camera' : 'Turn on camera'"
        :aria-label="isVideoEnabled ? 'Turn off camera' : 'Turn on camera'"
        :aria-pressed="String(isVideoEnabled)"
      >
        <svg
          v-if="isVideoEnabled"
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          ></path>
        </svg>
        <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 21l-1.5-1.5m-6.364-6.364L8.5 14.5 7 13l1.636-1.636m0 0L9 10.5"
          ></path>
        </svg>
      </button>

      <!-- Share Room -->
      <button
        @click="$emit('share-room')"
        data-test="share-room-button"
        class="control-button control-button-inactive"
        title="Share room"
        aria-label="Share room"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
          ></path>
        </svg>
      </button>

      <!-- End Call -->
      <button
        @click="$emit('end-call')"
        data-test="end-call-button"
        class="control-button control-button-danger"
        title="End call"
        aria-label="End call"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l18 18"
          ></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import RecordingControls from './RecordingControls.vue'
import MultiUserControls from './MultiUserControls.vue'

defineProps({
  roomCode: {
    type: String,
    default: ''
  },
  participantId: {
    type: String,
    default: ''
  },
  isMultiUserCall: {
    type: Boolean,
    default: false
  },
  participantCount: {
    type: Number,
    default: 0
  },
  isAudioEnabled: {
    type: Boolean,
    default: true
  },
  isVideoEnabled: {
    type: Boolean,
    default: true
  },
  isScreenSharing: {
    type: Boolean,
    default: false
  },
  isRecording: {
    type: Boolean,
    default: false
  },
  adaptiveLevel: {
    type: String,
    default: 'high',
  },
})

defineEmits([
  'recording-started',
  'recording-stopped',
  'layout-changed',
  'screen-share-toggled',
  'recording-toggled',
  'participant-pinned',
  'quality-settings-changed',
  'toggle-audio',
  'toggle-video',
  'share-room',
  'end-call',
])
</script>
