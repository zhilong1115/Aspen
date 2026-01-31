import { motion } from 'framer-motion'
import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import useSWR from 'swr'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { ErrorState } from '../components/ui/ErrorState'
import { PortfolioSkeleton } from '../components/ui/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import type { AccountInfo, TraderInfo } from '../types'

// ── Constants ──────────────────────────────────────────────
const GREEN = '#00C805'
const RED = '#FF5000'
const TIME_RANGES = ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as const
type TimeRange = (typeof TIME_RANGES)[number]
type ViewMode = 'portfolio' | 'compare'

// Trader line colors for comparison mode
const TRADER_COLORS = [
  '#00C805',
  '#5AC8FA',
  '#FF9500',
  '#AF52DE',
  '#FF2D55',
  '#FFD60A',
  '#30D158',
  '#64D2FF',
]

// Map raw model IDs to friendly display names
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

// ── Helpers ────────────────────────────────────────────────
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
        <p
          key={i}
          className="text-sm font-semibold"
          style={{ color: entry.color || GREEN }}
        >
          {entry.name === 'value'
            ? fmt(entry.value)
            : `${entry.name}: ${fmt(entry.value)}`}
        </p>
      ))}
    </div>
  )
}

// ── Sparkline ──────────────────────────────────────────────
function Sparkline({
  data,
  positive,
  width = 80,
  height = 32,
}: {
  data: number[]
  positive: boolean
  width?: number
  height?: number
}) {
  const points = data.map((v, i) => ({ v, i }))
  const color = positive ? GREEN : RED

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={points}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Trader Card ────────────────────────────────────────────
function TraderCard({
  trader,
  equityData,
  historyData,
  onClick,
  index,
}: {
  trader: TraderInfo
  equityData?: { equity: number; pnl: number; pnlPct: number }
  historyData?: number[]
  onClick: () => void
  index: number
}) {
  const equity = equityData?.equity ?? 0
  const pnl = equityData?.pnl ?? 0
  const pnlPct = equityData?.pnlPct ?? 0
  const isPositive = pnl >= 0

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-4 bg-transparent hover:bg-neutral-900/50 
                 border-b border-neutral-900 transition-colors duration-200 group cursor-pointer"
    >
      {/* Left: name + model */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{
            backgroundColor: TRADER_COLORS[index % TRADER_COLORS.length] + '22',
            color: TRADER_COLORS[index % TRADER_COLORS.length],
          }}
        >
          {trader.trader_name?.charAt(0) || 'T'}
        </div>
        <div className="text-left min-w-0">
          <p className="text-white font-medium text-sm truncate">
            {trader.trader_name}
          </p>
          <p className="text-neutral-500 text-xs truncate">
            {getModelDisplayName(trader.ai_model)}
          </p>
        </div>
      </div>

      {/* Center: sparkline */}
      <div className="hidden sm:block">
        {historyData && historyData.length > 1 && (
          <Sparkline data={historyData} positive={isPositive} />
        )}
      </div>

      {/* Right: equity + P&L */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-white font-medium text-sm">{fmt(equity)}</p>
          <p
            className="text-xs font-medium"
            style={{ color: isPositive ? GREEN : RED }}
          >
            {fmtPct(pnlPct)}
          </p>
        </div>
        <ChevronRight
          size={16}
          className="text-neutral-600 group-hover:text-neutral-400 transition-colors"
        />
      </div>
    </motion.button>
  )
}

// ── Main Portfolio Page ────────────────────────────────────
function PortfolioPageContent() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState<TimeRange>('1M')
  const [viewMode, setViewMode] = useState<ViewMode>('portfolio')
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const [hoverChange, setHoverChange] = useState<number | null>(null)
  const [hoverChangePct, setHoverChangePct] = useState<number | null>(null)

  // Fetch traders
  const {
    data: traders,
    error: tradersError,
    isLoading: tradersLoading,
    mutate: mutateTraders,
  } = useSWR<TraderInfo[]>(
    user && token ? 'my-traders' : null,
    api.getTraders,
    { refreshInterval: 15000 }
  )

  // Fetch accounts for each trader
  const traderIds = traders?.map((t) => t.trader_id) || []
  const { data: accounts } = useSWR<Record<string, AccountInfo>>(
    traderIds.length > 0 ? `accounts-${traderIds.join(',')}` : null,
    async () => {
      const results: Record<string, AccountInfo> = {}
      await Promise.all(
        traderIds.map(async (id) => {
          try {
            results[id] = await api.getAccount(id)
          } catch {
            /* skip failed */
          }
        })
      )
      return results
    },
    { refreshInterval: 15000 }
  )

  // Fetch equity history for each trader
  const { data: histories } = useSWR(
    traderIds.length > 0 ? `histories-${traderIds.join(',')}` : null,
    async () => {
      const results: Record<
        string,
        Array<{ timestamp: string; total_equity: number; pnl_pct: number }>
      > = {}
      await Promise.all(
        traderIds.map(async (id) => {
          try {
            results[id] = await api.getEquityHistory(id)
          } catch {
            /* skip */
          }
        })
      )
      return results
    },
    { refreshInterval: 30000 }
  )

  // ── Derived data ─────────────────────────────────────────
  // Compute per-trader equity from the LAST equity history point (most accurate)
  // Falls back to account API data if history isn't available yet
  const traderEquities = useMemo(() => {
    const result: Record<
      string,
      { equity: number; pnl: number; pnlPct: number; initial: number }
    > = {}
    for (const id of traderIds) {
      const h = histories?.[id]
      const acc = accounts?.[id]
      // Use configured initial_balance from account API, NOT first data point
      const initial = acc?.initial_balance || 10000
      if (h && h.length > 0) {
        const last = h[h.length - 1]
        const equity = last.total_equity
        const pnl = equity - initial
        const pnlPct = initial > 0 ? (pnl / initial) * 100 : 0
        result[id] = { equity, pnl, pnlPct, initial }
      } else if (acc) {
        result[id] = {
          equity: acc.total_equity || 0,
          pnl: acc.total_pnl || 0,
          pnlPct: acc.total_pnl_pct || 0,
          initial,
        }
      }
    }
    return result
  }, [histories, accounts, traderIds])

  // Total portfolio value
  const totalEquity = useMemo(() => {
    return Object.values(traderEquities).reduce((sum, t) => sum + t.equity, 0)
  }, [traderEquities])

  const totalPnl = useMemo(() => {
    return Object.values(traderEquities).reduce((sum, t) => sum + t.pnl, 0)
  }, [traderEquities])

  const totalInitial = useMemo(() => {
    return Object.values(traderEquities).reduce((sum, t) => sum + t.initial, 0)
  }, [traderEquities])

  const totalPnlPct =
    totalInitial > 0 ? ((totalEquity - totalInitial) / totalInitial) * 100 : 0

  // Combined portfolio chart data
  const portfolioChartData = useMemo(() => {
    if (!histories || !traderIds.length) return []
    // Merge all histories by timestamp into combined value
    const timeMap = new Map<string, number>()

    for (const id of traderIds) {
      const h = histories[id]
      if (!h) continue
      for (const point of h) {
        const existing = timeMap.get(point.timestamp) || 0
        timeMap.set(point.timestamp, existing + point.total_equity)
      }
    }

    const combined = Array.from(timeMap.entries())
      .map(([timestamp, value]) => ({ timestamp, value }))
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )

    return filterByRange(combined, timeRange) as Array<{
      timestamp: string
      value: number
    }>
  }, [histories, traderIds, timeRange])

  // Comparison chart data
  const compareChartData = useMemo(() => {
    if (!histories || !traders?.length) return []
    // Build unified timeline with each trader as a column
    const allTimestamps = new Set<string>()
    for (const id of traderIds) {
      histories[id]?.forEach((p) => allTimestamps.add(p.timestamp))
    }

    const sorted = Array.from(allTimestamps).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    )

    const data = sorted.map((ts) => {
      const row: { timestamp: string; [k: string]: unknown } = { timestamp: ts }
      traders?.forEach((t) => {
        const h = histories[t.trader_id]
        if (!h) return
        const point = h.find((p) => p.timestamp === ts)
        if (point) row[t.trader_name || t.trader_id] = point.total_equity
      })
      return row
    })

    return filterByRange(data, timeRange)
  }, [histories, traders, traderIds, timeRange])

  // Sparkline data per trader (last N points)
  const sparklines = useMemo(() => {
    if (!histories) return {}
    const result: Record<string, number[]> = {}
    for (const id of traderIds) {
      const h = histories[id]
      if (!h) continue
      result[id] = h.slice(-30).map((p) => p.total_equity)
    }
    return result
  }, [histories, traderIds])

  // Chart value on hover
  const displayValue = hoverValue ?? totalEquity
  const displayChange = hoverChange ?? totalPnl
  const displayChangePct = hoverChangePct ?? totalPnlPct
  const isPositive = displayChange >= 0
  const accentColor = isPositive ? GREEN : RED

  // First point for calculating change on hover
  const firstValue =
    portfolioChartData.length > 0 ? portfolioChartData[0].value : totalInitial

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

  // ── Loading/Error States ─────────────────────────────────
  // Show loading skeleton while fetching traders
  if (tradersLoading) {
    return <PortfolioSkeleton />
  }

  // Show error state if traders failed to load
  if (tradersError) {
    return (
      <ErrorState
        error={tradersError}
        title="Failed to load portfolio"
        description="We couldn't load your portfolio data. Please try again."
        onRetry={() => mutateTraders()}
      />
    )
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="max-w-3xl md:max-w-6xl mx-auto pb-8">
      <div className="md:grid md:grid-cols-5 md:gap-10">
        {/* ── Left Column: Chart & Header ── */}
        <div className="md:col-span-3">
          {/* Portfolio Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="px-2 pt-2"
          >
            <p className="text-neutral-500 text-sm font-medium mb-1">
              {viewMode === 'portfolio'
                ? 'Total Portfolio'
                : 'Comparing Traders'}
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
              {fmt(displayValue)}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {isPositive ? (
                <TrendingUp size={16} style={{ color: accentColor }} />
              ) : (
                <TrendingDown size={16} style={{ color: accentColor }} />
              )}
              <span
                className="text-sm font-medium"
                style={{ color: accentColor }}
              >
                {fmtChange(displayChange)} ({fmtPct(displayChangePct)})
              </span>
              <span className="text-neutral-600 text-sm">
                {timeRange === '1D' ? 'Today' : timeRange}
              </span>
            </div>
          </motion.div>

          {/* Chart Area */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-6 -mx-4 md:mx-0"
          >
            {viewMode === 'portfolio' && portfolioChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={portfolioChartData}
                  onMouseMove={handleChartHover}
                  onMouseLeave={handleChartLeave}
                >
                  <defs>
                    <linearGradient
                      id="portfolioGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={accentColor}
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="100%"
                        stopColor={accentColor}
                        stopOpacity={0}
                      />
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
                    fill="url(#portfolioGradient)"
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
            ) : viewMode === 'compare' &&
              compareChartData.length > 0 &&
              traders ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={compareChartData}
                  onMouseLeave={handleChartLeave}
                >
                  <XAxis dataKey="timestamp" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip content={<ChartTooltip />} />
                  {traders.map((t, i) => (
                    <Line
                      key={t.trader_id}
                      type="monotone"
                      dataKey={t.trader_name || t.trader_id}
                      stroke={TRADER_COLORS[i % TRADER_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-neutral-600 text-sm">No chart data yet</p>
              </div>
            )}
          </motion.div>

          {/* Time Range Pills + View Mode Toggle */}
          <div className="flex items-center justify-between px-2 mt-2">
            {/* Time ranges */}
            <div className="flex gap-1">
              {TIME_RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                    timeRange === r
                      ? 'text-white'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                  style={
                    timeRange === r
                      ? {
                          backgroundColor: accentColor + '22',
                          color: accentColor,
                        }
                      : {}
                  }
                >
                  {r}
                </button>
              ))}
            </div>

            {/* View mode toggle */}
            <div className="flex bg-neutral-900 rounded-full p-0.5">
              <button
                onClick={() => setViewMode('portfolio')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  viewMode === 'portfolio'
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-500'
                }`}
              >
                Portfolio
              </button>
              <button
                onClick={() => setViewMode('compare')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  viewMode === 'compare'
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-500'
                }`}
              >
                Compare
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Column: AI Strategies ── */}
        <div className="md:col-span-2 md:border-l md:border-neutral-900 md:pl-8">
          {/* Divider — mobile only */}
          <div className="border-t border-neutral-900 mt-6 md:hidden" />

          {/* Trader List */}
          <div className="mt-4 md:mt-0 px-2 md:px-0">
            <h2 className="text-lg font-bold text-white mb-3">AI Strategies</h2>
            <div className="rounded-xl overflow-hidden border border-neutral-900">
              {traders && traders.length > 0 ? (
                traders.map((trader, i) => (
                  <TraderCard
                    key={trader.trader_id}
                    trader={trader}
                    equityData={traderEquities[trader.trader_id]}
                    historyData={sparklines[trader.trader_id]}
                    onClick={() =>
                      navigate(`/dashboard?trader=${trader.trader_id}`)
                    }
                    index={i}
                  />
                ))
              ) : (
                <div className="py-12 text-center">
                  <p className="text-neutral-600 text-sm">
                    No traders configured yet
                  </p>
                  <button
                    onClick={() => navigate('/traders')}
                    className="mt-3 text-sm font-medium hover:underline"
                    style={{ color: GREEN }}
                  >
                    Create your first trader →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Compare Legend (when in compare mode) */}
          {viewMode === 'compare' && traders && traders.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 px-2 md:px-0 flex flex-wrap gap-3"
            >
              {traders.map((t, i) => (
                <div key={t.trader_id} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: TRADER_COLORS[i % TRADER_COLORS.length],
                    }}
                  />
                  <span className="text-xs text-neutral-400">
                    {t.trader_name}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

// Export wrapped with ErrorBoundary
export function PortfolioPage() {
  return (
    <ErrorBoundary>
      <PortfolioPageContent />
    </ErrorBoundary>
  )
}
