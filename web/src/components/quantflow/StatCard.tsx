import React, { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  className = '',
}) => {
  const trendColor =
    trend === 'up'
      ? 'text-[#00C805]'
      : trend === 'down'
        ? 'text-[#FF5000]'
        : 'text-white'

  return (
    <div
      className={`bg-neutral-900 p-4 rounded-xl border border-neutral-800 ${className}`}
    >
      <div className="text-gray-500 text-xs mb-1 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`font-bold text-lg ${trendColor}`}>{value}</div>
    </div>
  )
}

export default StatCard
