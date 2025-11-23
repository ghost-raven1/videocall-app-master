/**
 * Controller for managing call state
 * Handles connection state, call duration, and connection messages
 */
import { ref, computed, onUnmounted } from 'vue'
import type { Ref } from 'vue'

export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed'

export interface CallStateController {
  // State
  isConnecting: Ref<boolean>
  callDuration: Ref<number>
  callStartTime: Ref<Date | null>
  connectionProgress: Ref<string>
  connectingMessage: Ref<string>
  connectingSubMessage: Ref<string>
  
  // Computed
  connectionStatusText: Ref<string>
  connectionStatusColor: Ref<string>
  formattedCallDuration: Ref<string>
  
  // Methods
  startCall: () => void
  endCall: () => void
  updateConnectionState: (state: ConnectionState) => void
  updateCallDuration: () => void
  setConnectionProgress: (message: string) => void
  setConnectingMessage: (message: string, subMessage?: string) => void
  reset: () => void
}

/**
 * Creates a call state controller
 * @param externalConnectionState - Optional external connection state from WebRTC store
 */
export function useCallStateController(
  externalConnectionState?: Ref<ConnectionState>
): CallStateController {
  // Internal state
  const isConnecting = ref(false)
  const callDuration = ref(0)
  const callStartTime = ref<Date | null>(null)
  const connectionProgress = ref('Please wait while we set up your call')
  const connectingMessage = ref('Connecting...')
  const connectingSubMessage = ref('Setting up your video call')
  
  // Duration update interval
  let durationInterval: number | null = null

  // Use external connection state if provided, otherwise use internal
  const connectionState = externalConnectionState || ref<ConnectionState>('new')

  /**
   * Computed: Connection status text
   */
  const connectionStatusText = computed(() => {
    switch (connectionState.value) {
      case 'new':
        return 'Initializing...'
      case 'connecting':
        return 'Connecting...'
      case 'connected':
        return 'Connected'
      case 'disconnected':
        return 'Disconnected'
      case 'failed':
        return 'Connection failed'
      case 'closed':
        return 'Connection closed'
      default:
        return 'Unknown'
    }
  })

  /**
   * Computed: Connection status color for UI
   */
  const connectionStatusColor = computed(() => {
    switch (connectionState.value) {
      case 'connected':
        return 'bg-green-400'
      case 'connecting':
      case 'new':
        return 'bg-yellow-400'
      case 'disconnected':
      case 'failed':
      case 'closed':
        return 'bg-red-400'
      default:
        return 'bg-gray-400'
    }
  })

  /**
   * Computed: Formatted call duration (MM:SS or HH:MM:SS)
   */
  const formattedCallDuration = computed(() => {
    const hours = Math.floor(callDuration.value / 3600)
    const minutes = Math.floor((callDuration.value % 3600) / 60)
    const seconds = Math.floor(callDuration.value % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  })

  /**
   * Start call - initialize call state and start duration timer
   */
  const startCall = () => {
    // Only set isConnecting to true if connection state is not 'connected'
    // If already connected, just start duration tracking
    if (connectionState.value !== 'connected') {
      isConnecting.value = true
    }
    
    // Initialize start time if not already set
    if (!callStartTime.value) {
      callStartTime.value = new Date()
      callDuration.value = 0
    }
    
    // Start duration update interval (update every second)
    if (durationInterval) {
      clearInterval(durationInterval)
    }
    
    durationInterval = window.setInterval(() => {
      updateCallDuration()
    }, 1000)
  }

  /**
   * End call - cleanup and reset state
   */
  const endCall = () => {
    isConnecting.value = false
    
    // Clear duration interval
    if (durationInterval) {
      clearInterval(durationInterval)
      durationInterval = null
    }
    
    // Reset state
    callStartTime.value = null
    callDuration.value = 0
    connectionProgress.value = 'Please wait while we set up your call'
    connectingMessage.value = 'Connecting...'
    connectingSubMessage.value = 'Setting up your video call'
  }

  /**
   * Update connection state
   */
  const updateConnectionState = (state: ConnectionState) => {
    if (!externalConnectionState) {
      // Only update if we're managing state internally
      connectionState.value = state
    }
    
    // Update connecting flag based on state
    if (state === 'connected') {
      isConnecting.value = false
    } else if (state === 'connecting' || state === 'new') {
      isConnecting.value = true
    }
  }

  /**
   * Update call duration based on start time
   */
  const updateCallDuration = () => {
    if (callStartTime.value) {
      const now = new Date()
      const diff = Math.floor((now.getTime() - callStartTime.value.getTime()) / 1000)
      callDuration.value = Math.max(0, diff)
    }
  }

  /**
   * Set connection progress message
   */
  const setConnectionProgress = (message: string) => {
    connectionProgress.value = message
  }

  /**
   * Set connecting message and optional sub-message
   */
  const setConnectingMessage = (message: string, subMessage?: string) => {
    connectingMessage.value = message
    if (subMessage !== undefined) {
      connectingSubMessage.value = subMessage
    }
  }

  /**
   * Reset all state to initial values
   */
  const reset = () => {
    endCall()
    if (!externalConnectionState) {
      connectionState.value = 'new'
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (durationInterval) {
      clearInterval(durationInterval)
    }
  })

  return {
    // State
    isConnecting,
    callDuration,
    callStartTime,
    connectionProgress,
    connectingMessage,
    connectingSubMessage,
    
    // Computed
    connectionStatusText,
    connectionStatusColor,
    formattedCallDuration,
    
    // Methods
    startCall,
    endCall,
    updateConnectionState,
    updateCallDuration,
    setConnectionProgress,
    setConnectingMessage,
    reset
  }
}

