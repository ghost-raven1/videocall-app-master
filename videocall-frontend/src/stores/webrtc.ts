// src/stores/webrtc.js - WebRTC and media state management
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGlobalStore } from './global'
import { webrtcRetryService } from '../services/webrtc-retry'
import { errorReportingService } from '../services/error-reporting'
import { SFUConnectionManager } from './webrtc-sfu'
import { P2PConnectionManager } from './webrtc-p2p'
import { ConnectionQualityMonitor } from './webrtc-quality'

/**
 * @typedef {('user_joined'|'user_left'|'webrtc_offer'|'webrtc_answer'|'ice_candidate'|'media_state_update'|'pong'|'error')} WebSocketMessageType
 */

/**
 * Базовая структура сообщения из WebSocket сигнального сервера.
 * @typedef {Object} BaseWsMessage
 * @property {WebSocketMessageType} type
 * @property {string} [room_id]
 * @property {string} [participant_id]
 * @property {string} [participant_name]
 * @property {string} [sender]
 * @property {string} [target]
 * @property {number|string} [timestamp]
 * @property {any} [data]
 * @property {string} [message]
 * @property {any} [offer]
 * @property {any} [answer]
 * @property {{ candidate: string, sdpMid?: string, sdpMLineIndex?: number }} [candidate]
 */

/**
 * @param {string} roomId
 * @returns {string}
 */
interface WindowWithWS extends Window {
  __WS_BASE_URL?: string
  __WS_HOST?: string
}

