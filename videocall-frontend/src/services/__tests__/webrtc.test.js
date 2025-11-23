/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { webrtcService } from '../webrtc'

// Mock the webrtc-retry service
vi.mock('../webrtc-retry', () => ({
  webrtcRetryService: {
    createAdaptiveQualityMonitor: vi.fn(),
    monitorConnectionState: vi.fn(),
    executeWithRetry: vi.fn(),
    getErrorMessage: vi.fn()
  }
}))

describe('webrtcService', () => {
  let mockPeerConnection
  let mockGetStats

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock RTCPeerConnection
    mockGetStats = vi.fn()
    mockPeerConnection = {
      getStats: mockGetStats
    }

    // Mock window.RTCPeerConnection
    global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPeerConnection)

    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getIceServerConfig', () => {
    it('returns STUN server configuration', () => {
      const config = webrtcService.getIceServerConfig()

      expect(config).toHaveProperty('iceServers')
      expect(config).toHaveProperty('iceCandidatePoolSize', 10)
      expect(config.iceServers).toHaveLength(3)

      // Check STUN servers
      const stunServers = config.iceServers.filter(server =>
        server.urls.includes('stun:')
      )
      expect(stunServers.length).toBeGreaterThan(0)
    })

    it('includes Google STUN servers', () => {
      const config = webrtcService.getIceServerConfig()
      const googleStunUrls = config.iceServers.filter(server =>
        server.urls.includes('google.com')
      )
      expect(googleStunUrls.length).toBe(3)
    })
  })

  describe('isWebRTCSupported', () => {
    it('returns true when RTCPeerConnection is available', () => {
      expect(webrtcService.isWebRTCSupported()).toBe(true)
    })

    it('returns false when RTCPeerConnection is not available', () => {
      // Temporarily remove RTCPeerConnection
      const originalRTCPeerConnection = global.RTCPeerConnection
      delete global.RTCPeerConnection

      expect(webrtcService.isWebRTCSupported()).toBe(false)

      // Restore for other tests
      global.RTCPeerConnection = originalRTCPeerConnection
    })

    it('checks for vendor-prefixed versions', () => {
      // Remove standard RTCPeerConnection
      delete global.RTCPeerConnection

      // Add webkit version
      global.webkitRTCPeerConnection = vi.fn()

      expect(webrtcService.isWebRTCSupported()).toBe(true)

      // Cleanup
      delete global.webkitRTCPeerConnection
    })
  })

  describe('getConnectionStats', () => {
    it('returns null when peerConnection is not provided', async () => {
      const result = await webrtcService.getConnectionStats(null)
      expect(result).toBeNull()
    })

    it('retrieves and parses connection statistics', async () => {
      const mockStats = [
        {
          type: 'inbound-rtp',
          mediaType: 'video',
          bytesReceived: 1000,
          packetsReceived: 50,
          packetsLost: 2,
          frameWidth: 1920,
          frameHeight: 1080,
          framesPerSecond: 30
        },
        {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.05,
          availableOutgoingBitrate: 1000000,
          bytesReceived: 2000,
          bytesSent: 1500
        }
      ]

      mockGetStats.mockResolvedValue(mockStats)

      const result = await webrtcService.getConnectionStats(mockPeerConnection)

      expect(result).not.toBeNull()
      expect(result.video.inbound).toBeDefined()
      expect(result.video.inbound.bytesReceived).toBe(1000)
      expect(result.video.inbound.frameWidth).toBe(1920)
      expect(result.connection.currentRoundTripTime).toBe(0.05)
    })

    it('handles stats retrieval errors gracefully', async () => {
      mockGetStats.mockRejectedValue(new Error('Stats error'))

      const result = await webrtcService.getConnectionStats(mockPeerConnection)

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Failed to get connection stats:', expect.any(Error))
    })

    it('parses audio statistics correctly', async () => {
      const mockStats = [
        {
          type: 'inbound-rtp',
          mediaType: 'audio',
          bytesReceived: 500,
          packetsReceived: 25,
          packetsLost: 1
        }
      ]

      mockGetStats.mockResolvedValue(mockStats)

      const result = await webrtcService.getConnectionStats(mockPeerConnection)

      expect(result.audio.inbound).toBeDefined()
      expect(result.audio.inbound.bytesReceived).toBe(500)
    })

    it('parses outbound video statistics', async () => {
      const mockStats = [
        {
          type: 'outbound-rtp',
          mediaType: 'video',
          bytesSent: 800,
          packetsSent: 40,
          frameWidth: 1280,
          frameHeight: 720,
          framesPerSecond: 25
        }
      ]

      mockGetStats.mockResolvedValue(mockStats)

      const result = await webrtcService.getConnectionStats(mockPeerConnection)

      expect(result.video.outbound).toBeDefined()
      expect(result.video.outbound.bytesSent).toBe(800)
      expect(result.video.outbound.frameWidth).toBe(1280)
    })
  })

  describe('createQualityMonitor', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns null when peerConnection is not provided', () => {
      const monitor = webrtcService.createQualityMonitor(null, vi.fn())
      expect(monitor).toBeNull()
    })

    it('returns null when callback is not provided', () => {
      const monitor = webrtcService.createQualityMonitor(mockPeerConnection, null)
      expect(monitor).toBeNull()
    })

    it('creates a quality monitor that calls callback with stats', async () => {
      const callback = vi.fn()
      const mockStats = {
        video: { inbound: { packetsLost: 1, packetsReceived: 100 } },
        connection: { currentRoundTripTime: 0.02 }
      }

      mockGetStats.mockResolvedValue([])
      const getStatsSpy = vi.spyOn(webrtcService, 'getConnectionStats').mockResolvedValue(mockStats)

      const monitor = webrtcService.createQualityMonitor(mockPeerConnection, callback, 1000)

      expect(monitor).not.toBeNull()

      // Fast-forward time to trigger the interval
      vi.advanceTimersByTime(1000)

      await new Promise(resolve => setImmediate(resolve))

      expect(getStatsSpy).toHaveBeenCalledWith(mockPeerConnection)
      expect(callback).toHaveBeenCalled()
    })

    it('handles monitoring errors gracefully', async () => {
      const callback = vi.fn()
      mockGetStats.mockRejectedValue(new Error('InvalidStateError'))

      const monitor = webrtcService.createQualityMonitor(mockPeerConnection, callback, 1000)

      expect(monitor).not.toBeNull()

      // Fast-forward time to trigger the interval
      vi.advanceTimersByTime(1000)

      await new Promise(resolve => setImmediate(resolve))

      expect(console.error).toHaveBeenCalledWith('Quality monitoring error:', expect.any(Error))
    })

    it('clears interval when peer connection is closed', async () => {
      const callback = vi.fn()
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      mockGetStats.mockRejectedValue(new Error('InvalidStateError'))

      const monitor = webrtcService.createQualityMonitor(mockPeerConnection, callback, 1000)

      // Fast-forward time to trigger the interval
      vi.advanceTimersByTime(1000)

      await new Promise(resolve => setImmediate(resolve))

      expect(clearIntervalSpy).toHaveBeenCalledWith(monitor)
    })

    it('uses custom interval when provided', () => {
      const callback = vi.fn()
      const customInterval = 2000

      const monitor = webrtcService.createQualityMonitor(mockPeerConnection, callback, customInterval)

      expect(monitor).not.toBeNull()
      // The interval creation is internal, but we can verify the function doesn't throw
    })
  })

  describe('calculateQuality', () => {
    it('returns perfect score for excellent conditions', () => {
      const stats = {
        video: {
          inbound: {
            packetsLost: 0,
            packetsReceived: 100
          }
        },
        connection: {
          currentRoundTripTime: 0.02 // 20ms RTT
        }
      }

      const quality = webrtcService.calculateQuality(stats)
      expect(quality).toBe(100)
    })

    it('reduces score for packet loss', () => {
      const stats = {
        video: {
          inbound: {
            packetsLost: 5,
            packetsReceived: 100 // 5% packet loss
          }
        },
        connection: {
          currentRoundTripTime: 0.02
        }
      }

      const quality = webrtcService.calculateQuality(stats)
      expect(quality).toBe(98) // 100 - (5/100 * 50) = 97.5, rounded to 98
    })

    it('reduces score for high latency', () => {
      const stats = {
        video: {
          inbound: {
            packetsLost: 0,
            packetsReceived: 100
          }
        },
        connection: {
          currentRoundTripTime: 0.2 // 200ms RTT
        }
      }

      const quality = webrtcService.calculateQuality(stats)
      expect(quality).toBe(85) // 100 - ((200-150)/10) = 85
    })

    it('reduces score for low frame rate', () => {
      const stats = {
        video: {
          inbound: {
            framesPerSecond: 10 // Very low FPS
          }
        },
        connection: {
          currentRoundTripTime: 0.02
        }
      }

      const quality = webrtcService.calculateQuality(stats)
      expect(quality).toBe(80) // 100 - ((15-10) * 2) = 80
    })

    it('combines multiple quality factors', () => {
      const stats = {
        video: {
          inbound: {
            packetsLost: 2,
            packetsReceived: 100,
            framesPerSecond: 20 // Slightly low FPS
          }
        },
        connection: {
          currentRoundTripTime: 0.1 // 100ms RTT
        }
      }

      // Packet loss: 2% * 50 = 1 point deduction
      // RTT: (100-150)/10 = -5 points (but since RTT < 150, no deduction)
      // FPS: (15-20) * 2 = -10 point bonus (no deduction for FPS > 15)
      const quality = webrtcService.calculateQuality(stats)
      expect(quality).toBe(99) // 100 - 1 = 99
    })

    it('caps quality score at 100', () => {
      const stats = {
        video: {
          inbound: {
            packetsLost: 0,
            packetsReceived: 100,
            framesPerSecond: 30
          }
        },
        connection: {
          currentRoundTripTime: 0.01 // Excellent RTT
        }
      }

      const quality = webrtcService.calculateQuality(stats)
      expect(quality).toBe(100)
    })

    it('floors quality score at 0', () => {
      const stats = {
        video: {
          inbound: {
            packetsLost: 50,
            packetsReceived: 100, // 50% packet loss
            framesPerSecond: 5 // Very low FPS
          }
        },
        connection: {
          currentRoundTripTime: 0.5 // Very high RTT
        }
      }

      const quality = webrtcService.calculateQuality(stats)
      expect(quality).toBe(0)
    })

    it('handles missing stats gracefully', () => {
      const stats = {
        video: {},
        connection: {}
      }

      const quality = webrtcService.calculateQuality(stats)
      expect(quality).toBe(100) // No negative factors present
    })
  })

  describe('Error Handling', () => {
    it('delegates error message formatting to retry service', async () => {
      const { webrtcRetryService } = await import('../webrtc-retry')
      const error = new Error('Test error')
      const context = 'test context'

      webrtcService.getErrorMessage(error, context)

      expect(webrtcRetryService.getErrorMessage).toHaveBeenCalledWith(error, context)
    })

    it('handles adaptive quality monitor creation', async () => {
      const { webrtcRetryService } = await import('../webrtc-retry')
      const callback = vi.fn()

      webrtcService.createAdaptiveQualityMonitor(mockPeerConnection, 'participant1', callback, callback)

      expect(webrtcRetryService.createAdaptiveQualityMonitor).toHaveBeenCalledWith(
        mockPeerConnection,
        'participant1',
        callback,
        callback
      )
    })

    it('handles connection state monitoring', async () => {
      const { webrtcRetryService } = await import('../webrtc-retry')
      const recoveryCallback = vi.fn()
      const qualityCallback = vi.fn()

      webrtcService.monitorConnectionState(mockPeerConnection, 'participant1', recoveryCallback, qualityCallback)

      expect(webrtcRetryService.monitorConnectionState).toHaveBeenCalledWith(
        mockPeerConnection,
        'participant1',
        recoveryCallback,
        qualityCallback
      )
    })

    it('handles retry execution', async () => {
      const { webrtcRetryService } = await import('../webrtc-retry')
      const operation = vi.fn()
      const options = { maxRetries: 3 }

      await webrtcService.executeWithRetry('operation1', operation, options)

      expect(webrtcRetryService.executeWithRetry).toHaveBeenCalledWith('operation1', operation, options)
    })
  })

  describe('Browser Compatibility', () => {
    it('handles vendor-prefixed RTCPeerConnection', () => {
      // Remove standard RTCPeerConnection
      delete global.RTCPeerConnection

      // Add moz prefix
      global.mozRTCPeerConnection = vi.fn()

      expect(webrtcService.isWebRTCSupported()).toBe(true)

      // Cleanup
      delete global.mozRTCPeerConnection
    })

    it('works without any RTCPeerConnection implementations', () => {
      // Remove all RTCPeerConnection implementations
      delete global.RTCPeerConnection
      delete global.webkitRTCPeerConnection
      delete global.mozRTCPeerConnection

      expect(webrtcService.isWebRTCSupported()).toBe(false)
    })
  })

  describe('Statistics Parsing', () => {
    it('correctly identifies successful candidate pairs', async () => {
      const mockStats = [
        {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.03,
          availableOutgoingBitrate: 500000
        },
        {
          type: 'candidate-pair',
          state: 'failed',
          currentRoundTripTime: 0.1
        }
      ]

      mockGetStats.mockResolvedValue(mockStats)

      const result = await webrtcService.getConnectionStats(mockPeerConnection)

      expect(result.connection.currentRoundTripTime).toBe(0.03)
      expect(result.connection.availableOutgoingBitrate).toBe(500000)
    })

    it('ignores failed candidate pairs', async () => {
      const mockStats = [
        {
          type: 'candidate-pair',
          state: 'failed',
          currentRoundTripTime: 0.1
        }
      ]

      mockGetStats.mockResolvedValue(mockStats)

      const result = await webrtcService.getConnectionStats(mockPeerConnection)

      expect(result.connection.currentRoundTripTime).toBeUndefined()
    })
  })
})
