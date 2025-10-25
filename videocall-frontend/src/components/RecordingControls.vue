<!-- src/components/RecordingControls.vue - Recording controls component -->
<template>
  <div class="recording-controls">
    <!-- Recording Button -->
    <button
      v-if="!isRecording"
      @click="startRecording"
      :disabled="isProcessing"
      class="btn-record"
      title="Start Recording"
    >
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" />
      </svg>
      <span v-if="!isProcessing">Record</span>
      <span v-else>Starting...</span>
    </button>

    <!-- Stop Recording Button -->
    <button
      v-else
      @click="stopRecording"
      :disabled="isProcessing"
      class="btn-stop-record"
      title="Stop Recording"
    >
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <rect x="6" y="6" width="8" height="8" />
      </svg>
      <span>{{ recordingDuration }}</span>
    </button>

    <!-- Recording Indicator -->
    <div v-if="isRecording" class="recording-indicator">
      <span class="pulse"></span>
      REC
    </div>

    <!-- Recordings List Modal -->
    <Teleport to="body">
      <div
        v-if="showRecordingsList"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click="showRecordingsList = false"
      >
        <div class="card w-full max-w-2xl p-6 max-h-96 overflow-y-auto" @click.stop>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recordings
          </h3>

          <div v-if="recordings.length === 0" class="text-center py-8 text-gray-500">
            No recordings yet
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="recording in recordings"
              :key="recording.id"
              class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div class="flex-1">
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ formatDate(recording.started_at) }}
                </p>
                <p class="text-sm text-gray-500">
                  Duration: {{ recording.formatted_duration }} | 
                  Size: {{ recording.file_size_mb }} MB | 
                  Status: {{ recording.status }}
                </p>
              </div>

              <div class="flex items-center space-x-2">
                <button
                  v-if="recording.status === 'completed'"
                  @click="downloadRecording(recording.id)"
                  class="btn-secondary px-3 py-1 text-sm"
                >
                  Download
                </button>
                <span
                  v-else-if="recording.status === 'recording'"
                  class="text-red-500 text-sm"
                >
                  Recording...
                </span>
                <span
                  v-else-if="recording.status === 'processing'"
                  class="text-yellow-500 text-sm"
                >
                  Processing...
                </span>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button @click="showRecordingsList = false" class="btn-primary px-6 py-2">
              Close
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

const props = defineProps({
  roomCode: {
    type: String,
    required: true
  },
  participantId: {
    type: String,
    required: false
  }
})

const emit = defineEmits(['recording-started', 'recording-stopped'])

// State
const isRecording = ref(false)
const isProcessing = ref(false)
const currentRecordingId = ref(null)
const recordingStartTime = ref(null)
const recordingDuration = ref('00:00')
const recordings = ref([])
const showRecordingsList = ref(false)

// Timer
let durationInterval = null

// Computed
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

// Methods
const startRecording = async () => {
  try {
    isProcessing.value = true

    const response = await axios.post('/api/recordings/start/', {
      room_code: props.roomCode,
      participant_id: props.participantId,
      include_audio: true,
      include_video: true,
      include_screen_share: true
    })

    if (response.data.success) {
      isRecording.value = true
      currentRecordingId.value = response.data.recording.id
      recordingStartTime.value = new Date()
      
      // Start duration timer
      startDurationTimer()
      
      emit('recording-started', response.data.recording)
      
      console.log('Recording started:', response.data.recording)
    }
  } catch (error) {
    console.error('Failed to start recording:', error)
    alert('Failed to start recording: ' + (error.response?.data?.error || error.message))
  } finally {
    isProcessing.value = false
  }
}

const stopRecording = async () => {
  try {
    isProcessing.value = true

    const response = await axios.post(`/api/recordings/${currentRecordingId.value}/stop/`)

    if (response.data.success) {
      isRecording.value = false
      stopDurationTimer()
      
      emit('recording-stopped', response.data.recording)
      
      // Refresh recordings list
      await loadRecordings()
      
      console.log('Recording stopped:', response.data.recording)
    }
  } catch (error) {
    console.error('Failed to stop recording:', error)
    alert('Failed to stop recording: ' + (error.response?.data?.error || error.message))
  } finally {
    isProcessing.value = false
    currentRecordingId.value = null
  }
}

const loadRecordings = async () => {
  try {
    const response = await axios.get('/api/recordings/list_by_room/', {
      params: { room_code: props.roomCode }
    })

    if (response.data.success) {
      recordings.value = response.data.recordings
    }
  } catch (error) {
    console.error('Failed to load recordings:', error)
  }
}

const downloadRecording = async (recordingId) => {
  try {
    window.open(`/api/recordings/${recordingId}/download/`, '_blank')
  } catch (error) {
    console.error('Failed to download recording:', error)
  }
}

const startDurationTimer = () => {
  durationInterval = setInterval(() => {
    if (recordingStartTime.value) {
      const elapsed = Math.floor((new Date() - recordingStartTime.value) / 1000)
      const minutes = Math.floor(elapsed / 60)
      const seconds = elapsed % 60
      recordingDuration.value = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
  }, 1000)
}

const stopDurationTimer = () => {
  if (durationInterval) {
    clearInterval(durationInterval)
    durationInterval = null
  }
  recordingDuration.value = '00:00'
  recordingStartTime.value = null
}

// Lifecycle
onMounted(() => {
  loadRecordings()
})

onUnmounted(() => {
  stopDurationTimer()
})
</script>

<style scoped>
.recording-controls {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-record {
  @apply flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-stop-record {
  @apply flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.recording-indicator {
  @apply flex items-center space-x-2 px-3 py-1 bg-red-500 text-white rounded-full text-sm font-medium;
}

.pulse {
  @apply w-2 h-2 bg-white rounded-full animate-pulse;
}
</style>
