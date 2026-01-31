import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * ErrorBoundary catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the app.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#FF5000]/10 flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-[#FF5000]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-neutral-500 text-sm mb-6 max-w-md">
            An unexpected error occurred. Please try refreshing the page or
            contact support if the problem persists.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-xs text-neutral-600 bg-neutral-900 rounded-lg p-4 mb-6 max-w-lg overflow-auto text-left">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 bg-[#00C805] text-black flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * PageErrorBoundary - A full-page error boundary for route-level errors
 */
export class PageErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PageErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-[#FF5000]/10 flex items-center justify-center mb-6">
            <AlertTriangle size={40} className="text-[#FF5000]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Oops! Something went wrong
          </h1>
          <p className="text-neutral-500 text-base mb-8 max-w-md">
            We encountered an unexpected error. This has been logged and we'll
            look into it.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-xs text-neutral-600 bg-neutral-900 rounded-lg p-4 mb-8 max-w-2xl overflow-auto text-left">
              {this.state.error.stack || this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 bg-neutral-800 text-white border border-neutral-700"
            >
              Go Back
            </button>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 bg-[#00C805] text-black flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
