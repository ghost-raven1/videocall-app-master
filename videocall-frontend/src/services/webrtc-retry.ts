// src/services/webrtc-retry.ts - WebRTC retry logic and error handling

/**
 * Connection quality assessment result
 */
export interface ConnectionQuality {
  score: number
  issues: string[]
  recommendation: string
}

/**
 * Retry options for operations
 */
export interface RetryOptions<T = unknown> {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  shouldRetry?: (error: Error | unknown, attemptCount: number) => boolean
}

/**
 * Recovery callback function type
 */
export type RecoveryCallback = (participantId: string, recoveryInfo: {
  canRecover: boolean
  requiresReconnection: boolean
  error?: Error | unknown
}) => void | Promise<void>

/**
 * Quality change callback function type
 */
export type QualityChangeCallback = (quality: ConnectionQuality, state?: string) => void | Promise<void>

export class WebRTCRetryService {
  // Retry/backoff configuration
  maxRetries: number
  baseDelay: number
  maxDelay: number

  // Retry state
  retryAttempts: Map<string, number>
  retryTimeouts: Map<string, ReturnType<typeof setTimeout>>
  isRetrying: Set<string>

  // Quality monitoring state
  qualityMonitors: Map<RTCPeerConnection, ReturnType<typeof setInterval>>
  qualityCallbacks: Map<RTCPeerConnection, QualityChangeCallback>
  connectionStates: Map<RTCPeerConnection, RTCPeerConnectionState | string>

  // Fallback strategies and state
  fallbackStrategies: { video_to_audio: string; audio_to_chat: string; full_reconnect: string }
  currentFallbackLevel: Map<RTCPeerConnection, number>
  constructor() {
    this.maxRetries = 5
    this.baseDelay = 1000 // 1 second
    this.maxDelay = 30000 // 30 seconds
    this.retryAttempts = new Map() // Map<operationId, attemptCount>
    this.retryTimeouts = new Map() // Map<operationId, timeoutId>
    this.isRetrying = new Set() // Set<operationId>

    // Connection quality monitoring
    this.qualityMonitors = new Map() // Map<peerConnection, monitorId>
    this.qualityCallbacks = new Map() // Map<peerConnection, callback>
    this.connectionStates = new Map() // Map<peerConnection, state>

    // Fallback strategies
    this.fallbackStrategies = {
      video_to_audio: 'video_to_audio',
      audio_to_chat: 'audio_to_chat',
      full_reconnect: 'full_reconnect'
    }

    this.currentFallbackLevel = new Map() // Map<peerConnection, fallbackLevel>
  }

