/**
 * Main controller for video call coordination
 * Combines all sub-controllers and manages call lifecycle
 */
import { ref, computed, onUnmounted, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWebRTCStore } from '@/stores/webrtc'
import { useRoomsStore } from '@/stores/rooms'
import { useGlobalStore } from '@/stores/global'
import { useCallStateController, type ConnectionState } from './useCallStateController'
import { useMediaController } from './useMediaController'
import { useScreenShareController } from './useScreenShareController'
import { useRecordingController } from '../recording/useRecordingController'

export interface VideoCallController {
  // Sub-controllers
  callState: ReturnType<typeof useCallStateController>
  media: ReturnType<typeof useMediaController>
  screenShare: ReturnType<typeof useScreenShareController>
  recording: ReturnType<typeof useRecordingController>
  
  // State
  roomInfo: Ref<any | null>
  isInitialized: Ref<boolean>
  
  // Methods
  initializeCall: (roomId: string) => Promise<{ success: boolean; error?: string }>
  handleEndCall: () => Promise<void>
  refreshConnection: () => Promise<void>
  reset: () => void
}

/**
 * Creates the main video call controller
 * @param roomId - Optional room ID (if not provided, will be taken from route)
 */
export function useVideoCallController(roomId?: string): VideoCallController {
  const route = useRoute()
  const router = useRouter()
  const webrtcStore = useWebRTCStore()
  const roomsStore = useRoomsStore()
  const globalStore = useGlobalStore()
  
  // Get room ID from parameter or route
  const currentRoomId = roomId || (route.params.roomId as string)
  
  // State
  const roomInfo = ref<any | null>(null)
  const isInitialized = ref(false)
  
  // Create sub-controllers
  // Pass connectionState from store to callState controller
  const callState = useCallStateController(
    computed(() => webrtcStore.connectionState as ConnectionState)
  )
  const media = useMediaController()
  const screenShare = useScreenShareController()
  const recording = useRecordingController()

  /**
   * Initialize call - main entry point
   */
  const initializeCall = async (
    roomIdParam?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const targetRoomId = roomIdParam || currentRoomId
    
    if (!targetRoomId) {
      return { success: false, error: 'Room ID is required' }
    }

    try {
      // Start call state
      callState.startCall()
      callState.setConnectingMessage('Finding room...', 'Step 1/4: Locating room')
      callState.setConnectionProgress('Step 1/4: Locating room')

      // Get room info
      const roomResult = await roomsStore.getRoomInfo(targetRoomId)
      if (!roomResult.success) {
        globalStore.addNotification('Room not found or expired', 'error')
        router.push('/')
        return { success: false, error: 'Room not found' }
      }

      roomInfo.value = roomResult.room
      callState.setConnectingMessage('Accessing camera and microphone...', 'Step 2/4: Setting up media devices')
      callState.setConnectionProgress('Step 2/4: Setting up media devices')

      // Initialize media
      const mediaResult = await media.initializeMedia()
      if (!mediaResult.success) {
        globalStore.addNotification('Failed to access camera/microphone', 'error')
        return { success: false, error: mediaResult.error }
      }

      callState.setConnectingMessage('Setting up connection...', 'Preparing for video call')

      // Peer connections are created automatically when connecting WebSocket
      // No need to create manually

      callState.setConnectingMessage('Connecting to room...', 'Almost ready')

      // Connect WebSocket with timeout
      try {
        await webrtcStore.connectWebSocket(targetRoomId)
      } catch (error) {
        console.error('WebSocket connection failed:', error)
        globalStore.addNotification('Failed to connect to room. Please try again.', 'error')
        callState.endCall()
        return { success: false, error: 'WebSocket connection failed' }
      }

      // Update connection state
      callState.updateConnectionState('connected')
      callState.endCall() // This will stop the connecting state but keep duration timer
      callState.startCall() // Restart to begin duration tracking
      
      isInitialized.value = true
      
      return { success: true }
    } catch (error) {
      console.error('Failed to initialize call:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      globalStore.addNotification('Failed to join call', 'error')
      callState.endCall()
      router.push('/')
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Handle end call
   */
  const handleEndCall = async (): Promise<void> => {
    try {
      // Show confirmation if call is active
      if (webrtcStore.isConnected) {
        const confirmed = window.confirm('Are you sure you want to end this call?')
        if (!confirmed) return
      }

      // End call in store
      await webrtcStore.endCall()

      // Leave room
      if (roomInfo.value) {
        await roomsStore.leaveRoom(roomInfo.value.room_id)
      }

      // Stop screen sharing
      if (screenShare.isScreenSharing.value) {
        await screenShare.stopScreenShare()
      }

      // Stop recording if active
      if (recording.isRecording.value) {
        await recording.stopRecording()
      }

      // Stop media
      await media.stopMedia()

      // Reset call state
      callState.endCall()

      // Reset controller
      reset()

      // Navigate away
      router.push('/')
    } catch (error) {
      console.error('Error ending call:', error)
      globalStore.addNotification('Error ending call', 'error')
    }
  }

  /**
   * Refresh connection
   */
  const refreshConnection = async (): Promise<void> => {
    try {
      callState.setConnectingMessage('Refreshing connection...', 'Please wait')
      
      // Disconnect current connection
      await webrtcStore.endCall()
      
      // Reinitialize
      if (roomInfo.value) {
        await initializeCall(roomInfo.value.room_id)
      } else if (currentRoomId) {
        await initializeCall(currentRoomId)
      }
    } catch (error) {
      console.error('Error refreshing connection:', error)
      globalStore.addNotification('Failed to refresh connection', 'error')
    }
  }

  /**
   * Reset all controllers
   */
  const reset = (): void => {
    callState.reset()
    screenShare.reset()
    recording.reset()
    roomInfo.value = null
    isInitialized.value = false
  }

  // Cleanup on unmount
  onUnmounted(() => {
    reset()
  })

  return {
    // Sub-controllers
    callState,
    media,
    screenShare,
    recording,
    
    // State
    roomInfo,
    isInitialized,
    
    // Methods
    initializeCall,
    handleEndCall,
    refreshConnection,
    reset
  }
}

