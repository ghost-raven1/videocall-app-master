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
    computed(() => (webrtcStore as any).connectionState as ConnectionState)
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
      
      // Set current room in roomsStore for SFU mode switching
      if (!roomsStore.currentRoom || roomsStore.currentRoom.room_id !== targetRoomId) {
        roomsStore.currentRoom = {
          room_id: roomResult.room.room_id,
          short_code: roomResult.room.short_code,
          participant_count: roomResult.room.participant_count || 0,
          participant_id: null, // Will be set when participant joins
          joined_at: new Date().toISOString(),
        }
      }

      // Auto-join the room (important for direct link navigation)
      try {
        const joinIdentifier = roomResult.room.short_code || targetRoomId
        const joinRes = await roomsStore.joinRoom(joinIdentifier)
        if (!joinRes.success) {
          const errMsg = joinRes.error || 'Failed to join room'
          globalStore.addNotification(errMsg, 'error')
          callState.endCall()
          router.push('/')
          return { success: false, error: errMsg }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Failed to join room'
        globalStore.addNotification(errMsg, 'error')
        callState.endCall()
        router.push('/')
        return { success: false, error: errMsg }
      }
      
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
        await (webrtcStore as any).connectWebSocket(targetRoomId)
      } catch (error) {
        console.error('WebSocket connection failed:', error)
        globalStore.addNotification('Failed to connect to room. Please try again.', 'error')
        callState.endCall()
        return { success: false, error: 'WebSocket connection failed' }
      }

      // Immediately try to create SFU room and switch to SFU mode
      callState.setConnectingMessage('Setting up SFU connection...', 'Initializing SFU')
      try {
        console.log('Creating SFU room immediately for all calls, roomId:', targetRoomId)
        // room_id is passed in URL path, not in body
        const sfuResponse = await fetch(`/api/rooms/${targetRoomId}/sfu/create/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        })
        
        // Check if SFU room creation was successful
        // Status 201 = SFU created successfully
        // Status 200 = P2P fallback (SFU unavailable, but OK to use P2P)
        if (sfuResponse.ok) {
          const contentType = sfuResponse.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const sfuData = await sfuResponse.json()
            console.log('SFU room creation response:', sfuData, 'status:', sfuResponse.status)
            
            // Only switch to SFU if status is 201 (SFU created) and mode is 'sfu'
            // Status 200 means P2P fallback, which is fine - we'll use P2P mode
            if (sfuResponse.status === 201 && sfuData.success && sfuData.mode === 'sfu' && sfuData.sfu_ws_url) {
              // Refresh room info to get SFU details
              const updatedRoomResult = await roomsStore.getRoomInfo(targetRoomId)
              if (updatedRoomResult.success) {
                roomInfo.value = updatedRoomResult.room
                
                // Double-check if SFU is actually enabled in room info
                if (roomInfo.value.sfu_enabled && roomInfo.value.sfu_ws_url) {
                  // Switch to SFU mode immediately
                  const sfuResult = await (webrtcStore as any).switchToSFUMode(roomInfo.value)
                  if (sfuResult.success) {
                    console.log('Successfully switched to SFU mode')
                  } else {
                    console.warn('Failed to switch to SFU mode, using P2P fallback:', sfuResult.error)
                  }
                } else {
                  console.warn('SFU room created but not enabled in room info, using P2P fallback')
                }
              }
            } else {
              console.warn('SFU room creation returned fallback to P2P mode:', sfuData)
            }
          } else {
            const text = await sfuResponse.text()
            console.warn('SFU response is not JSON, got:', text.substring(0, 200))
          }
        } else {
          // Try to parse error response
          const contentType = sfuResponse.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const errorData = await sfuResponse.json()
            console.warn('Failed to create SFU room, using P2P fallback:', errorData)
          } else {
            const text = await sfuResponse.text()
            console.warn(`Failed to create SFU room (${sfuResponse.status}), using P2P fallback. Response:`, text.substring(0, 200))
          }
        }
      } catch (error) {
        console.warn('SFU setup failed, using P2P fallback:', error)
        // Don't block call initialization if SFU fails
      }

      // Update connection state to connected - this will hide the connecting overlay
      // updateConnectionState('connected') automatically sets isConnecting = false
      callState.updateConnectionState('connected')
      
      // startCall() was already called at the beginning of initializeCall()
      // so duration timer should already be running
      // No need to call endCall() or startCall() again
      
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
      if ((webrtcStore as any).isConnected) {
        const confirmed = window.confirm('Are you sure you want to end this call?')
        if (!confirmed) return
      }

      // End call in store
      await (webrtcStore as any).endCall()

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
      await (webrtcStore as any).endCall()
      
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
