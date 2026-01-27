import { motion } from 'framer-motion'
import {
  Check,
  ChevronDown,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import useSWR from 'swr'
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

// ── Constants ──────────────────────────────────────────────
const GREEN = '#00C805'
const RED = '#FF5000'
const TIME_RANGES = ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as const
type TimeRange = (typeof TIME_RANGES)[number]

// ── Helpers ────────────────────────────────────────────────
function getModelDisplayName(modelId: string): string {
  if (!modelId) return 'AI Trader'
  const lower = modelId.toLowerCase()
  const knownModels: [string, string][] = [
    ['deepseek', 'DeepSeek'],
    ['grok', 'Grok'],
    ['qwen', 'Qwen'],
    ['claude', 'Claude'],
    ['gpt', 'GPT'],
    ['gemini', 'Gemini'],
    ['llama', 'Llama'],
    ['mistral', 'Mistral'],
  ]
  for (const [key, name] of knownModels) {
    if (lower.includes(key)) return name
  }
  const parts = modelId.split('-').filter(Boolean)
  const last = parts[parts.length - 1] || modelId
  return last.charAt(0).toUpperCase() + last.slice(1)
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function fmtChange(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${fmt(n).replace('$', '$')}`
}

function filterByRange(
  data: Array<{ timestamp: string; [k: string]: unknown }>,
  range: TimeRange
): Array<{ timestamp: string; [k: string]: unknown }> {
  if (range === 'ALL' || !data.length) return data
  const now = new Date()
  let cutoff: Date
  switch (range) {
    case '1D':
      cutoff = new Date(now.getTime() - 86400000)
      break
    case '1W':
      cutoff = new Date(now.getTime() - 7 * 86400000)
      break
    case '1M':
      cutoff = new Date(now.getTime() - 30 * 86400000)
      break
    case '3M':
      cutoff = new Date(now.getTime() - 90 * 86400000)
      break
    case 'YTD':
      cutoff = new Date(now.getFullYear(), 0, 1)
      break
    case '1Y':
      cutoff = new Date(now.getTime() - 365 * 86400000)
      break
    default:
      return data
  }
  const filtered = data.filter((d) => new Date(d.timestamp) >= cutoff)
  return filtered.length > 0 ? filtered : data.slice(-1)
}

// ── Custom Tooltip ─────────────────────────────────────────
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  return (
    <div className="bg-neutral-900/95 backdrop-blur-sm border border-neutral-800 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-neutral-400">
        {new Date(d.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color || GREEN }}>
          {fmt(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────
export default function TraderDashboard() {
  const { language } = useLanguage()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const { traderId: routeTraderId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedTraderId, setSelectedTraderId] = useState<string | undefined>(
    routeTraderId || searchParams.get('trader') || undefined
  )
  const [timeRange, setTimeRange] = useState<TimeRange>('1M')
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const [hoverChange, setHoverChange] = useState<number | null>(null)
  const [hoverChangePct, setHoverChangePct] = useState<number | null>(null)

  // ── Data fetching ──────────────────────────────────────
  const { data: traders, error: tradersError } = useSWR<TraderInfo[]>(
    user && token ? 'traders' : null,
    api.getTraders,
    { refreshInterval: 10000, shouldRetryOnError: false }
  )

  // Auto-select first trader if none selected
  const effectiveSelectedId = useMemo(() => {
    if (selectedTraderId) return selectedTraderId
    if (traders && traders.length > 0) return traders[0].trader_id
    return undefined
  }, [selectedTraderId, traders])

  // Set selectedTraderId when traders load and none is set
  useMemo(() => {
    if (traders && traders.length > 0 && !selectedTraderId) {
      const firstId = traders[0].trader_id
      setSelectedTraderId(firstId)
      if (!routeTraderId) {
        setSearchParams({ trader: firstId })
      }
    }
  }, [traders, selectedTraderId, routeTraderId, setSearchParams])

  const handleTraderSelect = (traderId: string) => {
    setSelectedTraderId(traderId)
    setSearchParams({ trader: traderId })
  }

  const { data: status } = useSWR<SystemStatus>(
    effectiveSelectedId ? `status-${effectiveSelectedId}` : null,
    () => api.getStatus(effectiveSelectedId),
    { refreshInterval: 15000, revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const { data: account } = useSWR<AccountInfo>(
    effectiveSelectedId ? `account-${effectiveSelectedId}` : null,
    () => api.getAccount(effectiveSelectedId),
    { refreshInterval: 15000, revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const { data: positions } = useSWR<Position[]>(
    effectiveSelectedId ? `positions-${effectiveSelectedId}` : null,
    () => api.getPositions(effectiveSelectedId),
    { refreshInterval: 15000, revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const { data: decisions } = useSWR<DecisionRecord[]>(
    effectiveSelectedId ? `decisions/latest-${effectiveSelectedId}` : null,
    () => api.getLatestDecisions(effectiveSelectedId),
    { refreshInterval: 30000, revalidateOnFocus: false, dedupingInterval: 20000 }
  )

  const { data: _stats } = useSWR<Statistics>(
    effectiveSelectedId ? `statistics-${effectiveSelectedId}` : null,
    () => api.getStatistics(effectiveSelectedId),
    { refreshInterval: 30000, revalidateOnFocus: false, dedupingInterval: 20000 }
  )

  const { data: equityHistory } = useSWR<Array<{ timestamp: string; total_equity: number; pnl_pct: number }>>(
    effectiveSelectedId ? `equity-history-${effectiveSelectedId}` : null,
    () => api.getEquityHistory(effectiveSelectedId),
    { refreshInterval: 30000, revalidateOnFocus: false, dedupingInterval: 20000 }
  )

  // ── Derived data ─────────────────────────────────────────
  const selectedTrader = traders?.find((t) => t.trader_id === effectiveSelectedId)

  // Chart data
  const chartData = useMemo(() => {
    if (!equityHistory || equityHistory.length === 0) return []
    const mapped = equityHistory.map((p) => ({
      timestamp: p.timestamp,
      value: p.total_equity,
    }))
    return filterByRange(mapped, timeRange) as Array<{ timestamp: string; value: number }>
  }, [equityHistory, timeRange])

  // Derive equity from history (last point) with account API fallback
  const totalEquity = useMemo(() => {
    if (equityHistory && equityHistory.length > 0) {
      return equityHistory[equityHistory.length - 1].total_equity
    }
    return account?.total_equity ?? 0
  }, [equityHistory, account])

  // Initial balance: use account API's configured initial, NOT first data point
  const initialEquity = useMemo(() => {
    return account?.initial_balance ?? 10000
  }, [account])

  // Total return: current equity vs initial balance
  const totalPnl = totalEquity - initialEquity
  const totalPnlPct = initialEquity > 0 ? (totalPnl / initialEquity) * 100 : 0
  const isPositive = totalPnl >= 0
  const accentColor = isPositive ? GREEN : RED

  // Today's return: use the LAST day in the data (start of that day vs end)
  const { todayPnl, todayPnlPct } = useMemo(() => {
    if (!equityHistory || equityHistory.length < 2) return { todayPnl: 0, todayPnlPct: 0 }
    // Find the last data point's date, then find start of that day
    const lastPoint = equityHistory[equityHistory.length - 1]
    const lastDate = new Date(lastPoint.timestamp)
    const startOfLastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate())
    // Find the first point on that day (or last point before it as baseline)
    let dayStartEquity = equityHistory[0].total_equity
    for (const p of equityHistory) {
      const pTime = new Date(p.timestamp)
      if (pTime >= startOfLastDay) {
        dayStartEquity = p.total_equity
        break
      }
      dayStartEquity = p.total_equity
    }
    const endEquity = lastPoint.total_equity
    const pnl = endEquity - dayStartEquity
    const pct = dayStartEquity > 0 ? (pnl / dayStartEquity) * 100 : 0
    return { todayPnl: pnl, todayPnlPct: pct }
  }, [equityHistory])

  const firstValue = chartData.length > 0 ? chartData[0].value : initialEquity

  const displayValue = hoverValue ?? totalEquity
  const displayChange = hoverChange ?? totalPnl
  const displayChangePct = hoverChangePct ?? totalPnlPct

  const handleChartHover = useCallback(
    (state: any) => {
      if (state?.activePayload?.length) {
        const val = state.activePayload[0]?.value
        if (typeof val === 'number') {
          setHoverValue(val)
          const change = val - firstValue
          setHoverChange(change)
          setHoverChangePct(firstValue > 0 ? (change / firstValue) * 100 : 0)
        }
      }
    },
    [firstValue]
  )

  const handleChartLeave = useCallback(() => {
    setHoverValue(null)
    setHoverChange(null)
    setHoverChangePct(null)
  }, [])

  // ── Empty state ────────────────────────────────────────
  if (tradersError || (traders && traders.length === 0)) {
    return (
      <div className="max-w-3xl mx-auto pb-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md mx-auto px-6">
            <h2 className="text-2xl font-bold mb-3 text-white">
              {t('dashboardEmptyTitle', language)}
            </h2>
            <p className="text-base mb-6 text-neutral-500">
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
      </div>
    )
  }

  // ── Loading skeleton ───────────────────────────────────
  if (!selectedTrader) {
    return (
      <div className="max-w-3xl mx-auto pb-8 space-y-6 animate-pulse">
        <div className="h-8 w-24 bg-neutral-900 rounded-lg" />
        <div className="h-16 w-48 bg-neutral-900 rounded-lg" />
        <div className="h-[280px] bg-neutral-900 rounded-lg" />
      </div>
    )
  }

  const modelName = getModelDisplayName(selectedTrader.ai_model.split('_').pop() || selectedTrader.ai_model)

  return (
    <div className="max-w-3xl md:max-w-6xl mx-auto pb-8">
      <div className="md:grid md:grid-cols-5 md:gap-10">
        {/* ── Left Column: Chart + Stats + Positions ── */}
        <div className="md:col-span-3">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-2"
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-neutral-500 text-sm font-medium">
            {selectedTrader.trader_name} · {modelName}
            {status ? ` · ${status.call_count} cycles` : ''}
          </p>
          {traders && traders.length > 1 && (
            <div className="relative">
              <select
                value={effectiveSelectedId}
                onChange={(e) => handleTraderSelect(e.target.value)}
                className="appearance-none bg-transparent border border-neutral-800 rounded-full px-3 py-1.5 pr-8 text-sm text-white focus:outline-none focus:border-neutral-600 cursor-pointer"
              >
                {traders.map((trader) => (
                  <option key={trader.trader_id} value={trader.trader_id} className="bg-black">
                    {trader.trader_name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
            </div>
          )}
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
          {fmt(displayValue)}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          {displayChange >= 0 ? (
            <TrendingUp size={16} style={{ color: accentColor }} />
          ) : (
            <TrendingDown size={16} style={{ color: accentColor }} />
          )}
          <span className="text-sm font-medium" style={{ color: accentColor }}>
            {fmtChange(displayChange)} ({fmtPct(displayChangePct)})
          </span>
          <span className="text-neutral-600 text-sm">
            {timeRange === '1D' ? 'Today' : timeRange}
          </span>
        </div>
      </motion.div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="mt-6 -mx-4 md:mx-0"
      >
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={chartData}
              onMouseMove={handleChartHover}
              onMouseLeave={handleChartLeave}
            >
              <defs>
                <linearGradient id="dashGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="timestamp" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{
                  stroke: '#555',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={accentColor}
                strokeWidth={2}
                fill="url(#dashGradient)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: accentColor,
                  stroke: '#000',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center">
            <p className="text-neutral-600 text-sm">No chart data yet</p>
          </div>
        )}
      </motion.div>

      {/* Time Range Pills */}
      <div className="flex gap-1 px-2 mt-2">
        {TIME_RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setTimeRange(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              timeRange === r
                ? 'text-white'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
            style={timeRange === r ? { backgroundColor: accentColor + '22', color: accentColor } : {}}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-neutral-900 mt-6" />

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="space-y-4 mt-4 px-2"
      >
        {/* Row 1: INITIAL · TOTAL · POSITIONS */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-neutral-500 uppercase">Initial</p>
            <p className="text-base font-bold text-white">{fmt(initialEquity)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase">Total Equity</p>
            <p className="text-base font-bold text-white">{fmt(totalEquity)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase">Positions</p>
            <p className="text-base font-bold text-white">{positions?.length ?? account?.position_count ?? 0}</p>
          </div>
        </div>
        {/* Row 2: Today's Return */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">Today's Return</p>
          <p className="text-sm font-bold" style={{ color: todayPnl >= 0 ? GREEN : RED }}>
            {fmtChange(todayPnl)} ({fmtPct(todayPnlPct)})
          </p>
        </div>
        {/* Row 3: Total Return */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">Total Return</p>
          <p className="text-sm font-bold" style={{ color: accentColor }}>
            {fmtChange(totalPnl)} ({fmtPct(totalPnlPct)})
          </p>
        </div>
      </motion.div>

      {/* Divider */}
      <div className="border-t border-neutral-900 mt-6" />

      {/* Positions */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="mt-4 px-2"
      >
        <h2 className="text-lg font-bold text-white mb-3">{t('currentPositions', language)}</h2>
        <div className="rounded-xl overflow-hidden border border-neutral-900">
          {positions && positions.length > 0 ? (
            positions.map((pos, i) => (
              <div
                key={i}
                className="px-4 py-4 bg-transparent hover:bg-neutral-900/50 border-b border-neutral-900 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-white font-medium text-sm">{pos.symbol}</span>
                    <span
                      className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${
                        pos.side === 'long'
                          ? 'bg-[#00C805]/20 text-[#00C805]'
                          : 'bg-[#FF5000]/20 text-[#FF5000]'
                      }`}
                    >
                      {pos.side.toUpperCase()} {pos.leverage}x
                    </span>
                  </div>
                  <span
                    className="font-mono font-bold text-sm"
                    style={{ color: pos.unrealized_pnl >= 0 ? GREEN : RED }}
                  >
                    {pos.unrealized_pnl >= 0 ? '+' : ''}
                    {pos.unrealized_pnl.toFixed(2)} ({pos.unrealized_pnl_pct.toFixed(2)}%)
                  </span>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-neutral-500">
                  <span>Entry: <span className="text-neutral-400 font-mono">{pos.entry_price.toFixed(4)}</span></span>
                  <span>Mark: <span className="text-neutral-400 font-mono">{pos.mark_price.toFixed(4)}</span></span>
                  <span>Value: <span className="text-neutral-400 font-mono">{(pos.quantity * pos.mark_price).toFixed(2)}</span></span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center">
              <p className="text-neutral-600 text-sm">{t('noActivePositions', language)}</p>
            </div>
          )}
        </div>
      </motion.div>

        </div>

        {/* ── Right Column: Decisions ── */}
        <div className="md:col-span-2 md:border-l md:border-neutral-900 md:pl-8">

      {/* Divider — mobile only */}
      <div className="border-t border-neutral-900 mt-6 md:hidden" />

      {/* Decisions */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="mt-4 md:mt-0 px-2 md:px-0"
      >
        <h2 className="text-lg font-bold text-white mb-3">{t('recentDecisions', language)}</h2>
        <div className="rounded-xl overflow-hidden border border-neutral-900">
          {decisions && decisions.length > 0 ? (
            decisions.map((decision, i) => (
              <DecisionRow key={i} decision={decision} language={language} />
            ))
          ) : (
            <div className="py-12 text-center">
              <p className="text-neutral-600 text-sm">{t('noDecisionsYet', language)}</p>
            </div>
          )}
        </div>
      </motion.div>

        </div>
      </div>
    </div>
  )
}

