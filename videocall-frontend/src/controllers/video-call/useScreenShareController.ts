/**
 * Controller for managing screen sharing
 * Handles screen share start/stop, permissions, and error handling
 */
import { ref, computed, type Ref } from 'vue'
import { useWebRTCStore } from '@/stores/webrtc'
import { useGlobalStore } from '@/stores/global'

export interface ScreenShareController {
  // State
  isScreenSharing: Ref<boolean>
  screenShareStream: Ref<MediaStream | null>
  isStarting: Ref<boolean>
  isStopping: Ref<boolean>
  error: Ref<string | null>
  
  // Computed
  canStartScreenShare: Ref<boolean>
  canStopScreenShare: Ref<boolean>
  
  // Methods
  startScreenShare: (options?: MediaStreamConstraints) => Promise<{ success: boolean; error?: string }>
  stopScreenShare: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  handleScreenShareError: (error: Error) => void
  reset: () => void
}

/**
 * Creates a screen share controller
 */
export function useScreenShareController(): ScreenShareController {
  const webrtcStore = useWebRTCStore()
  const globalStore = useGlobalStore()
  
  const isScreenSharing = ref(false)
  const screenShareStream = ref<MediaStream | null>(null)
  const isStarting = ref(false)
  const isStopping = ref(false)
  const error = ref<string | null>(null)

  /**
   * Computed: Can start screen share (not already sharing and not starting)
   */
  const canStartScreenShare = computed(() => {
    return !isScreenSharing.value && !isStarting.value
  })

  /**
   * Computed: Can stop screen share (currently sharing and not stopping)
   */
  const canStopScreenShare = computed(() => {
    return isScreenSharing.value && !isStopping.value
  })

  /**
   * Start screen sharing
   */
  const startScreenShare = async (
    options?: MediaStreamConstraints
  ): Promise<{ success: boolean; error?: string }> => {
    if (isScreenSharing.value || isStarting.value) {
      return { success: false, error: 'Screen share already in progress' }
    }

    try {
      isStarting.value = true
      error.value = null

      // Default constraints for screen sharing
      const constraints: MediaStreamConstraints = {
        video: {
          displaySurface: 'monitor',
          cursor: 'always',
          ...(typeof options?.video === 'object' ? options.video : {})
        } as MediaTrackConstraints,
        audio: options?.audio ?? false
      }

      // Request screen share
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints)
      
      screenShareStream.value = stream
      isScreenSharing.value = true
      
      // Handle track ended (user stops sharing from browser UI)
      stream.getVideoTracks().forEach(track => {
        track.onended = () => {
          stopScreenShare()
        }
      })

      // Add audio track if available
      if (stream.getAudioTracks().length > 0) {
        // Handle audio track ended
        stream.getAudioTracks().forEach(track => {
          track.onended = () => {
            // If video track is still active, continue sharing
            if (stream.getVideoTracks().some(t => t.readyState === 'live')) {
              return
            }
            stopScreenShare()
          }
        })
      }

      // Notify store if needed (for peer connections)
      // This would typically be handled by the WebRTC store
      // to add the screen share track to peer connections

      globalStore.addNotification('Screen sharing started', 'success', 3000)
      
      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = errorMessage
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          globalStore.addNotification(
            'Screen sharing permission denied',
            'error',
            5000
          )
        } else if (err.name === 'NotFoundError') {
          globalStore.addNotification(
            'No screen or window available for sharing',
            'error',
            5000
          )
        } else {
          globalStore.addNotification(
            `Failed to start screen sharing: ${errorMessage}`,
            'error',
            5000
          )
        }
      }
      
      return { success: false, error: errorMessage }
    } finally {
      isStarting.value = false
    }
  }

  /**
   * Stop screen sharing
   */
  const stopScreenShare = async (): Promise<void> => {
    if (!isScreenSharing.value || isStopping.value) {
      return
    }

    try {
      isStopping.value = true

      // Stop all tracks
      if (screenShareStream.value) {
        screenShareStream.value.getTracks().forEach(track => {
          track.stop()
        })
        screenShareStream.value = null
      }

      isScreenSharing.value = false
      error.value = null

      // Notify store if needed (to remove screen share track from peer connections)
      // This would typically be handled by the WebRTC store

      globalStore.addNotification('Screen sharing stopped', 'info', 2000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to stop screen sharing:', err)
      globalStore.addNotification(
        `Failed to stop screen sharing: ${errorMessage}`,
        'error',
        3000
      )
    } finally {
      isStopping.value = false
    }
  }

  /**
   * Toggle screen sharing (start if stopped, stop if started)
   */
  const toggleScreenShare = async (): Promise<void> => {
    if (isScreenSharing.value) {
      await stopScreenShare()
    } else {
      await startScreenShare()
    }
  }

  /**
   * Handle screen share errors
   */
  const handleScreenShareError = (err: Error): void => {
    error.value = err.message
    
    if (err.name === 'NotAllowedError') {
      globalStore.addNotification(
        'Screen sharing permission denied. Please allow screen sharing in your browser settings.',
        'error',
        5000
      )
    } else if (err.name === 'NotFoundError') {
      globalStore.addNotification(
        'No screen or window available for sharing',
        'error',
        5000
      )
    } else {
      globalStore.addNotification(
        `Screen sharing error: ${err.message}`,
        'error',
        5000
      )
    }
  }

  /**
   * Reset controller state
   */
  const reset = (): void => {
    if (screenShareStream.value) {
      screenShareStream.value.getTracks().forEach(track => {
        track.stop()
      })
    }
    
    isScreenSharing.value = false
    screenShareStream.value = null
    isStarting.value = false
    isStopping.value = false
    error.value = null
  }

  return {
    // State
    isScreenSharing,
    screenShareStream,
    isStarting,
    isStopping,
    error,
    
    // Computed
    canStartScreenShare,
    canStopScreenShare,
    
    // Methods
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    handleScreenShareError,
    reset
  }
}