  /**
   * Execute operation with exponential backoff retry
   */
  async executeWithRetry<T = unknown>(
    operationId: string,
    operation: () => Promise<T>,
    options: RetryOptions<T> = {}
  ): Promise<T> {
    const {
      maxRetries = this.maxRetries,
      baseDelay = this.baseDelay,
      maxDelay = this.maxDelay,
      shouldRetry = this.defaultShouldRetry.bind(this)
    } = options

    const attemptCount = this.retryAttempts.get(operationId) || 0

    if (attemptCount >= maxRetries) {
      this.retryAttempts.delete(operationId)
      throw new Error(`Operation ${operationId} failed after ${maxRetries} attempts`)
    }

    try {
      const result = await operation()
      this.retryAttempts.delete(operationId) // Success, clear retry count
      return result
    } catch (error) {
      console.warn(`Operation ${operationId} failed (attempt ${attemptCount + 1}/${maxRetries}):`, error)

      if (!shouldRetry(error, attemptCount)) {
        this.retryAttempts.delete(operationId)
        throw error
      }

      const delay = this.calculateDelay(attemptCount, baseDelay, maxDelay)
      const nextAttempt = attemptCount + 1
      this.retryAttempts.set(operationId, nextAttempt)

      console.log(`Retrying operation ${operationId} in ${delay}ms (attempt ${nextAttempt}/${maxRetries})`)

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(async () => {
          this.retryTimeouts.delete(operationId)
          try {
            const result = await this.executeWithRetry(operationId, operation, options)
            resolve(result)
          } catch (retryError) {
            reject(retryError)
          }
        }, delay)

        this.retryTimeouts.set(operationId, timeoutId)
      })
    }
  }

  /**
   * Cancel retry operation
   */
  cancelRetry(operationId: string): void {
    const timeoutId = this.retryTimeouts.get(operationId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.retryTimeouts.delete(operationId)
    }
    this.retryAttempts.delete(operationId)
    this.isRetrying.delete(operationId)
  }

  /**
   * Calculate delay for exponential backoff with jitter
   */
  calculateDelay(attemptCount: number, baseDelay: number, maxDelay: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, attemptCount)
    const cappedDelay = Math.min(exponentialDelay, maxDelay)
    const jitter = Math.random() * 0.1 * cappedDelay // Add 10% jitter
    return Math.floor(cappedDelay + jitter)
  }

  /**
   * Default retry condition
   */
  defaultShouldRetry(error: Error | unknown, attemptCount: number): boolean {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    
    // Don't retry on certain errors
    if (errorObj.name === 'NotAllowedError' || errorObj.name === 'NotFoundError') {
      return false
    }

    // Retry on network errors, timeouts, and WebRTC connection errors
    const retryableErrors = [
      'NetworkError',
      'TimeoutError',
      'ConnectionError',
      'IceConnectionStateError',
      'PeerConnectionError'
    ]

    return retryableErrors.some(errorType =>
      errorObj.name?.includes(errorType) || errorObj.message?.includes(errorType)
    ) || attemptCount < this.maxRetries
  }

  /**
   * Monitor connection state and trigger recovery
   */
  monitorConnectionState(
    peerConnection: RTCPeerConnection | null,
    participantId: string,
    onRecoveryNeeded?: RecoveryCallback,
    onQualityChange?: QualityChangeCallback
  ): string | null {
    if (!peerConnection) return null

    const monitorId = `${participantId}_${Date.now()}`

    const handleConnectionStateChange = async () => {
      const state = peerConnection.connectionState
      this.connectionStates.set(peerConnection, state)

      console.log(`Connection state for ${participantId}: ${state}`)

      if (state === 'failed' || state === 'disconnected') {
        await this.handleConnectionFailure(peerConnection, participantId, onRecoveryNeeded)
      } else if (state === 'connected') {
        // Reset fallback level on successful connection
        this.currentFallbackLevel.delete(peerConnection)
      }

      // Notify quality change callback
      if (onQualityChange) {
        const quality = await this.assessConnectionQuality(peerConnection)
        onQualityChange(quality, state)
      }
    }

    const handleIceConnectionStateChange = async () => {
      const iceState = peerConnection.iceConnectionState
      console.log(`ICE connection state for ${participantId}: ${iceState}`)

      if (iceState === 'failed' || iceState === 'disconnected') {
        await this.handleIceConnectionFailure(peerConnection, participantId, onRecoveryNeeded)
      }
    }

    peerConnection.onconnectionstatechange = handleConnectionStateChange
    peerConnection.oniceconnectionstatechange = handleIceConnectionStateChange

    return monitorId
  }

  /**
   * Handle connection failure with retry and fallback logic
   */
  async handleConnectionFailure(
    peerConnection: RTCPeerConnection,
    participantId: string,
    onRecoveryNeeded?: RecoveryCallback
  ): Promise<void> {
    const currentFallback = this.currentFallbackLevel.get(peerConnection) || 0

    if (currentFallback >= Object.keys(this.fallbackStrategies).length) {
      console.error(`All fallback strategies exhausted for ${participantId}`)
      onRecoveryNeeded?.(participantId, {
        canRecover: false,
        requiresReconnection: false,
        error: new Error('Unable to maintain connection. Please check your internet connection.')
      })
      return
    }

    const strategy = Object.values(this.fallbackStrategies)[currentFallback]

    console.log(`Applying fallback strategy ${strategy} for ${participantId}`)

    switch (strategy) {
      case this.fallbackStrategies.video_to_audio:
        await this.fallbackToAudioOnly(peerConnection, participantId)
        break
      case this.fallbackStrategies.audio_to_chat:
        await this.fallbackToChatOnly(peerConnection, participantId)
        break
      case this.fallbackStrategies.full_reconnect:
        await this.attemptFullReconnect(peerConnection, participantId)
        break
    }

    this.currentFallbackLevel.set(peerConnection, currentFallback + 1)
  }

  /**
   * Handle ICE connection failure
   */
  async handleIceConnectionFailure(
    peerConnection: RTCPeerConnection,
    participantId: string,
    onRecoveryNeeded?: RecoveryCallback
  ): Promise<void> {
    console.log(`Attempting ICE restart for ${participantId}`)

    try {
      // Attempt ICE restart
      await this.restartIceConnection(peerConnection)
    } catch (error) {
      console.error(`ICE restart failed for ${participantId}:`, error)
      await this.handleConnectionFailure(peerConnection, participantId, onRecoveryNeeded)
    }
  }

  /**
   * Restart ICE connection
   */
  async restartIceConnection(peerConnection: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
    const offer = await peerConnection.createOffer({ iceRestart: true })
    await peerConnection.setLocalDescription(offer)
    return offer
  }

  /**
   * Fallback to audio-only mode
   */
  async fallbackToAudioOnly(
    peerConnection: RTCPeerConnection,
    participantId: string
  ): Promise<{ success: boolean; mode?: string; error?: string }> {
    try {
      // Disable video tracks
      const senders = peerConnection.getSenders()
      const videoSenders = senders.filter(sender =>
        sender.track && sender.track.kind === 'video'
      )

      for (const sender of videoSenders) {
        if (sender.track) {
          sender.track.enabled = false
        }
      }

      console.log(`Disabled video for ${participantId}, audio-only mode active`)
      return { success: true, mode: 'audio_only' }
    } catch (error) {
      console.error(`Failed to fallback to audio-only for ${participantId}:`, error)
      const errorObj = error instanceof Error ? error : new Error(String(error))
      return { success: false, error: errorObj.message }
    }
  }

  /**
   * Fallback to chat-only mode
   */
  async fallbackToChatOnly(
    peerConnection: RTCPeerConnection,
    participantId: string
  ): Promise<{ success: boolean; mode?: string; error?: string }> {
    try {
      // Disable all media tracks
      const senders = peerConnection.getSenders()

      for (const sender of senders) {
        if (sender.track) {
          sender.track.enabled = false
        }
      }

      console.log(`Disabled all media for ${participantId}, chat-only mode active`)
      return { success: true, mode: 'chat_only' }
    } catch (error) {
      console.error(`Failed to fallback to chat-only for ${participantId}:`, error)
      const errorObj = error instanceof Error ? error : new Error(String(error))
      return { success: false, error: errorObj.message }
    }
  }

  /**
   * Attempt full reconnection
   */
  async attemptFullReconnect(
    peerConnection: RTCPeerConnection,
    participantId: string
  ): Promise<{ success: boolean; requiresReconnection?: boolean; error?: string }> {
    try {
      console.log(`Attempting full reconnection for ${participantId}`)

      // Close current connection
      peerConnection.close()

      // Notify that reconnection is needed
      return { success: true, requiresReconnection: true }
    } catch (error) {
      console.error(`Failed to attempt full reconnection for ${participantId}:`, error)
      const errorObj = error instanceof Error ? error : new Error(String(error))
      return { success: false, error: errorObj.message }
    }
  }

  /**
   * Assess connection quality and return quality score and recommendations
   */
  async assessConnectionQuality(peerConnection: RTCPeerConnection): Promise<ConnectionQuality> {
    try {
      const stats = await peerConnection.getStats()
      let quality = 100
      const issues = []

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
          // Check packet loss
          if (report.packetsLost && report.packetsReceived) {
            const lossRate = report.packetsLost / report.packetsReceived
            if (lossRate > 0.1) { // More than 10% loss
              quality -= 30
              issues.push('high_packet_loss')
            }
          }

          // Check frame rate
          if (report.framesPerSecond < 15) {
            quality -= 20
            issues.push('low_frame_rate')
          }
        }

        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          // Check round trip time
          if (report.currentRoundTripTime) {
            const rtt = report.currentRoundTripTime * 1000 // Convert to ms
            if (rtt > 200) {
              quality -= 25
              issues.push('high_latency')
            }
          }
        }
      })

      quality = Math.max(0, Math.min(100, quality))

      return {
        score: quality,
        issues,
        recommendation: this.getQualityRecommendation(quality, issues)
      }
    } catch (error) {
      console.error('Failed to assess connection quality:', error)
      return { score: 0, issues: ['assessment_failed'], recommendation: 'unknown' }
    }
  }

  /**
   * Get quality-based recommendation
   */
  getQualityRecommendation(quality: number, _issues: string[]): string {
    if (quality >= 80) {
      return 'excellent'
    } else if (quality >= 60) {
      return 'good'
    } else if (quality >= 40) {
      return 'fair_consider_audio_only'
    } else if (quality >= 20) {
      return 'poor_consider_chat_only'
    } else {
      return 'very_poor_reconnect_needed'
    }
  }

  /**
   * Create adaptive quality monitor
   */
  createAdaptiveQualityMonitor(
    peerConnection: RTCPeerConnection,
    participantId: string,
    onQualityChange?: QualityChangeCallback,
    onAdaptiveAction?: RecoveryCallback
  ): string {
    // Stop existing monitor if any
    const existingMonitor = this.qualityMonitors.get(peerConnection)
    if (existingMonitor) {
      clearInterval(existingMonitor)
    }
    
    const monitorId = `adaptive_${participantId}_${Date.now()}`

    const monitor = setInterval(async () => {
      try {
        const quality = await this.assessConnectionQuality(peerConnection)

        if (onQualityChange) {
          onQualityChange(quality)
        }

        // Take adaptive actions based on quality
        if (quality.score < 40 && !this.currentFallbackLevel.has(peerConnection)) {
          console.log(`Poor quality detected for ${participantId}, taking adaptive action`)
          await this.handleConnectionFailure(peerConnection, participantId, onAdaptiveAction)
        }
      } catch (error) {
        console.error(`Quality monitoring error for ${participantId}:`, error)
      }
    }, 10000) // Check every 10 seconds

    this.qualityMonitors.set(peerConnection, monitor)
    return monitorId
  }

  /**
   * Stop quality monitoring
   */
  stopQualityMonitor(peerConnection: RTCPeerConnection): void {
    const monitor = this.qualityMonitors.get(peerConnection)
    if (monitor) {
      clearInterval(monitor)
      this.qualityMonitors.delete(peerConnection)
    }
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(error: Error | unknown, context: string = ''): string {
    const errorMessages = {
      // Network errors
      'NetworkError': 'Network connection problem. Please check your internet connection.',
      'TimeoutError': 'Connection timed out. Please try again.',
      'ConnectionError': 'Unable to establish connection. Please check your network settings.',

      // WebRTC specific errors
      'IceConnectionStateError': 'Connection failed. Trying alternative connection method...',
      'PeerConnectionError': 'Peer connection error. Attempting to reconnect...',

      // Media errors
      'NotAllowedError': 'Camera and microphone access denied. Please allow permissions and try again.',
      'NotFoundError': 'No camera or microphone found on this device.',
      'NotReadableError': 'Camera or microphone is already in use by another application.',
      'OverconstrainedError': 'Camera/microphone doesn\'t support the requested quality settings.',

      // Generic fallback
      'default': 'Connection issue occurred. Attempting to restore connection...'
    }

    const errorObj = error instanceof Error ? error : new Error(String(error))
    const errorKey = Object.keys(errorMessages).find(key =>
      errorObj.name?.includes(key) || errorObj.message?.includes(key)
    )

    let message = errorMessages[errorKey as keyof typeof errorMessages] || errorMessages.default

    if (context) {
      message += ` (${context})`
    }

    return message
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    // Cancel all retries
    this.retryTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId)
    })

    // Clear quality monitors
    this.qualityMonitors.forEach((monitor) => {
      clearInterval(monitor)
    })

    // Clear all maps and sets
    this.retryAttempts.clear()
    this.retryTimeouts.clear()
    this.isRetrying.clear()
    this.qualityMonitors.clear()
    this.qualityCallbacks.clear()
    this.connectionStates.clear()
    this.currentFallbackLevel.clear()
  }
}

// Create singleton instance
export const webrtcRetryService = new WebRTCRetryService()
