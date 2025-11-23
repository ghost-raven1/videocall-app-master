// src/types/errors.d.ts - Type definitions for error handling

/**
 * Error severity levels
 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical'

/**
 * Error types
 */
export type ErrorType =
  | 'unknown'
  | 'vue-error'
  | 'javascript-error'
  | 'unhandled-rejection'
  | 'api-error'
  | 'webrtc-error'
  | 'websocket-error'
  | 'network-error'
  | 'validation-error'
  | 'authentication-error'
  | 'authorization-error'

/**
 * Error metadata
 */
export interface ErrorMetadata {
  viewport: string
  screen: string
  language: string
  timezone: string
  online: boolean
  memoryUsage: MemoryUsage | null
}

/**
 * Memory usage information
 */
export interface MemoryUsage {
  used: number // MB
  total: number // MB
  limit: number // MB
}

/**
 * Error context information
 */
export interface ErrorContext {
  severity?: ErrorSeverity
  type?: ErrorType
  component?: string
  [key: string]: unknown
}

/**
 * Base error information
 */
export interface BaseErrorInfo {
  message: string
  timestamp: string
  url: string
  type: ErrorType | 'message'
  context?: ErrorContext
}

/**
 * Error information for captured errors
 */
export interface ErrorInfo extends BaseErrorInfo {
  stack?: string
  userAgent: string
  userId: string
  sessionId: string
  severity: ErrorSeverity
  metadata: ErrorMetadata
  context: ErrorContext
}

/**
 * Message information for captured messages
 */
export interface MessageInfo extends BaseErrorInfo {
  level: 'info' | 'warning' | 'error'
  message: string
  context: ErrorContext
}

/**
 * Union type for all error-related information
 */
export type ErrorReport = ErrorInfo | MessageInfo

/**
 * User context for error reporting
 */
export interface UserContext {
  userId?: string
  username?: string
  email?: string
  [key: string]: unknown
}

/**
 * Custom context for error reporting
 */
export interface CustomContext {
  [key: string]: unknown
}

/**
 * Environment information
 */
export interface AppEnvironment {
  MODE?: string
  VITE_APP_VERSION?: string
  VITE_ERROR_REPORTING_URL?: string
  VITE_ERROR_REPORTING_API_KEY?: string
}

/**
 * Performance memory API (if available)
 */
export interface PerformanceMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

/**
 * Extended Performance interface with memory
 */
export interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory
}

/**
 * Window interface with app environment
 */
declare global {
  interface Window {
    __APP_ENV?: AppEnvironment
  }
}

export {}

