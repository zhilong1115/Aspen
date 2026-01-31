import { SWRConfig } from 'swr'
import type { SWRConfiguration } from 'swr'
import type { ReactNode } from 'react'
import { notify } from './notify'

/**
 * Default SWR configuration with retry logic and error handling
 */
export const swrConfig: SWRConfiguration = {
  // Retry configuration
  errorRetryCount: 3,
  errorRetryInterval: 1000, // 1 second between retries

  // Revalidation settings
  revalidateOnFocus: false, // Don't refetch on window focus (can be noisy)
  revalidateOnReconnect: true, // Refetch when network reconnects
  dedupingInterval: 5000, // Dedupe requests within 5 seconds

  // Keep previous data while revalidating
  keepPreviousData: true,

  // Global error handler - shows toast for network errors
  onError: (error, key) => {
    // Don't show toast for expected errors or when user is not authenticated
    if (error?.status === 401 || error?.status === 403) {
      // Auth errors are handled by the auth context
      return
    }

    // Only log in development
    if (import.meta.env.DEV) {
      console.error(`SWR Error [${key}]:`, error)
    }

    // Show toast for network/server errors
    const message = getErrorMessage(error)
    notify.error(message)
  },

  // Custom shouldRetryOnError - don't retry on auth or client errors
  shouldRetryOnError: (error) => {
    // Don't retry on 4xx errors (client errors)
    if (error?.status >= 400 && error?.status < 500) {
      return false
    }
    // Retry on network errors and 5xx server errors
    return true
  },

  // Loading timeout - trigger slow loading state after 3 seconds
  loadingTimeout: 3000,

  // Suspense mode disabled by default (opt-in per component)
  suspense: false,
}

/**
 * Extract a user-friendly error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('fetch')) {
      return 'Network error. Please check your connection.'
    }
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again.'
    }
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as {
      status?: number
      message?: string
      statusText?: string
    }

    // Handle HTTP status codes
    if (err.status) {
      switch (err.status) {
        case 400:
          return 'Invalid request. Please check your input.'
        case 404:
          return 'Resource not found.'
        case 429:
          return 'Too many requests. Please wait a moment.'
        case 500:
          return 'Server error. Please try again later.'
        case 502:
        case 503:
        case 504:
          return 'Service temporarily unavailable. Please try again.'
        default:
          return err.message || err.statusText || 'An error occurred'
      }
    }

    return err.message || 'An error occurred'
  }

  return 'An unexpected error occurred'
}

/**
 * SWR Provider component - wrap your app to use global configuration
 */
export function SWRProvider({ children }: { children: ReactNode }) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>
}

/**
 * Custom error class for API errors with status codes
 */
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export default SWRProvider
