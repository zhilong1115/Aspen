import { type HTMLAttributes } from 'react'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string
}

/**
 * Base Skeleton component - animated loading placeholder
 */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-neutral-900 rounded-lg ${className}`}
      {...props}
    />
  )
}

/**
 * Text skeleton - for single lines of text
 */
export function SkeletonText({ className = '', ...props }: SkeletonProps) {
  return <Skeleton className={`h-4 ${className}`} {...props} />
}

/**
 * Card skeleton - for card-shaped loading states
 */
export function SkeletonCard({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`rounded-xl border border-neutral-900 p-4 ${className}`}
      {...props}
    >
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
    </div>
  )
}

/**
 * Chart skeleton - for chart loading states
 */
export function SkeletonChart({
  className = '',
  height = 280,
}: SkeletonProps & { height?: number }) {
  return (
    <div className={`relative ${className}`} style={{ height }}>
      <Skeleton className="w-full h-full" />
      <div className="absolute inset-0 flex items-end justify-around p-4 gap-2">
        {[40, 65, 35, 80, 55, 70, 45, 60, 50, 75, 30, 85].map((h, i) => (
          <Skeleton key={i} className="w-full" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}

/**
 * Table row skeleton
 */
export function SkeletonTableRow({
  columns = 4,
  className = '',
}: SkeletonProps & { columns?: number }) {
  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 border-b border-neutral-900 ${className}`}
    >
      {[...Array(columns)].map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === 0 ? 'w-32' : 'flex-1'}`} />
      ))}
    </div>
  )
}

/**
 * List skeleton - for list items
 */
export function SkeletonList({
  count = 3,
  className = '',
}: SkeletonProps & { count?: number }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border border-neutral-900"
        >
          <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}

/**
 * Dashboard skeleton - combined skeleton for dashboard pages
 */
export function DashboardSkeleton() {
  return (
    <div className="max-w-3xl mx-auto pb-8 space-y-6 animate-pulse">
      {/* Header */}
      <div className="px-2">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-12 w-48 mb-2" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Chart */}
      <SkeletonChart height={280} />

      {/* Time range pills */}
      <div className="flex gap-2 px-2">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-12 rounded-full" />
        ))}
      </div>

      {/* Stats */}
      <div className="border-t border-neutral-900 pt-4 px-2">
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Positions */}
      <div className="border-t border-neutral-900 pt-4 px-2">
        <Skeleton className="h-6 w-36 mb-4" />
        <SkeletonList count={2} />
      </div>
    </div>
  )
}

/**
 * Portfolio skeleton - for portfolio page
 */
export function PortfolioSkeleton() {
  return (
    <div className="max-w-3xl md:max-w-6xl mx-auto pb-8">
      <div className="md:grid md:grid-cols-5 md:gap-10">
        {/* Left Column */}
        <div className="md:col-span-3 space-y-6">
          <div className="px-2 pt-2">
            <Skeleton className="h-4 w-28 mb-2" />
            <Skeleton className="h-12 w-48 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>
          <SkeletonChart height={280} />
          <div className="flex gap-2 px-2">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-12 rounded-full" />
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="md:col-span-2 md:border-l md:border-neutral-900 md:pl-8 mt-6 md:mt-0">
          <Skeleton className="h-6 w-32 mb-4" />
          <SkeletonList count={4} />
        </div>
      </div>
    </div>
  )
}

/**
 * Traders page skeleton
 */
export function TradersSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
      </div>

      {/* Config Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-900 p-5">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-8 h-8" />
              <Skeleton className="h-6 w-24" />
            </div>
            <SkeletonList count={2} />
          </div>
        ))}
      </div>

      {/* Traders List */}
      <div className="rounded-xl border border-neutral-900 p-6">
        <Skeleton className="h-6 w-36 mb-6" />
        <SkeletonList count={3} />
      </div>
    </div>
  )
}

/**
 * Community page skeleton
 */
export function CommunitySkeleton() {
  return (
    <div className="min-h-screen bg-black pb-8 animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="w-7 h-7" />
          <Skeleton className="h-8 w-56" />
        </div>
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3.5 flex items-center gap-3"
          >
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-3 w-20 mb-1" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <SkeletonList count={5} />
    </div>
  )
}

export default Skeleton
