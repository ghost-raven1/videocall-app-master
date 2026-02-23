/**
 * Controller for managing recording functionality
 * Handles starting, stopping, and managing recordings
 */
import { ref, computed, onUnmounted, type Ref } from 'vue'
import { useGlobalStore } from '@/stores/global'
import axios from 'axios'

export interface Recording {
  id: string
  room_id: string
  room_code: string
  participant_id: string
  started_at: string
  ended_at?: string
  duration?: number
  formatted_duration?: string
  file_size?: number
  file_size_mb?: number
  status: 'recording' | 'processing' | 'completed' | 'failed'
  file_url?: string
  include_audio: boolean
  include_video: boolean
  include_screen_share: boolean
}

export interface RecordingController {
  // State
  isRecording: Ref<boolean>
  isProcessing: Ref<boolean>
  recordingDuration: Ref<string>
  recordings: Ref<Recording[]>
  currentRecordingId: Ref<string | null>
  error: Ref<string | null>
  showRecordingsList: Ref<boolean>
  
  // Computed
  hasRecordings: Ref<boolean>
  currentRecording: Ref<Recording | null>
  
  // Methods
  startRecording: (roomCode: string, participantId?: string, options?: {
    includeAudio?: boolean
    includeVideo?: boolean
    includeScreenShare?: boolean
  }) => Promise<{ success: boolean; error?: string; recording?: Recording }>
  stopRecording: () => Promise<{ success: boolean; error?: string; recording?: Recording }>
  toggleRecording: (roomCode: string, participantId?: string) => Promise<void>
  loadRecordings: (roomCode: string) => Promise<void>
  downloadRecording: (recordingId: string) => void
  formatDate: (dateString: string) => string
  reset: () => void
}

/**
 * Creates a recording controller
 */
