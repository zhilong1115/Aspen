import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'

interface ErrorStateProps {
  /** Error object or message */
  error?: Error | string | null
  /** Custom title text */
  title?: string
  /** Custom description text */
  description?: string
  /** Callback when retry button is clicked */
  onRetry?: () => void
  /** Whether to show a compact version */
  compact?: boolean
  /** Custom icon */
  icon?: ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * ErrorState - Consistent error display component for failed data fetches
 */
export function ErrorState({
  error,
  title = 'Failed to load data',
  description = 'Something went wrong while loading. Please try again.',
  onRetry,
  compact = false,
  icon,
  className = '',
}: ErrorStateProps) {
  const isNetworkError =
    error instanceof Error &&
    (error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Network'))

  const errorMessage = error instanceof Error ? error.message : error

  const IconComponent = icon ? (
    icon
  ) : isNetworkError ? (
    <WifiOff size={compact ? 24 : 32} className="text-[#FF5000]" />
  ) : (
    <AlertCircle size={compact ? 24 : 32} className="text-[#FF5000]" />
  )

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 p-4 rounded-xl border border-[#FF5000]/30 bg-[#FF5000]/10 ${className}`}
      >
        {IconComponent}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{title}</p>
          {errorMessage && import.meta.env.DEV && (
            <p className="text-xs text-neutral-500 truncate">{errorMessage}</p>
          )}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 rounded-full text-xs font-bold bg-neutral-800 text-white hover:bg-neutral-700 transition-colors flex items-center gap-1"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 md:py-20 text-center ${className}`}
    >
      <div className="w-16 h-16 rounded-full bg-[#FF5000]/10 flex items-center justify-center mb-4">
        {IconComponent}
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-neutral-500 text-sm max-w-md mb-6">
        {isNetworkError
          ? 'Please check your internet connection and try again.'
          : description}
      </p>
      {errorMessage && import.meta.env.DEV && (
        <pre className="text-xs text-neutral-600 bg-neutral-900 rounded-lg p-3 mb-6 max-w-md overflow-auto">
          {errorMessage}
        </pre>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-full text-sm font-bold bg-[#00C805] text-black hover:scale-105 transition-transform flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      )}
    </div>
  )
}

/**
 * EmptyState - For when data is successfully loaded but empty
 */
interface EmptyStateProps {
  icon?: ReactNode
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon,
  title = 'No data available',
  description = 'There is nothing to show here yet.',
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 md:py-20 text-center ${className}`}
    >
      {icon && (
        <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mb-4 text-neutral-600">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-neutral-400 mb-2">{title}</h3>
      <p className="text-neutral-600 text-sm max-w-md mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 rounded-full text-sm font-bold bg-[#00C805] text-black hover:scale-105 transition-transform"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export default ErrorState
