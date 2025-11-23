// src/stores/webrtc-sfu.ts - SFU mode logic extracted from webrtc.ts
import { ref, Ref } from 'vue'
import { useGlobalStore } from './global'

/**
 * SFU WebSocket message handler
 */
export interface SFUWebSocketMessage {
  type: string
  room_id?: string
  peer_id?: string
  data?: any
  candidate?: any
  sdp?: string
}

/**
 * SFU connection manager
 */
export class SFUConnectionManager {
  private sfuWebSocket: Ref<WebSocket | null>
  private sfuPeerConnection: Ref<RTCPeerConnection | null>
  private sfuRoomId: Ref<string | null>
  private localStream: Ref<MediaStream | null>
  private localParticipantId: Ref<string | null>
  private remoteStreams: Ref<Map<string, MediaStream>>
  private remoteParticipants: Ref<any[]>
  private globalStore: ReturnType<typeof useGlobalStore>
  private rtcConfiguration: RTCConfiguration

  constructor(
    sfuWebSocket: Ref<WebSocket | null>,
    sfuPeerConnection: Ref<RTCPeerConnection | null>,
    sfuRoomId: Ref<string | null>,
    localStream: Ref<MediaStream | null>,
    localParticipantId: Ref<string | null>,
    remoteStreams: Ref<Map<string, MediaStream>>,
    remoteParticipants: Ref<any[]>,
    rtcConfiguration: RTCConfiguration
  ) {
    this.sfuWebSocket = sfuWebSocket
    this.sfuPeerConnection = sfuPeerConnection
    this.sfuRoomId = sfuRoomId
    this.localStream = localStream
    this.localParticipantId = localParticipantId
    this.remoteStreams = remoteStreams
    this.remoteParticipants = remoteParticipants
    this.globalStore = useGlobalStore()
    this.rtcConfiguration = rtcConfiguration
  }

  /**
   * Check SFU server health before switching
   */
  async checkSFUHealth(roomInfo: any): Promise<boolean> {
    try {
      const { apiService } = await import('../services/api')
      const roomId = roomInfo.room_id || roomInfo.sfu_room_id

      if (roomId) {
        try {
          const healthResponse = await apiService.getRoomHealth(roomId)

          if (healthResponse && healthResponse.data && healthResponse.data.sfu_health) {
            const sfuHealth = healthResponse.data.sfu_health
            if (!sfuHealth.healthy) {
              console.warn('SFU server health check failed, falling back to P2P')
              this.globalStore.addNotification('SFU server unavailable, using P2P mode', 'warning', 5000)
              return false
            }
          }
        } catch (healthError) {
          console.warn('Room health check failed, trying SFU server stats:', healthError)
          // Fallback: check SFU server stats directly
          try {
            const statsResponse = await apiService.getSFUServerStats()
            if (statsResponse && statsResponse.data?.sfu_server && !statsResponse.data.sfu_server.healthy) {
              console.warn('SFU server health check failed, falling back to P2P')
              this.globalStore.addNotification('SFU server unavailable, using P2P mode', 'warning', 5000)
              return false
            }
          } catch (statsError) {
            console.warn('SFU server stats check also failed:', statsError)
          }
        }
      } else {
        // Fallback: check SFU server stats directly
        try {
          const statsResponse = await apiService.getSFUServerStats()
          if (statsResponse && statsResponse.data?.sfu_server && !statsResponse.data.sfu_server.healthy) {
            console.warn('SFU server health check failed, falling back to P2P')
            this.globalStore.addNotification('SFU server unavailable, using P2P mode', 'warning', 5000)
            return false
          }
        } catch (statsError) {
          console.warn('SFU server stats check failed:', statsError)
        }
      }
    } catch (error) {
      console.error('SFU health check failed:', error)
      // Don't block SFU switch on health check failure - let it try and fail gracefully
      console.warn('Proceeding with SFU switch despite health check failure')
    }

    return true
  }

