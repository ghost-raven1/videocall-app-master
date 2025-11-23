// src/types/api.d.ts - Type definitions for API service

import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'

/**
 * API error response structure
 */
export interface APIErrorResponse {
  error?: string
  message?: string
  detail?: string
  code?: string | number
  [key: string]: unknown
}

/**
 * Extended Axios error with API-specific fields
 */
export interface APIError extends AxiosError<APIErrorResponse> {
  response?: AxiosResponse<APIErrorResponse>
  config: AxiosRequestConfig & {
    _retry?: boolean
  }
}

/**
 * API request configuration
 */
export interface APIRequestConfig extends AxiosRequestConfig {
  _retry?: boolean
}

/**
 * Credentials for authentication
 */
export interface Credentials {
  email: string
  password: string
}

/**
 * JWT token response
 */
export interface TokenResponse {
  access?: string
  refresh?: string
  access_token?: string
  refresh_token?: string
}

/**
 * Environment configuration for API
 */
export interface APIEnvironment {
  VITE_API_BASE_URL?: string
  __API_BASE_URL?: string
}

declare global {
  interface Window {
    __API_BASE_URL?: string
  }
}

export {}

