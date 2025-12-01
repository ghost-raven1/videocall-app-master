// src/stores/webrtc-sfu.ts - SFU mode logic extracted from webrtc.ts
import { Ref } from 'vue'
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
  private iceCandidateQueue: RTCIceCandidate[] = []
  private iceCandidateBatchTimer: ReturnType<typeof setTimeout> | null = null
  private readonly ICE_CANDIDATE_BATCH_DELAY = 50 // ms - batch ICE candidates every 50ms
  private readonly MAX_ICE_CANDIDATES_PER_BATCH = 10
  private readonly MAX_MESSAGE_SIZE = 120000 // 120KB - less aggressive limit to avoid unnecessary SDP/ICE truncation
  private bandwidthMonitor: ReturnType<typeof setInterval> | null = null
  private lastBandwidthCheck: number = 0
  private currentBandwidth: number = 0
  // Диагностика ICE/SDP/Answer для локализации зависаний "connecting"
  private diagnostics: {
    totalIceCandidatesSent: number
    batchesSent: number
    lastBatchSizeBytes: number
    lastOfferSizeBytes: number
    lastAnswerReceivedAt: number | null
  } = {
    totalIceCandidatesSent: 0,
    batchesSent: 0,
    lastBatchSizeBytes: 0,
    lastOfferSizeBytes: 0,
    lastAnswerReceivedAt: null,
  }

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
            // Try using nginx proxy. In dev, front-end may run on :3001 while nginx on :3000.
            const currentProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const host = window.location.hostname
            const port = window.location.port
            const proxyPort = port === '3001' ? '3000' : port || (currentProtocol === 'wss:' ? '443' : '80')
            const proxyHost = `${host}:${proxyPort}`
            browserWsUrl = `${currentProtocol}//${proxyHost}/sfu/ws/`
            console.log(`Using SFU proxy via nginx at ${browserWsUrl} (front-end port: ${port})`)
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

    // Handle remote tracks from SFU with optimized processing for large data streams
    sfuPC.ontrack = (event) => {
      console.log('🎥 Received track from SFU:', {
        trackId: event.track.id,
        trackKind: event.track.kind,
        trackLabel: event.track.label,
        trackEnabled: event.track.enabled,
        trackReadyState: event.track.readyState,
        streamId: event.streams[0]?.id,
        streamsCount: event.streams.length,
        transceiver: event.transceiver,
        receiver: event.receiver,
        connectionState: sfuPC.connectionState,
        iceConnectionState: sfuPC.iceConnectionState,
        signalingState: sfuPC.signalingState
      })
      
      const stream = event.streams[0]
      const track = event.track
      
      if (stream && track) {
        console.log('✅ Processing SFU track:', {
          streamId: stream.id,
          trackId: track.id,
          trackKind: track.kind,
          streamActive: stream.active,
          trackActive: track.readyState === 'live',
          currentParticipants: this.remoteParticipants.value.length
        })
        
        // Optimize track processing for large data streams
        // Use requestAnimationFrame to batch track processing and avoid blocking
        requestAnimationFrame(() => {
          this.processSFUTrack(stream, track)
        })
      } else {
        console.warn('⚠️ Received track from SFU but stream or track is missing:', {
          hasStream: !!stream,
          hasTrack: !!track,
          streamsLength: event.streams.length
        })
      }
    }

    // Handle ICE candidates with batching for large data streams
    sfuPC.onicecandidate = (event) => {
      if (event.candidate) {
        // Queue candidate for batching
        this.iceCandidateQueue.push(event.candidate)
        
        // If queue is full, send immediately
        if (this.iceCandidateQueue.length >= this.MAX_ICE_CANDIDATES_PER_BATCH) {
          this.flushIceCandidates()
        } else {
          // Schedule batch send if not already scheduled
          if (!this.iceCandidateBatchTimer) {
            this.iceCandidateBatchTimer = setTimeout(() => {
              this.flushIceCandidates()
            }, this.ICE_CANDIDATE_BATCH_DELAY)
          }
        }
      } else {
        // null candidate means end of candidates - flush queue immediately
        if (this.iceCandidateQueue.length > 0) {
          this.flushIceCandidates()
        }
        // Логируем итоговое количество отправленных ICE-кандидатов на этот оффер
        console.log('🧊 ICE gathering complete for SFU offer:', {
          totalIceCandidatesSent: this.diagnostics.totalIceCandidatesSent,
          batchesSent: this.diagnostics.batchesSent,
          lastBatchSizeBytes: this.diagnostics.lastBatchSizeBytes,
        })
      }
    }

    // Handle connection state
    sfuPC.onconnectionstatechange = () => {
      const state = sfuPC.connectionState
      console.log('SFU connection state changed:', state, {
        iceConnectionState: sfuPC.iceConnectionState,
        signalingState: sfuPC.signalingState
      })
      
      // Update connection state callback if provided
      if (this.updateConnectionState) {
        this.updateConnectionState()
      }
      
      if (state === 'connected') {
        console.log('✅ SFU peer connection connected!')
        this.globalStore.addNotification('Connected to SFU server', 'success', 3000)
        // Start bandwidth monitoring for large data streams
        this.startBandwidthMonitoring(sfuPC)
      } else if (state === 'failed') {
        console.error('❌ SFU peer connection failed')
        this.globalStore.addNotification('SFU connection failed, falling back to P2P', 'error', 5000)
        // Stop bandwidth monitoring
        this.stopBandwidthMonitoring()
        // Trigger fallback to P2P (will be handled by parent store)
      } else if (state === 'disconnected' || state === 'closed') {
        console.warn('⚠️ SFU peer connection disconnected/closed')
        // Stop bandwidth monitoring
        this.stopBandwidthMonitoring()
      } else if (state === 'connecting') {
        console.log('🔄 SFU peer connection connecting...')
      }
    }
    
    // Also monitor ICE connection state for more detailed info
    sfuPC.oniceconnectionstatechange = () => {
      console.log('SFU ICE connection state:', sfuPC.iceConnectionState, {
        connectionState: sfuPC.connectionState,
        signalingState: sfuPC.signalingState
      })
    }

    return sfuPC
  }

  /**
   * Process SFU track with optimizations for large data streams and multiple participants
   */
  private processSFUTrack(stream: MediaStream, track: MediaStreamTrack): void {
        // Try to get participant ID from stream ID or track label
        // SFU creates tracks with stream ID format: originalStreamID_peerID
        // So we need to extract peerID from the stream ID
        let participantId: string | null = null
        
        // Try to extract participant ID from stream ID
        // Stream ID format from SFU: originalStreamID_peerID
        if (stream.id) {
          // Check if stream ID contains peer ID (format: originalStreamID_peerID)
          // SFU creates tracks with format: originalStreamID_peerID
          const parts = stream.id.split('_')
          if (parts.length >= 2) {
            // Last part should be peer ID
            const potentialPeerID = parts[parts.length - 1]
            // Check if it looks like a peer ID:
            // - Starts with "peer_" (e.g., "peer_1234567890")
            // - Or is a UUID (e.g., "12345678-1234-1234-1234-123456789012")
            // - Or matches peer ID pattern (e.g., "peer1234567890")
            if (potentialPeerID.startsWith('peer_') || 
                /^[a-f0-9-]{36}$/i.test(potentialPeerID) ||
                /^peer\d+$/i.test(potentialPeerID)) {
              participantId = potentialPeerID
              console.log(`Extracted participant ID from stream ID: ${participantId} (from ${stream.id})`)
            }
          }
          
          // Also try regex match for participant ID patterns
          if (!participantId) {
            const streamIdMatch = stream.id.match(/participant[_-]?([a-f0-9-]+)/i)
            if (streamIdMatch) {
              participantId = streamIdMatch[1]
            }
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
        
    // Check if we already have this stream to avoid duplicates (optimized for large participant lists)
        const existingStream = this.remoteStreams.value.get(participantId)
        if (existingStream && existingStream.id === stream.id) {
          console.log(`Stream ${stream.id} already exists for participant ${participantId}, skipping duplicate`)
          return
        }
    
    // For large data streams, optimize track constraints based on participant count
    const participantCount = this.remoteParticipants.value.length
    if (participantCount > 5 && track.kind === 'video') {
      // For many participants, reduce video quality to save bandwidth
      const settings = track.getSettings()
      if (settings.width && settings.width > 640) {
        // Apply constraints to reduce bandwidth for large streams
        track.applyConstraints({
          width: { ideal: 640, max: 1280 },
          height: { ideal: 360, max: 720 },
          frameRate: { ideal: 15, max: 30 }
        }).catch(error => {
          console.warn(`Failed to apply constraints for participant ${participantId}:`, error)
        })
      }
    }

    // Update or add participant - optimized lookup for large participant lists
    // First, try to find by exact ID
    let existingParticipantIndex = this.remoteParticipants.value.findIndex(p => p.id === participantId)
    let tempParticipantId: string | null = null
    
    // If not found, try to find by temporary ID (starts with "temp_")
    // This happens when participant joins before receiving tracks
    if (existingParticipantIndex < 0) {
      // Look for participants with temporary IDs that don't have a stream yet
      // We'll update the first temporary participant without a stream
      existingParticipantIndex = this.remoteParticipants.value.findIndex(p => 
        p.id.startsWith('temp_') && !p.stream
      )
      
      if (existingParticipantIndex >= 0) {
        // Update temporary participant with real ID and stream
        const tempParticipant = this.remoteParticipants.value[existingParticipantIndex]
        tempParticipantId = tempParticipant.id
        console.log(`🔄 Updating temporary participant ${tempParticipant.id} with real ID ${participantId} and stream`)
        tempParticipant.id = participantId
        tempParticipant.name = `Participant ${participantId.slice(-4)}`
        
        // Remove old stream entry if exists for temporary ID
        if (this.remoteStreams.value.has(tempParticipantId)) {
          this.remoteStreams.value.delete(tempParticipantId)
        }
      } else {
        console.log(`ℹ️ No temporary participant found for ${participantId}, will add as new participant`)
      }
    }
    
    // Set stream for participant (after updating ID if needed)
    this.remoteStreams.value.set(participantId, stream)
    
    if (existingParticipantIndex >= 0) {
          // Update existing participant's stream
      const existingParticipant = this.remoteParticipants.value[existingParticipantIndex]
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
          console.log(`✅ Updated stream for existing participant ${participantId}`, {
            hasVideo: track.kind === 'video',
            hasAudio: track.kind === 'audio',
            enabled: track.enabled,
            muted: track.muted,
            streamId: stream.id
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
          console.log(`➕ Added new participant ${participantId} from SFU track`, {
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted,
            streamId: stream.id
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
    // Диагностика размеров SDP/сообщения
    this.diagnostics.lastOfferSizeBytes = messageSize
    
    console.log('SDP offer size check:', {
      sdpSize: sdpSize,
      messageSize: messageSize,
      sdpLines: offer.sdp.split('\n').length
    })
    
    // Check if message is too large (use MAX_MESSAGE_SIZE for consistency)
    if (messageSize > this.MAX_MESSAGE_SIZE) {
      console.warn('SDP offer message is too large, attempting to reduce size:', messageSize, 'bytes')
      
      // Try multiple reduction strategies for large data streams
      const lines = offer.sdp.split('\n')
      let reducedLines = lines
      
      // Strategy 1: Remove non-host candidates (keep only host candidates)
      reducedLines = reducedLines.filter(line => {
        if (!line.startsWith('a=candidate:')) return true
        return line.includes('typ host')
      })
      
      // Strategy 2: If still too large, keep only first 20 candidates per media line
      let messageSizeAfterReduction = new Blob([JSON.stringify({
        type: 'offer',
        room_id: this.sfuRoomId.value || '',
        peer_id: this.localParticipantId.value || '',
        data: { sdp: reducedLines.join('\n'), type: offer.type }
      })]).size
      
      if (messageSizeAfterReduction > this.MAX_MESSAGE_SIZE) {
        console.warn('SDP still too large after removing non-host candidates, limiting candidates per media line')
        const mediaLineIndices: number[] = []
        reducedLines.forEach((line, index) => {
          if (line.startsWith('m=')) {
            mediaLineIndices.push(index)
          }
        })
        
        // Keep only first 20 candidates per media line
        let candidateCount = 0
        reducedLines = reducedLines.filter((line) => {
          if (line.startsWith('m=')) {
            candidateCount = 0
            return true
          }
          if (line.startsWith('a=candidate:')) {
            candidateCount++
            return candidateCount <= 20
          }
          return true
        })
      }
      
      offer.sdp = reducedLines.join('\n')
      
      const finalMessageSize = new Blob([JSON.stringify({
        type: 'offer',
        room_id: this.sfuRoomId.value || '',
        peer_id: this.localParticipantId.value || '',
        data: { sdp: offer.sdp, type: offer.type }
      })]).size
      
      console.log('Reduced SDP offer size:', {
        originalSize: messageSize,
        finalSize: finalMessageSize,
        reduction: ((messageSize - finalMessageSize) / messageSize * 100).toFixed(1) + '%',
        originalLines: lines.length,
        reducedLines: reducedLines.length
      })
      
      // If still too large, throw error to fallback to P2P
      if (finalMessageSize > this.MAX_MESSAGE_SIZE) {
        throw new Error(`SDP offer too large even after reduction: ${finalMessageSize} bytes (limit: ${this.MAX_MESSAGE_SIZE}). Falling back to P2P mode.`)
      }
    }
    
    // Send offer to SFU via WebSocket
    try {
      const peerId = this.localParticipantId.value
      if (!peerId) {
        console.error('❌ Cannot send offer: localParticipantId is not set')
        throw new Error('localParticipantId is required to send offer')
      }
      
      const offerMessage = {
        type: 'offer',
        room_id: this.sfuRoomId.value || '',
        peer_id: peerId,
        data: {
          sdp: offer.sdp,
          type: offer.type,
        },
      }
      console.log('📤 Sending offer to SFU:', {
        type: offerMessage.type,
        room_id: offerMessage.room_id,
        peer_id: offerMessage.peer_id,
        sdpLength: offerMessage.data.sdp.length
      })
      // Логируем реальный размер JSON-посылки c оффером
      const offerMessageSize = new Blob([JSON.stringify(offerMessage)]).size
      this.diagnostics.lastOfferSizeBytes = offerMessageSize
      console.log('📏 SFU offer message size:', {
        bytes: offerMessageSize,
        limit: this.MAX_MESSAGE_SIZE
      })
      this.sendSFUWebSocketMessage(offerMessage)
      console.log('✅ Offer sent to SFU successfully')
    } catch (error) {
      console.error('❌ Failed to send SFU offer:', error)
      // Re-throw to trigger fallback to P2P
      throw error
    }
  }

  /**
   * Flush queued ICE candidates as a batch
   */
  private flushIceCandidates(): void {
    if (this.iceCandidateBatchTimer) {
      clearTimeout(this.iceCandidateBatchTimer)
      this.iceCandidateBatchTimer = null
    }

    if (this.iceCandidateQueue.length === 0) {
      return
    }

    // Only send if WebSocket is connected and ready
    if (!this.sfuWebSocket.value || this.sfuWebSocket.value.readyState !== WebSocket.OPEN) {
      console.debug('SFU WebSocket not ready, queuing ICE candidates for later')
      // Re-schedule flush when WebSocket is ready
      if (!this.iceCandidateBatchTimer) {
        this.iceCandidateBatchTimer = setTimeout(() => {
          this.flushIceCandidates()
        }, 100)
      }
      return
    }

    // Send candidates as batch, but check size first
    let candidates = this.iceCandidateQueue.splice(0, this.MAX_ICE_CANDIDATES_PER_BATCH)
    
    // Check message size and reduce batch if needed
    let batchMessage = {
      type: 'ice-candidates-batch',
      room_id: this.sfuRoomId.value || '',
      peer_id: this.localParticipantId.value || '',
      data: {
        candidates: candidates.map(c => ({
          candidate: c.candidate,
          sdpMLineIndex: c.sdpMLineIndex,
          sdpMid: c.sdpMid,
        })),
      },
    }
    
    let messageSize = new Blob([JSON.stringify(batchMessage)]).size
    
    // If batch is too large, reduce it
    while (messageSize > this.MAX_MESSAGE_SIZE && candidates.length > 1) {
      // Put last candidate back in queue
      const lastCandidate = candidates.pop()
      if (lastCandidate) {
        this.iceCandidateQueue.unshift(lastCandidate)
      }
      
      // Recalculate message size
      batchMessage = {
        type: 'ice-candidates-batch',
        room_id: this.sfuRoomId.value || '',
        peer_id: this.localParticipantId.value || '',
        data: {
          candidates: candidates.map(c => ({
            candidate: c.candidate,
            sdpMLineIndex: c.sdpMLineIndex,
            sdpMid: c.sdpMid,
          })),
        },
      }
      messageSize = new Blob([JSON.stringify(batchMessage)]).size
      
      console.log(`Reducing ICE candidate batch size: ${candidates.length} candidates, ${messageSize} bytes`)
    }
    
    // For large batches, send as array
    try {
      if (candidates.length > 1) {
        console.log(`Sending ICE candidate batch: ${candidates.length} candidates, ${messageSize} bytes`)
        this.diagnostics.totalIceCandidatesSent += candidates.length
        this.diagnostics.batchesSent += 1
        this.diagnostics.lastBatchSizeBytes = messageSize
        this.sendSFUWebSocketMessage(batchMessage)
      } else if (candidates.length === 1) {
        // Single candidate - send as before for compatibility
        const singleMessage = {
          type: 'ice-candidate',
          room_id: this.sfuRoomId.value || '',
          peer_id: this.localParticipantId.value || '',
          data: {
            candidate: candidates[0].candidate,
            sdpMLineIndex: candidates[0].sdpMLineIndex,
            sdpMid: candidates[0].sdpMid,
          },
        }
        const singleSize = new Blob([JSON.stringify(singleMessage)]).size
        this.diagnostics.totalIceCandidatesSent += 1
        this.diagnostics.batchesSent += 1
        this.diagnostics.lastBatchSizeBytes = singleSize
        this.sendSFUWebSocketMessage(singleMessage)
      }
    } catch (error) {
      console.error('Failed to send ICE candidates:', error)
      // Put candidates back in queue to retry later
      this.iceCandidateQueue.unshift(...candidates)
      // Don't throw - just log and retry later
    }

    // If more candidates in queue, schedule next flush
    if (this.iceCandidateQueue.length > 0) {
      this.iceCandidateBatchTimer = setTimeout(() => {
        this.flushIceCandidates()
      }, this.ICE_CANDIDATE_BATCH_DELAY)
    }
  }

  /**
   * Send message to SFU WebSocket with size checking for large data streams
   */
  sendSFUWebSocketMessage(message: SFUWebSocketMessage): void {
    if (this.sfuWebSocket.value && this.sfuWebSocket.value.readyState === WebSocket.OPEN) {
      try {
        const messageStr = JSON.stringify(message)
        const messageSize = new Blob([messageStr]).size
        
        // Check message size (WebSocket limit is usually 64KB, but be conservative)
        if (messageSize > this.MAX_MESSAGE_SIZE) {
          console.error('SFU WebSocket message too large, cannot send:', {
            type: message.type,
            size: messageSize,
            limit: this.MAX_MESSAGE_SIZE,
            message: messageStr.substring(0, 200) + '...'
          })
          
          // Don't send if message is too large - it will cause 1009 error
          if (message.type === 'offer' && message.data?.sdp) {
            // SDP offer should have been reduced already
            throw new Error(`SDP offer too large (${messageSize} bytes) even after reduction. Cannot send.`)
          }
          
          // For other large messages, throw error to prevent 1009
          throw new Error(`Message too large (${messageSize} bytes) for WebSocket. Type: ${message.type}`)
        }
        
        // Log large messages for debugging
        if (messageSize > 30000) {
          console.warn('Large SFU WebSocket message:', {
            type: message.type,
            size: messageSize,
            percentage: ((messageSize / this.MAX_MESSAGE_SIZE) * 100).toFixed(1) + '%'
          })
        }
        
        console.log('📡 Sending WebSocket message to SFU:', {
          type: message.type,
          size: messageSize,
          readyState: this.sfuWebSocket.value.readyState
        })
        this.sfuWebSocket.value.send(messageStr)
        console.log('✅ WebSocket message sent to SFU')
      } catch (error) {
        console.error('Failed to send SFU WebSocket message:', error, message)
        // If error is due to message size, handle it gracefully
        if (error instanceof Error && (error.message.includes('size') || error.message.includes('too large'))) {
          console.error('Message too large for WebSocket, preventing 1009 error')
          // Don't try to send - this will prevent 1009 error
          // The error will be handled by the caller
          throw error
        }
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
    console.log('📨 Received SFU WebSocket message:', data.type, data)

    switch (data.type) {
      case 'offer':
        // Handle renegotiation offer from SFU (when new tracks are added)
        console.log('🔄 Received renegotiation offer from SFU:', {
          hasPeerConnection: !!this.sfuPeerConnection.value,
          hasData: !!data.data,
          sdpLength: data.data?.sdp?.length || 0
        })
        if (this.sfuPeerConnection.value && data.data) {
          try {
            // Set remote description from offer
            await this.sfuPeerConnection.value.setRemoteDescription(
              new RTCSessionDescription({
                type: 'offer',
                sdp: data.data.sdp,
              })
            )
            console.log('✅ Set remote description from SFU renegotiation offer')
            
            // Create answer
            const answer = await this.sfuPeerConnection.value.createAnswer()
            await this.sfuPeerConnection.value.setLocalDescription(answer)
            console.log('✅ Created answer for SFU renegotiation')
            
            // Send answer back to SFU
            this.sendSFUWebSocketMessage({
              type: 'answer',
              room_id: data.room_id || '',
              peer_id: data.peer_id || '',
              data: {
                sdp: answer.sdp,
                type: answer.type,
              },
            })
            console.log('✅ Sent answer for SFU renegotiation')
          } catch (error) {
            console.error('❌ Failed to handle SFU renegotiation offer:', error)
          }
        } else {
          console.warn('⚠️ Cannot handle renegotiation offer: missing peer connection or data')
        }
        break

      case 'answer':
        console.log('✅ Received answer from SFU:', {
          hasPeerConnection: !!this.sfuPeerConnection.value,
          hasData: !!data.data,
          sdpLength: data.data?.sdp?.length || 0
        })
        // Фиксируем момент получения answer от SFU
        this.diagnostics.lastAnswerReceivedAt = Date.now()
        if (this.sfuPeerConnection.value && data.data) {
          try {
          await this.sfuPeerConnection.value.setRemoteDescription(
            new RTCSessionDescription({
              type: 'answer',
              sdp: data.data.sdp,
            })
          )
            console.log('✅ Set remote description from SFU answer successfully')
          } catch (error) {
            console.error('❌ Failed to set remote description from SFU answer:', error)
          }
        } else {
          console.warn('⚠️ Cannot set remote description: missing peer connection or data')
        }
        break

      case 'ice-candidate':
        if (this.sfuPeerConnection.value && data.data) {
          try {
          await this.sfuPeerConnection.value.addIceCandidate(
            new RTCIceCandidate({
              candidate: data.data.candidate,
              sdpMLineIndex: data.data.sdpMLineIndex,
              sdpMid: data.data.sdpMid,
            })
          )
          } catch (error) {
            console.error('Failed to add ICE candidate:', error)
          }
        }
        break

      case 'ice-candidates-batch':
        // Handle batched ICE candidates for large data streams
        if (this.sfuPeerConnection.value && data.data?.candidates) {
          const candidates = data.data.candidates
          console.log(`Processing batch of ${candidates.length} ICE candidates`)
          
          // Add candidates in parallel for better performance
          const addPromises = candidates.map(async (candidateData: any) => {
            try {
              await this.sfuPeerConnection.value!.addIceCandidate(
                new RTCIceCandidate({
                  candidate: candidateData.candidate,
                  sdpMLineIndex: candidateData.sdpMLineIndex,
                  sdpMid: candidateData.sdpMid,
                })
              )
            } catch (error) {
              console.error('Failed to add batched ICE candidate:', error)
            }
          })
          
          await Promise.allSettled(addPromises)
        }
        break

      case 'peer-joined':
        console.log('👤 Peer joined SFU room:', data.peer_id, {
          currentParticipants: this.remoteParticipants.value.length,
          remoteStreams: this.remoteStreams.value.size
        })
        
        // Update participant ID if we have a temporary participant from ontrack
        // Look for participants without proper ID or with temporary SFU ID
        if (data.peer_id) {
          // Check if we have a stream for this peer ID
          if (this.remoteStreams.value.has(data.peer_id)) {
            // Update existing participant if exists
            const existingParticipant = this.remoteParticipants.value.find(p => p.id === data.peer_id)
            if (existingParticipant) {
              existingParticipant.connectionState = 'connected'
              console.log(`✅ Updated participant ${data.peer_id} on peer-joined (has stream)`)
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
              console.log(`➕ Added participant ${data.peer_id} on peer-joined (waiting for stream)`)
            } else {
              console.log(`ℹ️ Participant ${data.peer_id} already exists, updating connection state`)
              existingParticipant.connectionState = 'connecting'
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
    // Stop bandwidth monitoring
    this.stopBandwidthMonitoring()
    
    // Flush any remaining ICE candidates
    if (this.iceCandidateBatchTimer) {
      clearTimeout(this.iceCandidateBatchTimer)
      this.iceCandidateBatchTimer = null
    }
    this.iceCandidateQueue = []
    
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

  /**
   * Start bandwidth monitoring for large data streams
   */
  private startBandwidthMonitoring(peerConnection: RTCPeerConnection): void {
    this.stopBandwidthMonitoring() // Stop any existing monitoring
    
    this.lastBandwidthCheck = Date.now()
    this.currentBandwidth = 0
    
    // Monitor bandwidth every 2 seconds
    this.bandwidthMonitor = setInterval(async () => {
      try {
        const stats = await peerConnection.getStats()
        let totalBytesReceived = 0
        let totalBytesSent = 0
        
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' || report.type === 'media-source') {
            totalBytesReceived += (report as any).bytesReceived || 0
          }
          if (report.type === 'outbound-rtp') {
            totalBytesSent += (report as any).bytesSent || 0
          }
        })
        
        const now = Date.now()
        const timeDelta = (now - this.lastBandwidthCheck) / 1000 // seconds
        
        if (timeDelta > 0) {
          const receivedBandwidth = (totalBytesReceived * 8) / timeDelta / 1000 // kbps
          const sentBandwidth = (totalBytesSent * 8) / timeDelta / 1000 // kbps
          
          this.currentBandwidth = Math.max(receivedBandwidth, sentBandwidth)
          
          // Log bandwidth for large streams (> 1 Mbps)
          if (this.currentBandwidth > 1000) {
            console.log(`SFU bandwidth: ${this.currentBandwidth.toFixed(2)} kbps (${(this.currentBandwidth / 1000).toFixed(2)} Mbps)`)
          }
          
          // Warn if bandwidth is very high (> 5 Mbps) - might indicate issues
          if (this.currentBandwidth > 5000) {
            console.warn(`High SFU bandwidth detected: ${(this.currentBandwidth / 1000).toFixed(2)} Mbps`)
          }
        }
        
        this.lastBandwidthCheck = now
      } catch (error) {
        console.error('Failed to get bandwidth stats:', error)
      }
    }, 2000) // Check every 2 seconds
  }

  /**
   * Stop bandwidth monitoring
   */
  private stopBandwidthMonitoring(): void {
    if (this.bandwidthMonitor) {
      clearInterval(this.bandwidthMonitor)
      this.bandwidthMonitor = null
    }
    this.currentBandwidth = 0
    this.lastBandwidthCheck = 0
  }

  /**
   * Get current bandwidth usage
   */
  getCurrentBandwidth(): number {
    return this.currentBandwidth
  }
}
