import React from 'react';
import { Strategy } from '../types';
import { Play, Pause } from 'lucide-react';
import { RH_GREEN, RH_RED } from '../constants';

interface StrategyListProps {
  strategies: Strategy[];
  onSelect: (strategy: Strategy) => void;
}

const StrategyList: React.FC<StrategyListProps> = ({ strategies, onSelect }) => {
  return (
    <div className="flex flex-col gap-4 pb-24">
      {strategies.map((strategy) => (
        <div 
            key={strategy.id} 
            onClick={() => onSelect(strategy)}
            className="bg-neutral-900 rounded-xl p-5 border border-neutral-800 active:scale-98 transition-transform cursor-pointer"
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-bold text-white text-lg">{strategy.name}</h3>
              <span className="text-xs text-gray-500 bg-neutral-800 px-2 py-0.5 rounded uppercase tracking-wider">
                {strategy.type}
              </span>
            </div>
            <div className={`flex flex-col items-end`}>
               <span className={`font-bold text-lg ${strategy.returnPercentage >= 0 ? 'text-[#00C805]' : 'text-[#FF5000]'}`}>
                 {strategy.returnPercentage >= 0 ? '+' : ''}{strategy.returnPercentage}%
               </span>
               <span className="text-xs text-gray-500">All Time</span>
            </div>
          </div>
          
          <div className="flex justify-between items-end mt-4">
             <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${strategy.status === 'Running' ? 'bg-[#00C805] animate-pulse' : 'bg-yellow-500'}`}></span>
                <span className="text-xs text-gray-400 font-medium">{strategy.status}</span>
             </div>
             <div className="text-white font-mono text-sm">
                ${strategy.totalPnl.toFixed(2)}
             </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StrategyList;