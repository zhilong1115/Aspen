import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Target,
  Activity,
  Check,
  X,
  XCircle,
  BarChart3,
  Zap,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { DecisionRecord } from '../types'

const GREEN = '#00C805'
const RED = '#FF5000'
const PAGE_SIZE = 10

// ── Helpers ────────────────────────────────────────────────

/** Try to extract confidence from decision_json or cot_trace */
function extractConfidence(decision: DecisionRecord): number | null {
  // Try from decision_json
  if (decision.decision_json) {
    try {
      const parsed = JSON.parse(decision.decision_json)
      if (typeof parsed.confidence === 'number') return parsed.confidence
      if (typeof parsed.confidence_level === 'number') return parsed.confidence_level
      if (typeof parsed.confidence === 'string') {
        const n = parseFloat(parsed.confidence)
        if (!isNaN(n)) return n
      }
      // Check nested
      if (parsed.analysis?.confidence) return parseFloat(parsed.analysis.confidence)
    } catch { /* ignore */ }
  }
  // Try from cot_trace with regex
  if (decision.cot_trace) {
    const match = decision.cot_trace.match(/confidence[:\s]*(\d+(?:\.\d+)?)\s*%?/i)
    if (match) return parseFloat(match[1])
  }
  return null
}

/** Extract indicator signals from input_prompt */
function extractSignals(decision: DecisionRecord): string[] {
  const signals: string[] = []
  const text = decision.input_prompt || ''

  // Common indicator patterns
  const indicators = [
    { pattern: /RSI/i, name: 'RSI' },
    { pattern: /MACD/i, name: 'MACD' },
    { pattern: /EMA/i, name: 'EMA' },
    { pattern: /SMA/i, name: 'SMA' },
    { pattern: /Bollinger/i, name: 'Bollinger' },
    { pattern: /volume/i, name: 'Volume' },
    { pattern: /support|resistance/i, name: 'S/R Levels' },
    { pattern: /trend/i, name: 'Trend' },
    { pattern: /momentum/i, name: 'Momentum' },
    { pattern: /OI|open.interest/i, name: 'Open Interest' },
    { pattern: /funding.rate/i, name: 'Funding Rate' },
    { pattern: /liquidat/i, name: 'Liquidation' },
    { pattern: /ATR/i, name: 'ATR' },
    { pattern: /fibonacci|fib/i, name: 'Fibonacci' },
    { pattern: /ichimoku/i, name: 'Ichimoku' },
    { pattern: /stochastic/i, name: 'Stochastic' },
    { pattern: /VWAP/i, name: 'VWAP' },
  ]

  for (const { pattern, name } of indicators) {
    if (pattern.test(text) || pattern.test(decision.cot_trace || '')) {
      signals.push(name)
    }
  }

  return signals.length > 0 ? signals : ['Market Data']
}

// ── Confidence Badge ───────────────────────────────────────
function ConfidenceBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="text-xs text-neutral-600 italic">N/A</span>
    )
  }
  const pct = value > 1 ? value : value * 100 // handle 0-1 or 0-100
  const color =
    pct >= 70 ? GREEN : pct >= 40 ? '#F59E0B' : RED

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono font-bold" style={{ color }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

