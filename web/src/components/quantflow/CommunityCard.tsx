import React from 'react'
import { Users, TrendingUp } from 'lucide-react'

export interface CommunityStrategyData {
  id: string
  name: string
  creator: string
  description: string
  returnPercentage: number
  followers: number
  winRate: number
}

interface CommunityCardProps {
  strategy: CommunityStrategyData
  onClick?: () => void
  onCopy?: () => void
}

const CommunityCard: React.FC<CommunityCardProps> = ({
  strategy,
  onClick,
  onCopy,
}) => {
  const creatorInitial = strategy.creator.length > 1 
    ? strategy.creator[1].toUpperCase() 
    : strategy.creator[0].toUpperCase()

  return (
    <div
      onClick={onClick}
      className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 hover:border-purple-500/50 transition-all cursor-pointer group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-4 items-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-xl text-white">
            {creatorInitial}
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">{strategy.name}</h3>
            <p className="text-sm text-purple-400 font-medium">
              {strategy.creator}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[#00C805] font-bold text-xl">
            +{strategy.returnPercentage}%
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-widest">
            Historical
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-6 line-clamp-2">
        {strategy.description}
      </p>

      <div className="flex justify-between items-center border-t border-neutral-800 pt-4">
        <div className="flex gap-6">
          <div className="flex items-center gap-2 text-gray-500">
            <Users size={16} />
            <span className="text-xs font-bold">
              {strategy.followers.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <TrendingUp size={16} />
            <span className="text-xs font-bold">{strategy.winRate}% Win</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onCopy?.()
          }}
          className="text-xs bg-white text-black px-4 py-2 rounded-full font-bold group-hover:bg-[#00C805] group-hover:text-white transition-colors"
        >
          Copy Strategy
        </button>
      </div>
    </div>
  )
}

export default CommunityCard
