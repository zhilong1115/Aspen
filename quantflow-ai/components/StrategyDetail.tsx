import React, { useState } from 'react';
import { Strategy } from '../types';
import { ArrowLeft, Brain, TrendingUp, TrendingDown, Activity, AlertTriangle, Play, Pause, Trash2 } from 'lucide-react';
import PortfolioChart from './PortfolioChart';
import { getStrategyAnalysis } from '../services/geminiService';
import { RH_GREEN, RH_RED } from '../constants';

interface StrategyDetailProps {
  strategy: Strategy;
  onBack: () => void;
}

const StrategyDetail: React.FC<StrategyDetailProps> = ({ strategy, onBack }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const isPositive = strategy.returnPercentage >= 0;
  const accentColor = isPositive ? 'text-[#00C805]' : 'text-[#FF5000]';

  const handleRunAnalysis = async () => {
    setLoadingAi(true);
    const result = await getStrategyAnalysis(strategy);
    setAnalysis(result);
    setLoadingAi(false);
  };

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-y-auto pb-24 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-md z-10 px-4 py-4 flex items-center justify-between border-b border-neutral-900">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-neutral-800 transition">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <span className="font-medium text-lg">{strategy.name}</span>
        <div className="w-8"></div> {/* Spacer for alignment */}
      </div>

      {/* Main Metric */}
      <div className="px-6 py-6 text-center">
        <h1 className="text-4xl font-bold tracking-tighter mb-1">
            {strategy.returnPercentage > 0 ? '+' : ''}{strategy.returnPercentage}%
        </h1>
        <p className={`text-sm font-medium ${accentColor}`}>All Time Return</p>
      </div>

      {/* Mini Chart */}
      <div className="px-0 mb-8 border-b border-neutral-900 pb-4">
        <PortfolioChart data={strategy.chartData} isPositive={isPositive} />
      </div>

      {/* Actions */}
      <div className="px-6 flex gap-4 mb-8">
        <button className="flex-1 bg-white text-black font-bold py-3 rounded-full flex items-center justify-center gap-2 hover:bg-gray-200 transition">
           {strategy.status === 'Running' ? <Pause size={18} /> : <Play size={18} />}
           {strategy.status === 'Running' ? 'Pause Strategy' : 'Resume Strategy'}
        </button>
        <button className="p-3 rounded-full bg-neutral-900 text-neutral-400 hover:bg-neutral-800 transition">
           <Trash2 size={20} />
        </button>
      </div>

      {/* AI Analysis Section */}
      <div className="px-6 mb-8">
        <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-2 text-purple-400">
                <Brain className="w-5 h-5" />
                <span className="font-bold">Gemini Quant Insight</span>
             </div>
             {!analysis && (
                 <button 
                    onClick={handleRunAnalysis}
                    disabled={loadingAi}
                    className="text-xs bg-purple-900/50 text-purple-200 px-3 py-1 rounded-full hover:bg-purple-900 transition disabled:opacity-50"
                 >
                    {loadingAi ? 'Thinking...' : 'Analyze'}
                 </button>
             )}
          </div>
          <div className="text-sm text-gray-300 leading-relaxed min-h-[60px]">
             {loadingAi ? (
                 <span className="animate-pulse">Analyzing market conditions and execution history...</span>
             ) : analysis ? (
                 analysis
             ) : (
                 "Tap 'Analyze' to generate an AI-driven report on this strategy's performance, risk profile, and optimization opportunities."
             )}
          </div>
        </div>
      </div>

      {/* Key Statistics Grid */}
      <div className="px-6 mb-8">
        <h3 className="text-lg font-bold mb-4">Statistics</h3>
        <div className="grid grid-cols-2 gap-4">
            <StatCard label="Total PnL" value={`$${strategy.totalPnl.toFixed(2)}`} icon={<TrendingUp size={16} />} />
            <StatCard label="Win Rate" value={`${strategy.winRate}%`} icon={<Activity size={16} />} />
            <StatCard label="Max Drawdown" value={`${strategy.maxDrawdown}%`} icon={<TrendingDown size={16} />} />
            <StatCard label="Risk Level" value={strategy.riskLevel} icon={<AlertTriangle size={16} />} />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-6 mb-8">
        <h3 className="text-lg font-bold mb-4">Recent Trades</h3>
        <div className="space-y-4">
            {strategy.trades.map((trade) => (
                <div key={trade.id} className="flex justify-between items-center py-2 border-b border-neutral-900 last:border-0">
                    <div>
                        <div className="font-bold text-white">{trade.side} {trade.asset}</div>
                        <div className="text-xs text-gray-500">{trade.timestamp}</div>
                    </div>
                    <div className="text-right">
                        <div className={`font-bold ${trade.pnl >= 0 ? 'text-[#00C805]' : 'text-[#FF5000]'}`}>
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">{trade.size} units</div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) => (
    <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
        <div className="text-gray-500 text-xs mb-1 flex items-center gap-1">
            {icon} {label}
        </div>
        <div className="text-white font-bold text-lg">{value}</div>
    </div>
);

export default StrategyDetail;