  /**
   * Connect to SFU WebSocket
   */
  async connectToSFUWebSocket(sfuWsUrl: string, roomId: string, peerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build SFU WebSocket URL with room and peer parameters
        const url = new URL(sfuWsUrl)
        url.searchParams.set('room', roomId)
        url.searchParams.set('peer', peerId)

        this.sfuWebSocket.value = new WebSocket(url.toString())

        this.sfuWebSocket.value.onopen = () => {
          console.log('SFU WebSocket connected')
          resolve(undefined)
        }

        this.sfuWebSocket.value.onerror = (error) => {
          console.error('SFU WebSocket error:', error)
          reject(error)
        }

        this.sfuWebSocket.value.onclose = (event) => {
          console.log('SFU WebSocket closed:', event.code, event.reason)
          if (event.code !== 1000) {
            this.globalStore.addNotification('SFU connection lost, attempting reconnection...', 'warning', 5000)
          }
        }

        // Set timeout for connection
        setTimeout(() => {
          if (this.sfuWebSocket.value && this.sfuWebSocket.value.readyState !== WebSocket.OPEN) {
            this.sfuWebSocket.value.close()
            reject(new Error('SFU WebSocket connection timeout'))
          }
        }, 15000)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Create WebRTC connection to SFU server
   */
  createSFUPeerConnection(): RTCPeerConnection {
    if (!this.localStream.value) {
      throw new Error('Local media stream not available')
    }

    const sfuPC = new RTCPeerConnection(this.rtcConfiguration)
    this.sfuPeerConnection.value = sfuPC

    // Add local tracks to SFU connection
    this.localStream.value.getTracks().forEach(track => {
      sfuPC.addTrack(track, this.localStream.value!)
    })

    // Handle remote tracks from SFU
    sfuPC.ontrack = (event) => {
      console.log('Received track from SFU:', event)
      const stream = event.streams[0]
      if (stream) {
        // SFU sends tracks with participant ID in track ID or stream ID
        const participantId = event.track.id || `sfu_${Date.now()}`
        this.remoteStreams.value.set(participantId, stream)

        // Add participant if not exists
        const existingParticipant = this.remoteParticipants.value.find(p => p.id === participantId)
        if (!existingParticipant) {
          this.remoteParticipants.value.push({
            id: participantId,
            name: `Participant ${participantId.slice(-4)}`,
            stream: stream,
            isVideoEnabled: true,
            isAudioEnabled: true,
            connectionState: 'connected',
          })
        }
      }
    }

    // Handle ICE candidates
    sfuPC.onicecandidate = (event) => {
      if (event.candidate && this.sfuWebSocket.value) {
        this.sendSFUWebSocketMessage({
          type: 'ice-candidate',
          room_id: this.sfuRoomId.value || '',
          peer_id: this.localParticipantId.value || '',
          data: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          },
        })
      }
    }

    // Handle connection state
    sfuPC.onconnectionstatechange = () => {
      console.log('SFU connection state:', sfuPC.connectionState)
      if (sfuPC.connectionState === 'connected') {
        this.globalStore.addNotification('Connected to SFU server', 'success', 3000)
      } else if (sfuPC.connectionState === 'failed') {
        this.globalStore.addNotification('SFU connection failed, falling back to P2P', 'error', 5000)
        // Trigger fallback to P2P (will be handled by parent store)
      }
    }

    return sfuPC
  }

  /**
   * Create and send offer to SFU
   */
  async createAndSendOffer(): Promise<void> {
    if (!this.sfuPeerConnection.value) {
      throw new Error('SFU peer connection not created')
    }

    const offer = await this.sfuPeerConnection.value.createOffer()
    await this.sfuPeerConnection.value.setLocalDescription(offer)

    // Send offer to SFU via WebSocket
    this.sendSFUWebSocketMessage({
      type: 'offer',
      room_id: this.sfuRoomId.value || '',
      peer_id: this.localParticipantId.value || '',
      data: {
        sdp: offer.sdp,
        type: offer.type,
      },
    })
  }

  /**
   * Send message to SFU WebSocket
   */
  sendSFUWebSocketMessage(message: SFUWebSocketMessage): void {
    if (this.sfuWebSocket.value && this.sfuWebSocket.value.readyState === WebSocket.OPEN) {
      this.sfuWebSocket.value.send(JSON.stringify(message))
    } else {
      console.warn('SFU WebSocket not connected, cannot send message:', message)
    }
  }

  /**
   * Handle incoming SFU WebSocket message
   */
  async handleSFUWebSocketMessage(data: SFUWebSocketMessage): Promise<void> {
    console.log('Received SFU WebSocket message:', data.type)

    switch (data.type) {
      case 'answer':
        if (this.sfuPeerConnection.value && data.data) {
          await this.sfuPeerConnection.value.setRemoteDescription(
            new RTCSessionDescription({
              type: 'answer',
              sdp: data.data.sdp,
            })
          )
        }
        break

      case 'ice-candidate':
        if (this.sfuPeerConnection.value && data.data) {
          await this.sfuPeerConnection.value.addIceCandidate(
            new RTCIceCandidate({
              candidate: data.data.candidate,
              sdpMLineIndex: data.data.sdpMLineIndex,
              sdpMid: data.data.sdpMid,
            })
          )
        }
        break

      case 'peer-joined':
        console.log('Peer joined SFU room:', data.peer_id)
        this.globalStore.addNotification('New participant joined', 'info', 3000)
        break

      case 'peer-left':
        console.log('Peer left SFU room:', data.peer_id)
        // Remove participant stream
        if (data.peer_id && this.remoteStreams.value.has(data.peer_id)) {
          const stream = this.remoteStreams.value.get(data.peer_id)
          if (stream) {
            stream.getTracks().forEach(track => track.stop())
          }
          this.remoteStreams.value.delete(data.peer_id)
        }
        // Remove participant from list
        this.remoteParticipants.value = this.remoteParticipants.value.filter(
          p => p.id !== data.peer_id
        )
        this.globalStore.addNotification('Participant left', 'info', 3000)
        break

      default:
        console.warn('Unknown SFU message type:', data.type)
    }
  }

  /**
   * Close SFU connections
   */
  closeSFUConnections(): void {
    // Close SFU WebSocket
    if (this.sfuWebSocket.value) {
      this.sfuWebSocket.value.close(1000, 'Switching to P2P mode')
      this.sfuWebSocket.value = null
    }

    // Close SFU WebRTC connection
    if (this.sfuPeerConnection.value) {
      this.sfuPeerConnection.value.close()
      this.sfuPeerConnection.value = null
    }

    // Clear SFU room ID
    this.sfuRoomId.value = null
  }

  /**
   * Clean up SFU remote streams
   */
  cleanupSFUStreams(): void {
    // Clean up all SFU remote streams
    this.remoteStreams.value.forEach((stream, participantId) => {
      if (participantId.startsWith('sfu_')) {
        stream.getTracks().forEach(track => track.stop())
        this.remoteStreams.value.delete(participantId)
      }
    })

    // Remove SFU participants
    this.remoteParticipants.value = this.remoteParticipants.value.filter(
      p => !p.id.startsWith('sfu_')
    )
  }
}