export function useRecordingController(): RecordingController {
  const globalStore = useGlobalStore()
  const isAxiosLikeError = (value: unknown): value is { response?: { data?: { error?: string } }; message?: string } => {
    if (typeof (axios as any)?.isAxiosError === 'function') {
      return (axios as any).isAxiosError(value)
    }
    return !!(value && typeof value === 'object' && ('response' in (value as Record<string, unknown>) || 'message' in (value as Record<string, unknown>)))
  }
  
  // State
  const isRecording = ref(false)
  const isProcessing = ref(false)
  const recordingDuration = ref('00:00')
  const recordings = ref<Recording[]>([])
  const currentRecordingId = ref<string | null>(null)
  const recordingStartTime = ref<Date | null>(null)
  const error = ref<string | null>(null)
  const showRecordingsList = ref(false)
  
  // Timer
  let durationInterval: number | null = null
  
  /**
   * Computed: Has recordings
   */
  const hasRecordings = computed(() => {
    return recordings.value.length > 0
  })
  
  /**
   * Computed: Current recording
   */
  const currentRecording = computed(() => {
    if (!currentRecordingId.value) return null
    return recordings.value.find(r => r.id === currentRecordingId.value) || null
  })
  
  /**
   * Start duration timer
   */
  const startDurationTimer = (): void => {
    if (durationInterval) {
      clearInterval(durationInterval)
    }
    
    durationInterval = setInterval(() => {
      if (recordingStartTime.value) {
        const elapsed = Math.floor((new Date().getTime() - recordingStartTime.value.getTime()) / 1000)
        const minutes = Math.floor(elapsed / 60)
        const seconds = elapsed % 60
        recordingDuration.value = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      }
    }, 1000) as unknown as number
  }
  
  /**
   * Stop duration timer
   */
  const stopDurationTimer = (): void => {
    if (durationInterval) {
      clearInterval(durationInterval)
      durationInterval = null
    }
    recordingDuration.value = '00:00'
    recordingStartTime.value = null
  }
  
  /**
   * Start recording
   */
  const startRecording = async (
    roomCode: string,
    participantId?: string,
    options: {
      includeAudio?: boolean
      includeVideo?: boolean
      includeScreenShare?: boolean
    } = {}
  ): Promise<{ success: boolean; error?: string; recording?: Recording }> => {
    if (isProcessing.value) {
      return { success: false, error: 'Recording operation already in progress' }
    }
    
    if (isRecording.value) {
      return { success: false, error: 'Recording is already in progress' }
    }
    
    try {
      isProcessing.value = true
      error.value = null
      
      // Use axios directly for recording endpoints
      const response = await axios.post('/api/recordings/start/', {
        room_code: roomCode,
        participant_id: participantId,
        include_audio: options.includeAudio !== false,
        include_video: options.includeVideo !== false,
        include_screen_share: options.includeScreenShare !== false
      })
      
      if (response.data.success && response.data.recording) {
        isRecording.value = true
        currentRecordingId.value = response.data.recording.id
        recordingStartTime.value = new Date()
        
        // Start duration timer
        startDurationTimer()
        
        // Add to recordings list if not already there
        const existingIndex = recordings.value.findIndex(r => r.id === response.data.recording.id)
        if (existingIndex === -1) {
          recordings.value.push(response.data.recording)
        }
        
        globalStore.addNotification('Recording started', 'success', 2000)
        
        return { success: true, recording: response.data.recording }
      } else {
        const errorMsg = response.data.error || 'Failed to start recording'
        error.value = errorMsg
        globalStore.addNotification(errorMsg, 'error', 5000)
        return { success: false, error: errorMsg }
      }
    } catch (err: unknown) {
      let errorMessage = 'Unknown error'
      if (isAxiosLikeError(err)) {
        errorMessage = err.response?.data?.error || err.message || 'Unknown error'
      } else if (err instanceof Error) {
        errorMessage = err.message
      }
      error.value = errorMessage
      globalStore.addNotification(`Failed to start recording: ${errorMessage}`, 'error', 5000)
      return { success: false, error: errorMessage }
    } finally {
      isProcessing.value = false
    }
  }
  
  /**
   * Stop recording
   */
  const stopRecording = async (): Promise<{ success: boolean; error?: string; recording?: Recording }> => {
    if (!isRecording.value || !currentRecordingId.value) {
      return { success: false, error: 'No active recording to stop' }
    }
    
    if (isProcessing.value) {
      return { success: false, error: 'Recording operation already in progress' }
    }
    
    try {
      isProcessing.value = true
      error.value = null
      
      // Use axios directly for recording endpoints
      const response = await axios.post(`/api/recordings/${currentRecordingId.value}/stop/`)
      
      if (response.data.success && response.data.recording) {
        isRecording.value = false
        stopDurationTimer()
        
        // Update recording in list
        const index = recordings.value.findIndex(r => r.id === currentRecordingId.value)
        if (index !== -1) {
          recordings.value[index] = response.data.recording
        }
        
        const stoppedRecording = response.data.recording
        currentRecordingId.value = null
        
        // Refresh recordings list
        await loadRecordings(stoppedRecording.room_code)
        
        globalStore.addNotification('Recording stopped', 'success', 2000)
        
        return { success: true, recording: stoppedRecording }
      } else {
        const errorMsg = response.data.error || 'Failed to stop recording'
        error.value = errorMsg
        globalStore.addNotification(errorMsg, 'error', 5000)
        return { success: false, error: errorMsg }
      }
    } catch (err: unknown) {
      let errorMessage = 'Unknown error'
      if (isAxiosLikeError(err)) {
        errorMessage = err.response?.data?.error || err.message || 'Unknown error'
      } else if (err instanceof Error) {
        errorMessage = err.message
      }
      error.value = errorMessage
      globalStore.addNotification(`Failed to stop recording: ${errorMessage}`, 'error', 5000)
      return { success: false, error: errorMessage }
    } finally {
      isProcessing.value = false
    }
  }
  
  /**
   * Toggle recording (start if stopped, stop if started)
   */
  const toggleRecording = async (roomCode: string, participantId?: string): Promise<void> => {
    if (isRecording.value) {
      await stopRecording()
    } else {
      await startRecording(roomCode, participantId)
    }
  }
  
  /**
   * Load recordings for a room
   */
  const loadRecordings = async (roomCode: string): Promise<void> => {
    try {
      error.value = null
      
      // Use axios directly for recording endpoints
      const response = await axios.get('/api/rooms/recordings/list_by_room/', {
        params: { room_code: roomCode }
      })
      
      if (response.data.success && response.data.recordings) {
        recordings.value = response.data.recordings
      } else {
        console.error('Failed to load recordings:', response.data.error || 'Unknown error')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load recordings'
      error.value = errorMessage
      console.error('Failed to load recordings:', err)
    }
  }
  
  /**
   * Download recording
   */
  const downloadRecording = async (recordingId: string): Promise<void> => {
    try {
      console.log('Downloading recording:', recordingId)
      
      const downloadUrl = `/api/rooms/recordings/${recordingId}/download/`
      
      // Use fetch to check if file exists and trigger download
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Accept': '*/*'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to download recording' }))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `recording_${recordingId}.webm`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      }
      
      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      console.log('Recording downloaded successfully:', filename)
      globalStore.addNotification('Recording downloaded successfully', 'success', 2000)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download recording'
      console.error('Failed to download recording:', err)
      globalStore.addNotification(`Failed to download recording: ${errorMessage}`, 'error', 3000)
    }
  }
  
  /**
   * Format date for display
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }
  
  /**
   * Reset controller state
   */
  const reset = (): void => {
    stopDurationTimer()
    isRecording.value = false
    isProcessing.value = false
    currentRecordingId.value = null
    recordingStartTime.value = null
    error.value = null
    showRecordingsList.value = false
  }
  
  // Cleanup on unmount
  onUnmounted(() => {
    stopDurationTimer()
  })
  
  return {
    // State
    isRecording,
    isProcessing,
    recordingDuration,
    recordings,
    currentRecordingId,
    error,
    showRecordingsList,
    
    // Computed
    hasRecordings,
    currentRecording,
    
    // Methods
    startRecording,
    stopRecording,
    toggleRecording,
    loadRecordings,
    downloadRecording,
    formatDate,
    reset
  }
}
