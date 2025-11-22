import {
  AlertTriangle,
  Bot,
  Brain,
  Check,
  Inbox,
  PieChart,
  RefreshCw,
  Send,
  TrendingUp,
  X,
  XCircle
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
import { stripLeadingIcons } from '../lib/text'
import type {
  AccountInfo,
  DecisionRecord,
  Position,
  Statistics,
  SystemStatus,
  TraderInfo,
} from '../types'

// 获取友好的AI模型名称
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

  // 获取trader列表（仅在用户登录时）
  const { data: traders, error: tradersError } = useSWR<TraderInfo[]>(
    user && token ? 'traders' : null,
    api.getTraders,
    {
      refreshInterval: 10000,
      shouldRetryOnError: false,
    }
  )

  // 当获取到traders后，设置默认选中第一个
  useEffect(() => {
    if (traders && traders.length > 0 && !selectedTraderId) {
      const firstTraderId = traders[0].trader_id
      setSelectedTraderId(firstTraderId)
      setSearchParams({ trader: firstTraderId })
    }
  }, [traders, selectedTraderId, setSearchParams])

  // 更新URL参数
  const handleTraderSelect = (traderId: string) => {
    setSelectedTraderId(traderId)
    setSearchParams({ trader: traderId })
  }

  // 如果在trader页面，获取该trader的数据
  const { data: status } = useSWR<SystemStatus>(
    selectedTraderId ? `status-${selectedTraderId}` : null,
    () => api.getStatus(selectedTraderId),
    {
      refreshInterval: 15000,
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  const { data: account } = useSWR<AccountInfo>(
    selectedTraderId ? `account-${selectedTraderId}` : null,
    () => api.getAccount(selectedTraderId),
    {
      refreshInterval: 15000,
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  const { data: positions } = useSWR<Position[]>(
    selectedTraderId ? `positions-${selectedTraderId}` : null,
    () => api.getPositions(selectedTraderId),
    {
      refreshInterval: 15000,
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  const { data: decisions } = useSWR<DecisionRecord[]>(
    selectedTraderId ? `decisions/latest-${selectedTraderId}` : null,
    () => api.getLatestDecisions(selectedTraderId),
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
      dedupingInterval: 20000,
    }
  )

  const { data: stats } = useSWR<Statistics>(
    selectedTraderId ? `statistics-${selectedTraderId}` : null,
    () => api.getStatistics(selectedTraderId),
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
      dedupingInterval: 20000,
    }
  )

  // Avoid unused variable warning
  void stats

  useEffect(() => {
    if (account) {
      const now = new Date().toLocaleTimeString()
      setLastUpdate(now)
    }
  }, [account])

  const selectedTrader = traders?.find((t) => t.trader_id === selectedTraderId)

  // If API failed with error, show empty state
  if (tradersError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md mx-auto px-6">
          <div
            className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center bg-[var(--surface-soft-yellow)] border-2 border-[var(--google-yellow)]/30"
          >
            <Bot size={48} className="text-[var(--google-yellow)]" />
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#EAECEF' }}>
            {t('dashboardEmptyTitle', language)}
          </h2>
          <p className="text-base mb-6" style={{ color: '#848E9C' }}>
            {t('dashboardEmptyDescription', language)}
          </p>
          <button
            onClick={() => navigate('/traders')}
            className="px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 bg-[var(--google-yellow)] text-black shadow-md hover:shadow-lg"
          >
            {t('goToTradersPage', language)}
          </button>
        </div>
      </div>
    )
  }

  // If traders is loaded and empty, show empty state
  if (traders && traders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md mx-auto px-6">
          <div
            className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center bg-[var(--surface-soft-yellow)] border-2 border-[var(--google-yellow)]/30"
          >
            <Bot size={48} className="text-[var(--google-yellow)]" />
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#EAECEF' }}>
            {t('dashboardEmptyTitle', language)}
          </h2>
          <p className="text-base mb-6" style={{ color: '#848E9C' }}>
            {t('dashboardEmptyDescription', language)}
          </p>
          <button
            onClick={() => navigate('/traders')}
            className="px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 bg-[var(--google-yellow)] text-black shadow-md hover:shadow-lg"
          >
            {t('goToTradersPage', language)}
          </button>
        </div>
      </div>
    )
  }

  // If traders is still loading or selectedTrader is not ready, show skeleton
  if (!selectedTrader) {
    return (
      <div className="space-y-6">
        <div className="space-y-6">
          <div className="glass-card p-6 animate-pulse">
            <div className="skeleton h-8 w-48 mb-3 bg-gray-200"></div>
            <div className="flex gap-4">
              <div className="skeleton h-4 w-32 bg-gray-200"></div>
              <div className="skeleton h-4 w-24 bg-gray-200"></div>
              <div className="skeleton h-4 w-28 bg-gray-200"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass-card p-5 animate-pulse">
                <div className="skeleton h-4 w-24 mb-3 bg-gray-200"></div>
                <div className="skeleton h-8 w-32 bg-gray-200"></div>
              </div>
            ))}
          </div>
          <div className="glass-card p-6 animate-pulse">
            <div className="skeleton h-6 w-40 mb-4 bg-gray-200"></div>
            <div className="skeleton h-64 w-full bg-gray-200"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Trader Header */}
      <div className="mb-6 rounded-xl p-6 animate-scale-in bg-[var(--surface-soft-yellow)] border border-[var(--google-yellow)]/20 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
            <span className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--google-yellow)] text-black shadow-sm">
              <Bot className="w-5 h-5" />
            </span>
            {selectedTrader.trader_name}
          </h2>

          {/* Trader Selector */}
          {traders && traders.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-secondary)]">
                {t('switchTrader', language)}:
              </span>
              <select
                value={selectedTraderId}
                onChange={(e) => handleTraderSelect(e.target.value)}
                className="rounded px-3 py-2 text-sm font-medium cursor-pointer transition-colors bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--google-blue)] focus:border-transparent outline-none"
              >
                {traders.map((trader) => (
                  <option key={trader.trader_id} value={trader.trader_id}>
                    {trader.trader_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
          <span>
            AI Model:{' '}
            <span
              className="font-semibold"
              style={{
                color: selectedTrader.ai_model.includes('qwen')
                  ? '#9333ea'
                  : '#2563eb',
              }}
            >
              {getModelDisplayName(
                selectedTrader.ai_model.split('_').pop() ||
                selectedTrader.ai_model
              )}
            </span>
          </span>
          {status && (
            <>
              <span>•</span>
              <span>Cycles: {status.call_count}</span>
              <span>•</span>
              <span>Runtime: {status.runtime_minutes} min</span>
            </>
          )}
        </div>
      </div>

      {/* Debug Info */}
      {account && (
        <div className="mb-4 p-3 rounded text-xs font-mono bg-[var(--surface)] border border-[var(--border-light)] text-[var(--text-secondary)]">
          <div>
            <RefreshCw className="inline w-4 h-4 mr-1 align-text-bottom" />
            Last Update: {lastUpdate} | Total Equity:{' '}
            {account?.total_equity?.toFixed(2) || '0.00'} | Available:{' '}
            {account?.available_balance?.toFixed(2) || '0.00'} | P&L:{' '}
            {account?.total_pnl?.toFixed(2) || '0.00'} (
            {account?.total_pnl_pct?.toFixed(2) || '0.00'}%)
          </div>
        </div>
      )}

      {/* Account Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title={t('totalEquity', language)}
          value={`${account?.total_equity?.toFixed(2) || '0.00'} USDT`}
          change={account?.total_pnl_pct || 0}
          positive={(account?.total_pnl ?? 0) > 0}
        />
        <StatCard
          title={t('availableBalance', language)}
          value={`${account?.available_balance?.toFixed(2) || '0.00'} USDT`}
          subtitle={`${account?.available_balance && account?.total_equity ? ((account.available_balance / account.total_equity) * 100).toFixed(1) : '0.0'}% ${t('free', language)}`}
        />
        <StatCard
          title={t('totalPnL', language)}
          value={`${account?.total_pnl !== undefined && account.total_pnl >= 0 ? '+' : ''}${account?.total_pnl?.toFixed(2) || '0.00'} USDT`}
          change={account?.total_pnl_pct || 0}
          positive={(account?.total_pnl ?? 0) >= 0}
        />
        <StatCard
          title={t('positions', language)}
          value={`${account?.position_count || 0}`}
          subtitle={`${t('margin', language)}: ${account?.margin_used_pct?.toFixed(1) || '0.0'}%`}
        />
      </div>

      {/* 主要内容区：左右分屏 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 左侧：图表 + 持仓 */}
        <div className="space-y-6">
          {/* Equity Chart */}
          <div className="animate-slide-in" style={{ animationDelay: '0.1s' }}>
            <EquityChart traderId={selectedTrader.trader_id} />
          </div>

          {/* Current Positions */}
          <div
            className="glass-card p-6 animate-slide-in"
            style={{ animationDelay: '0.15s' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
                <TrendingUp className="w-5 h-5 text-[var(--google-yellow)]" />
                {t('currentPositions', language)}
              </h2>
              {positions && positions.length > 0 && (
                <div
                  className="text-xs px-3 py-1 rounded bg-[var(--surface-soft-yellow)] text-[var(--google-yellow)] border border-[var(--google-yellow)]/20"
                >
                  {positions.length} {t('active', language)}
                </div>
              )}
            </div>
            {positions && positions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left border-b border-[var(--border-light)]">
                    <tr>
                      <th className="pb-3 font-semibold text-gray-400">
                        {t('symbol', language)}
                      </th>
                      <th className="pb-3 font-semibold text-gray-400">
                        {t('side', language)}
                      </th>
                      <th className="pb-3 font-semibold text-gray-400">
                        {t('entryPrice', language)}
                      </th>
                      <th className="pb-3 font-semibold text-gray-400">
                        {t('markPrice', language)}
                      </th>
                      <th className="pb-3 font-semibold text-gray-400">
                        {t('quantity', language)}
                      </th>
                      <th className="pb-3 font-semibold text-gray-400">
                        {t('positionValue', language)}
                      </th>
                      <th className="pb-3 font-semibold text-gray-400">
                        {t('leverage', language)}
                      </th>
                      <th className="pb-3 font-semibold text-gray-400">
                        {t('unrealizedPnL', language)}
                      </th>
                      <th className="pb-3 font-semibold text-gray-400">
                        {t('liqPrice', language)}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos, i) => (
                      <tr
                        key={i}
                        className="border-b border-[var(--border-light)] last:border-0"
                      >
                        <td className="py-3 font-mono font-semibold">
                          {pos.symbol}
                        </td>
                        <td className="py-3">
                          <span
                            className="px-2 py-1 rounded text-xs font-bold"
                            style={
                              pos.side === 'long'
                                ? {
                                  background: 'var(--surface-soft-green)',
                                  color: 'var(--google-green)',
                                }
                                : {
                                  background: 'var(--surface-soft)',
                                  color: 'var(--google-red)',
                                }
                            }
                          >
                            {t(
                              pos.side === 'long' ? 'long' : 'short',
                              language
                            )}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-[var(--text-primary)]">
                          {pos.entry_price.toFixed(4)}
                        </td>
                        <td className="py-3 font-mono text-[var(--text-primary)]">
                          {pos.mark_price.toFixed(4)}
                        </td>
                        <td className="py-3 font-mono text-[var(--text-primary)]">
                          {pos.quantity.toFixed(4)}
                        </td>
                        <td className="py-3 font-mono font-bold text-[var(--text-primary)]">
                          {(pos.quantity * pos.mark_price).toFixed(2)} USDT
                        </td>
                        <td className="py-3 font-mono text-[var(--google-yellow)]">
                          {pos.leverage}x
                        </td>
                        <td className="py-3 font-mono">
                          <span
                            style={{
                              color:
                                pos.unrealized_pnl >= 0 ? 'var(--google-green)' : 'var(--google-red)',
                              fontWeight: 'bold',
                            }}
                          >
                            {pos.unrealized_pnl >= 0 ? '+' : ''}
                            {pos.unrealized_pnl.toFixed(2)} (
                            {pos.unrealized_pnl_pct.toFixed(2)}%)
                          </span>
                        </td>
                        <td className="py-3 font-mono text-[var(--text-secondary)]">
                          {pos.liquidation_price.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 text-[var(--text-tertiary)]">
                <div className="mb-4 opacity-50 flex justify-center">
                  <PieChart className="w-16 h-16" />
                </div>
                <div className="text-lg font-semibold mb-2">
                  {t('noPositions', language)}
                </div>
                <div className="text-sm">
                  {t('noActivePositions', language)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：Recent Decisions */}
        <div
          className="glass-card p-6 animate-slide-in h-fit lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)]"
          style={{ animationDelay: '0.2s' }}
        >
          <div
            className="flex items-center gap-3 mb-5 pb-4 border-b border-[var(--border-light)]"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--surface-soft-purple)] shadow-sm"
            >
              <Brain className="w-5 h-5 text-[var(--google-blue)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                {t('recentDecisions', language)}
              </h2>
              {decisions && decisions.length > 0 && (
                <div className="text-xs text-[var(--text-secondary)]">
                  {t('lastCycles', language, { count: decisions.length })}
                </div>
              )}
            </div>
          </div>

          <div
            className="space-y-4 overflow-y-auto pr-2"
            style={{ maxHeight: 'calc(100vh - 280px)' }}
          >
            {decisions && decisions.length > 0 ? (
              decisions.map((decision, i) => (
                <DecisionCard key={i} decision={decision} language={language} />
              ))
            ) : (
              <div className="py-16 text-center">
                <div className="mb-4 opacity-30 flex justify-center">
                  <Brain className="w-16 h-16" />
                </div>
                <div className="text-lg font-semibold mb-2 text-[var(--text-primary)]">
                  {t('noDecisionsYet', language)}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {t('aiDecisionsWillAppear', language)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Learning & Performance Analysis */}
      <div className="mb-6 animate-slide-in" style={{ animationDelay: '0.3s' }}>
        <AILearning traderId={selectedTrader.trader_id} />
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({
  title,
  value,
  change,
  positive,
  subtitle,
}: {
  title: string
  value: string
  change?: number
  positive?: boolean
  subtitle?: string
}) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="text-xs mb-2 mono uppercase tracking-wider text-[var(--text-secondary)]">
        {title}
      </div>
      <div className="text-2xl font-bold mb-1 mono text-[var(--text-primary)]">
        {value}
      </div>
      {change !== undefined && (
        <div className="flex items-center gap-1">
          <div
            className="text-sm mono font-bold"
            style={{ color: positive ? 'var(--google-green)' : 'var(--google-red)' }}
          >
            {positive ? '▲' : '▼'} {positive ? '+' : ''}
            {change.toFixed(2)}%
          </div>
        </div>
      )}
      {subtitle && (
        <div className="text-xs mt-2 mono text-[var(--text-secondary)]">
          {subtitle}
        </div>
      )}
    </div>
  )
}

// Decision Card Component
function DecisionCard({
  decision,
  language,
}: {
  decision: DecisionRecord
  language: Language
}) {
  const [showInputPrompt, setShowInputPrompt] = useState(false)
  const [showCoT, setShowCoT] = useState(false)

  return (
    <div
      className="rounded-xl p-5 transition-all duration-300 hover:translate-y-[-2px] bg-[var(--surface)] border border-[var(--border)] shadow-sm hover:shadow-md"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-[var(--text-primary)]">
            {t('cycle', language)} #{decision.cycle_number}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            {new Date(decision.timestamp).toLocaleString()}
          </div>
        </div>
        <div
          className="px-3 py-1 rounded text-xs font-bold"
          style={
            decision.success
              ? { background: 'var(--surface-soft-green)', color: 'var(--google-green)' }
              : { background: 'var(--surface-soft)', color: 'var(--google-red)' }
          }
        >
          {t(decision.success ? 'success' : 'failed', language)}
        </div>
      </div>

      {/* Input Prompt - Collapsible */}
      {decision.input_prompt && (
        <div className="mb-3">
          <button
            onClick={() => setShowInputPrompt(!showInputPrompt)}
            className="flex items-center gap-2 text-sm transition-colors text-[var(--google-blue)]"
          >
            <span className="font-semibold flex items-center gap-2">
              <Inbox className="w-4 h-4" /> {t('inputPrompt', language)}
            </span>
            <span className="text-xs">
              {showInputPrompt
                ? t('collapse', language)
                : t('expand', language)}
            </span>
          </button>
          {showInputPrompt && (
            <div
              className="mt-2 rounded p-4 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto"
              style={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              {decision.input_prompt}
            </div>
          )}
        </div>
      )}

      {/* AI Chain of Thought - Collapsible */}
      {decision.cot_trace && (
        <div className="mb-3">
          <button
            onClick={() => setShowCoT(!showCoT)}
            className="flex items-center gap-2 text-sm transition-colors text-[var(--google-yellow)]"
          >
            <span className="font-semibold flex items-center gap-2">
              <Send className="w-4 h-4" />{' '}
              {stripLeadingIcons(t('aiThinking', language))}
            </span>
            <span className="text-xs">
              {showCoT ? t('collapse', language) : t('expand', language)}
            </span>
          </button>
          {showCoT && (
            <div
              className="mt-2 rounded p-4 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto"
              style={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              {decision.cot_trace}
            </div>
          )}
        </div>
      )}

      {/* Decisions Actions */}
      {decision.decisions && decision.decisions.length > 0 && (
        <div className="space-y-2 mb-3">
          {decision.decisions.map((action, j) => (
            <div
              key={j}
              className="flex items-center gap-2 text-sm rounded px-3 py-2 bg-[var(--background)]"
            >
              <span className="font-mono font-bold text-[var(--text-primary)]">
                {action.symbol}
              </span>
              <span
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={
                  action.action.includes('open')
                    ? {
                      background: 'rgba(96, 165, 250, 0.1)',
                      color: '#60a5fa',
                    }
                    : {
                      background: 'var(--surface-soft-yellow)',
                      color: 'var(--google-yellow)',
                    }
                }
              >
                {action.action}
              </span>
              {action.leverage > 0 && (
                <span style={{ color: '#F0B90B' }}>{action.leverage}x</span>
              )}
              {action.price > 0 && (
                <span
                  className="font-mono text-xs text-[var(--text-secondary)]"
                >
                  @{action.price.toFixed(4)}
                </span>
              )}
              <span style={{ color: action.success ? '#0ECB81' : '#F6465D' }}>
                {action.success ? (
                  <Check className="w-3 h-3 inline" />
                ) : (
                  <X className="w-3 h-3 inline" />
                )}
              </span>
              {action.error && (
                <span className="text-xs ml-2 text-[var(--google-red)]">
                  {action.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Account State Summary */}
      {decision.account_state && (
        <div
          className="flex gap-4 text-xs mb-3 rounded px-3 py-2 bg-[var(--background)] text-[var(--text-secondary)]"
        >
          <span>
            净值: {decision.account_state.total_balance.toFixed(2)} USDT
          </span>
          <span>
            可用: {decision.account_state.available_balance.toFixed(2)} USDT
          </span>
          <span>
            保证金率: {decision.account_state.margin_used_pct.toFixed(1)}%
          </span>
          <span>持仓: {decision.account_state.position_count}</span>
          <span
            style={{
              color:
                decision.candidate_coins &&
                  decision.candidate_coins.length === 0
                  ? 'var(--google-red)'
                  : 'var(--text-secondary)',
            }}
          >
            {t('candidateCoins', language)}:{' '}
            {decision.candidate_coins?.length || 0}
          </span>
        </div>
      )}

      {/* Candidate Coins Warning */}
      {decision.candidate_coins && decision.candidate_coins.length === 0 && (
        <div
          className="text-sm rounded px-4 py-3 mb-3 flex items-start gap-3 bg-[var(--surface-soft)] border border-[var(--google-red)]/30 text-[var(--google-red)]"
        >
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold mb-1">
              {t('candidateCoinsZeroWarning', language)}
            </div>
            <div className="text-xs space-y-1 text-[var(--text-secondary)]">
              <div>{t('possibleReasons', language)}</div>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>{t('coinPoolApiNotConfigured', language)}</li>
                <li>{t('apiConnectionTimeout', language)}</li>
                <li>{t('noCustomCoinsAndApiFailed', language)}</li>
              </ul>
              <div className="mt-2">
                <strong>{t('solutions', language)}</strong>
              </div>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>{t('setCustomCoinsInConfig', language)}</li>
                <li>{t('orConfigureCorrectApiUrl', language)}</li>
                <li>{t('orDisableCoinPoolOptions', language)}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Execution Logs */}
      {decision.execution_log && decision.execution_log.length > 0 && (
        <div className="space-y-1">
          {decision.execution_log.map((log, k) => (
            <div
              key={k}
              className="text-xs font-mono"
              style={{
                color:
                  log.includes('✓') || log.includes('成功')
                    ? '#0ECB81'
                    : '#F6465D',
              }}
            >
              {log}
            </div>
          ))}
        </div>
      )}

      {/* Error Message */}
      {decision.error_message && (
        <div
          className="text-sm rounded px-3 py-2 mt-3 flex items-center gap-2"
          style={{ color: '#F6465D', background: 'rgba(246, 70, 93, 0.1)' }}
        >
          <XCircle className="w-4 h-4" /> {decision.error_message}
        </div>
      )}
    </div>
  )
}
