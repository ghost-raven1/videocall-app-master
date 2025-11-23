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
  public remoteParticipants: Ref<any[]>
  private globalStore: ReturnType<typeof useGlobalStore>
  private rtcConfiguration: RTCConfiguration
  private updateConnectionState?: () => void

  constructor(
    sfuWebSocket: Ref<WebSocket | null>,
    sfuPeerConnection: Ref<RTCPeerConnection | null>,
    sfuRoomId: Ref<string | null>,
    localStream: Ref<MediaStream | null>,
    localParticipantId: Ref<string | null>,
    remoteStreams: Ref<Map<string, MediaStream>>,
    remoteParticipants: Ref<any[]>,
    rtcConfiguration: RTCConfiguration,
    updateConnectionState?: () => void
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
    this.updateConnectionState = updateConnectionState
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
        // Close existing WebSocket connection if any
        if (this.sfuWebSocket.value) {
          // Remove event handlers to prevent triggering onclose reconnection
          this.sfuWebSocket.value.onclose = null
          this.sfuWebSocket.value.onerror = null
          this.sfuWebSocket.value.onmessage = null
          // Close with normal closure code to indicate intentional close
          if (this.sfuWebSocket.value.readyState === WebSocket.OPEN || 
              this.sfuWebSocket.value.readyState === WebSocket.CONNECTING) {
            this.sfuWebSocket.value.close(1000, 'Switching to new SFU connection')
          }
          this.sfuWebSocket.value = null
        }

        // Convert internal Docker hostname to browser-accessible hostname
        // Backend returns ws://streaming-node:8080/ws, but browser needs ws://localhost:8080/ws
        let browserWsUrl = sfuWsUrl
        
        // Check for environment variable override first
        const envWsUrl = import.meta.env.VITE_SFU_WS_URL
        if (envWsUrl) {
          // Use environment variable as base URL
          browserWsUrl = envWsUrl
        } else {
          // Replace internal Docker hostnames with localhost for browser
          if (browserWsUrl.includes('streaming-node:')) {
            browserWsUrl = browserWsUrl.replace('streaming-node:', 'localhost:')
          }
          // Also try nginx proxy path if using default setup
          if (browserWsUrl.includes('localhost:8080/ws')) {
            // Try using nginx proxy: ws://localhost/sfu/ws/
            const currentProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            browserWsUrl = `${currentProtocol}//${window.location.host}/sfu/ws/`
          }
        }
        
        // Build SFU WebSocket URL with room and peer parameters
        const url = new URL(browserWsUrl)
        // Preserve existing query params from original URL
        const originalUrl = new URL(sfuWsUrl)
        originalUrl.searchParams.forEach((value, key) => {
          url.searchParams.set(key, value)
        })
        // Add/override room and peer parameters
        url.searchParams.set('room', roomId)
        url.searchParams.set('peer', peerId)

        console.log(`🔌 Connecting to SFU WebSocket: ${url.toString()} (converted from ${sfuWsUrl})`)
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

    // Add local tracks to SFU connection (audio and video)
    this.localStream.value.getTracks().forEach(track => {
      console.log('Adding local track to SFU:', {
        kind: track.kind,
        id: track.id,
        enabled: track.enabled,
        readyState: track.readyState,
        label: track.label
      })
      sfuPC.addTrack(track, this.localStream.value!)
    })
    
    // Add screen share stream if available
    // Note: Screen share tracks should be added when screen sharing starts
    // This is handled separately in handleToggleScreenShare

    // Handle remote tracks from SFU
    sfuPC.ontrack = (event) => {
      console.log('Received track from SFU:', event)
      const stream = event.streams[0]
      const track = event.track
      
      if (stream && track) {
        // Try to get participant ID from stream ID or track label
        // SFU typically sends participant ID in stream ID or track label
        let participantId: string | null = null
        
        // Try to extract participant ID from stream ID
        if (stream.id) {
          // Stream ID might contain participant ID
          const streamIdMatch = stream.id.match(/participant[_-]?([a-f0-9-]+)/i)
          if (streamIdMatch) {
            participantId = streamIdMatch[1]
          }
        }
        
        // Try to get from track label
        if (!participantId && track.label) {
          const labelMatch = track.label.match(/participant[_-]?([a-f0-9-]+)/i)
          if (labelMatch) {
            participantId = labelMatch[1]
          }
        }
        
        // If still no participant ID, try to match by stream ID or use stream ID as fallback
        if (!participantId) {
          // Use stream ID as fallback participant ID
          participantId = stream.id || `sfu_stream_${Date.now()}`
          console.warn('Could not extract participant ID from SFU track, using stream ID as fallback:', participantId)
        }
        
        // Check if we already have this stream to avoid duplicates
        const existingStream = this.remoteStreams.value.get(participantId)
        if (existingStream && existingStream.id === stream.id) {
          console.log(`Stream ${stream.id} already exists for participant ${participantId}, skipping duplicate`)
          return
        }
        
        this.remoteStreams.value.set(participantId, stream)

        // Update or add participant - check by ID first to avoid duplicates
        const existingParticipant = this.remoteParticipants.value.find(p => p.id === participantId)
        if (existingParticipant) {
          // Update existing participant's stream
          existingParticipant.stream = stream
          // Merge tracks from same stream
          if (track.kind === 'video') {
            existingParticipant.isVideoEnabled = track.enabled
          } else if (track.kind === 'audio') {
            existingParticipant.isAudioEnabled = track.enabled
            // Ensure audio track is not muted
            if (track.enabled && !track.muted) {
              console.log(`Audio track enabled and not muted for participant ${participantId}`)
            }
          }
          existingParticipant.connectionState = 'connected'
          console.log(`Updated stream for existing participant ${participantId}`, {
            hasVideo: track.kind === 'video',
            hasAudio: track.kind === 'audio',
            enabled: track.enabled,
            muted: track.muted
          })
        } else {
          // Add new participant
          this.remoteParticipants.value.push({
            id: participantId,
            name: `Participant ${participantId.slice(-4)}`,
            stream: stream,
            isVideoEnabled: track.kind === 'video' ? track.enabled : false,
            isAudioEnabled: track.kind === 'audio' ? track.enabled : false,
            connectionState: 'connected',
          })
          console.log(`Added new participant ${participantId} from SFU track`, {
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted
          })
        }
        
        // Ensure audio tracks are not muted and are enabled
        if (track.kind === 'audio') {
          // Ensure audio track is enabled and not muted
          if (!track.enabled) {
            track.enabled = true
            console.log(`Enabled audio track for participant ${participantId}`)
          }
          if (track.muted) {
            // Try to unmute (may not work if track is muted by browser)
            console.warn(`Audio track is muted for participant ${participantId}, may need user interaction`)
          }
          console.log(`Audio track state for participant ${participantId}:`, {
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState
          })
        }
        
        // Check if this is a screen share track
        const isScreenShare = track.label && (
          track.label.toLowerCase().includes('screen') ||
          track.label.toLowerCase().includes('display') ||
          track.label.toLowerCase().includes('window') ||
          stream.id.toLowerCase().includes('screen')
        )
        
        if (isScreenShare) {
          // Handle screen share track separately
          console.log(`Screen share track received from SFU for participant ${participantId}`, {
            trackId: track.id,
            trackLabel: track.label,
            streamId: stream.id
          })
          
          // Get or create screen share stream for this participant
          // Note: remoteScreenShareStreams should be passed to constructor or accessed via store
          // For now, we'll update the participant's screenShareStream property
          const participant = this.remoteParticipants.value.find(p => p.id === participantId)
          if (participant) {
            participant.isScreenSharing = true
            participant.screenShareStream = stream
            console.log(`Screen share stream set for participant ${participantId}`)
          }
        }
        
        // Listen for track ended
        track.onended = () => {
          console.log(`Track ended for participant ${participantId}`, track.kind)
          const participant = this.remoteParticipants.value.find(p => p.id === participantId)
          if (participant) {
            if (track.kind === 'video') {
              // Check if it was a screen share track
              const wasScreenShare = track.label && (
                track.label.toLowerCase().includes('screen') ||
                track.label.toLowerCase().includes('display') ||
                track.label.toLowerCase().includes('window')
              )
              if (wasScreenShare) {
                participant.isScreenSharing = false
                participant.screenShareStream = null
                console.log(`Screen share ended for participant ${participantId}`)
              } else {
                participant.isVideoEnabled = false
              }
            } else if (track.kind === 'audio') {
              participant.isAudioEnabled = false
            }
          }
        }
      }
    }

    // Handle ICE candidates
    sfuPC.onicecandidate = (event) => {
      if (event.candidate) {
        // Only send if WebSocket is connected and ready
        if (this.sfuWebSocket.value && this.sfuWebSocket.value.readyState === WebSocket.OPEN) {
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
        } else {
          // Queue candidate for later if WebSocket is not ready yet
          console.debug('ICE candidate generated but WebSocket not ready, will be sent when connected')
        }
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
   * Add screen share track to SFU connection
   */
  addScreenShareTrack(screenShareStream: MediaStream): void {
    if (!this.sfuPeerConnection.value) {
      console.warn('SFU peer connection not available, cannot add screen share track')
      return
    }

    console.log('Adding screen share tracks to SFU connection:', {
      streamId: screenShareStream.id,
      tracks: screenShareStream.getTracks().map(t => ({
        kind: t.kind,
        id: t.id,
        enabled: t.enabled,
        label: t.label
      }))
    })

    // Add all tracks from screen share stream
    screenShareStream.getTracks().forEach(track => {
      // Remove old screen share track if exists
      const senders = this.sfuPeerConnection.value!.getSenders()
      const existingSender = senders.find(s => 
        s.track && s.track.kind === track.kind && (s.track.label || '').includes('screen')
      )
      if (existingSender) {
        this.sfuPeerConnection.value!.removeTrack(existingSender)
        console.log('Removed existing screen share track before adding new one')
      }

      // Add new screen share track
      this.sfuPeerConnection.value!.addTrack(track, screenShareStream)
      console.log('Added screen share track to SFU:', {
        kind: track.kind,
        id: track.id,
        label: track.label
      })
    })

    // Create new offer to negotiate screen share
    this.createAndSendOffer().catch(error => {
      console.error('Failed to create offer after adding screen share:', error)
    })
  }

  /**
   * Remove screen share track from SFU connection
   */
  removeScreenShareTrack(): void {
    if (!this.sfuPeerConnection.value) {
      return
    }

    const senders = this.sfuPeerConnection.value.getSenders()
    senders.forEach(sender => {
      if (sender.track && (sender.track.label || '').includes('screen')) {
        this.sfuPeerConnection.value!.removeTrack(sender)
        console.log('Removed screen share track from SFU:', sender.track.id)
      }
    })

    // Create new offer to negotiate removal
    this.createAndSendOffer().catch(error => {
      console.error('Failed to create offer after removing screen share:', error)
    })
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

    console.log('Created SFU offer:', {
      type: offer.type,
      sdpLines: offer.sdp.split('\n').filter(l => l.trim()).length,
      hasAudio: offer.sdp.includes('audio'),
      hasVideo: offer.sdp.includes('video')
    })

    // Check SDP size before sending (WebSocket has message size limits)
    const sdpSize = new Blob([offer.sdp]).size
    const messageSize = new Blob([JSON.stringify({
      type: 'offer',
      room_id: this.sfuRoomId.value || '',
      peer_id: this.localParticipantId.value || '',
      data: { sdp: offer.sdp, type: offer.type }
    })]).size
    
    console.log('SDP offer size check:', {
      sdpSize: sdpSize,
      messageSize: messageSize,
      sdpLines: offer.sdp.split('\n').length
    })
    
    // Check if message is too large (limit is usually 64KB, but we'll be conservative)
    if (messageSize > 60000) { // 60KB limit to be safe
      console.warn('SDP offer message is too large, attempting to reduce size:', messageSize, 'bytes')
      // Try to reduce SDP size by removing unnecessary candidates (keep only host candidates)
      const lines = offer.sdp.split('\n')
      const reducedLines = lines.filter(line => {
        // Keep all non-candidate lines
        if (!line.startsWith('a=candidate:')) return true
        // For candidates, keep only host candidates (typ host)
        return line.includes('typ host')
      })
      offer.sdp = reducedLines.join('\n')
      
      const newMessageSize = new Blob([JSON.stringify({
        type: 'offer',
        room_id: this.sfuRoomId.value || '',
        peer_id: this.localParticipantId.value || '',
        data: { sdp: offer.sdp, type: offer.type }
      })]).size
      
      console.log('Reduced SDP offer size:', {
        originalSize: messageSize,
        newSize: newMessageSize,
        reduction: ((messageSize - newMessageSize) / messageSize * 100).toFixed(1) + '%'
      })
      
      // If still too large, throw error to fallback to P2P
      if (newMessageSize > 60000) {
        throw new Error(`SDP offer too large even after reduction: ${newMessageSize} bytes. Falling back to P2P mode.`)
      }
    }
    
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
      try {
        this.sfuWebSocket.value.send(JSON.stringify(message))
      } catch (error) {
        console.error('Failed to send SFU WebSocket message:', error, message)
      }
    } else {
      const state = this.sfuWebSocket.value?.readyState
      const stateName = state === WebSocket.CONNECTING ? 'CONNECTING' 
                     : state === WebSocket.OPEN ? 'OPEN'
                     : state === WebSocket.CLOSING ? 'CLOSING'
                     : state === WebSocket.CLOSED ? 'CLOSED'
                     : 'NOT_CREATED'
      console.warn(`SFU WebSocket not ready (state: ${stateName}), cannot send message:`, message.type)
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
        
        // Update participant ID if we have a temporary participant from ontrack
        // Look for participants without proper ID or with temporary SFU ID
        if (data.peer_id) {
          // Check if we have a stream for this peer ID
          if (this.remoteStreams.value.has(data.peer_id)) {
            // Update existing participant if exists
            const existingParticipant = this.remoteParticipants.value.find(p => p.id === data.peer_id)
            if (existingParticipant) {
              existingParticipant.connectionState = 'connected'
              console.log(`Updated participant ${data.peer_id} on peer-joined`)
            }
          } else {
            // Add participant if not exists (stream will come via ontrack)
            const existingParticipant = this.remoteParticipants.value.find(p => p.id === data.peer_id)
            if (!existingParticipant) {
              this.remoteParticipants.value.push({
                id: data.peer_id,
                name: `Participant ${data.peer_id.slice(-4)}`,
                stream: null,
                isVideoEnabled: false,
                isAudioEnabled: false,
                connectionState: 'connecting',
              })
              console.log(`Added participant ${data.peer_id} on peer-joined (waiting for stream)`)
            }
          }
        }
        
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

