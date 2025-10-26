// src/services/api.js - API service layer with JWT support
import axios from 'axios'

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include httpOnly cookies for JWT
})

// JWT token management
const tokenManager = {
  // Get access token from httpOnly cookie (server-side only)
  getAccessToken() {
    // Access tokens are stored in httpOnly cookies and automatically sent
    return null // We don't need to read it client-side
  },

  // Get refresh token from httpOnly cookie (server-side only)
  getRefreshToken() {
    return null // We don't need to read it client-side
  },

  // Clear all auth cookies (logout)
  clearTokens() {
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  }
}

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  },
)

// Response interceptor for handling JWT authentication errors
apiClient.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`)
    return response
  },
  async (error) => {
    console.error('API Response Error:', {
      status: error.response?.status,
      message: error.response?.data?.error || error.message,
      url: error.config?.url,
    })

    // Handle JWT-specific error cases
    if (error.response?.status === 401) {
      // Unauthorized - token might be expired
      console.log('Unauthorized access - token may be expired')

      // Try to refresh token once before giving up
      if (!error.config._retry) {
        error.config._retry = true
        try {
          await jwtManager.refreshAccessToken()
          // Retry the original request
          return apiClient(error.config)
        } catch (refreshError) {
          console.warn('Token refresh failed:', refreshError)
          // Clear invalid tokens
          tokenManager.clearTokens()
          // Dispatch custom event for auth state change
          window.dispatchEvent(new CustomEvent('auth:token-expired'))
        }
      } else {
        // Clear invalid tokens if retry also failed
        tokenManager.clearTokens()
        // Dispatch custom event for auth state change
        window.dispatchEvent(new CustomEvent('auth:token-expired'))
      }
    } else if (error.response?.status === 403) {
      // Forbidden - insufficient permissions
      console.log('Forbidden access - insufficient permissions')
    } else if (error.response?.status === 429) {
      // Rate limited
      console.log('Rate limit exceeded')
    } else if (error.response?.status >= 500) {
      // Server error
      console.log('Server error occurred')
    }

    return Promise.reject(error)
  },
)

// JWT token management with automatic refresh
const jwtManager = {
  refreshPromise: null,

  async refreshAccessToken() {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = this._doRefreshToken()
    try {
      const result = await this.refreshPromise
      return result
    } finally {
      this.refreshPromise = null
    }
  },

  async _doRefreshToken() {
    try {
      const response = await apiClient.post('/authentication/token/refresh/')
      return response.data
    } catch (error) {
      console.warn('Failed to refresh JWT token:', error)
      throw error
    }
  },

  isTokenExpiringSoon(expiresAt) {
    if (!expiresAt) return false
    const now = Math.floor(Date.now() / 1000)
    const fiveMinutesFromNow = now + (5 * 60)
    return expiresAt < fiveMinutesFromNow
  },

  scheduleTokenRefresh(expiresAt) {
    if (!expiresAt) return

    const now = Math.floor(Date.now() / 1000)
    const refreshTime = (expiresAt - now - (5 * 60)) * 1000 // Refresh 5 minutes before expiry

    if (refreshTime > 0) {
      setTimeout(() => {
        this.refreshAccessToken().catch(error => {
          console.warn('Scheduled token refresh failed:', error)
        })
      }, refreshTime)
    }
  }
}

// API service object with all endpoint methods
export const apiService = {
  // Initialize JWT system
  async initialize() {
    // No client-side initialization needed for JWT with httpOnly cookies
    console.log('JWT API service initialized')
  },

  // Authentication endpoints using JWT with httpOnly cookies
  async login(credentials) {
    try {
      // Ensure credentials is an object
      const loginData = typeof credentials === 'string' ? JSON.parse(credentials) : credentials
      
      // Ensure we're sending proper JSON
      const response = await apiClient.post('/auth/token/', loginData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })

      // Schedule token refresh if we get expiration info
      if (response.data.expires_at) {
        jwtManager.scheduleTokenRefresh(response.data.expires_at)
      }

      return response
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  },

  async refreshToken() {
    return await jwtManager.refreshAccessToken()
  },

  async logout() {
    try {
      // Call server logout endpoint that clears cookies
      await apiClient.post('/auth/logout/')
    } catch (error) {
      console.warn('Server logout failed, clearing local tokens anyway:', error)
    } finally {
      // Always clear any remaining cookies on client side
      tokenManager.clearTokens()
    }
  },

  async checkAuth() {
    return apiClient.get('/auth/check/')
  },

  // Room management endpoints (no CSRF needed for JWT)
  async createRoom() {
    return apiClient.post('/rooms/create/')
  },

  async getRoomInfo(roomId) {
    return apiClient.get(`/rooms/${roomId}/`)
  },

  async joinRoom(roomIdentifier) {
    return apiClient.post('/rooms/join/', {
      room_identifier: roomIdentifier,
    })
  },

  async leaveRoom(roomId) {
    return apiClient.post(`/rooms/${roomId}/leave/`)
  },

  async deleteRoom(roomId) {
    return apiClient.delete(`/rooms/${roomId}/delete/`)
  },

  // System endpoints
  async healthCheck() {
    return apiClient.get('/health/')
  },
}

// Utility functions for API handling
export const apiUtils = {
  /**
   * Extract error message from API response
   */
  getErrorMessage(error) {
    if (error.response?.data?.error) {
      return error.response.data.error
    } else if (error.response?.data?.message) {
      return error.response.data.message
    } else if (error.message) {
      return error.message
    } else {
      return 'An unexpected error occurred'
    }
  },

  /**
   * Check if error is due to network issues
   */
  isNetworkError(error) {
    return !error.response || error.code === 'NETWORK_ERROR'
  },

  /**
   * Check if error is due to authentication
   */
  isAuthError(error) {
    return error.response?.status === 401
  },

  /**
   * Check if error is due to rate limiting
   */
  isRateLimitError(error) {
    return error.response?.status === 429
  },


  /**
   * Retry API call with exponential backoff
   */
  async retryWithBackoff(apiCall, maxRetries = 3, baseDelay = 1000) {
    let lastError

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await apiCall()
      } catch (error) {
        lastError = error

        // Don't retry on authentication errors (401/403)
        if (this.isAuthError(error)) {
          break
        }

        // Don't retry on other client errors (4xx)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          break
        }

        // Wait before retrying server errors (exponential backoff)
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError
  },

  /**
   * Refresh JWT token if needed and retry request
   */
  async retryWithTokenRefresh(apiCall) {
    try {
      return await apiCall()
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await jwtManager.refreshAccessToken()
          return await apiCall()
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
          throw error
        }
      }
      throw error
    }
  },
}

