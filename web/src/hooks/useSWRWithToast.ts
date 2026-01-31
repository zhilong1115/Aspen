import useSWR from 'swr'
import type { SWRConfiguration, SWRResponse, Key } from 'swr'
import { useEffect, useRef } from 'react'
import { notify } from '../lib/notify'

interface UseSWRWithToastOptions<Data, Error>
  extends SWRConfiguration<Data, Error> {
  /** Whether to show error toasts (default: true) */
  showErrorToast?: boolean
  /** Custom error message (overrides default) */
  errorMessage?: string
  /** Whether to show success toast on first load */
  showSuccessToast?: boolean
  /** Custom success message */
  successMessage?: string
  /** Whether to suppress specific error codes from showing toasts */
  suppressErrorCodes?: number[]
}

/**
 * useSWRWithToast - A wrapper around useSWR that shows toast notifications for errors
 *
 * @example
 * const { data, error, isLoading } = useSWRWithToast(
 *   'my-key',
 *   fetcher,
 *   { errorMessage: 'Failed to load items' }
 * )
 */
export function useSWRWithToast<Data = any, Error = any>(
  key: Key,
  fetcher: ((key: any) => Promise<Data>) | null,
  options: UseSWRWithToastOptions<Data, Error> = {}
): SWRResponse<Data, Error> {
  const {
    showErrorToast = true,
    errorMessage,
    showSuccessToast = false,
    successMessage,
    suppressErrorCodes = [401, 403], // Don't show toasts for auth errors by default
    ...swrOptions
  } = options

  const result = useSWR<Data, Error>(key, fetcher, swrOptions)

  // Track if we've shown an error toast for this error
  const lastErrorRef = useRef<Error | null>(null)
  const hasShownSuccessRef = useRef(false)

  // Show error toast when error occurs
  useEffect(() => {
    if (
      showErrorToast &&
      result.error &&
      result.error !== lastErrorRef.current
    ) {
      lastErrorRef.current = result.error

      // Check if we should suppress this error
      const errorStatus = (result.error as any)?.status
      if (suppressErrorCodes.includes(errorStatus)) {
        return
      }

      const message = errorMessage || getDefaultErrorMessage(result.error)
      notify.error(message)
    }
  }, [result.error, showErrorToast, errorMessage, suppressErrorCodes])

  // Show success toast on first successful load
  useEffect(() => {
    if (
      showSuccessToast &&
      result.data &&
      !hasShownSuccessRef.current &&
      !result.isLoading
    ) {
      hasShownSuccessRef.current = true
      notify.success(successMessage || 'Data loaded successfully')
    }
  }, [result.data, result.isLoading, showSuccessToast, successMessage])

  // Reset success toast tracking when key changes
  useEffect(() => {
    hasShownSuccessRef.current = false
    lastErrorRef.current = null
  }, [key])

  return result
}

/**
 * Get a user-friendly error message from various error types
 */
function getDefaultErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'Network error. Please check your connection.'
    }
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again.'
    }
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as { status?: number; message?: string }
    if (err.status) {
      switch (err.status) {
        case 429:
          return 'Too many requests. Please wait a moment.'
        case 500:
          return 'Server error. Please try again later.'
        case 502:
        case 503:
        case 504:
          return 'Service temporarily unavailable.'
        default:
          return err.message || 'An error occurred'
      }
    }
    return err.message || 'An error occurred'
  }

  return 'An unexpected error occurred'
}

export default useSWRWithToast
