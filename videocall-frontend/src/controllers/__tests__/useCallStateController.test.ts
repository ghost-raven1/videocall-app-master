/**
 * Tests for useCallStateController
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCallStateController, type ConnectionState } from '../video-call/useCallStateController'
import { ref } from 'vue'

describe('useCallStateController', () => {
  let controller: ReturnType<typeof useCallStateController>

  beforeEach(() => {
    vi.useFakeTimers()
    controller = useCallStateController()
  })

  afterEach(() => {
    controller.reset()
    vi.useRealTimers()
  })

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(controller.isConnecting.value).toBe(false)
      expect(controller.callDuration.value).toBe(0)
      expect(controller.callStartTime.value).toBeNull()
      expect(controller.connectionProgress.value).toBe('Please wait while we set up your call')
    })

    it('should have computed properties', () => {
      expect(controller.connectionStatusText.value).toBe('Unknown')
      expect(controller.connectionStatusColor.value).toBe('bg-gray-400')
      expect(controller.formattedCallDuration.value).toBe('0:00')
    })
  })

  describe('startCall', () => {
    it('should start call and initialize timer', () => {
      controller.startCall()

      expect(controller.isConnecting.value).toBe(true)
      expect(controller.callStartTime.value).not.toBeNull()
      expect(controller.callDuration.value).toBe(0)
    })

    it('should update call duration over time', () => {
      controller.startCall()

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000)

      expect(controller.callDuration.value).toBe(5)
      expect(controller.formattedCallDuration.value).toBe('0:05')
    })

    it('should format duration correctly for hours', () => {
      controller.startCall()

      // Advance time by 1 hour and 5 minutes
      vi.advanceTimersByTime(65 * 60 * 1000)

      expect(controller.formattedCallDuration.value).toMatch(/^1:05:/)
    })
  })

  describe('endCall', () => {
    it('should end call and reset state', () => {
      controller.startCall()
      controller.endCall()

      expect(controller.isConnecting.value).toBe(false)
      expect(controller.callStartTime.value).toBeNull()
      expect(controller.callDuration.value).toBe(0)
    })

    it('should clear duration interval', () => {
      controller.startCall()
      vi.advanceTimersByTime(5000)
      
      controller.endCall()
      vi.advanceTimersByTime(5000)

      // Duration should not increase after endCall
      expect(controller.callDuration.value).toBe(0)
    })
  })

  describe('updateConnectionState', () => {
    it('should update connection state', () => {
      controller.updateConnectionState('connecting')
      expect(controller.isConnecting.value).toBe(true)

      controller.updateConnectionState('connected')
      expect(controller.isConnecting.value).toBe(false)
    })

    it('should update connection status text', () => {
      controller.updateConnectionState('connecting')
      expect(controller.connectionStatusText.value).toBe('Connecting...')

      controller.updateConnectionState('connected')
      expect(controller.connectionStatusText.value).toBe('Connected')
    })

    it('should update connection status color', () => {
      controller.updateConnectionState('connected')
      expect(controller.connectionStatusColor.value).toBe('bg-green-400')

      controller.updateConnectionState('failed')
      expect(controller.connectionStatusColor.value).toBe('bg-red-400')
    })
  })

  describe('setConnectionProgress', () => {
    it('should update connection progress message', () => {
      controller.setConnectionProgress('Step 2/4: Setting up media')
      expect(controller.connectionProgress.value).toBe('Step 2/4: Setting up media')
    })
  })

  describe('setConnectingMessage', () => {
    it('should update connecting message', () => {
      controller.setConnectingMessage('Connecting to room...')
      expect(controller.connectingMessage.value).toBe('Connecting to room...')
    })

    it('should update connecting message and sub-message', () => {
      controller.setConnectingMessage('Connecting...', 'Almost ready')
      expect(controller.connectingMessage.value).toBe('Connecting...')
      expect(controller.connectingSubMessage.value).toBe('Almost ready')
    })
  })

  describe('reset', () => {
    it('should reset all state', () => {
      controller.startCall()
      controller.setConnectingMessage('Test', 'Sub')
      controller.setConnectionProgress('Test progress')
      controller.updateConnectionState('connected')

      controller.reset()

      expect(controller.isConnecting.value).toBe(false)
      expect(controller.callDuration.value).toBe(0)
      expect(controller.callStartTime.value).toBeNull()
      expect(controller.connectionProgress.value).toBe('Please wait while we set up your call')
    })
  })

  describe('with external connection state', () => {
    it('should use external connection state', () => {
      const externalState = ref<ConnectionState>('connecting')
      const controllerWithExternal = useCallStateController(externalState)

      expect(controllerWithExternal.connectionStatusText.value).toBe('Connecting...')

      externalState.value = 'connected'
      expect(controllerWithExternal.connectionStatusText.value).toBe('Connected')
    })
  })
})