// ── Decision Detail Card ───────────────────────────────────
function DecisionDetailCard({ decision }: { decision: DecisionRecord }) {
  const [showCoT, setShowCoT] = useState(false)
  const confidence = extractConfidence(decision)
  const signals = extractSignals(decision)
  const hasActions = decision.decisions && decision.decisions.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="border border-neutral-900 rounded-xl overflow-hidden bg-black"
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-900">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-bold">
            Cycle #{decision.cycle_number}
          </span>
          <span className="text-xs text-neutral-500">
            <Clock size={10} className="inline mr-1" />
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

      <div className="px-4 py-3 space-y-3">
        {/* Final Decision */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Target size={12} className="text-neutral-500" />
            <span className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
              Final Decision
            </span>
          </div>
          {hasActions ? (
            <div className="flex flex-wrap gap-1.5">
              {decision.decisions.map((action, j) => {
                const isOpen = action.action.includes('open')
                const isLong = action.action.includes('long')
                const actionColor = isLong ? GREEN : RED
                return (
                  <div
                    key={j}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-900/80 border border-neutral-800"
                  >
                    {isOpen ? (
                      <Zap size={10} style={{ color: actionColor }} />
                    ) : (
                      <Activity size={10} className="text-neutral-400" />
                    )}
                    <span className="font-mono text-xs font-bold text-white">
                      {action.symbol}
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase"
                      style={{ color: actionColor }}
                    >
                      {action.action.replace(/_/g, ' ')}
                    </span>
                    {action.success ? (
                      <Check size={10} className="text-[#00C805]" />
                    ) : (
                      <X size={10} className="text-[#FF5000]" />
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-neutral-500 italic">
              HOLD — No action taken this cycle
            </p>
          )}
        </div>

        {/* Confidence Level */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <BarChart3 size={12} className="text-neutral-500" />
            <span className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
              Confidence Level
            </span>
          </div>
          <ConfidenceBadge value={confidence} />
        </div>

        {/* Indicator Signals */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Activity size={12} className="text-neutral-500" />
            <span className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
              Indicator Signals
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {signals.map((signal, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700"
              >
                {signal}
              </span>
            ))}
            {decision.candidate_coins && decision.candidate_coins.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-400">
                {decision.candidate_coins.length} coins analyzed
              </span>
            )}
          </div>
        </div>

        {/* Chain of Thought */}
        {decision.cot_trace && (
          <div>
            <button
              onClick={() => setShowCoT(!showCoT)}
              className="flex items-center gap-1.5 group"
            >
              <Brain size={12} className="text-neutral-500 group-hover:text-neutral-300 transition-colors" />
              <span className="text-xs text-neutral-500 uppercase tracking-wide font-medium group-hover:text-neutral-300 transition-colors">
                Chain of Thought
              </span>
              {showCoT ? (
                <ChevronUp size={12} className="text-neutral-600" />
              ) : (
                <ChevronDown size={12} className="text-neutral-600" />
              )}
            </button>
            <AnimatePresence>
              {showCoT && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 text-xs bg-neutral-900/60 border border-neutral-800 rounded-lg p-3 font-mono text-neutral-400 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {decision.cot_trace}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Error */}
        {decision.error_message && (
          <div className="text-xs text-[#FF5000] flex items-center gap-1 bg-[#FF5000]/10 rounded-lg px-3 py-2">
            <XCircle size={12} /> {decision.error_message}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Component ─────────────────────────────────────────
interface AIDecisionLogProps {
  decisions: DecisionRecord[] | undefined
  isLoading?: boolean
}

export default function AIDecisionLog({ decisions, isLoading }: AIDecisionLogProps) {
  const [page, setPage] = useState(0)

  const totalPages = useMemo(() => {
    if (!decisions) return 0
    return Math.ceil(decisions.length / PAGE_SIZE)
  }, [decisions])

  const pagedDecisions = useMemo(() => {
    if (!decisions) return []
    const start = page * PAGE_SIZE
    return decisions.slice(start, start + PAGE_SIZE)
  }, [decisions, page])

  const handlePrev = useCallback(() => setPage((p) => Math.max(0, p - 1)), [])
  const handleNext = useCallback(
    () => setPage((p) => Math.min(totalPages - 1, p + 1)),
    [totalPages]
  )

  // Stats summary
  const stats = useMemo(() => {
    if (!decisions || decisions.length === 0) return null
    const total = decisions.length
    const successful = decisions.filter((d) => d.success).length
    const withActions = decisions.filter(
      (d) => d.decisions && d.decisions.length > 0
    ).length
    return { total, successful, withActions }
  }, [decisions])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-6 bg-neutral-900 rounded w-48 animate-pulse" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-neutral-900 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-neutral-400" />
          <h2 className="text-lg font-bold text-white">AI Decision Log</h2>
        </div>
        {stats && (
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span>{stats.total} cycles</span>
            <span className="text-[#00C805]">{stats.successful} ok</span>
            <span>{stats.withActions} with trades</span>
          </div>
        )}
      </div>

      {/* Decision Cards */}
      <div className="space-y-3">
        {pagedDecisions.length > 0 ? (
          pagedDecisions.map((decision, i) => (
            <DecisionDetailCard key={`${decision.cycle_number}-${i}`} decision={decision} />
          ))
        ) : (
          <div className="py-12 text-center border border-neutral-900 rounded-xl">
            <Brain size={32} className="mx-auto text-neutral-700 mb-2" />
            <p className="text-neutral-600 text-sm">No decisions recorded yet</p>
            <p className="text-neutral-700 text-xs mt-1">
              Decisions will appear here once the AI trader starts making them
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <button
            onClick={handlePrev}
            disabled={page === 0}
            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white disabled:text-neutral-700 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} /> Newer
          </button>
          <span className="text-xs text-neutral-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={handleNext}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white disabled:text-neutral-700 disabled:cursor-not-allowed transition-colors"
          >
            Older <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
