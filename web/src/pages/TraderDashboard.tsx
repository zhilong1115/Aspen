import {
  Bot,
  Brain,
  Check,
  ChevronDown,
  PieChart,
  RefreshCw,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useSWR from 'swr'
import AILearning from '../components/AILearning'
import { EquityChart } from '../components/EquityChart'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { t, type Language } from '../i18n/translations'
import { api } from '../lib/api'
import type {
  AccountInfo,
  DecisionRecord,
  Position,
  Statistics,
  SystemStatus,
  TraderInfo,
} from '../types'

function getModelDisplayName(modelId: string): string {
  switch (modelId.toLowerCase()) {
    case 'deepseek':
      return 'DeepSeek'
    case 'qwen':
      return 'Qwen'
    case 'claude':
      return 'Claude'
    default:
      return modelId.toUpperCase()
  }
}

export default function TraderDashboard() {
  const { language } = useLanguage()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedTraderId, setSelectedTraderId] = useState<string | undefined>(
    searchParams.get('trader') || undefined
  )
  const [lastUpdate, setLastUpdate] = useState<string>('--:--:--')
  const [timeRange, setTimeRange] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1W')

  const { data: traders, error: tradersError } = useSWR<TraderInfo[]>(
    user && token ? 'traders' : null,
    api.getTraders,
    { refreshInterval: 10000, shouldRetryOnError: false }
  )

  useEffect(() => {
    if (traders && traders.length > 0 && !selectedTraderId) {
      const firstTraderId = traders[0].trader_id
      setSelectedTraderId(firstTraderId)
      setSearchParams({ trader: firstTraderId })
    }
  }, [traders, selectedTraderId, setSearchParams])

  const handleTraderSelect = (traderId: string) => {
    setSelectedTraderId(traderId)
    setSearchParams({ trader: traderId })
  }

  const { data: status } = useSWR<SystemStatus>(
    selectedTraderId ? `status-${selectedTraderId}` : null,
    () => api.getStatus(selectedTraderId),
    { refreshInterval: 15000, revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const { data: account } = useSWR<AccountInfo>(
    selectedTraderId ? `account-${selectedTraderId}` : null,
    () => api.getAccount(selectedTraderId),
    { refreshInterval: 15000, revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const { data: positions } = useSWR<Position[]>(
    selectedTraderId ? `positions-${selectedTraderId}` : null,
    () => api.getPositions(selectedTraderId),
    { refreshInterval: 15000, revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const { data: decisions } = useSWR<DecisionRecord[]>(
    selectedTraderId ? `decisions/latest-${selectedTraderId}` : null,
    () => api.getLatestDecisions(selectedTraderId),
    { refreshInterval: 30000, revalidateOnFocus: false, dedupingInterval: 20000 }
  )

  const { data: stats } = useSWR<Statistics>(
    selectedTraderId ? `statistics-${selectedTraderId}` : null,
    () => api.getStatistics(selectedTraderId),
    { refreshInterval: 30000, revalidateOnFocus: false, dedupingInterval: 20000 }
  )

  void stats

  useEffect(() => {
    if (account) {
      setLastUpdate(new Date().toLocaleTimeString())
    }
  }, [account])

  const selectedTrader = traders?.find((t) => t.trader_id === selectedTraderId)
  const totalEquity = account?.total_equity ?? 0
  const totalPnl = account?.total_pnl ?? 0
  const totalPnlPct = account?.total_pnl_pct ?? 0
  const isPositive = totalPnl >= 0

  // Empty states
  if (tradersError || (traders && traders.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center bg-neutral-900 border border-neutral-800">
            <Bot size={48} className="text-[#00C805]" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-white">
            {t('dashboardEmptyTitle', language)}
          </h2>
          <p className="text-base mb-6 text-gray-500">
            {t('dashboardEmptyDescription', language)}
          </p>
          <button
            onClick={() => navigate('/traders')}
            className="px-6 py-3 rounded-full font-bold transition-all hover:scale-105 bg-[#00C805] text-black"
          >
            {t('goToTradersPage', language)}
          </button>
        </div>
      </div>
    )
  }

  // Loading skeleton
  if (!selectedTrader) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-neutral-900 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-neutral-900 rounded-xl" />
          ))}
        </div>
        <div className="h-80 bg-neutral-900 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Portfolio Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#00C805]">
              <Bot size={20} className="text-black" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{selectedTrader.trader_name}</h1>
              <span className="text-xs text-gray-500">
                {getModelDisplayName(selectedTrader.ai_model.split('_').pop() || selectedTrader.ai_model)}
                {status && ` • ${status.call_count} cycles`}
              </span>
            </div>
          </div>

          {traders && traders.length > 1 && (
            <div className="relative">
              <select
                value={selectedTraderId}
                onChange={(e) => handleTraderSelect(e.target.value)}
                className="appearance-none bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 pr-8 text-sm text-white focus:outline-none focus:border-[#00C805] cursor-pointer"
              >
                {traders.map((trader) => (
                  <option key={trader.trader_id} value={trader.trader_id}>
                    {trader.trader_name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Big Portfolio Value */}
        <div className="pt-4 pb-2">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white">
            ${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <div className={`flex items-center gap-2 text-sm font-medium mt-1 ${isPositive ? 'text-[#00C805]' : 'text-[#FF5000]'}`}>
            <span>{isPositive ? '+' : ''}{totalPnl.toFixed(2)} USDT</span>
            <span>({isPositive ? '+' : ''}{totalPnlPct.toFixed(2)}%)</span>
            <span className="text-gray-500 uppercase text-xs">All Time</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-6 bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
        <div className="p-4">
          <EquityChart traderId={selectedTrader.trader_id} />
        </div>
        <div className="flex justify-between px-4 py-3 border-t border-neutral-800">
          {(['1D', '1W', '1M', '3M', '1Y'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`text-xs font-bold py-1 px-4 rounded-md transition-colors ${
                timeRange === range ? 'bg-neutral-800 text-white' : 'text-gray-500 hover:text-white'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={t('totalEquity', language)}
          value={`${totalEquity.toFixed(2)}`}
          suffix="USDT"
        />
        <StatCard
          label={t('availableBalance', language)}
          value={`${account?.available_balance?.toFixed(2) || '0.00'}`}
          suffix="USDT"
          subtext={`${account?.available_balance && totalEquity ? ((account.available_balance / totalEquity) * 100).toFixed(1) : '0'}% free`}
        />
        <StatCard
          label={t('totalPnL', language)}
          value={`${isPositive ? '+' : ''}${totalPnl.toFixed(2)}`}
          suffix="USDT"
          trend={isPositive ? 'up' : 'down'}
        />
        <StatCard
          label={t('positions', language)}
          value={`${account?.position_count || 0}`}
          subtext={`Margin: ${account?.margin_used_pct?.toFixed(1) || '0'}%`}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Positions - Left 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Positions */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp size={20} className="text-[#00C805]" />
                {t('currentPositions', language)}
              </h3>
              {positions && positions.length > 0 && (
                <span className="text-xs px-3 py-1 rounded-full bg-[#00C805]/10 text-[#00C805] font-bold">
                  {positions.length} Active
                </span>
              )}
            </div>

            {positions && positions.length > 0 ? (
              <div className="space-y-3">
                {positions.map((pos, i) => (
                  <div key={i} className="bg-black rounded-xl p-4 border border-neutral-800">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-mono font-bold text-white">{pos.symbol}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${
                          pos.side === 'long' ? 'bg-[#00C805]/20 text-[#00C805]' : 'bg-[#FF5000]/20 text-[#FF5000]'
                        }`}>
                          {pos.side.toUpperCase()} {pos.leverage}x
                        </span>
                      </div>
                      <span className={`font-mono font-bold ${pos.unrealized_pnl >= 0 ? 'text-[#00C805]' : 'text-[#FF5000]'}`}>
                        {pos.unrealized_pnl >= 0 ? '+' : ''}{pos.unrealized_pnl.toFixed(2)} ({pos.unrealized_pnl_pct.toFixed(2)}%)
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-xs text-gray-500">
                      <div>
                        <span className="block text-gray-600">Entry</span>
                        <span className="font-mono text-white">{pos.entry_price.toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="block text-gray-600">Mark</span>
                        <span className="font-mono text-white">{pos.mark_price.toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="block text-gray-600">Value</span>
                        <span className="font-mono text-white">{(pos.quantity * pos.mark_price).toFixed(2)} USDT</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <PieChart size={48} className="mx-auto mb-4 text-gray-700" />
                <p className="text-gray-500">{t('noActivePositions', language)}</p>
              </div>
            )}
          </div>

          {/* AI Learning */}
          <AILearning traderId={selectedTrader.trader_id} />
        </div>

        {/* Right Sidebar - Decisions */}
        <div className="lg:col-span-1">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 sticky top-24">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-neutral-800">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-900/30">
                <Brain size={20} className="text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">{t('recentDecisions', language)}</h3>
                {decisions && decisions.length > 0 && (
                  <span className="text-xs text-gray-500">Last {decisions.length} cycles</span>
                )}
              </div>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {decisions && decisions.length > 0 ? (
                decisions.map((decision, i) => (
                  <DecisionCard key={i} decision={decision} language={language} />
                ))
              ) : (
                <div className="text-center py-12">
                  <Brain size={48} className="mx-auto mb-4 text-gray-700" />
                  <p className="text-gray-500">{t('noDecisionsYet', language)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Debug footer */}
      <div className="text-xs text-gray-600 font-mono flex items-center gap-2 mb-6">
        <RefreshCw size={12} />
        Last update: {lastUpdate}
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({
  label,
  value,
  suffix,
  subtext,
  trend,
}: {
  label: string
  value: string
  suffix?: string
  subtext?: string
  trend?: 'up' | 'down'
}) {
  const trendColor = trend === 'up' ? 'text-[#00C805]' : trend === 'down' ? 'text-[#FF5000]' : 'text-white'
  
  return (
    <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold font-mono ${trendColor}`}>
        {value}
        {suffix && <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>}
      </div>
      {subtext && <div className="text-xs text-gray-600 mt-1">{subtext}</div>}
    </div>
  )
}

// Decision Card Component
function DecisionCard({ decision, language: _language }: { decision: DecisionRecord; language: Language }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-black rounded-xl p-4 border border-neutral-800">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-white text-sm">Cycle #{decision.cycle_number}</div>
          <div className="text-xs text-gray-500">{new Date(decision.timestamp).toLocaleString()}</div>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
          decision.success ? 'bg-[#00C805]/20 text-[#00C805]' : 'bg-[#FF5000]/20 text-[#FF5000]'
        }`}>
          {decision.success ? 'Success' : 'Failed'}
        </span>
      </div>

      {/* Actions */}
      {decision.decisions && decision.decisions.length > 0 && (
        <div className="space-y-1 mb-2">
          {decision.decisions.slice(0, 2).map((action, j) => (
            <div key={j} className="flex items-center gap-2 text-xs">
              <span className="font-mono font-bold text-white">{action.symbol}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                action.action.includes('open') ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {action.action}
              </span>
              {action.success ? (
                <Check size={12} className="text-[#00C805]" />
              ) : (
                <X size={12} className="text-[#FF5000]" />
              )}
            </div>
          ))}
          {decision.decisions.length > 2 && (
            <span className="text-xs text-gray-500">+{decision.decisions.length - 2} more</span>
          )}
        </div>
      )}

      {/* Expand for details */}
      {(decision.cot_trace || decision.input_prompt) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-purple-400 hover:text-purple-300"
        >
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      )}

      {expanded && (
        <div className="mt-3 space-y-2">
          {decision.cot_trace && (
            <div className="text-xs bg-neutral-900 rounded p-3 font-mono text-gray-400 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {decision.cot_trace}
            </div>
          )}
        </div>
      )}

      {decision.error_message && (
        <div className="mt-2 text-xs text-[#FF5000] flex items-center gap-1">
          <XCircle size={12} /> {decision.error_message}
        </div>
      )}
    </div>
  )
}
