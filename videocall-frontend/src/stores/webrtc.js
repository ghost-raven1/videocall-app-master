// src/stores/webrtc.js - WebRTC and media state management
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGlobalStore } from './global'
import { webrtcRetryService } from '../services/webrtc-retry'

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
function buildWebSocketUrl(roomId) {
  const baseEnv = import.meta.env.VITE_WS_BASE_URL
  if (typeof baseEnv === 'string' && baseEnv.trim() !== '') {
    const base = baseEnv.replace(/\/$/, '')
    return `${base}/ws/room/${roomId}/`
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsHost = import.meta.env.VITE_WS_HOST || window.location.host
  return `${protocol}//${wsHost}/ws/room/${roomId}/`
}

/**
 * @param {any} data
 * @returns {data is BaseWsMessage}
 */
function isValidWsMessage(data) {
  if (!data || typeof data !== 'object') return false
  if (typeof data.type !== 'string') return false
  const known = new Set([
    'user_joined',
    'user_left',
    'webrtc_offer',
    'webrtc_answer',
    'ice_candidate',
    'media_state_update',
    'pong',
    'error',
  ])
  return known.has(data.type)
}

export const useWebRTCStore = defineStore('webrtc', () => {
  const globalStore = useGlobalStore()

  // State
  const localStream = ref(null)
  const remoteStreams = ref(new Map()) // Map<participantId, MediaStream>
  const peerConnections = ref(new Map()) // Map<participantId, RTCPeerConnection>
  const websocket = ref(null)
  const isConnected = ref(false)
  const isVideoEnabled = ref(true)
  const isAudioEnabled = ref(true)
  const connectionState = ref('new') // new, connecting, connected, disconnected, failed
  const remoteParticipants = ref([])
  const localParticipantId = ref(null)
  const sfuMode = ref(false) // true when using SFU for 3+ users

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
  const hasLocalVideo = computed(() => localStream.value !== null)
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

  // WebRTC configuration
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Add TURN servers here for production
    ],
    iceCandidatePoolSize: 10,
  }

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
      return { success: false, error: error.message }
    }
  }

  const createPeerConnectionForParticipant = async (participantId) => {
    const operationId = `create_peer_${participantId}_${Date.now()}`

    try {
      // Use retry service for peer connection creation
      const result = await webrtcRetryService.executeWithRetry(
        operationId,
        async () => {
          const peerConnection = new RTCPeerConnection(rtcConfiguration)

          // Add local stream tracks to peer connection
          if (localStream.value) {
            localStream.value.getTracks().forEach((track) => {
              peerConnection.addTrack(track, localStream.value)
            })
          }

          return peerConnection
        },
        {
          maxRetries: 3,
          baseDelay: 1000,
          shouldRetry: (error) => {
            // Don't retry on configuration errors
            return !error.message?.includes('InvalidAccessError')
          }
        }
      )

      const peerConnection = result
      peerConnections.value.set(participantId, peerConnection)

      // Handle remote stream for this participant
      peerConnection.ontrack = (event) => {
        console.log(`Received remote track from participant ${participantId}:`, event)
        remoteStreams.value.set(participantId, event.streams[0])

        // Update participant stream reference
        const participant = remoteParticipants.value.find(p => p.id === participantId)
        if (participant) {
          participant.stream = event.streams[0]
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
        (recoveryInfo) => handleConnectionRecovery(participantId, peerConnection, recoveryInfo),
        (quality, state) => handleConnectionQualityChange(participantId, quality, state)
      )
      connectionMonitors.value.set(participantId, monitorId)

      return { success: true, peerConnection }
    } catch (error) {
      console.error(`Failed to create peer connection for participant ${participantId}:`, error)
      const userFriendlyMessage = webrtcRetryService.getErrorMessage(error, `Participant ${participantId}`)
      globalStore.addNotification(userFriendlyMessage, 'error', 6000)
      return { success: false, error: error.message }
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

  const handleConnectionRecovery = async (participantId, peerConnection, recoveryInfo) => {
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
            return !error.message?.includes('NotAllowedError')
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

  const switchToSFUMode = () => {
    sfuMode.value = true
    console.log('Switching to SFU mode for multi-user call')
    // TODO: Implement SFU connection logic
  }

  const switchToP2PMode = () => {
    sfuMode.value = false
    console.log('Switching to P2P mode')
    // TODO: Implement P2P fallback logic
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

              console.log('Connecting to WebSocket:', wsUrl)
              websocket.value = new WebSocket(wsUrl)

              websocket.value.onopen = () => {
                console.log('WebSocket connected')
                connectionAttemptCount.value = 0
                lastConnectionAttempt.value = new Date()
                resolve()
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
                  const errorMessage = webrtcRetryService.getErrorMessage(
                    new Error(`WebSocket closed unexpectedly: ${event.reason}`),
                    'Connection'
                  )
                  globalStore.addNotification(errorMessage, 'warning', 5000)

                  // Schedule reconnection attempt
                  setTimeout(() => {
                    if (!websocket.value || websocket.value.readyState === WebSocket.CLOSED) {
                      console.log('Attempting WebSocket reconnection...')
                      connectWebSocket(roomId).catch(console.error)
                    }
                  }, 3000)
                }
              }

              websocket.value.onerror = (error) => {
                console.error('WebSocket error:', error)
                const errorMessage = webrtcRetryService.getErrorMessage(error, 'WebSocket')
                globalStore.addNotification(errorMessage, 'error', 5000)
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
            return !error.message?.includes('401') && !error.message?.includes('403')
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
  const handleUserJoined = (data) => {
    const participantId = data.participant_id

    if (!remoteParticipants.value.find((p) => p.id === participantId)) {
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

      // Check if we should switch to SFU mode
      if (participantCount.value >= 3 && !sfuMode.value) {
        switchToSFUMode()
      }
    }

    globalStore.addNotification(`${data.participant_name || 'Someone'} joined the call`, 'info', 3000)

    // If we are already in the room, create peer connection for the new participant
    if (localStream.value) {
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
        createPeerConnectionForParticipant(participantId)
      }

      const peerConnection = peerConnections.value.get(participantId)
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)

      sendWebSocketMessage({
        type: 'webrtc_answer',
        answer: answer,
        target: participantId,
      })
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
      const peerConnection = peerConnections.value.get(participantId)

      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
      }
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
      const peerConnection = peerConnections.value.get(participantId)

      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
      }
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

      const peerConnection = peerConnections.value.get(participantId)
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      sendWebSocketMessage({
        type: 'webrtc_offer',
        offer: offer,
        target: participantId,
      })
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
   */
  const sendWebSocketMessage = (message) => {
    if (websocket.value && websocket.value.readyState === WebSocket.OPEN) {
      websocket.value.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, message not sent:', message)
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
      // Cancel all retry operations
      for (const operationId of retryOperations.value.keys()) {
        webrtcRetryService.cancelRetry(operationId)
      }
      retryOperations.value.clear()

      // Stop all quality monitors
      for (const [participantId, monitorId] of qualityMonitors.value) {
        webrtcRetryService.stopQualityMonitor(peerConnections.value.get(participantId))
      }
      qualityMonitors.value.clear()

      // Close all peer connections
      for (const [participantId, peerConnection] of peerConnections.value) {
        const monitorId = connectionMonitors.value.get(participantId)
        if (monitorId) {
          // The monitor cleanup is handled by the retry service
        }
        peerConnection.close()
      }
      peerConnections.value.clear()
      connectionMonitors.value.clear()

      // Close WebSocket
      if (websocket.value) {
        websocket.value.close(1000, 'Call ended') // Normal closure
        websocket.value = null
      }

      // Stop local media tracks
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => track.stop())
        localStream.value = null
      }

      // Stop and clear all remote streams
      for (const [participantId, stream] of remoteStreams.value) {
        stream.getTracks().forEach((track) => track.stop())
      }
      remoteStreams.value.clear()

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
