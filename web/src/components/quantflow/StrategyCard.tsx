import React from 'react'

export interface StrategyCardData {
  id: string
  name: string
  type: string
  status: 'Running' | 'Paused' | 'Stopped'
  returnPercentage: number
  totalPnl: number
}

interface StrategyCardProps {
  strategy: StrategyCardData
  onClick?: () => void
  compact?: boolean
}

const StrategyCard: React.FC<StrategyCardProps> = ({
  strategy,
  onClick,
  compact = false,
}) => {
  const isPositive = strategy.returnPercentage >= 0

  if (compact) {
    return (
      <div
        onClick={onClick}
        className="p-3 bg-black rounded-xl border border-neutral-800 hover:border-neutral-700 cursor-pointer transition"
      >
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-sm truncate text-white">
            {strategy.name}
          </span>
          <span
            className={`text-xs font-mono ${
              isPositive ? 'text-[#00C805]' : 'text-[#FF5000]'
            }`}
          >
            {isPositive ? '+' : ''}
            {strategy.returnPercentage}%
          </span>
        </div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">
          {strategy.type}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className="bg-neutral-900 rounded-xl p-5 border border-neutral-800 active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-bold text-white text-lg">{strategy.name}</h3>
          <span className="text-xs text-gray-500 bg-neutral-800 px-2 py-0.5 rounded uppercase tracking-wider">
            {strategy.type}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span
            className={`font-bold text-lg ${
              isPositive ? 'text-[#00C805]' : 'text-[#FF5000]'
            }`}
          >
            {isPositive ? '+' : ''}
            {strategy.returnPercentage}%
          </span>
          <span className="text-xs text-gray-500">All Time</span>
        </div>
      </div>

      <div className="flex justify-between items-end mt-4">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              strategy.status === 'Running'
                ? 'bg-[#00C805] animate-pulse'
                : strategy.status === 'Paused'
                  ? 'bg-yellow-500'
                  : 'bg-gray-500'
            }`}
          />
          <span className="text-xs text-gray-400 font-medium">
            {strategy.status}
          </span>
        </div>
        <div className="text-white font-mono text-sm">
          ${strategy.totalPnl.toFixed(2)}
        </div>
      </div>
    </div>
  )
}

export default StrategyCard
