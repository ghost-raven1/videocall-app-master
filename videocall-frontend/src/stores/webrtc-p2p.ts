// src/stores/webrtc-p2p.ts - P2P mode logic extracted from webrtc.ts
import { ref, Ref } from 'vue'
import { useGlobalStore } from './global'

/**
 * P2P connection manager
 */
export class P2PConnectionManager {
  private peerConnections: Ref<Map<string, RTCPeerConnection>>
  private localStream: Ref<MediaStream | null>
  private remoteStreams: Ref<Map<string, MediaStream>>
  private remoteParticipants: Ref<any[]>
  private websocket: Ref<WebSocket | null>
  private localParticipantId: Ref<string | null>
  private globalStore: ReturnType<typeof useGlobalStore>
  private rtcConfiguration: RTCConfiguration

  constructor(
    peerConnections: Ref<Map<string, RTCPeerConnection>>,
    localStream: Ref<MediaStream | null>,
    remoteStreams: Ref<Map<string, MediaStream>>,
    remoteParticipants: Ref<any[]>,
    websocket: Ref<WebSocket | null>,
    localParticipantId: Ref<string | null>,
    rtcConfiguration: RTCConfiguration
  ) {
    this.peerConnections = peerConnections
    this.localStream = localStream
    this.remoteStreams = remoteStreams
    this.remoteParticipants = remoteParticipants
    this.websocket = websocket
    this.localParticipantId = localParticipantId
    this.globalStore = useGlobalStore()
    this.rtcConfiguration = rtcConfiguration
  }

  /**
   * Create peer connection for a participant
   */
  async createPeerConnectionForParticipant(participantId: string): Promise<RTCPeerConnection> {
    // Close existing connection if any
    if (this.peerConnections.value.has(participantId)) {
      this.peerConnections.value.get(participantId)?.close()
      this.peerConnections.value.delete(participantId)
    }

    const pc = new RTCPeerConnection(this.rtcConfiguration)
    this.peerConnections.value.set(participantId, pc)

    // Add local tracks
    if (this.localStream.value) {
      this.localStream.value.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream.value!)
      })
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log('Received track from participant:', participantId)
      const stream = event.streams[0]
      if (stream) {
        this.remoteStreams.value.set(participantId, stream)

        // Update participant stream
        const participant = this.remoteParticipants.value.find(p => p.id === participantId)
        if (participant) {
          participant.stream = stream
          participant.connectionState = 'connected'
        }
      }
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.websocket.value) {
        this.sendWebSocketMessage({
          type: 'ice_candidate',
          target: participantId,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          },
        })
      }
    }

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`P2P connection state for ${participantId}:`, pc.connectionState)
      const participant = this.remoteParticipants.value.find(p => p.id === participantId)
      if (participant) {
        participant.connectionState = pc.connectionState
      }

      if (pc.connectionState === 'connected') {
        this.globalStore.addNotification(`Connected to ${participantId}`, 'success', 3000)
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.globalStore.addNotification(`Connection to ${participantId} lost`, 'warning', 3000)
      }
    }

    return pc
  }

  /**
   * Create and send offer for a participant
   */
  async createOfferForParticipant(participantId: string): Promise<void> {
    const pc = this.peerConnections.value.get(participantId)
    if (!pc) {
      throw new Error(`Peer connection not found for participant: ${participantId}`)
    }

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      this.sendWebSocketMessage({
        type: 'webrtc_offer',
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
        target: participantId,
      })
    } catch (error) {
      console.error(`Failed to create offer for participant ${participantId}:`, error)
      throw error
    }
  }

  /**
   * Handle incoming offer from a participant
   */
  async handleOffer(participantId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    let pc = this.peerConnections.value.get(participantId)

    if (!pc) {
      pc = await this.createPeerConnectionForParticipant(participantId)
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer))

    // Create and send answer
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    this.sendWebSocketMessage({
      type: 'webrtc_answer',
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
      target: participantId,
    })
  }

  /**
   * Handle incoming answer from a participant
   */
  async handleAnswer(participantId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections.value.get(participantId)
    if (!pc) {
      console.warn(`Peer connection not found for participant: ${participantId}`)
      return
    }

    await pc.setRemoteDescription(new RTCSessionDescription(answer))
  }

  /**
   * Handle incoming ICE candidate from a participant
   */
  async handleICECandidate(participantId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.value.get(participantId)
    if (!pc) {
      console.warn(`Peer connection not found for participant: ${participantId}`)
      return
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (error) {
      console.error(`Failed to add ICE candidate for participant ${participantId}:`, error)
    }
  }

  /**
   * Close peer connection for a participant
   */
  closePeerConnection(participantId: string): void {
    const pc = this.peerConnections.value.get(participantId)
    if (pc) {
      pc.close()
      this.peerConnections.value.delete(participantId)
    }

    // Clean up remote stream
    const stream = this.remoteStreams.value.get(participantId)
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      this.remoteStreams.value.delete(participantId)
    }
  }

  /**
   * Close all P2P connections
   */
  closeAllConnections(): void {
    this.peerConnections.value.forEach((pc, participantId) => {
      pc.close()
      this.closePeerConnection(participantId)
    })
    this.peerConnections.value.clear()
  }

  /**
   * Send WebSocket message
   */
  private sendWebSocketMessage(message: any): void {
    if (this.websocket.value && this.websocket.value.readyState === WebSocket.OPEN) {
      this.websocket.value.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, message not sent:', message)
    }
  }
}