function buildWebSocketUrl(roomId: string): string {
  // Prefer process.env (tests) and fall back to window overrides or location
  const windowWithWS = window as WindowWithWS
  const envBase = (typeof process !== 'undefined' && process.env && process.env.VITE_WS_BASE_URL) || windowWithWS.__WS_BASE_URL
  if (typeof envBase === 'string' && envBase.trim() !== '') {
    const base = envBase.replace(/\/$/, '')
    return `${base}/ws/room/${roomId}/`
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const hostEnv = (typeof process !== 'undefined' && process.env && process.env.VITE_WS_HOST) || windowWithWS.__WS_HOST
  const wsHost = hostEnv || window.location.host
  return `${protocol}//${wsHost}/ws/room/${roomId}/`
}

import type { BaseWsMessage, WebSocketMessageType, RecoveryInfo } from '../types/websocket'

/**
 * Type guard for WebSocket messages
 */
function isValidWsMessage(data: unknown): data is BaseWsMessage {
  if (!data || typeof data !== 'object') return false
  if (!('type' in data) || typeof (data as { type: unknown }).type !== 'string') return false
  const known: Set<WebSocketMessageType> = new Set([
    'user_joined',
    'user_left',
    'webrtc_offer',
    'webrtc_answer',
    'ice_candidate',
    'media_state_update',
    'pong',
    'error',
    'chat_message',
    'chat_message_edited',
    'chat_message_deleted',
    'file_uploaded',
    'screen_share_started',
    'screen_share_stopped',
    'ping',
    'sfu_enabled',
    'participant_list_request',
    'room_info_request',
  ])
  return known.has((data as { type: string }).type as WebSocketMessageType)
}

export const useWebRTCStore = defineStore('webrtc', () => {
  const globalStore = useGlobalStore()

  // State
  const localStream = ref(null)
  const remoteStreams = ref(new Map()) // Map<participantId, MediaStream>
  const remoteScreenShareStreams = ref(new Map()) // Map<participantId, MediaStream> - для screen share от других участников
  const localScreenShareStream = ref<MediaStream | null>(null) // Local screen share stream to add to new peer connections
  const peerConnections = ref(new Map()) // Map<participantId, RTCPeerConnection>
  const websocket = ref(null)
  const isConnected = ref(false)
  const isVideoEnabled = ref(true)
  const isAudioEnabled = ref(true)
  const connectionState = ref('new') // new, connecting, connected, disconnected, failed
  const remoteParticipants = ref([])
  const localParticipantId = ref(null)
  const sfuMode = ref(false) // true when using SFU for 3+ users
  const sfuWebSocket = ref(null) // SFU WebSocket connection
  const sfuPeerConnection = ref(null) // WebRTC connection to SFU server
  const sfuRoomId = ref(null) // SFU room ID
  const isSwitchingToSFU = ref(false) // Flag to prevent multiple simultaneous SFU switch attempts

  // Retry and recovery state
  const retryOperations = ref(new Map()) // Map<operationId, retryInfo>
  const connectionMonitors = ref(new Map()) // Map<participantId, monitorId>
  const qualityMonitors = ref(new Map()) // Map<participantId, monitorId>
  const fallbackLevels = ref(new Map()) // Map<participantId, fallbackLevel>
  const connectionRecoveryInProgress = ref(false)
  const lastConnectionAttempt = ref(null)
  const connectionAttemptCount = ref(0)

  // Media constraints
  const mediaConstraints = ref({
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })

  // Computed
  const hasLocalVideo = computed(() => {
    if (!localStream.value) return false
    const videoTracks = localStream.value.getVideoTracks()
    return videoTracks.length > 0 && videoTracks[0].enabled && isVideoEnabled.value
  })
  const hasRemoteVideo = computed(() => remoteStreams.value.size > 0)
  const hasAnyRemoteStream = computed(() => remoteStreams.value.size > 0)
  const remoteStream = computed(() => {
    // For backward compatibility, return the first remote stream if exists
    return remoteStreams.value.size > 0 ? remoteStreams.value.values().next().value : null
  })
  const isCallActive = computed(
    () => isConnected.value && (hasLocalVideo.value || hasRemoteVideo.value),
  )
  const participantCount = computed(() => remoteParticipants.value.length + 1)
  const isMultiUserCall = computed(() => participantCount.value > 2)

  // WebRTC configuration with STUN/TURN servers
  // Can be configured via environment variables
  const getIceServers = () => {
    const iceServers = []
    
    // Get STUN servers from env or use defaults
    const stunServers = (import.meta.env.VITE_STUN_SERVERS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302').split(',')
    stunServers.forEach(url => {
      if (url.trim()) {
        iceServers.push({ urls: url.trim() })
      }
    })
    
    // Get TURN servers from env (format: urls:username:credential,urls:username:credential)
    const turnServers = import.meta.env.VITE_TURN_SERVERS
    if (turnServers) {
      turnServers.split(',').forEach(turnConfig => {
        const parts = turnConfig.trim().split(':')
        if (parts.length >= 3) {
          const urls = parts[0]
          const username = parts[1]
          const credential = parts.slice(2).join(':') // Handle credentials with colons
          iceServers.push({
            urls,
            username,
            credential
          })
        } else if (parts.length === 1) {
          // Just URL without credentials
          iceServers.push({ urls: parts[0] })
        }
      })
    }
    
    return iceServers.length > 0 ? iceServers : [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  }

  const rtcConfiguration = {
    iceServers: getIceServers(),
    iceCandidatePoolSize: 10,
  }

  // Initialize connection managers
  const sfuManager = new SFUConnectionManager(
    sfuWebSocket,
    sfuPeerConnection,
    sfuRoomId,
    localStream,
    localParticipantId,
    remoteStreams,
    remoteParticipants,
    rtcConfiguration
  )

  const p2pManager = new P2PConnectionManager(
    peerConnections,
    localStream,
    remoteStreams,
    remoteParticipants,
    websocket,
    localParticipantId,
    rtcConfiguration
  )

  const qualityMonitor = new ConnectionQualityMonitor(
    connectionMonitors,
    qualityMonitors,
    fallbackLevels,
    remoteParticipants
  )

  // Actions
  const initializeLocalMedia = async () => {
    try {
      globalStore.setLoading(true, 'Accessing camera and microphone...')

      localStream.value = await navigator.mediaDevices.getUserMedia(mediaConstraints.value)

      // Set initial media states based on stream tracks
      const videoTrack = localStream.value.getVideoTracks()[0]
      const audioTrack = localStream.value.getAudioTracks()[0]

      if (videoTrack) {
        isVideoEnabled.value = videoTrack.enabled
      }
      if (audioTrack) {
        isAudioEnabled.value = audioTrack.enabled
      }

      return { success: true }
    } catch (error) {
      let errorMessage = 'Failed to access camera or microphone'

      if (error.name === 'NotAllowedError') {
        errorMessage =
          'Camera and microphone access denied. Please allow permissions and try again.'
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found on this device.'
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera or microphone is already in use by another application.'
      }

      globalStore.addNotification(errorMessage, 'error', 8000)
      return { success: false, error: errorMessage }
    } finally {
      globalStore.setLoading(false)
    }
  }

  // Метод для создания основного peer connection
  const createPeerConnection = () => {
    try {
      // Создаем новое соединение с использованием конфигурации
      const peerConnection = new RTCPeerConnection(rtcConfiguration)
      
      // Добавляем локальные треки в соединение
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream.value)
        })
      }
      
      return { success: true, peerConnection }
    } catch (error) {
      console.error('Failed to create peer connection:', error)
      globalStore.addNotification('Failed to create connection', 'error', 5000)
      const errorObj = error instanceof Error ? error : new Error(String(error))
      return { success: false, error: errorObj.message }
    }
  }

  const createPeerConnectionForParticipant = async (participantId) => {
    const operationId = `create_peer_${participantId}_${Date.now()}`

    try {
      // Use retry service for peer connection creation
      const result = await webrtcRetryService.executeWithRetry(
        operationId,
        async () => {
          // Use P2P manager to create peer connection
          return await p2pManager.createPeerConnectionForParticipant(participantId)
        },
        {
          maxRetries: 3,
          baseDelay: 1000,
          shouldRetry: (error) => {
            // Don't retry on configuration errors
            const errorObj = error instanceof Error ? error : new Error(String(error))
            return !errorObj.message?.includes('InvalidAccessError')
          }
        }
      )

      const peerConnection = result

      // Handle remote stream for this participant
      peerConnection.ontrack = (event) => {
        console.log(`Received remote track from participant ${participantId}:`, event)
        
        // Check if this is a screen share track
        const track = event.track
        const isScreenShare = track && (
          track.kind === 'video' && (
            track.label?.toLowerCase().includes('screen') ||
            track.label?.toLowerCase().includes('display') ||
            track.label?.toLowerCase().includes('window') ||
            track.getSettings?.()?.displaySurface
          )
        )
        
        if (isScreenShare) {
          // This is a screen share track - store separately
          console.log(`Received screen share track from participant ${participantId}`)
          
          // Create or update screen share stream for this participant
          let screenShareStream = remoteScreenShareStreams.value.get(participantId)
          if (!screenShareStream) {
            screenShareStream = new MediaStream()
            remoteScreenShareStreams.value.set(participantId, screenShareStream)
          }
          
          // Add the track to the screen share stream
          screenShareStream.addTrack(track)
          
          // Update participant screen sharing state
          const participant = remoteParticipants.value.find(p => p.id === participantId)
          if (participant) {
            participant.isScreenSharing = true
            participant.screenShareStream = screenShareStream
          }
          
          // Listen for track ended
          track.onended = () => {
            console.log(`Screen share track ended for participant ${participantId}`)
            screenShareStream.removeTrack(track)
            if (screenShareStream.getTracks().length === 0) {
              remoteScreenShareStreams.value.delete(participantId)
            }
            
            const participant = remoteParticipants.value.find(p => p.id === participantId)
            if (participant) {
              participant.isScreenSharing = false
              participant.screenShareStream = null
            }
          }
        } else {
          // Regular video/audio track - store in remoteStreams
          const stream = event.streams[0]
          if (stream) {
            remoteStreams.value.set(participantId, stream)

        // Update participant stream reference
        const participant = remoteParticipants.value.find(p => p.id === participantId)
        if (participant) {
              participant.stream = stream
            }
          }
        }
      }

      // Handle ICE candidates with retry
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate && websocket.value) {
          const iceOperationId = `ice_candidate_${participantId}_${Date.now()}`

          try {
            await webrtcRetryService.executeWithRetry(
              iceOperationId,
              async () => {
                sendWebSocketMessage({
                  type: 'ice_candidate',
                  candidate: event.candidate,
                  target: participantId,
                })
              },
              { maxRetries: 2, baseDelay: 500 }
            )
          } catch (error) {
            console.error(`Failed to send ICE candidate for ${participantId}:`, error)
          }
        }
      }

      // Enhanced connection state monitoring with recovery
      peerConnection.onconnectionstatechange = async () => {
        const participant = remoteParticipants.value.find(p => p.id === participantId)
        if (participant) {
          participant.connectionState = peerConnection.connectionState
        }

        console.log(`Connection state for ${participantId}:`, peerConnection.connectionState)

        if (peerConnection.connectionState === 'connected') {
          globalStore.addNotification(`Connected to participant`, 'success', 2000)
          // Reset fallback level on successful connection
          fallbackLevels.value.delete(participantId)
        } else if (peerConnection.connectionState === 'disconnected') {
          const userFriendlyMessage = webrtcRetryService.getErrorMessage(
            new Error('Connection disconnected'),
            `Participant ${participantId}`
          )
          globalStore.addNotification(userFriendlyMessage, 'warning', 4000)
        } else if (peerConnection.connectionState === 'failed') {
          const errorMessage = webrtcRetryService.getErrorMessage(
            new Error('Connection failed'),
            `Participant ${participantId}`
          )
          globalStore.addNotification(errorMessage, 'error', 5000)

          // Attempt recovery
          await handleConnectionRecovery(participantId, peerConnection)
        }

        // Update overall connection state
        updateOverallConnectionState()
      }

      // Setup enhanced monitoring with retry service
      const monitorId = webrtcRetryService.monitorConnectionState(
        peerConnection,
        participantId,
        (recoveryParticipantId, recoveryInfo) => handleConnectionRecovery(recoveryParticipantId, peerConnection, recoveryInfo),
        (quality, state) => handleConnectionQualityChange(participantId, quality, state)
      )
      connectionMonitors.value.set(participantId, monitorId)

      return { success: true, peerConnection }
    } catch (error) {
      console.error(`Failed to create peer connection for participant ${participantId}:`, error)
      const userFriendlyMessage = webrtcRetryService.getErrorMessage(error, `Participant ${participantId}`)
      globalStore.addNotification(userFriendlyMessage, 'error', 6000)
      const errorObj = error instanceof Error ? error : new Error(String(error))
      return { success: false, error: errorObj.message }
    }
  }

  const updateOverallConnectionState = () => {
    const connections = Array.from(peerConnections.value.values())
    if (connections.length === 0) {
      connectionState.value = 'new'
      isConnected.value = false
      return
    }

    const states = connections.map(pc => pc.connectionState)
    if (states.every(state => state === 'connected')) {
      connectionState.value = 'connected'
      isConnected.value = true
    } else if (states.some(state => state === 'connecting' || state === 'new')) {
      connectionState.value = 'connecting'
      isConnected.value = false
    } else if (states.some(state => state === 'failed')) {
      connectionState.value = 'failed'
      isConnected.value = false
    } else {
      connectionState.value = 'disconnected'
      isConnected.value = false
    }
  }

  const handleConnectionRecovery = async (participantId: string, peerConnection: RTCPeerConnection, recoveryInfo?: RecoveryInfo) => {
    if (connectionRecoveryInProgress.value) {
      return // Already handling recovery
    }

    connectionRecoveryInProgress.value = true

    try {
      console.log(`Handling connection recovery for ${participantId}:`, recoveryInfo)

      if (recoveryInfo.canRecover === false) {
        globalStore.addNotification(
          'Connection cannot be restored. Please refresh the page or check your internet connection.',
          'error',
          10000
        )
        return
      }

      // Update participant state
      const participant = remoteParticipants.value.find(p => p.id === participantId)
      if (participant) {
        participant.connectionState = 'connecting'
        participant.isRecovering = true
      }

      // Attempt recovery based on type
      if (recoveryInfo.requiresReconnection) {
        await attemptReconnection(participantId)
      } else {
        globalStore.addNotification('Attempting to restore connection...', 'info', 3000)
      }

    } catch (error) {
      console.error(`Recovery failed for ${participantId}:`, error)
      const errorMessage = webrtcRetryService.getErrorMessage(error, 'Recovery')
      globalStore.addNotification(errorMessage, 'error', 5000)
    } finally {
      connectionRecoveryInProgress.value = false

      // Clear recovery flag
      const participant = remoteParticipants.value.find(p => p.id === participantId)
      if (participant) {
        participant.isRecovering = false
      }
    }
  }

  const handleConnectionQualityChange = (participantId, quality, state) => {
    const participant = remoteParticipants.value.find(p => p.id === participantId)
    if (participant) {
      participant.connectionQuality = quality.score

      // Update fallback level based on quality
      if (quality.score < 40 && !fallbackLevels.value.has(participantId)) {
        fallbackLevels.value.set(participantId, 0)
      }
    }

    // Show quality warnings for poor connections
    if (quality.score < 30 && state !== 'failed') {
      const qualityMessage = `Connection quality is poor (${quality.score}%). Attempting to improve...`
      globalStore.addNotification(qualityMessage, 'warning', 4000)
    }
  }

  const attemptReconnection = async (participantId) => {
    const operationId = `reconnect_${participantId}_${Date.now()}`

    try {
      globalStore.addNotification('Reconnecting to participant...', 'info', 3000)

      await webrtcRetryService.executeWithRetry(
        operationId,
        async () => {
          // Close existing connection
          const existingConnection = peerConnections.value.get(participantId)
          if (existingConnection) {
            existingConnection.close()
            peerConnections.value.delete(participantId)
          }

          // Clean up remote stream
          if (remoteStreams.value.has(participantId)) {
            const stream = remoteStreams.value.get(participantId)
            if (stream) {
              stream.getTracks().forEach(track => track.stop())
            }
            remoteStreams.value.delete(participantId)
          }

          // Create new connection
          await createPeerConnectionForParticipant(participantId)

          // Re-initiate offer
          await createOfferForParticipant(participantId)
        },
        {
          maxRetries: 3,
          baseDelay: 2000,
          shouldRetry: (error) => {
            const errorObj = error instanceof Error ? error : new Error(String(error))
            return !errorObj.message?.includes('NotAllowedError')
          }
        }
      )

      globalStore.addNotification('Reconnected successfully', 'success', 3000)
    } catch (error) {
      console.error(`Reconnection failed for ${participantId}:`, error)
      const errorMessage = webrtcRetryService.getErrorMessage(error, 'Reconnection')
      globalStore.addNotification(errorMessage, 'error', 6000)
    }
  }

  const switchToSFUMode = async (roomInfo = null) => {
    // Prevent multiple simultaneous SFU switch attempts
    if (sfuMode.value) {
      console.log('Already in SFU mode, skipping switch', {
        hasWebSocket: !!sfuWebSocket.value,
        wsState: sfuWebSocket.value?.readyState,
        hasPeerConnection: !!sfuPeerConnection.value,
        pcState: sfuPeerConnection.value?.connectionState
      })
      return { success: true, alreadyInSFUMode: true }
    }
    
    // Prevent concurrent switch attempts
    if (isSwitchingToSFU.value) {
      console.log('SFU switch already in progress, skipping duplicate request', {
        stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
      })
      return { success: false, error: 'SFU switch already in progress' }
    }
    
    // Check if SFU WebSocket is already connected
    if (sfuWebSocket.value && sfuWebSocket.value.readyState === WebSocket.OPEN) {
      console.log('SFU WebSocket already connected, skipping switch')
      sfuMode.value = true
      return { success: true, alreadyConnected: true }
    }
    
    isSwitchingToSFU.value = true

    // If roomInfo not provided, try to get it from current room
    if (!roomInfo) {
      try {
        // Try to get room info from rooms store or API
        const { useRoomsStore } = await import('./rooms')
        const roomsStore = useRoomsStore()
        if (roomsStore.currentRoomId) {
          const roomResult = await roomsStore.getRoomInfo(roomsStore.currentRoomId)
          if (roomResult.success) {
            roomInfo = roomResult.room
          }
        }
      } catch (error) {
        console.warn('Failed to get room info for SFU:', error)
      }
    }

    if (!roomInfo) {
      console.warn('SFU mode requested but room info is null')
      globalStore.addNotification('SFU mode not available, using P2P', 'warning', 5000)
      return { success: false, error: 'SFU not available - no room info' }
    }
    
    console.log('Checking SFU availability:', {
      hasRoomInfo: !!roomInfo,
      sfu_enabled: roomInfo.sfu_enabled,
      sfu_ws_url: roomInfo.sfu_ws_url,
      sfu_room_id: roomInfo.sfu_room_id,
      alreadyInSFUMode: sfuMode.value,
      isSwitching: isSwitchingToSFU.value,
      stackTrace: new Error().stack?.split('\n').slice(1, 5).join('\n')
    })
    
    if (!roomInfo.sfu_ws_url || !roomInfo.sfu_enabled) {
      console.warn('SFU mode requested but SFU not enabled or missing URL:', {
        sfu_enabled: roomInfo.sfu_enabled,
        sfu_ws_url: roomInfo.sfu_ws_url,
        roomInfo
      })
      globalStore.addNotification('SFU mode not available, using P2P', 'warning', 5000)
      return { success: false, error: 'SFU not available - not enabled or missing URL' }
    }

    // Check SFU server health before switching
    const healthCheck = await sfuManager.checkSFUHealth(roomInfo)
    if (!healthCheck) {
      return { success: false, error: 'SFU server unavailable' }
    }

    try {
      sfuMode.value = true
      console.log('Switching to SFU mode for multi-user call')
      globalStore.addNotification('Switching to SFU mode...', 'info', 3000)

      // Store SFU room ID
      sfuRoomId.value = roomInfo.sfu_room_id || roomInfo.room_id

      // Close existing P2P connections
      p2pManager.closeAllConnections()

      // Connect to SFU WebSocket and create peer connection
      const sfuWsUrl = roomInfo.sfu_ws_url
      const peerId = localParticipantId.value || `peer_${Date.now()}`
      
      await sfuManager.connectToSFUWebSocket(sfuWsUrl, sfuRoomId.value, peerId)
      
      // Ensure WebSocket is fully connected before proceeding
      if (!sfuWebSocket.value || sfuWebSocket.value.readyState !== WebSocket.OPEN) {
        throw new Error('SFU WebSocket connection failed or not ready')
      }
      
      // Set up message handler
      if (sfuWebSocket.value) {
        sfuWebSocket.value.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data)
            await sfuManager.handleSFUWebSocketMessage(data)
          } catch (error) {
            console.error('Failed to handle SFU WebSocket message:', error)
          }
        }
        
        sfuWebSocket.value.onclose = (event) => {
          // Only reconnect if not a normal closure (1000) and we're still in SFU mode
          // Don't reconnect if we're already switching (code 1000 = normal closure)
          if (event.code !== 1000 && sfuMode.value && !isSwitchingToSFU.value) {
            console.warn('SFU WebSocket closed unexpectedly, attempting reconnection...', event.code, event.reason)
            globalStore.addNotification('SFU connection lost, attempting reconnection...', 'warning', 5000)
            setTimeout(() => {
              // Double-check we're still in SFU mode and not already switching
              if (sfuMode.value && !isSwitchingToSFU.value) {
                switchToSFUMode(roomInfo).catch(console.error)
              }
            }, 3000)
          } else if (event.code === 1000) {
            console.log('SFU WebSocket closed normally:', event.reason)
          }
        }
      }

      // Create WebRTC connection to SFU server
      // Close existing SFU peer connection if any
      if (sfuPeerConnection.value) {
        try {
          sfuPeerConnection.value.close()
        } catch (e) {
          console.warn('Error closing existing SFU peer connection:', e)
        }
        sfuPeerConnection.value = null
      }
      
      const sfuPC = sfuManager.createSFUPeerConnection()
      
      // Handle connection state
      sfuPC.onconnectionstatechange = () => {
        if (sfuPC.connectionState === 'failed' && sfuMode.value && !isSwitchingToSFU.value) {
          console.warn('SFU peer connection failed, falling back to P2P')
          globalStore.addNotification('SFU connection failed, falling back to P2P', 'error', 5000)
          switchToP2PMode()
        }
      }

      // Create and send offer
      await sfuManager.createAndSendOffer()

      globalStore.addNotification('Switched to SFU mode successfully', 'success', 3000)
      isSwitchingToSFU.value = false
      console.log('✅ SFU mode switch completed successfully')
      return { success: true }
    } catch (error) {
      console.error('Failed to switch to SFU mode:', error)
      globalStore.addNotification('Failed to switch to SFU mode, using P2P', 'error', 5000)
      sfuMode.value = false
      isSwitchingToSFU.value = false
      const errorObj = error instanceof Error ? error : new Error(String(error))
      return { success: false, error: errorObj.message }
    }
  }

  const sendSFUWebSocketMessage = (message) => {
    if (sfuWebSocket.value && sfuWebSocket.value.readyState === WebSocket.OPEN) {
      sfuWebSocket.value.send(JSON.stringify(message))
    } else {
      console.warn('SFU WebSocket not connected, cannot send message:', message)
    }
  }

  const handleSFUWebSocketMessage = async (data) => {
    console.log('Received SFU WebSocket message:', data.type)

    switch (data.type) {
      case 'answer':
        if (sfuPeerConnection.value && data.data) {
          await sfuPeerConnection.value.setRemoteDescription(
            new RTCSessionDescription({
              type: 'answer',
              sdp: data.data.sdp,
            })
          )
        }
        break

      case 'ice-candidate':
        if (sfuPeerConnection.value && data.data) {
          await sfuPeerConnection.value.addIceCandidate(
            new RTCIceCandidate({
              candidate: data.data.candidate,
              sdpMLineIndex: data.data.sdpMLineIndex,
              sdpMid: data.data.sdpMid,
            })
          )
        }
        break

      case 'peer-joined':
        console.log('Peer joined via SFU:', data.peer_id)
        // SFU will handle peer connections automatically
        break

      case 'peer-left':
        console.log('Peer left via SFU:', data.peer_id)
        // Remove participant
        remoteParticipants.value = remoteParticipants.value.filter(p => p.id !== data.peer_id)
        remoteStreams.value.delete(data.peer_id)
        break

      default:
        console.log('Unknown SFU message type:', data.type)
    }
  }

  const switchToP2PMode = async () => {
    try {
      console.log('Switching to P2P mode')
      globalStore.addNotification('Switching to P2P mode...', 'info', 3000)

      // Close SFU connections and clean up streams
      sfuManager.closeSFUConnections()
      sfuManager.cleanupSFUStreams()

      // Reset SFU state
      sfuRoomId.value = null
      sfuMode.value = false

      // Re-establish P2P connections if we have participants
      if (websocket.value && websocket.value.readyState === WebSocket.OPEN) {
        // Re-initiate connections with all participants via Django WebSocket
        const currentParticipants = remoteParticipants.value.map(p => p.id)
        for (const participantId of currentParticipants) {
          try {
            await createPeerConnectionForParticipant(participantId)
            await createOfferForParticipant(participantId)
          } catch (error) {
            console.error(`Failed to re-establish P2P connection with ${participantId}:`, error)
          }
        }
      }

      globalStore.addNotification('Switched to P2P mode successfully', 'success', 3000)
      return { success: true }
    } catch (error) {
      console.error('Failed to switch to P2P mode:', error)
      globalStore.addNotification('Error switching to P2P mode', 'error', 5000)
      const errorObj = error instanceof Error ? error : new Error(String(error))
      return { success: false, error: errorObj.message }
    }
  }

  const connectWebSocket = async (roomId) => {
    const operationId = `websocket_connect_${roomId}_${Date.now()}`

    try {
      return await webrtcRetryService.executeWithRetry(
        operationId,
        async () => {
          return new Promise((resolve, reject) => {
            try {
              // WebSocket должен подключаться к бэкенду/домену (nginx), поддерживаем VITE_WS_BASE_URL
              const wsUrl = buildWebSocketUrl(roomId)

              console.log('🔌 Connecting to WebSocket:', wsUrl)
              if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('💡 Tip: Make sure backend is running with: cd backend && python run_server.py')
                console.log('📡 Backend should be at: http://localhost:8000')
                console.log('🔄 Vite will proxy /ws requests from port 3000 to backend on port 8000')
              }
              
              websocket.value = new WebSocket(wsUrl)

              websocket.value.onopen = () => {
                console.log('WebSocket connected')
                connectionAttemptCount.value = 0
                lastConnectionAttempt.value = new Date()
                resolve(undefined)
              }

              websocket.value.onmessage = async (event) => {
                try {
                  const data = JSON.parse(event.data)
                  if (!isValidWsMessage(data)) {
                    console.warn('Invalid WS message format', data)
                    return
                  }
                  await handleWebSocketMessage(data)
                } catch (error) {
                  console.error('Failed to handle WebSocket message:', error)
                  const errorMessage = webrtcRetryService.getErrorMessage(error, 'Message handling')
                  globalStore.addNotification(errorMessage, 'error', 4000)
                }
              }

              websocket.value.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason)
                isConnected.value = false

                if (event.code !== 1000) {
                  // Not a normal closure - attempt to reconnect
                  let closeMessage = `WebSocket closed unexpectedly (code: ${event.code})`
                  if (event.reason) {
                    closeMessage += `: ${event.reason}`
                  }
                  
                  // Provide helpful message for common error codes
                  if (event.code === 1006) {
                    closeMessage = 'WebSocket connection failed. Please ensure the backend server is running with Daphne (WebSocket support).'
                    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                      closeMessage += ' Run: cd backend && python run_server.py'
                    }
                    
                    // Log to console for debugging
                    console.error('❌ WebSocket connection failed (code 1006)')
                    console.error('📡 Tried to connect to:', buildWebSocketUrl(roomId))
                    console.error('💡 Make sure backend is running with: cd backend && python run_server.py')
                  }
                  
                  try {
                    globalStore.addNotification(closeMessage, 'warning', 8000)
                  } catch (notifError) {
                    console.error('Failed to show notification:', notifError)
                    // Fallback: only show once per connection attempt
                    if (event.code === 1006 && !(window as any).__ws_error_shown) {
                      (window as any).__ws_error_shown = true
                      setTimeout(() => {
                        (window as any).__ws_error_shown = false
                      }, 5000)
                      console.warn('⚠️', closeMessage)
                    }
                  }

                  // Schedule reconnection attempt only if not error code 1006 (connection refused)
                  if (event.code !== 1006) {
                  setTimeout(() => {
                    if (!websocket.value || websocket.value.readyState === WebSocket.CLOSED) {
                      console.log('Attempting WebSocket reconnection...')
                      connectWebSocket(roomId).catch(console.error)
                    }
                  }, 3000)
                  }
                }
              }

              websocket.value.onerror = (error) => {
                console.error('WebSocket error:', error)
                const wsUrl = buildWebSocketUrl(roomId)
                
                // Determine actual backend URL (Vite proxies to port 8000 in dev)
                let backendUrl = 'localhost:8000'
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                  // In dev mode, Vite proxies /ws to backend:8000
                  backendUrl = 'localhost:8000'
                } else {
                  // In production, use the same host
                  backendUrl = window.location.host
                }
                
                let errorMessage = `WebSocket connection failed. `
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                  errorMessage += `Please ensure the backend server is running on http://${backendUrl} with Daphne (WebSocket support). `
                  errorMessage += `Run: cd backend && python run_server.py`
                } else {
                  errorMessage += `Cannot connect to ${backendUrl}. Please check server status.`
                }
                
                // Log to console for debugging
                console.error('❌', errorMessage)
                console.error('📡 WebSocket URL (via Vite proxy):', wsUrl)
                console.error('🔗 Backend should be at:', `http://${backendUrl}`)
                console.error('💡 Vite proxies /ws to backend, but backend must be running first')
                
                // Show notification to user
                try {
                  globalStore.addNotification(errorMessage, 'error', 8000)
                } catch (notifError) {
                  console.error('Failed to show notification:', notifError)
                  // Fallback: alert if notification system fails
                  alert(errorMessage)
                }
                
                reject(error)
              }

              // Set timeout for connection
              setTimeout(() => {
                if (websocket.value && websocket.value.readyState !== WebSocket.OPEN) {
                  websocket.value.close()
                  const timeoutError = new Error('WebSocket connection timeout')
                  const errorMessage = webrtcRetryService.getErrorMessage(timeoutError, 'Connection')
                  globalStore.addNotification(errorMessage, 'error', 5000)
                  reject(timeoutError)
                }
              }, 15000) // 15 second timeout with retry
            } catch (error) {
              reject(error)
            }
          })
        },
        {
          maxRetries: 3,
          baseDelay: 2000,
          shouldRetry: (error) => {
            // Retry on network errors but not on authentication errors
            const errorObj = error instanceof Error ? error : new Error(String(error))
            return !errorObj.message?.includes('401') && !errorObj.message?.includes('403')
          }
        }
      )
    } catch (error) {
      console.error('WebSocket connection failed after retries:', error)
      throw error
    }
  }

  /**
   * Обработчик входящих WS-сообщений с предсказуемой структурой.
   * @param {BaseWsMessage} data
   */
  const handleWebSocketMessage = async (data) => {
    console.log('Received WebSocket message:', data.type)

    switch (data.type) {
      case 'user_joined':
        handleUserJoined(data)
        break

      case 'user_left':
        handleUserLeft(data)
        break

      case 'webrtc_offer':
        await handleWebRTCOffer(data)
        break

      case 'webrtc_answer':
        await handleWebRTCAnswer(data)
        break

      case 'ice_candidate':
        await handleICECandidate(data)
        break

      case 'media_state_update':
        handleMediaStateUpdate(data)
        break

      case 'pong':
        // Handle ping response
        break

      case 'error':
        globalStore.addNotification(data.message, 'error', 5000)
        break
    }
  }

  /**
   * @param {BaseWsMessage} data
   */
  const handleUserJoined = async (data) => {
    const participantId = data.participant_id

    // Skip if this is our own participant ID
    if (participantId === localParticipantId.value) {
      console.log('Ignoring user_joined for own participant:', participantId)
      return
    }

    // Check if participant already exists
    const existingParticipant = remoteParticipants.value.find((p) => p.id === participantId)
    if (existingParticipant) {
      console.log('Participant already exists, ignoring duplicate user_joined:', participantId)
      return
    }
    
    console.log('Adding new remote participant:', participantId, 'Total:', remoteParticipants.value.length + 1)
      remoteParticipants.value.push({
        id: participantId,
        joined_at: data.timestamp,
        stream: null,
        connectionState: 'new', // new, connecting, connected, disconnected, failed
        isVideoEnabled: true,
        isAudioEnabled: true,
        isScreenSharing: false,
        audioLevel: 0,
        connectionQuality: 0,
        isRecording: false,
      })

    // Note: SFU mode is now enabled immediately when joining a room
    // This check is kept as a fallback in case SFU wasn't enabled during initialization
    if (!sfuMode.value && participantCount.value >= 2) {
        // Try to get current room info and pass it to switchToSFUMode
        const { useRoomsStore } = await import('./rooms')
        const roomsStore = useRoomsStore()
        let roomInfoForSFU = null
        
        // Try to get room ID from current room or from WebSocket room_id
        let targetRoomId = roomsStore.currentRoomId
        if (!targetRoomId && websocket.value) {
          // Try to extract room ID from WebSocket URL
          const wsUrl = websocket.value.url
          const match = wsUrl.match(/\/room\/([a-f0-9-]+)/)
          if (match) {
            targetRoomId = match[1]
          }
        }
        
        if (targetRoomId) {
          try {
            console.log('Getting room info for SFU switch, roomId:', targetRoomId)
            const roomResult = await roomsStore.getRoomInfo(targetRoomId)
            if (roomResult.success) {
              roomInfoForSFU = roomResult.room
              console.log('Room info for SFU:', {
                sfu_enabled: roomInfoForSFU.sfu_enabled,
                sfu_ws_url: roomInfoForSFU.sfu_ws_url,
                sfu_room_id: roomInfoForSFU.sfu_room_id
              })
              
              // If SFU is not enabled yet, try to create SFU room first
              if (!roomInfoForSFU.sfu_enabled && !roomInfoForSFU.sfu_ws_url) {
                console.log('Creating SFU room for multi-user call...')
                try {
                  // room_id is passed in URL path, not in body
                  const sfuResponse = await fetch(`/api/rooms/${targetRoomId}/sfu/create/`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    }
                  })
                  if (sfuResponse.ok) {
                    const sfuData = await sfuResponse.json()
                    console.log('SFU room created:', sfuData)
                    // Refresh room info to get SFU details
                    const updatedRoomResult = await roomsStore.getRoomInfo(targetRoomId)
                    if (updatedRoomResult.success) {
                      roomInfoForSFU = updatedRoomResult.room
                      console.log('Updated room info with SFU:', roomInfoForSFU)
                    }
                  } else {
                    const errorData = await sfuResponse.json()
                    console.warn('Failed to create SFU room:', errorData)
                  }
                } catch (error) {
                  console.warn('Failed to create SFU room:', error)
                }
              }
            } else {
              console.warn('Failed to get room info:', roomResult.error)
            }
          } catch (error) {
            console.warn('Failed to get room info for SFU switch:', error)
          }
        } else {
          console.warn('No room ID available for SFU switch')
        }
        
      // Only switch to SFU if not already in SFU mode and not already switching
      if (!sfuMode.value && !isSwitchingToSFU.value && roomInfoForSFU && roomInfoForSFU.sfu_enabled && roomInfoForSFU.sfu_ws_url) {
        await switchToSFUMode(roomInfoForSFU)
      } else if (sfuMode.value) {
        console.log('Already in SFU mode, skipping switch in handleUserJoined')
      } else if (isSwitchingToSFU.value) {
        console.log('SFU switch already in progress, skipping duplicate request in handleUserJoined')
      }
    }

    globalStore.addNotification(`${data.participant_name || 'Someone'} joined the call`, 'info', 3000)

    // If we are already in the room and not in SFU mode, create peer connection for the new participant
    if (localStream.value && !sfuMode.value) {
      createPeerConnectionForParticipant(participantId)
    }
  }

  /**
   * @param {BaseWsMessage} data
   */
  const handleUserLeft = (data) => {
    const participantId = data.participant_id

    // Close peer connection for this participant
    if (peerConnections.value.has(participantId)) {
      peerConnections.value.get(participantId).close()
      peerConnections.value.delete(participantId)
    }

    // Remove remote stream for this participant
    if (remoteStreams.value.has(participantId)) {
      const stream = remoteStreams.value.get(participantId)
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      remoteStreams.value.delete(participantId)
    }

    // Remove participant from list
    remoteParticipants.value = remoteParticipants.value.filter((p) => p.id !== participantId)

    globalStore.addNotification(`${data.participant_name || 'Someone'} left the call`, 'info', 3000)

    // Check if we should switch back from SFU mode
    if (participantCount.value <= 2 && sfuMode.value) {
      switchToP2PMode()
    }
  }

  /**
   * @param {BaseWsMessage} data
   */
  const handleWebRTCOffer = async (data) => {
    try {
      const participantId = data.sender

      // Create peer connection for this participant if it doesn't exist
      if (!peerConnections.value.has(participantId)) {
        await createPeerConnectionForParticipant(participantId)
      }

      // Use P2P manager to handle offer
      await p2pManager.handleOffer(participantId, data.offer)
    } catch (error) {
      console.error(`Failed to handle WebRTC offer from ${data.sender}:`, error)
    }
  }

  /**
   * @param {BaseWsMessage} data
   */
  const handleWebRTCAnswer = async (data) => {
    try {
      const participantId = data.sender
      // Use P2P manager to handle answer
      await p2pManager.handleAnswer(participantId, data.answer)
    } catch (error) {
      console.error(`Failed to handle WebRTC answer from ${data.sender}:`, error)
    }
  }

  /**
   * @param {BaseWsMessage} data
   */
  const handleICECandidate = async (data) => {
    try {
      const participantId = data.sender
      // Use P2P manager to handle ICE candidate
      await p2pManager.handleICECandidate(participantId, data.candidate)
    } catch (error) {
      console.error(`Failed to handle ICE candidate from ${data.sender}:`, error)
    }
  }

  const handleMediaStateUpdate = (data) => {
    const participant = remoteParticipants.value.find((p) => p.id === data.participant_id)
    if (participant) {
      participant.mediaState = data.state
    }
  }

  const createOfferForParticipant = async (participantId) => {
    try {
      // Create peer connection for this participant if it doesn't exist
      if (!peerConnections.value.has(participantId)) {
        await createPeerConnectionForParticipant(participantId)
      }

      // Use P2P manager to create and send offer
      await p2pManager.createOfferForParticipant(participantId)
    } catch (error) {
      console.error(`Failed to create offer for participant ${participantId}:`, error)
    }
  }

  const initiateConnectionsWithAllParticipants = async () => {
    for (const participant of remoteParticipants.value) {
      if (participant.connectionState === 'new' || participant.connectionState === 'disconnected') {
        await createOfferForParticipant(participant.id)
      }
    }
  }

  /**
   * Отправляет сообщение на сигнальный WebSocket-сервер.
   * Ожидает открытое соединение, иначе логирует предупреждение.
   *
   * @param {Partial<BaseWsMessage> & { type: string }} message
   * @returns {boolean} true if message was sent, false otherwise
   */
  const sendWebSocketMessage = (message) => {
    if (!websocket.value) {
      console.warn('WebSocket not initialized')
      return false
    }
    
    if (websocket.value.readyState === WebSocket.OPEN) {
      try {
        websocket.value.send(JSON.stringify(message))
        return true
      } catch (error) {
        console.error('Failed to send WebSocket message:', error)
        errorReportingService.captureError(error, {
          type: 'websocket-error',
          severity: 'error',
          context: { messageType: message.type }
        })
        return false
      }
    } else {
      console.warn('WebSocket not connected, message not sent:', message)
      return false
    }
  }

  /**
   * Переключает состояние видеотрека локального пользователя и
   * отправляет уведомление другим участникам о новом состоянии медиа.
   */
  const toggleVideo = () => {
    if (localStream.value) {
      const videoTrack = localStream.value.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        isVideoEnabled.value = videoTrack.enabled

        // Notify other participants
        sendWebSocketMessage({
          type: 'media_state',
          state: {
            video: isVideoEnabled.value,
            audio: isAudioEnabled.value,
          },
        })

        globalStore.addNotification(
          isVideoEnabled.value ? 'Camera turned on' : 'Camera turned off',
          'info',
          2000,
        )
      }
    }
  }

  /**
   * Переключает состояние аудиотрека локального пользователя и
   * отправляет уведомление другим участникам о новом состоянии медиа.
   */
  const toggleAudio = () => {
    if (localStream.value) {
      const audioTrack = localStream.value.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        isAudioEnabled.value = audioTrack.enabled

        // Notify other participants
        sendWebSocketMessage({
          type: 'media_state',
          state: {
            video: isVideoEnabled.value,
            audio: isAudioEnabled.value,
          },
        })

        globalStore.addNotification(
          isAudioEnabled.value ? 'Microphone turned on' : 'Microphone turned off',
          'info',
          2000,
        )
      }
    }
  }

  const endCall = async () => {
    try {
      // Stop all quality monitoring
      qualityMonitor.stopAllMonitoring()
      
      // Stop all connection monitors from webrtcRetryService
      connectionMonitors.value.forEach((monitorId) => {
        // Monitor ID is a string, we need to stop the monitoring
        // The actual cleanup is done by webrtcRetryService when peer connection closes
      })
      
      // Stop all quality monitors
      qualityMonitors.value.forEach((monitor) => {
        if (monitor && typeof monitor === 'number') {
          clearInterval(monitor)
        }
      })
      
      // Clear all monitors
      connectionMonitors.value.clear()
      qualityMonitors.value.clear()
      
      // Close all peer connections (this will trigger cleanup in webrtcRetryService)
      peerConnections.value.forEach((pc, participantId) => {
        try {
          // Stop quality monitoring for this connection
          webrtcRetryService.stopQualityMonitor(pc)
          // Close the connection
          pc.close()
        } catch (error) {
          console.error(`Error closing peer connection for ${participantId}:`, error)
        }
      })
      peerConnections.value.clear()
      
      // Close SFU connections if active
      if (sfuMode.value) {
        sfuManager.closeSFUConnections()
        sfuManager.cleanupSFUStreams()
        sfuMode.value = false
      }
      
      // Close P2P connections
      p2pManager.closeAllConnections()
      
      // Cancel all retry operations
      retryOperations.value.forEach((_, operationId) => {
        webrtcRetryService.cancelRetry(operationId)
      })
      retryOperations.value.clear()

      // Close WebSocket
      if (websocket.value) {
        try {
          if (websocket.value.readyState === WebSocket.OPEN || websocket.value.readyState === WebSocket.CONNECTING) {
            websocket.value.close(1000, 'Call ended') // Normal closure
          }
        } catch (error) {
          console.error('Error closing WebSocket:', error)
        } finally {
          websocket.value = null
        }
      }

      // Stop local media tracks
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch (error) {
            console.error('Error stopping local track:', error)
          }
        })
        localStream.value = null
      }

      // Stop and clear all remote streams
      remoteStreams.value.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch (error) {
            console.error('Error stopping remote track:', error)
          }
        })
      })
      remoteStreams.value.clear()
      
      // Clear screen share streams
      remoteScreenShareStreams.value.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          track.stop()
        })
      })
      remoteScreenShareStreams.value.clear()

      // Reset state
      isConnected.value = false
      connectionState.value = 'new'
      remoteParticipants.value = []
      sfuMode.value = false
      connectionRecoveryInProgress.value = false
      fallbackLevels.value.clear()

      console.log('Call ended successfully')
    } catch (error) {
      console.error('Failed to end call:', error)
      // Report error but don't throw - we want to clean up as much as possible
      errorReportingService.captureError(error, {
        type: 'webrtc-error',
        severity: 'error',
        context: { action: 'endCall' }
      })
    }
  }

  // Participant-specific methods
  const toggleParticipantVideo = (participantId) => {
    const participant = remoteParticipants.value.find(p => p.id === participantId)
    if (participant) {
      participant.isVideoEnabled = !participant.isVideoEnabled

      sendWebSocketMessage({
        type: 'participant_media_update',
        participant_id: participantId,
        media_state: {
          video: participant.isVideoEnabled,
          audio: participant.isAudioEnabled,
        },
      })
    }
  }

  const toggleParticipantAudio = (participantId) => {
    const participant = remoteParticipants.value.find(p => p.id === participantId)
    if (participant) {
      participant.isAudioEnabled = !participant.isAudioEnabled

      sendWebSocketMessage({
        type: 'participant_media_update',
        participant_id: participantId,
        media_state: {
          video: participant.isVideoEnabled,
          audio: participant.isAudioEnabled,
        },
      })
    }
  }

  const getParticipantStream = (participantId) => {
    return remoteStreams.value.get(participantId) || null
  }

  const getParticipantConnectionState = (participantId) => {
    const participant = remoteParticipants.value.find(p => p.id === participantId)
    return participant ? participant.connectionState : 'disconnected'
  }

  const getParticipantById = (participantId) => {
    return remoteParticipants.value.find(p => p.id === participantId) || null
  }

  return {
    // State
    localStream,
    remoteStream,
    remoteStreams,
    remoteScreenShareStreams,
    localScreenShareStream,
    peerConnections,
    websocket,
    isConnected,
    isVideoEnabled,
    isAudioEnabled,
    connectionState,
    remoteParticipants,
    localParticipantId,
    mediaConstraints,
    sfuMode,
    sfuPeerConnection,
    retryOperations,
    connectionMonitors,
    qualityMonitors,
    fallbackLevels,
    connectionRecoveryInProgress,
    lastConnectionAttempt,
    connectionAttemptCount,

    // Computed
    hasLocalVideo,
    hasRemoteVideo,
    hasAnyRemoteStream,
    isCallActive,
    participantCount,
    isMultiUserCall,

    // Actions
    initializeLocalMedia,
    createPeerConnectionForParticipant,
    connectWebSocket,
    createOfferForParticipant,
    initiateConnectionsWithAllParticipants,
    sendWebSocketMessage,
    toggleVideo,
    toggleAudio,
    toggleParticipantVideo,
    toggleParticipantAudio,
    endCall,
    getParticipantStream,
    getParticipantConnectionState,
    getParticipantById,
    updateOverallConnectionState,
    switchToSFUMode,
    switchToP2PMode,
    handleConnectionRecovery,
    handleConnectionQualityChange,
    attemptReconnection,
  }
})

// Named exports for unit testing of helpers
export { buildWebSocketUrl, isValidWsMessage }
