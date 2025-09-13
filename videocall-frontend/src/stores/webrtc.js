// src/stores/webrtc.js - WebRTC and media state management
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGlobalStore } from './global'

export const useWebRTCStore = defineStore('webrtc', () => {
  const globalStore = useGlobalStore()

  // State
  const localStream = ref(null)
  const remoteStreams = ref(new Map()) // Map of participant_id -> MediaStream
  const peerConnections = ref(new Map()) // Map of participant_id -> RTCPeerConnection
  const websocket = ref(null)
  const isConnected = ref(false)
  const isVideoEnabled = ref(true)
  const isAudioEnabled = ref(true)
  const connectionState = ref('new') // new, connecting, connected, disconnected, failed
  const remoteParticipants = ref([])
  const localParticipantId = ref(null)
  const isNegotiating = ref(new Map()) // Map of participant_id -> boolean
  const pendingOffers = ref(new Map()) // Map of participant_id -> array of offers

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
  const isCallActive = computed(
    () => isConnected.value && (hasLocalVideo.value || hasRemoteVideo.value),
  )
  const connectedParticipantsCount = computed(() => peerConnections.value.size)

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

  const createPeerConnection = (participantId) => {
    try {
      const peerConnection = new RTCPeerConnection(rtcConfiguration)

      // Add local stream tracks to peer connection
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream.value)
        })
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote track from:', participantId, event)
        remoteStreams.value.set(participantId, event.streams[0])
      }

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && websocket.value) {
          sendWebSocketMessage({
            type: 'ice_candidate',
            candidate: event.candidate,
            target: participantId,
          })
        }
      }

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log(`Connection state with ${participantId}:`, peerConnection.connectionState)
        
        if (peerConnection.connectionState === 'connected') {
          isConnected.value = true
          globalStore.addNotification(`Connected to ${participantId}`, 'success', 2000)
        } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
          // Remove the connection and stream
          peerConnections.value.delete(participantId)
          remoteStreams.value.delete(participantId)
          
          if (peerConnection.connectionState === 'failed') {
            globalStore.addNotification(`Connection failed with ${participantId}`, 'error', 3000)
          }
          
          // Update overall connection state
          if (peerConnections.value.size === 0) {
            isConnected.value = false
            connectionState.value = 'disconnected'
          }
        }
      }

      // Store the connection
      peerConnections.value.set(participantId, peerConnection)
      isNegotiating.value.set(participantId, false)
      pendingOffers.value.set(participantId, [])

      return { success: true }
    } catch (error) {
      console.error('Failed to create peer connection:', error)
      return { success: false, error: error.message }
    }
  }

  const connectWebSocket = (roomId) => {
    return new Promise((resolve, reject) => {
      try {
        // WebSocket должен подключаться к бэкенду (порт 8000), а не к фронтенду
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsHost = import.meta.env.VITE_WS_HOST || window.location.host
        const wsUrl = `${protocol}//${wsHost}/ws/room/${roomId}/`

        console.log('Connecting to WebSocket:', wsUrl)
        websocket.value = new WebSocket(wsUrl)

        websocket.value.onopen = () => {
          console.log('WebSocket connected')
          resolve()
        }

        websocket.value.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data)
            await handleWebSocketMessage(data)
          } catch (error) {
            console.error('Failed to handle WebSocket message:', error)
          }
        }

        websocket.value.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason)
          isConnected.value = false

          if (event.code !== 1000) {
            // Not a normal closure
            globalStore.addNotification('Connection lost', 'error', 5000)
          }
        }

        websocket.value.onerror = (error) => {
          console.error('WebSocket error:', error)
          reject(error)
        }

        // Set timeout for connection
        setTimeout(() => {
          if (websocket.value && websocket.value.readyState !== WebSocket.OPEN) {
            websocket.value.close()
            reject(new Error('WebSocket connection timeout'))
          }
        }, 10000) // 10 second timeout
      } catch (error) {
        reject(error)
      }
    })
  }

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

  const handleUserJoined = (data) => {
    const participantId = data.participant_id

    if (!remoteParticipants.value.find((p) => p.id === participantId)) {
      remoteParticipants.value.push({
        id: participantId,
        joined_at: data.timestamp,
        stream: null,
      })
    }

    globalStore.addNotification('Someone joined the call', 'info', 3000)

    // Create peer connection for the new participant
    if (localStream.value) {
      createPeerConnection(participantId)
      // Send offer to the new participant
      setTimeout(() => createOffer(participantId), 100)
    }
  }

  const handleUserLeft = (data) => {
    const participantId = data.participant_id

    remoteParticipants.value = remoteParticipants.value.filter((p) => p.id !== participantId)

    globalStore.addNotification('Someone left the call', 'info', 3000)

    // Close peer connection and remove stream
    const peerConnection = peerConnections.value.get(participantId)
    if (peerConnection) {
      peerConnection.close()
      peerConnections.value.delete(participantId)
    }
    
    remoteStreams.value.delete(participantId)
    isNegotiating.value.delete(participantId)
    pendingOffers.value.delete(participantId)
  }

  const handleWebRTCOffer = async (data) => {
    try {
      const senderId = data.sender
      const isNegotiatingWithSender = isNegotiating.value.get(senderId) || false
      
      if (isNegotiatingWithSender) {
        console.warn(`Already negotiating with ${senderId}, queuing offer`)
        const pending = pendingOffers.value.get(senderId) || []
        pending.push(data)
        pendingOffers.value.set(senderId, pending)
        return
      }

      let peerConnection = peerConnections.value.get(senderId)
      if (!peerConnection) {
        createPeerConnection(senderId)
        peerConnection = peerConnections.value.get(senderId)
      }

      
      // Check if we can set remote description
      if (peerConnection.signalingState === 'stable' || 
          peerConnection.signalingState === 'have-local-offer') {
        isNegotiating.value.set(senderId, true)
        console.log(`Setting remote description for offer from ${senderId}, current state:`, peerConnection.signalingState)
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
        
        const answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)

        sendWebSocketMessage({
          type: 'answer',
          answer: answer,
          target: senderId,
        })
        
        isNegotiating.value.set(senderId, false)
        
        // Process any pending offers
        const pending = pendingOffers.value.get(senderId) || []
        if (pending.length > 0) {
          const nextOffer = pending.shift()
          pendingOffers.value.set(senderId, pending)
          setTimeout(() => handleWebRTCOffer(nextOffer), 100) // Small delay to ensure state is stable
        }
      } else {
        console.warn(`Cannot handle offer from ${senderId} in current signaling state:`, peerConnection.signalingState)
      }
    } catch (error) {
      console.error('Failed to handle WebRTC offer:', error)
      isNegotiating.value.set(data.sender, false)
    }
  }

  const handleWebRTCAnswer = async (data) => {
    try {
      const senderId = data.sender
      const peerConnection = peerConnections.value.get(senderId)
      
      if (!peerConnection) {
        console.warn(`No peer connection found for ${senderId}`)
        return
      }
      
      // Check if we can set remote description
      if (peerConnection.signalingState === 'have-local-offer') {
        console.log(`Setting remote description for answer from ${senderId}, current state:`, peerConnection.signalingState)
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
      } else {
        console.warn(`Cannot handle answer from ${senderId} in current signaling state:`, peerConnection.signalingState)
      }
    } catch (error) {
      console.error('Failed to handle WebRTC answer:', error)
    }
  }

  const handleICECandidate = async (data) => {
    try {
      const senderId = data.sender
      const peerConnection = peerConnections.value.get(senderId)
      
      if (peerConnection && peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
      } else {
        console.warn(`Cannot add ICE candidate from ${senderId}: no remote description set`)
      }
    } catch (error) {
      console.error('Failed to handle ICE candidate:', error)
    }
  }

  const handleMediaStateUpdate = (data) => {
    const participant = remoteParticipants.value.find((p) => p.id === data.participant_id)
    if (participant) {
      participant.mediaState = data.state
    }
  }

  const createOffer = async (participantId) => {
    try {
      const isNegotiatingWithParticipant = isNegotiating.value.get(participantId) || false
      
      if (isNegotiatingWithParticipant) {
        console.warn(`Already negotiating with ${participantId}, ignoring create offer request`)
        return
      }

      let peerConnection = peerConnections.value.get(participantId)
      if (!peerConnection) {
        createPeerConnection(participantId)
        peerConnection = peerConnections.value.get(participantId)
      }

      // Only create offer if in stable state
      if (peerConnection.signalingState === 'stable') {
        isNegotiating.value.set(participantId, true)
        console.log(`Creating offer for ${participantId}, current state:`, peerConnection.signalingState)
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)

        sendWebSocketMessage({
          type: 'offer',
          offer: offer,
          target: participantId,
        })
        
        isNegotiating.value.set(participantId, false)
      } else {
        console.warn(`Cannot create offer for ${participantId} in current signaling state:`, peerConnection.signalingState)
      }
    } catch (error) {
      console.error('Failed to create offer:', error)
      isNegotiating.value.set(participantId, false)
    }
  }

  const sendWebSocketMessage = (message) => {
    if (websocket.value && websocket.value.readyState === WebSocket.OPEN) {
      websocket.value.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, message not sent:', message)
    }
  }

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
      // Close all peer connections
      peerConnections.value.forEach((peerConnection, participantId) => {
        peerConnection.close()
      })
      peerConnections.value.clear()

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

      // Clear remote streams
      remoteStreams.value.clear()

      // Reset state
      isConnected.value = false
      connectionState.value = 'new'
      remoteParticipants.value = []
      isNegotiating.value.clear()
      pendingOffers.value.clear()

      console.log('Call ended successfully')
    } catch (error) {
      console.error('Failed to end call:', error)
    }
  }

  return {
    // State
    localStream,
    remoteStreams,
    peerConnections,
    websocket,
    isConnected,
    isVideoEnabled,
    isAudioEnabled,
    connectionState,
    remoteParticipants,
    localParticipantId,
    isNegotiating,
    pendingOffers,
    mediaConstraints,

    // Computed
    hasLocalVideo,
    hasRemoteVideo,
    isCallActive,
    connectedParticipantsCount,

    // Actions
    initializeLocalMedia,
    createPeerConnection,
    connectWebSocket,
    createOffer,
    sendWebSocketMessage,
    toggleVideo,
    toggleAudio,
    endCall,
  }
})

