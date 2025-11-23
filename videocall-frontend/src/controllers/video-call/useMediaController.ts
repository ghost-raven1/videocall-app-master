/**
 * Controller for managing media streams (video/audio)
 * Handles local media initialization, toggling, and device management
 */
import { ref, computed, type Ref } from 'vue'
import { useWebRTCStore } from '@/stores/webrtc'
import { useGlobalStore } from '@/stores/global'

export interface MediaController {
  // State (read-only from store)
  localStream: Ref<MediaStream | null>
  isVideoEnabled: Ref<boolean>
  isAudioEnabled: Ref<boolean>
  hasLocalVideo: Ref<boolean>
  hasLocalAudio: Ref<boolean>
  
  // Computed
  canToggleVideo: Ref<boolean>
  canToggleAudio: Ref<boolean>
  
  // Methods
  initializeMedia: (constraints?: MediaStreamConstraints) => Promise<{ success: boolean; error?: string }>
  toggleVideo: () => Promise<void>
  toggleAudio: () => Promise<void>
  stopMedia: () => Promise<void>
  replaceVideoTrack: (newTrack: MediaStreamTrack) => Promise<void>
  replaceAudioTrack: (newTrack: MediaStreamTrack) => Promise<void>
  updateMediaConstraints: (constraints: MediaStreamConstraints) => Promise<void>
}

/**
 * Creates a media controller
 * Uses WebRTC store for actual media management
 */
export function useMediaController(): MediaController {
  const webrtcStore = useWebRTCStore()
  const globalStore = useGlobalStore()
  
  const isInitializing = ref(false)

  /**
   * Computed: Can toggle video (has local stream)
   */
  const canToggleVideo = computed(() => {
    return webrtcStore.localStream !== null
  })

  /**
   * Computed: Can toggle audio (has local stream)
   */
  const canToggleAudio = computed(() => {
    return webrtcStore.localStream !== null
  })

  /**
   * Initialize local media (camera and microphone)
   */
  const initializeMedia = async (
    constraints?: MediaStreamConstraints
  ): Promise<{ success: boolean; error?: string }> => {
    if (isInitializing.value) {
      return { success: false, error: 'Media initialization already in progress' }
    }

    try {
      isInitializing.value = true
      
      // Use store's initializeLocalMedia method
      const result = await webrtcStore.initializeLocalMedia()
      
      if (!result.success) {
        globalStore.addNotification(
          result.error || 'Failed to access camera/microphone',
          'error',
          5000
        )
        return result
      }

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to initialize media:', error)
      globalStore.addNotification(
        `Failed to access media devices: ${errorMessage}`,
        'error',
        5000
      )
      return { success: false, error: errorMessage }
    } finally {
      isInitializing.value = false
    }
  }

  /**
   * Toggle video on/off
   */
  const toggleVideo = async (): Promise<void> => {
    try {
      await webrtcStore.toggleVideo()
      
      const message = webrtcStore.isVideoEnabled
        ? 'Camera enabled'
        : 'Camera disabled'
      globalStore.addNotification(message, 'info', 2000)
    } catch (error) {
      console.error('Failed to toggle video:', error)
      globalStore.addNotification('Failed to toggle camera', 'error', 3000)
    }
  }

  /**
   * Toggle audio on/off
   */
  const toggleAudio = async (): Promise<void> => {
    try {
      await webrtcStore.toggleAudio()
      
      const message = webrtcStore.isAudioEnabled
        ? 'Microphone enabled'
        : 'Microphone disabled'
      globalStore.addNotification(message, 'info', 2000)
    } catch (error) {
      console.error('Failed to toggle audio:', error)
      globalStore.addNotification('Failed to toggle microphone', 'error', 3000)
    }
  }

  /**
   * Stop all media tracks
   */
  const stopMedia = async (): Promise<void> => {
    try {
      if (webrtcStore.localStream) {
        webrtcStore.localStream.getTracks().forEach(track => {
          track.stop()
        })
      }
      
      // Use store's method to cleanup
      await webrtcStore.endCall()
    } catch (error) {
      console.error('Failed to stop media:', error)
      globalStore.addNotification('Failed to stop media', 'error', 3000)
    }
  }

  /**
   * Replace video track in local stream
   */
  const replaceVideoTrack = async (newTrack: MediaStreamTrack): Promise<void> => {
    try {
      if (!webrtcStore.localStream) {
        throw new Error('No local stream available')
      }

      // Get current video track
      const currentVideoTrack = webrtcStore.localStream.getVideoTracks()[0]
      
      if (currentVideoTrack) {
        // Replace track in stream
        webrtcStore.localStream.removeTrack(currentVideoTrack)
        currentVideoTrack.stop()
      }
      
      // Add new track
      webrtcStore.localStream.addTrack(newTrack)
      
      // Update peer connections if needed
      // This would be handled by the store's peer connection management
    } catch (error) {
      console.error('Failed to replace video track:', error)
      globalStore.addNotification('Failed to switch camera', 'error', 3000)
      throw error
    }
  }

  /**
   * Replace audio track in local stream
   */
  const replaceAudioTrack = async (newTrack: MediaStreamTrack): Promise<void> => {
    try {
      if (!webrtcStore.localStream) {
        throw new Error('No local stream available')
      }

      // Get current audio track
      const currentAudioTrack = webrtcStore.localStream.getAudioTracks()[0]
      
      if (currentAudioTrack) {
        // Replace track in stream
        webrtcStore.localStream.removeTrack(currentAudioTrack)
        currentAudioTrack.stop()
      }
      
      // Add new track
      webrtcStore.localStream.addTrack(newTrack)
    } catch (error) {
      console.error('Failed to replace audio track:', error)
      globalStore.addNotification('Failed to switch microphone', 'error', 3000)
      throw error
    }
  }

  /**
   * Update media constraints and reinitialize
   */
  const updateMediaConstraints = async (
    constraints: Partial<MediaStreamConstraints>
  ): Promise<void> => {
    try {
      // Update constraints in store (merge with existing)
      const currentConstraints = webrtcStore.mediaConstraints
      
      if (constraints.video !== undefined) {
        webrtcStore.mediaConstraints = {
          ...currentConstraints,
          video: constraints.video
        } as any // Type assertion needed due to store's specific constraint type
      }
      if (constraints.audio !== undefined) {
        webrtcStore.mediaConstraints = {
          ...currentConstraints,
          audio: constraints.audio
        } as any // Type assertion needed due to store's specific constraint type
      }
      
      // Reinitialize media
      await initializeMedia()
    } catch (error) {
      console.error('Failed to update media constraints:', error)
      globalStore.addNotification('Failed to update media settings', 'error', 3000)
    }
  }

  return {
    // State (from store)
    localStream: computed(() => webrtcStore.localStream),
    isVideoEnabled: computed(() => webrtcStore.isVideoEnabled),
    isAudioEnabled: computed(() => webrtcStore.isAudioEnabled),
    hasLocalVideo: computed(() => webrtcStore.hasLocalVideo),
    hasLocalAudio: computed(() => {
      return webrtcStore.localStream?.getAudioTracks().some(track => track.enabled) ?? false
    }),
    
    // Computed
    canToggleVideo,
    canToggleAudio,
    
    // Methods
    initializeMedia,
    toggleVideo,
    toggleAudio,
    stopMedia,
    replaceVideoTrack,
    replaceAudioTrack,
    updateMediaConstraints
  }
}

