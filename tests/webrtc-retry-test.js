// tests/webrtc-retry-test.js - Test script for WebRTC retry logic
// This file can be run in a browser console or Node.js environment to test the retry mechanisms

// Mock WebRTC classes for testing (if not in browser environment)
if (typeof RTCPeerConnection === 'undefined') {
  global.RTCPeerConnection = class MockRTCPeerConnection {
    constructor(config) {
      this.config = config
      this.connectionState = 'new'
      this.iceConnectionState = 'new'
      this.onconnectionstatechange = null
      this.oniceconnectionstatechange = null
      this.ontrack = null
      this.onicecandidate = null
    }

    createOffer(options) {
      return Promise.resolve({
        type: 'offer',
        sdp: 'mock-sdp-offer'
      })
    }

    createAnswer() {
      return Promise.resolve({
        type: 'answer',
        sdp: 'mock-sdp-answer'
      })
    }

    setLocalDescription(description) {
      return Promise.resolve()
    }

    setRemoteDescription(description) {
      return Promise.resolve()
    }

    addIceCandidate(candidate) {
      return Promise.resolve()
    }

    getStats() {
      return Promise.resolve(new Map([
        ['inbound-rtp', {
          type: 'inbound-rtp',
          mediaType: 'video',
          bytesReceived: 100000,
          packetsReceived: 1000,
          packetsLost: 50,
          frameWidth: 1280,
          frameHeight: 720,
          framesPerSecond: 25
        }],
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.05,
          availableOutgoingBitrate: 500000
        }]
      ]))
    }

    close() {
      this.connectionState = 'closed'
    }
  }
}

// Test the retry service
async function testWebRTCRetryService() {
  console.log('🧪 Testing WebRTC Retry Service...')

  try {
    // Import the retry service (this would work in a real environment)
    // const { webrtcRetryService } = await import('../videocall-frontend/src/services/webrtc-retry.js')

    // For this test, we'll create a mock version
    const mockRetryService = {
      executeWithRetry: async (operationId, operation, options = {}) => {
        const { maxRetries = 3, baseDelay = 100 } = options

        console.log(`📝 Executing operation ${operationId} with max ${maxRetries} retries`)

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            console.log(`🔄 Attempt ${attempt + 1}/${maxRetries + 1}`)
            const result = await operation()

            if (attempt > 0) {
              console.log(`✅ Operation ${operationId} succeeded after ${attempt} retries`)
            }

            return result
          } catch (error) {
            console.log(`❌ Attempt ${attempt + 1} failed:`, error.message)

            if (attempt < maxRetries) {
              const delay = baseDelay * Math.pow(2, attempt)
              console.log(`⏳ Waiting ${delay}ms before retry...`)
              await new Promise(resolve => setTimeout(resolve, delay))
            } else {
              throw new Error(`Operation ${operationId} failed after ${maxRetries + 1} attempts`)
            }
          }
        }
      },

      getErrorMessage: (error, context = '') => {
        const messages = {
          'NetworkError': 'Network connection problem. Please check your internet connection.',
          'TimeoutError': 'Connection timed out. Please try again.',
          'NotAllowedError': 'Camera and microphone access denied. Please allow permissions and try again.',
          'default': 'Connection issue occurred. Attempting to restore connection...'
        }

        const errorKey = Object.keys(messages).find(key => error.message?.includes(key))
        let message = messages[errorKey] || messages.default

        if (context) {
          message += ` (${context})`
        }

        return message
      },

      calculateDelay: (attemptCount, baseDelay, maxDelay) => {
        const exponentialDelay = baseDelay * Math.pow(2, attemptCount)
        const cappedDelay = Math.min(exponentialDelay, maxDelay)
        const jitter = Math.random() * 0.1 * cappedDelay
        return Math.floor(cappedDelay + jitter)
      }
    }

    // Test 1: Successful operation on first try
    console.log('\n🧪 Test 1: Successful operation on first try')
    try {
      await mockRetryService.executeWithRetry(
        'test_success',
        async () => {
          console.log('✅ Executing successful operation')
          return { success: true }
        }
      )
      console.log('✅ Test 1 passed')
    } catch (error) {
      console.error('❌ Test 1 failed:', error.message)
    }

    // Test 2: Operation that fails then succeeds
    console.log('\n🧪 Test 2: Operation that fails then succeeds')
    let attemptCount = 0
    try {
      await mockRetryService.executeWithRetry(
        'test_retry_success',
        async () => {
          attemptCount++
          if (attemptCount < 3) {
            throw new Error('Temporary network error')
          }
          console.log('✅ Operation succeeded after retries')
          return { success: true, attempts: attemptCount }
        },
        { maxRetries: 3, baseDelay: 50 }
      )
      console.log('✅ Test 2 passed')
    } catch (error) {
      console.error('❌ Test 2 failed:', error.message)
    }

    // Test 3: Operation that always fails
    console.log('\n🧪 Test 3: Operation that always fails')
    try {
      await mockRetryService.executeWithRetry(
        'test_always_fail',
        async () => {
          throw new Error('Persistent network error')
        },
        { maxRetries: 2, baseDelay: 50 }
      )
      console.error('❌ Test 3 should have failed but didn\'t')
    } catch (error) {
      console.log('✅ Test 3 passed (correctly failed after retries)')
    }

    // Test 4: Error message generation
    console.log('\n🧪 Test 4: Error message generation')
    const testErrors = [
      { error: new Error('NetworkError: Connection failed'), context: 'Video call' },
      { error: new Error('TimeoutError occurred'), context: 'Audio setup' },
      { error: new Error('NotAllowedError: Permission denied'), context: 'Camera access' },
      { error: new Error('Unknown error type'), context: 'Generic' }
    ]

    testErrors.forEach(({ error, context }, index) => {
      const message = mockRetryService.getErrorMessage(error, context)
      console.log(`📝 Error message ${index + 1}: ${message}`)
    })

    // Test 5: Delay calculation
    console.log('\n🧪 Test 5: Delay calculation')
    for (let i = 0; i < 5; i++) {
      const delay = mockRetryService.calculateDelay(i, 1000, 10000)
      console.log(`📊 Attempt ${i}: ${delay}ms delay`)
    }

    console.log('\n🎉 All tests completed!')

  } catch (error) {
    console.error('❌ Test suite failed:', error)
  }
}

