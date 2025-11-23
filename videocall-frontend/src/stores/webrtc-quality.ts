// src/stores/webrtc-quality.ts - Connection quality monitoring extracted from webrtc.ts
import { ref, Ref } from 'vue'
import { useGlobalStore } from './global'
import { webrtcRetryService } from '../services/webrtc-retry'

/**
 * Connection quality monitor
 */
export class ConnectionQualityMonitor {
  private connectionMonitors: Ref<Map<string, number>>
  private qualityMonitors: Ref<Map<string, number>>
  private fallbackLevels: Ref<Map<string, number>>
  private remoteParticipants: Ref<any[]>
  private globalStore: ReturnType<typeof useGlobalStore>

  constructor(
    connectionMonitors: Ref<Map<string, number>>,
    qualityMonitors: Ref<Map<string, number>>,
    fallbackLevels: Ref<Map<string, number>>,
    remoteParticipants: Ref<any[]>
  ) {
    this.connectionMonitors = connectionMonitors
    this.qualityMonitors = qualityMonitors
    this.fallbackLevels = fallbackLevels
    this.remoteParticipants = remoteParticipants
    this.globalStore = useGlobalStore()
  }

  /**
   * Monitor connection quality for a participant
   */
  startQualityMonitoring(participantId: string, peerConnection: RTCPeerConnection): void {
    // Stop existing monitor if any
    this.stopQualityMonitoring(participantId)

    const monitorId = webrtcRetryService.monitorConnectionState(
      peerConnection,
      (state) => {
        const participant = this.remoteParticipants.value.find(p => p.id === participantId)
        if (participant) {
          participant.connectionState = state
        }
      }
    )

    this.connectionMonitors.value.set(participantId, monitorId)

    // Start quality monitoring
    const qualityMonitorId = setInterval(async () => {
      try {
        const stats = await peerConnection.getStats()
        const quality = this.calculateQualityFromStats(stats)

        const participant = this.remoteParticipants.value.find(p => p.id === participantId)
        if (participant) {
          participant.connectionQuality = quality.score

          // Update fallback level based on quality
          if (quality.score < 40 && !this.fallbackLevels.value.has(participantId)) {
            this.fallbackLevels.value.set(participantId, 0)
          }
        }

        // Show quality warnings for poor connections
        if (quality.score < 30) {
          const qualityMessage = `Connection quality is poor (${quality.score}%). Attempting to improve...`
          this.globalStore.addNotification(qualityMessage, 'warning', 4000)
        }
      } catch (error) {
        console.error(`Failed to get stats for participant ${participantId}:`, error)
      }
    }, 5000)

    this.qualityMonitors.value.set(participantId, qualityMonitorId as any)
  }

  /**
   * Stop quality monitoring for a participant
   */
  stopQualityMonitoring(participantId: string): void {
    const monitorId = this.connectionMonitors.value.get(participantId)
    if (monitorId) {
      webrtcRetryService.stopQualityMonitor(monitorId)
      this.connectionMonitors.value.delete(participantId)
    }

    const qualityMonitorId = this.qualityMonitors.value.get(participantId)
    if (qualityMonitorId) {
      clearInterval(qualityMonitorId as any)
      this.qualityMonitors.value.delete(participantId)
    }
  }

  /**
   * Stop all quality monitoring
   */
  stopAllMonitoring(): void {
    this.connectionMonitors.value.forEach((monitorId, participantId) => {
      this.stopQualityMonitoring(participantId)
    })
    this.connectionMonitors.value.clear()
    this.qualityMonitors.value.clear()
  }

  /**
   * Calculate quality score from RTCStatsReport
   */
  private calculateQualityFromStats(stats: RTCStatsReport): { score: number; details: any } {
    let score = 100
    const details: any = {}

    // Process stats
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        details.video = {
          packetsReceived: report.packetsReceived,
          packetsLost: report.packetsLost,
          framesPerSecond: report.framesPerSecond,
          frameWidth: report.frameWidth,
          frameHeight: report.frameHeight,
        }

        // Reduce score based on packet loss
        if (report.packetsReceived && report.packetsLost !== undefined) {
          const lossRate = report.packetsLost / report.packetsReceived
          score -= lossRate * 50 // Up to 50 points for packet loss
        }

        // Reduce score based on low frame rate
        if (report.framesPerSecond && report.framesPerSecond < 15) {
          score -= (15 - report.framesPerSecond) * 4 // Up to 60 points for very low FPS
        }
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        details.connection = {
          currentRoundTripTime: report.currentRoundTripTime,
          availableOutgoingBitrate: report.availableOutgoingBitrate,
        }

        // Reduce score based on round trip time
        if (report.currentRoundTripTime) {
          const rtt = report.currentRoundTripTime * 1000 // Convert to ms
          if (rtt > 150) {
            // Penalize 0.3 points per ms above 150ms, capped at 30
            score -= Math.min(30, (rtt - 150) * 0.3)
          }
        }
      }
    })

    // Extreme degradation guard
    const fps = details.video?.framesPerSecond || 60
    const rttMs = details.connection?.currentRoundTripTime ? details.connection.currentRoundTripTime * 1000 : 0
    const lossRate = (details.video?.packetsLost ?? 0) / Math.max(1, details.video?.packetsReceived ?? 1)
    if (fps < 10 && rttMs > 300 && lossRate > 0.3) {
      score = 0
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      details,
    }
  }

  /**
   * Handle connection quality change
   */
  handleConnectionQualityChange(participantId: string, quality: number, state: string): void {
    const participant = this.remoteParticipants.value.find(p => p.id === participantId)
    if (participant) {
      participant.connectionQuality = quality

      // Update fallback level based on quality
      if (quality < 40 && !this.fallbackLevels.value.has(participantId)) {
        this.fallbackLevels.value.set(participantId, 0)
      }
    }

    // Show quality warnings for poor connections
    if (quality < 30 && state !== 'failed') {
      const qualityMessage = `Connection quality is poor (${quality}%). Attempting to improve...`
      this.globalStore.addNotification(qualityMessage, 'warning', 4000)
    }
  }
}