// ── Decision Row ───────────────────────────────────────────
function DecisionRow({ decision, language: _language }: { decision: DecisionRecord; language: Language }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="px-4 py-3 border-b border-neutral-900 transition-colors hover:bg-neutral-900/50">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-white text-sm font-medium">Cycle #{decision.cycle_number}</span>
          <span className="text-xs text-neutral-500 ml-2">
            {new Date(decision.timestamp).toLocaleString()}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold ${
            decision.success
              ? 'bg-[#00C805]/20 text-[#00C805]'
              : 'bg-[#FF5000]/20 text-[#FF5000]'
          }`}
        >
          {decision.success ? 'Success' : 'Failed'}
        </span>
      </div>

      {/* Actions preview */}
      {decision.decisions && decision.decisions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {decision.decisions.slice(0, 3).map((action, j) => (
            <div key={j} className="flex items-center gap-1.5 text-xs">
              <span className="font-mono font-bold text-white">{action.symbol}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  action.action.includes('open')
                    ? 'bg-neutral-800 text-neutral-300'
                    : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {action.action}
              </span>
              {action.success ? (
                <Check size={12} className="text-[#00C805]" />
              ) : (
                <X size={12} className="text-[#FF5000]" />
              )}
            </div>
          ))}
          {decision.decisions.length > 3 && (
            <span className="text-xs text-neutral-500">+{decision.decisions.length - 3} more</span>
          )}
        </div>
      )}

      {/* Expand for details */}
      {(decision.cot_trace || decision.input_prompt) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-xs text-neutral-400 hover:text-neutral-300 transition-colors"
        >
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      )}

      {expanded && (
        <div className="mt-2">
          {decision.cot_trace && (
            <div className="text-xs bg-neutral-900/50 rounded-lg p-3 font-mono text-neutral-400 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {decision.cot_trace}
            </div>
          )}
        </div>
      )}

      {decision.error_message && (
        <div className="mt-1.5 text-xs text-[#FF5000] flex items-center gap-1">
          <XCircle size={12} /> {decision.error_message}
        </div>
      )}
    </div>
  )
}