// Test connection quality assessment
async function testConnectionQuality() {
  console.log('\n🔍 Testing Connection Quality Assessment...')

  try {
    if (typeof RTCPeerConnection === 'undefined') {
      console.log('ℹ️ Skipping quality test - RTCPeerConnection not available')
      return
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    const stats = await pc.getStats()
    console.log('📊 Connection stats retrieved:', stats.size, 'reports')

    // Test stats parsing
    let videoStats = null
    let connectionStats = null

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        videoStats = report
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        connectionStats = report
      }
    })

    if (videoStats) {
      console.log('🎥 Video stats:', {
        resolution: `${videoStats.frameWidth}x${videoStats.frameHeight}`,
        fps: videoStats.framesPerSecond,
        packetsLost: videoStats.packetsLost,
        packetsReceived: videoStats.packetsReceived
      })
    }

    if (connectionStats) {
      console.log('🌐 Connection stats:', {
        rtt: Math.round(connectionStats.currentRoundTripTime * 1000) + 'ms',
        bandwidth: Math.round(connectionStats.availableOutgoingBitrate / 1000) + 'kbps'
      })
    }

    pc.close()
    console.log('✅ Connection quality test completed')

  } catch (error) {
    console.error('❌ Connection quality test failed:', error.message)
  }
}

// Run tests if in Node.js environment or browser console
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  testWebRTCRetryService().then(() => {
    console.log('Node.js tests completed')
  }).catch(console.error)
} else {
  // Browser environment
  console.log('🌐 Browser test environment detected')
  console.log('Run testWebRTCRetryService() and testConnectionQuality() in the console')

  // Make functions available globally
  window.testWebRTCRetryService = testWebRTCRetryService
  window.testConnectionQuality = testConnectionQuality
}

export { testWebRTCRetryService, testConnectionQuality }