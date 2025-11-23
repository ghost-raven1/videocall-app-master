// src/services/api.ts - API service layer with JWT support
import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import type { APIError, APIRequestConfig, Credentials, TokenResponse, APIEnvironment } from '../types/api'

// Create axios instance with base configuration
// In dev mode, always use relative path which will be proxied by Vite
// In production, use VITE_API_BASE_URL if set
const apiBaseURL = import.meta.env.PROD 
  ? (import.meta.env.VITE_API_BASE_URL || (window.__API_BASE_URL) || '/api')
  : '/api' // Use relative path in dev - Vite will proxy it to backend
const apiClient = axios.create({
  baseURL: apiBaseURL,
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

// Response interceptor for handling JWT authentication errors and showing user-friendly messages
apiClient.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`)
    return response
  },
  async (error: APIError) => {
    const errorStatus = error.response?.status
    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message
    const errorUrl = error.config?.url

    console.error('API Response Error:', {
      status: errorStatus,
      message: errorMessage,
      url: errorUrl,
    })

    // Try to get global store for notifications
    let globalStore = null
    try {
      const { useGlobalStore } = await import('../stores/global')
      globalStore = useGlobalStore()
    } catch (e) {
      // Store not available, skip notifications
    }

    // Handle JWT-specific error cases
    if (errorStatus === 401) {
      // Unauthorized - token might be expired
      console.log('Unauthorized access - token may be expired')

      // Try to refresh token once before giving up
      const config = error.config as APIRequestConfig
      if (!config._retry) {
        config._retry = true
        try {
          await jwtManager.refreshAccessToken()
          // Retry the original request
          return apiClient(config)
        } catch (refreshError) {
          console.warn('Token refresh failed:', refreshError)
          // Clear invalid tokens
          tokenManager.clearTokens()
          // Dispatch custom event for auth state change
          window.dispatchEvent(new CustomEvent('auth:token-expired'))
          
          if (globalStore) {
            globalStore.addNotification('Session expired. Please log in again.', 'warning', 5000)
          }
        }
      } else {
        // Clear invalid tokens if retry also failed
        tokenManager.clearTokens()
        // Dispatch custom event for auth state change
        window.dispatchEvent(new CustomEvent('auth:token-expired'))
        
        if (globalStore) {
          globalStore.addNotification('Session expired. Please log in again.', 'warning', 5000)
        }
      }
    } else if (errorStatus === 403) {
      // Forbidden - insufficient permissions
      console.log('Forbidden access - insufficient permissions')
      if (globalStore) {
        globalStore.addNotification('You do not have permission to perform this action.', 'error', 5000)
      }
    } else if (errorStatus === 404) {
      // Not found
      if (globalStore && !errorUrl?.includes('/health/')) {
        globalStore.addNotification('Resource not found.', 'error', 4000)
      }
    } else if (errorStatus === 429) {
      // Rate limited
      console.log('Rate limit exceeded')
      if (globalStore) {
        globalStore.addNotification('Too many requests. Please wait a moment and try again.', 'warning', 5000)
      }
    } else if (errorStatus >= 500) {
      // Server error
      console.log('Server error occurred')
      if (globalStore) {
        globalStore.addNotification('Server error. Please try again later.', 'error', 6000)
      }
    } else if (!error.response) {
      // Network error
      console.error('Network error - no response from server')
      if (globalStore) {
        globalStore.addNotification('Network error. Please check your connection.', 'error', 5000)
      }
    } else if (errorMessage && globalStore && errorStatus !== 401 && errorStatus !== 403) {
      // Show user-friendly error message for other errors
      const userMessage = typeof errorMessage === 'string' ? errorMessage : 'An error occurred. Please try again.'
      globalStore.addNotification(userMessage, 'error', 5000)
    }

    return Promise.reject(error)
  },
)

// JWT token management with automatic refresh
const jwtManager = {
  refreshPromise: null,

  async refreshAccessToken(): Promise<TokenResponse> {
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

  async _doRefreshToken(): Promise<TokenResponse> {
    try {
      const response = await apiClient.post<TokenResponse>('/auth/token/refresh/')
      return response.data
    } catch (error) {
      console.warn('Failed to refresh JWT token:', error)
      throw error
    }
  },

  isTokenExpiringSoon(expiresAt: number | null | undefined): boolean {
    if (!expiresAt) return false
    const now = Math.floor(Date.now() / 1000)
    const fiveMinutesFromNow = now + (5 * 60)
    return expiresAt < fiveMinutesFromNow
  },

  scheduleTokenRefresh(expiresAt: number | null | undefined): void {
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
  /**
   * Инициализация JWT-слоя
   * @returns {Promise<void>}
   */
  async initialize() {
    // No client-side initialization needed for JWT with httpOnly cookies
    console.log('JWT API service initialized')
  },

  // Authentication endpoints using JWT with httpOnly cookies
  /**
   * Вход по email и паролю
   */
  async login(credentials: Credentials | string) {
    try {
      // Ensure credentials is an object
      let loginData: Credentials
      if (typeof credentials === 'string') {
        try {
          loginData = JSON.parse(credentials)
        } catch (error) {
          throw new Error('Invalid credentials format')
        }
      } else {
        loginData = credentials
      }
      
      // Validate input
      if (!loginData.email || !loginData.password) {
        throw new Error('Email and password are required')
      }
      
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginData.email)) {
        throw new Error('Invalid email format')
      }
      
      if (loginData.password.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }
      
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

  /**
   * Обновление access токена по refresh-cookie
   * @returns {Promise<any>}
   */
  async refreshToken() {
    return await jwtManager.refreshAccessToken()
  },

  /**
   * Выход и очистка httpOnly cookies
   * @returns {Promise<void>}
   */
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

  /**
   * Проверка авторизации
   * @returns {Promise<import('axios').AxiosResponse<any>>}
   */
  async checkAuth() {
    return apiClient.get('/auth/check/')
  },

  // Room management endpoints (no CSRF needed for JWT)
  /**
   * Создание комнаты
   * @param participantName - Имя участника (необязательно)
   * @param roomPassword - Пароль комнаты (необязательно)
   * @returns {Promise<import('axios').AxiosResponse<any>>}
   */
  async createRoom(participantName?: string, roomPassword?: string) {
    const payload: any = {}
    if (participantName) {
      payload.participant_name = participantName
    }
    if (roomPassword) {
      payload.room_password = roomPassword
    }
    return apiClient.post('/rooms/create/', Object.keys(payload).length > 0 ? payload : undefined)
  },

  /**
   * Получение информации о комнате
   */
  async getRoomInfo(roomId: string) {
    return apiClient.get(`/rooms/${roomId}/`)
  },

  /**
   * Присоединение к комнате
   * @param roomIdentifier - Код или ID комнаты
   * @param roomPassword - Пароль комнаты (необязательно)
   * @param participantName - Имя участника (необязательно)
   */
  async joinRoom(roomIdentifier: string, roomPassword?: string, participantName?: string) {
    const payload: any = {
      room_identifier: roomIdentifier,
    }
    if (roomPassword) {
      payload.room_password = roomPassword
    }
    if (participantName) {
      payload.participant_name = participantName
    }
    return apiClient.post('/rooms/join/', payload)
  },

  /**
   * Выход из комнаты
   */
  async leaveRoom(roomId: string) {
    return apiClient.post(`/rooms/${roomId}/leave/`)
  },

  /**
   * Удаление комнаты
   */
  async deleteRoom(roomId: string) {
    return apiClient.delete(`/rooms/${roomId}/delete/`)
  },

  /**
   * Проверка здоровья комнаты и SFU
   */
  async getRoomHealth(roomId: string) {
    return apiClient.get(`/rooms/${roomId}/health/`)
  },

  /**
   * Получение статистики SFU сервера
   * @returns {Promise<import('axios').AxiosResponse<any>>}
   */
  async getSFUServerStats() {
    return apiClient.get('/rooms/sfu/server/stats/')
  },

  // Chat endpoints
  /**
   * Send chat message
   */
  async sendChatMessage(roomCode: string, participantId: string, content: string, messageType: string = 'text', replyTo?: string) {
    return apiClient.post('/rooms/chat/messages/', {
      room_code: roomCode,
      participant_id: participantId,
      content,
      message_type: messageType,
      reply_to: replyTo
    })
  },

  /**
   * Upload chat file attachment
   */
  async uploadChatFile(roomCode: string, participantId: string, file: File, messageId?: string) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('room_code', roomCode)
    formData.append('participant_id', participantId)
    if (messageId) {
      formData.append('message_id', messageId)
    }
    
    return apiClient.post('/rooms/chat/attachments/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  /**
   * Get chat history
   */
  async getChatHistory(roomCode: string, limit: number = 100, offset: number = 0) {
    return apiClient.get('/rooms/chat/messages/history/', {
      params: {
        room_code: roomCode,
        limit,
        offset
      }
    })
  },

  /**
   * Edit chat message
   */
  async editChatMessage(messageId: string, participantId: string, content: string) {
    return apiClient.put(`/rooms/chat/messages/${messageId}/edit/`, {
      participant_id: participantId,
      content
    })
  },

  /**
   * Delete chat message
   */
  async deleteChatMessage(messageId: string, participantId: string) {
    return apiClient.delete(`/rooms/chat/messages/${messageId}/soft_delete/`, {
      data: {
        participant_id: participantId
      }
    })
  },

  // System endpoints
  /**
   * Проверка здоровья API
   * @returns {Promise<import('axios').AxiosResponse<any>>}
   */
  async healthCheck() {
    return apiClient.get('/health/')
  },
}

// Utility functions for API handling
export const apiUtils = {
  /**
   * Extract error message from API response
   */
  getErrorMessage(error: APIError | Error | unknown): string {
    if (error && typeof error === 'object' && 'response' in error) {
      const apiError = error as APIError
      if (apiError.response?.data?.error) {
        return String(apiError.response.data.error)
      } else if (apiError.response?.data?.message) {
        return String(apiError.response.data.message)
      }
    }
    
    if (error instanceof Error) {
      return error.message
    }
    
    return 'An unexpected error occurred'
  },

  /**
   * Check if error is due to network issues
   */
  isNetworkError(error: APIError | Error | unknown): boolean {
    if (error && typeof error === 'object' && 'response' in error) {
      const apiError = error as APIError
      return !apiError.response || apiError.code === 'NETWORK_ERROR'
    }
    return false
  },

  /**
   * Check if error is due to authentication
   */
  isAuthError(error: APIError | Error | unknown): boolean {
    if (error && typeof error === 'object' && 'response' in error) {
      const apiError = error as APIError
      return apiError.response?.status === 401
    }
    return false
  },

  /**
   * Check if error is due to rate limiting
   */
  isRateLimitError(error: APIError | Error | unknown): boolean {
    if (error && typeof error === 'object' && 'response' in error) {
      const apiError = error as APIError
      return apiError.response?.status === 429
    }
    return false
  },


  /**
   * Retry API call with exponential backoff
   */
  async retryWithBackoff<T = unknown>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
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
  async retryWithTokenRefresh<T = unknown>(apiCall: () => Promise<T>): Promise<T> {
    try {
      return await apiCall()
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as APIError
        if (apiError.response?.status === 401) {
          try {
            await jwtManager.refreshAccessToken()
            return await apiCall()
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError)
            throw error
          }
        }
      }
      throw error
    }
  },
}
