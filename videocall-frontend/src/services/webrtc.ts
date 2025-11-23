// src/services/webrtc.js - WebRTC utility functions
import { webrtcRetryService } from './webrtc-retry'

export const webrtcService = {
  /**
   * Get STUN/TURN server configuration
   */
  getIceServerConfig() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // Add TURN servers for production
        // {
        //   urls: 'turn:your-turn-server.com:3478',
        //   username: 'username',
        //   credential: 'password'
        // }
      ],
      iceCandidatePoolSize: 10,
    }
  },

  /**
   * Test WebRTC support
   */
  isWebRTCSupported() {
    return !!(
      window.RTCPeerConnection ||
      window.webkitRTCPeerConnection ||
      window.mozRTCPeerConnection
    )
  },

  /**
   * Get WebRTC statistics
   */
  async getConnectionStats(peerConnection) {
    if (!peerConnection) return null

    try {
      const stats = await peerConnection.getStats()
      const result: {
        video: {
          inbound?: {
            bytesReceived?: number
            packetsReceived?: number
            packetsLost?: number
            frameWidth?: number
            frameHeight?: number
            framesPerSecond?: number
          }
          outbound?: {
            bytesSent?: number
            packetsSent?: number
            frameWidth?: number
            frameHeight?: number
            framesPerSecond?: number
          }
        }
        audio: {
          inbound?: {
            bytesReceived?: number
            packetsReceived?: number
            packetsLost?: number
          }
          outbound?: {
            bytesSent?: number
            packetsSent?: number
          }
        }
        connection: {
          currentRoundTripTime?: number
          availableOutgoingBitrate?: number
          bytesReceived?: number
          bytesSent?: number
        }
      } = {
        video: {},
        audio: {},
        connection: {},
      }

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
          result.video.inbound = {
            bytesReceived: report.bytesReceived,
            packetsReceived: report.packetsReceived,
            packetsLost: report.packetsLost,
            frameWidth: report.frameWidth,
            frameHeight: report.frameHeight,
            framesPerSecond: report.framesPerSecond,
          }
        } else if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
          result.video.outbound = {
            bytesSent: report.bytesSent,
            packetsSent: report.packetsSent,
            frameWidth: report.frameWidth,
            frameHeight: report.frameHeight,
            framesPerSecond: report.framesPerSecond,
          }
        } else if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
          result.audio.inbound = {
            bytesReceived: report.bytesReceived,
            packetsReceived: report.packetsReceived,
            packetsLost: report.packetsLost,
          }
        } else if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
          result.audio.outbound = {
            bytesSent: report.bytesSent,
            packetsSent: report.packetsSent,
          }
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          result.connection = {
            currentRoundTripTime: report.currentRoundTripTime,
            availableOutgoingBitrate: report.availableOutgoingBitrate,
            bytesReceived: report.bytesReceived,
            bytesSent: report.bytesSent,
          }
        }
      })

      return result
    } catch (error) {
      console.error('Failed to get connection stats:', error)
      return null
    }
  },

  /**
   * Monitor connection quality with enhanced error handling and retry logic
   */
  createQualityMonitor(peerConnection, callback, interval = 5000) {
    if (!peerConnection || typeof callback !== 'function') {
      return null
    }

    const runCheck = () => {
      try {
        const gs = peerConnection.getStats()
        const proceed = () => {
          try {
            const maybeStats = webrtcService.getConnectionStats(peerConnection)
            if (maybeStats && typeof maybeStats.then === 'function') {
              maybeStats
                .then((stats) => {
                  if (stats) {
                    const quality = webrtcService.calculateQuality(stats)
                    callback(quality, stats)
                  }
                })
                .catch((error) => {
                  console.error('Quality monitoring error:', error)
                  if (error.name === 'InvalidStateError' || error.message?.includes('InvalidStateError')) {
                    clearInterval(monitor)
                  }
                })
            } else if (maybeStats) {
              const quality = webrtcService.calculateQuality(maybeStats as any)
              callback(quality, maybeStats as any)
            }
          } catch (error) {
            console.error('Quality monitoring error:', error)
            if ((error as any).name === 'InvalidStateError' || (error as any).message?.includes('InvalidStateError')) {
              clearInterval(monitor)
            }
          }
        }

        if (gs && typeof (gs as any).then === 'function') {
          (gs as Promise<any>)
            .then(() => proceed())
            .catch((error) => {
              console.error('Quality monitoring error:', error)
              if (error.name === 'InvalidStateError' || error.message?.includes('InvalidStateError')) {
                clearInterval(monitor)
              }
            })
        } else {
          proceed()
        }
      } catch (error) {
        console.error('Quality monitoring error:', error)
        if ((error as any).name === 'InvalidStateError' || (error as any).message?.includes('InvalidStateError')) {
          clearInterval(monitor)
        }
      }
    }

    const monitor = setInterval(() => {
      runCheck()
    }, interval)

    // Immediate microtask-based first check, avoids extra timer interaction
    Promise.resolve().then(() => runCheck())

    return monitor
  },

  /**
   * Create adaptive quality monitor with automatic recovery
   */
  createAdaptiveQualityMonitor(peerConnection, participantId, onQualityChange, onAdaptiveAction) {
    return webrtcRetryService.createAdaptiveQualityMonitor(
      peerConnection,
      participantId,
      onQualityChange,
      onAdaptiveAction
    )
  },

  /**
   * Monitor connection state with retry and recovery capabilities
   */
  monitorConnectionState(peerConnection, participantId, onRecoveryNeeded, onQualityChange) {
    return webrtcRetryService.monitorConnectionState(
      peerConnection,
      participantId,
      onRecoveryNeeded,
      onQualityChange
    )
  },

  /**
   * Execute WebRTC operation with retry logic
   */
  async executeWithRetry(operationId, operation, options = {}) {
    return webrtcRetryService.executeWithRetry(operationId, operation, options)
  },

  /**
   * Get user-friendly error message for WebRTC errors
   */
  getErrorMessage(error, context = '') {
    return webrtcRetryService.getErrorMessage(error, context)
  },

  /**
   * Calculate connection quality score (0-100)
   */
  calculateQuality(stats) {
    let score = 100

    // Reduce score based on packet loss
    if (stats.video.inbound?.packetsLost && stats.video.inbound?.packetsReceived) {
      const lossRate = stats.video.inbound.packetsLost / stats.video.inbound.packetsReceived
      score -= lossRate * 50 // Up to 50 points for packet loss
    }

    // Reduce score based on round trip time
    if (stats.connection?.currentRoundTripTime) {
      const rtt = stats.connection.currentRoundTripTime * 1000 // Convert to ms
      if (rtt > 150) {
        // Penalize 0.3 points per ms above 150ms, capped at 30
        score -= Math.min(30, (rtt - 150) * 0.3)
      }
    }

    // Reduce score based on low frame rate
    if (stats.video.inbound?.framesPerSecond) {
      const fps = stats.video.inbound.framesPerSecond
      if (fps < 15) {
        score -= (15 - fps) * 4 // Up to 60 points for very low FPS
      }
    }

    // Extreme degradation guard: floor to 0 when multiple severe issues coincide
    const fps = stats.video.inbound?.framesPerSecond
    const rttMs = stats.connection?.currentRoundTripTime ? stats.connection.currentRoundTripTime * 1000 : 0
    const lossRate = (stats.video.inbound?.packetsLost ?? 0) / Math.max(1, stats.video.inbound?.packetsReceived ?? 1)
    if ((fps ?? 60) < 10 && rttMs > 300 && lossRate > 0.3) {
      score = 0
    }

    return Math.max(0, Math.min(100, Math.round(score)))
  },
}
