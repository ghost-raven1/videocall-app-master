import { vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'

// Global test utilities
export const testUtils = {
  // Create a testing pinia instance
  createPinia: (options = {}) => createTestingPinia({
    createSpy: vi.fn,
    ...options
  }),

  // Create mock component props
  createProps: (defaults = {}) => ({
    ...defaults
  }),

  // Create mock emit handlers
  createEmits: () => ({ }),

  // Wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Create mock user data
  createMockUser: (overrides = {}) => ({
    id: 'user-123',
    email: 'test@example.com',
    role: 'user',
    is_active: true,
    ...overrides
  }),

  // Create mock room data
  createMockRoom: (overrides = {}) => ({
    id: 'room-123',
    name: 'Test Room',
    host_id: 'user-123',
    participants: [],
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides
  }),

  // Create mock WebRTC peer
  createMockPeer: (overrides = {}) => ({
    id: 'peer-123',
    user_id: 'user-456',
    stream: {
      getTracks: () => [
        { kind: 'video', enabled: true },
        { kind: 'audio', enabled: true }
      ]
    },
    ...overrides
  })
}

// Custom render functions with common setup
export const render = {
  // Render component with full mounting (for integration tests)
  mount: (component, options = {}) => {
    const defaultOptions = {
      global: {
        plugins: [testUtils.createPinia()],
        stubs: {
          // Stub common UI components that don't need testing
          'router-link': {
            template: '<a><slot /></a>'
          },
          'router-view': {
            template: '<div><slot /></div>'
          }
        }
      },
      ...options
    }

    return mount(component, defaultOptions)
  },

  // Render component with shallow mounting (for unit tests)
  shallow: (component, options = {}) => {
    const defaultOptions = {
      global: {
        plugins: [testUtils.createPinia()],
        stubs: {
          // Stub child components for isolation
          ...options.stubs
        }
      },
      ...options
    }

    return shallowMount(component, defaultOptions)
  }
}

// Mock API responses
export const mockApi = {
  success: (data = {}) => ({
    data,
    status: 200,
    statusText: 'OK'
  }),

  error: (message = 'Error', status = 400) => ({
    response: {
      data: { message },
      status,
      statusText: 'Error'
    }
  }),

  unauthorized: () => mockApi.error('Unauthorized', 401),

  forbidden: () => mockApi.error('Forbidden', 403),

  notFound: () => mockApi.error('Not found', 404)
}

// Mock WebSocket events
export const mockWebSocket = {
  emit: (event, data) => ({
    event,
    data,
    timestamp: Date.now()
  }),

  message: (type, payload) => ({
    type,
    payload,
    timestamp: Date.now()
  })
}

// Test data factories
export const factories = {
  user: (overrides = {}) => ({
    id: `user-${Math.random().toString(36).substr(2, 9)}`,
    email: `user${Math.random().toString(36).substr(2, 9)}@example.com`,
    role: 'user',
    is_active: true,
    first_name: 'Test',
    last_name: 'User',
    created_at: new Date().toISOString(),
    ...overrides
  }),

  room: (overrides = {}) => ({
    id: `room-${Math.random().toString(36).substr(2, 9)}`,
    name: `Test Room ${Math.random().toString(36).substr(2, 5)}`,
    host_id: `user-${Math.random().toString(36).substr(2, 9)}`,
    participants: [],
    is_active: true,
    max_participants: 10,
    created_at: new Date().toISOString(),
    ...overrides
  }),

  message: (overrides = {}) => ({
    id: `msg-${Math.random().toString(36).substr(2, 9)}`,
    user_id: `user-${Math.random().toString(36).substr(2, 9)}`,
    room_id: `room-${Math.random().toString(36).substr(2, 9)}`,
    content: 'Test message',
    type: 'text',
    created_at: new Date().toISOString(),
    ...overrides
  })
}