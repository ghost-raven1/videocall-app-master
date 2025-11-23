// src/services/error-reporting.js - Error reporting and monitoring service
import { useGlobalStore } from '../stores/global'

export class ErrorReportingService {
  // Class fields (TS) to satisfy useDefineForClassFields
  errors: any[] = []
  maxErrors: number = 100
  isProduction: boolean = false
  reportingEndpoint?: string
  apiKey?: string
  userContext: Record<string, any> = {}
  customContext: Record<string, any> = {}

  constructor() {
    this.errors = []
    this.maxErrors = 100 // Keep only the last 100 errors
    const env = (window as any).__APP_ENV || {}
    this.isProduction = env.MODE === 'production'
    this.reportingEndpoint = env.VITE_ERROR_REPORTING_URL
    this.apiKey = env.VITE_ERROR_REPORTING_API_KEY

    // Initialize error reporting
    this.initialize()
  }

  initialize() {
    // Set up periodic error reporting in production
    if (this.isProduction && this.reportingEndpoint) {
      // Report errors every 30 seconds if there are new errors
      setInterval(() => {
        this.flushErrors()
      }, 30000)
    }

    // Report errors before page unload
    window.addEventListener('beforeunload', () => {
      this.flushErrors()
    })

    // Report errors on visibility change (when user switches tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.flushErrors()
      }
    })

    console.log('Error reporting service initialized')
  }

  /**
   * Capture an error with context information
   */
  captureError(error: any, context: Record<string, any> = {}) {
    const errorInfo = {
      message: error.message || error.toString(),
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId(),
      context,
      severity: context.severity || 'error',
      type: context.type || 'unknown',
      metadata: {
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        screen: `${screen.width}x${screen.height}`,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        online: navigator.onLine,
        memoryUsage: this.getMemoryUsage(),
      }
    }

    // Add to local errors array
    this.errors.push(errorInfo)

    // Keep only the last maxErrors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors)
    }

    // Log to console in development
    if (!this.isProduction) {
      console.group('🚨 Error Captured')
      console.error('Error:', errorInfo.message)
      console.log('Context:', context)
      console.log('Full Error Info:', errorInfo)
      console.groupEnd()
    }

    // Report immediately for critical errors
    if (context.severity === 'critical') {
      this.reportError(errorInfo)
    }
  }

  /**
   * Capture a message (for logging purposes)
   */
  captureMessage(message: string, level: 'info'|'warning'|'error' = 'info', context: Record<string, any> = {}) {
    const messageInfo = {
      message,
      level,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      context,
      type: 'message'
    }

    if (!this.isProduction) {
      console.log(`[${level.toUpperCase()}] ${message}`, context)
    }

    // Add to errors array if it's a warning or error
    if (level === 'warning' || level === 'error') {
      this.errors.push(messageInfo)
      if (this.errors.length > this.maxErrors) {
        this.errors = this.errors.slice(-this.maxErrors)
      }
    }
  }

  /**
   * Flush all pending errors to the reporting service
   */
  async flushErrors() {
    if (this.errors.length === 0) return

    const errorsToReport = [...this.errors]
    this.errors = [] // Clear the array after taking the errors

    if (this.isProduction && this.reportingEndpoint) {
      try {
        await this.sendToReportingService(errorsToReport)
      } catch (error) {
        console.error('Failed to report errors:', error)
        // Put errors back if reporting failed
        this.errors.unshift(...errorsToReport)
      }
    }
  }

  /**
   * Send errors to the external reporting service
   */
  async sendToReportingService(errors: any[]) {
    if (!this.reportingEndpoint) return

    try {
      const response = await fetch(this.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify({
          errors,
          appVersion: ((window as any).__APP_ENV?.VITE_APP_VERSION) || '1.0.0',
          environment: ((window as any).__APP_ENV?.MODE) || 'development',
          timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error(`Reporting service responded with ${response.status}`)
      }

      console.log(`Reported ${errors.length} errors to external service`)
    } catch (error) {
      console.error('Failed to send errors to reporting service:', error)
      throw error
    }
  }

  /**
   * Report a single error immediately
   */
  async reportError(errorInfo) {
    if (this.isProduction && this.reportingEndpoint) {
      try {
        await this.sendToReportingService([errorInfo])
      } catch (error) {
        console.error('Failed to report critical error:', error)
      }
    }
  }

  /**
   * Get current user ID (if authenticated)
   */
  getCurrentUserId() {
    try {
      // Try to get user info from the global store
      const globalStore = useGlobalStore()
      return globalStore.isAuthenticated ? 'authenticated-user' : 'anonymous'
    } catch {
      return 'unknown'
    }
  }

  /**
   * Get or create session ID
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem('error_session_id')
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      sessionStorage.setItem('error_session_id', sessionId)
    }
    return sessionId
  }

  /**
   * Get memory usage information (if available)
   */
  getMemoryUsage() {
    if ('memory' in (performance as any)) {
      const memInfo = (performance as any).memory as {
        usedJSHeapSize: number
        totalJSHeapSize: number
        jsHeapSizeLimit: number
      }
      return {
        used: Math.round(memInfo.usedJSHeapSize / 1048576), // Convert to MB
        total: Math.round(memInfo.totalJSHeapSize / 1048576),
        limit: Math.round(memInfo.jsHeapSizeLimit / 1048576)
      }
    }
    return null
  }

  /**
   * Get all captured errors (for debugging)
   */
  getErrors() {
    return [...this.errors]
  }

  /**
   * Clear all captured errors
   */
  clearErrors() {
    this.errors = []
  }

  /**
   * Set user context for error reporting
   */
  setUserContext(userContext) {
    this.userContext = { ...this.userContext, ...userContext }
  }

  /**
   * Set custom context for error reporting
   */
  setCustomContext(customContext) {
    this.customContext = { ...this.customContext, ...customContext }
  }
}

// Create singleton instance
export const errorReportingService = new ErrorReportingService()

// Vue plugin for easy access in components
export const ErrorReportingPlugin = {
  install(app) {
    app.config.globalProperties.$errorReporting = errorReportingService

    // Add $captureError and $captureMessage to all components
    app.mixin({
      methods: {
        $captureError(error, context) {
          errorReportingService.captureError(error, context)
        },
        $captureMessage(message, level, context) {
          errorReportingService.captureMessage(message, level, context)
        }
      }
    })
  }
}
