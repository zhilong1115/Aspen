import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Trophy,
  Target,
  BarChart3,
  Minus,
} from 'lucide-react'
import useSWR from 'swr'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { ErrorState } from '../components/ui/ErrorState'
import { CommunitySkeleton } from '../components/ui/Skeleton'
import { api } from '../lib/api'
import type { CommunityData, CommunityTraderProfile } from '../types'

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

const GREEN = '#00C805'
const RED = '#FF5000'

const RANK_COLORS = [
  { bg: '#D4A017', text: '#000' }, // Gold
  { bg: '#A8A9AD', text: '#000' }, // Silver
  { bg: '#CD7F32', text: '#000' }, // Bronze
]

// Deterministic avatar color from trader name
const AVATAR_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#2563eb',
  '#7c3aed',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getAvatarLetter(name: string): string {
  return (name.charAt(0) || '?').toUpperCase()
}

// ── Animation Variants ─────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
}

// ── Stats Header ───────────────────────────────────────────
function StatsHeader({ traders }: { traders: CommunityTraderProfile[] }) {
  const totalTraders = traders.length
  const best = traders.length > 0 ? traders[0] : null
  const avgWinRate =
    traders.length > 0
      ? traders.reduce(
          (sum, t) => sum + (t.total_trades > 0 ? t.win_rate : 0),
          0
        ) / traders.filter((t) => t.total_trades > 0).length || 0
      : 0

  const stats = [
    {
      label: 'Active Traders',
      value: totalTraders.toString(),
      icon: Users,
      color: '#a78bfa',
    },
    {
      label: 'Top Performer',
      value: best ? `${best.trader_name}` : '—',
      sub: best
        ? `${best.total_return_pct >= 0 ? '+' : ''}${best.total_return_pct.toFixed(2)}%`
        : undefined,
      subColor: best ? (best.total_return_pct >= 0 ? GREEN : RED) : undefined,
      icon: Trophy,
      color: '#D4A017',
    },
    {
      label: 'Avg Win Rate',
      value: `${avgWinRate.toFixed(1)}%`,
      icon: Target,
      color: avgWinRate >= 50 ? GREEN : RED,
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3"
    >
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3.5 flex items-center gap-3"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${s.color}18` }}
          >
            <s.icon size={18} style={{ color: s.color }} />
          </div>
          <div className="min-w-0">
            <div className="text-neutral-500 text-[10px] uppercase tracking-wider">
              {s.label}
            </div>
            <div className="text-white font-semibold text-sm truncate">
              {s.value}
              {s.sub && (
                <span
                  className="ml-1.5 text-xs font-bold"
                  style={{ color: s.subColor }}
                >
                  {s.sub}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  )
}

// ── Trader Card ────────────────────────────────────────────
function TraderCard({
  trader,
  rank,
}: {
  trader: CommunityTraderProfile
  rank: number
}) {
  const isPositive = trader.total_return_pct >= 0
  const accentColor = isPositive ? GREEN : RED
  const ReturnIcon = isPositive ? TrendingUp : TrendingDown
  const isTop3 = rank <= 3
  const rankMeta = RANK_COLORS[rank - 1] // undefined if rank > 3

  return (
    <motion.div
      variants={cardVariants}
      className={`rounded-xl border bg-neutral-900/50 p-4 sm:p-5 flex items-center gap-4 transition-colors ${
        isTop3
          ? 'border-neutral-700/80 hover:border-neutral-600'
          : 'border-neutral-900 hover:border-neutral-700'
      }`}
      style={
        isTop3
          ? { boxShadow: `inset 0 0 0 0.5px ${rankMeta?.bg ?? '#555'}22` }
          : undefined
      }
    >
      {/* Rank */}
      <div className="w-10 text-center shrink-0">
        {rankMeta ? (
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
            style={{ backgroundColor: rankMeta.bg, color: rankMeta.text }}
          >
            {rank}
          </span>
        ) : (
          <span className="text-neutral-500 font-bold text-lg">{rank}</span>
        )}
      </div>

      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
        style={{ backgroundColor: getAvatarColor(trader.trader_name) }}
      >
        {getAvatarLetter(trader.trader_name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-white font-semibold text-sm sm:text-base truncate">
            {trader.trader_name}
          </span>
          {trader.is_running && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: GREEN }}
              title="Running"
            />
          )}
          <span className="text-neutral-500 text-xs bg-neutral-800 rounded-full px-2 py-0.5 shrink-0">
            {getModelDisplayName(trader.ai_model)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-400 flex-wrap">
          <span>{trader.total_trades} trades</span>
          {trader.sharpe_ratio !== 0 && (
            <span>Sharpe {trader.sharpe_ratio.toFixed(2)}</span>
          )}
          {trader.profit_factor > 0 && (
            <span>PF {trader.profit_factor.toFixed(2)}</span>
          )}
        </div>
      </div>

      {/* Position Change Indicator */}
      <div className="shrink-0 hidden sm:flex items-center justify-center w-6">
        <Minus size={14} className="text-neutral-600" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 sm:gap-6 shrink-0">
        {/* Win Rate */}
        <div className="text-right">
          <div className="text-neutral-500 text-[10px] uppercase tracking-wider mb-0.5">
            Win Rate
          </div>
          <div
            className="font-bold text-sm sm:text-base"
            style={{ color: trader.win_rate >= 50 ? GREEN : RED }}
          >
            {trader.total_trades > 0 ? `${trader.win_rate.toFixed(1)}%` : '—'}
          </div>
        </div>

        {/* Total Return */}
        <div className="text-right">
          <div className="text-neutral-500 text-[10px] uppercase tracking-wider mb-0.5">
            Return
          </div>
          <div className="flex items-center gap-1 justify-end">
            <ReturnIcon size={14} style={{ color: accentColor }} />
            <span
              className="font-bold text-sm sm:text-base"
              style={{ color: accentColor }}
            >
              {isPositive ? '+' : ''}
              {trader.total_return_pct.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Component ──────────────────────────────────────────────
function CommunityPageContent() {
  const { data, error, isLoading, mutate } = useSWR<CommunityData>(
    'community',
    () => api.getCommunity(),
    { refreshInterval: 30000 }
  )

  const traders = data?.traders ?? []
  const top3 = traders.slice(0, 3)
  const rest = traders.slice(3)

  return (
    <div className="min-h-screen bg-black pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-1">
          <Users size={28} style={{ color: GREEN }} />
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Community Leaderboard
          </h1>
        </div>
        <p className="text-neutral-500 text-sm sm:text-base">
          See how AI strategies perform across the platform
        </p>
      </motion.div>

      {/* Stats Header */}
      {!isLoading && !error && traders.length > 0 && (
        <StatsHeader traders={traders} />
      )}

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/30 px-5 py-3.5 flex items-center gap-3"
      >
        <BarChart3 size={18} className="text-neutral-500 shrink-0" />
        <p className="text-neutral-500 text-sm">
          Ranked by total return. Win rate, Sharpe ratio, and profit factor from
          live trading history.
        </p>
      </motion.div>

      {/* Loading */}
      {isLoading && <CommunitySkeleton />}

      {/* Error */}
      {error && !isLoading && (
        <ErrorState
          error={error}
          title="Failed to load community data"
          description="We couldn't load the leaderboard. Please try again."
          onRetry={() => mutate()}
        />
      )}

      {/* Empty State */}
      {!isLoading && !error && traders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Users size={40} className="text-neutral-600" />
          <p className="text-neutral-500 text-sm">No traders yet</p>
        </div>
      )}

      {/* Leaderboard */}
      {!isLoading && !error && traders.length > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-3"
        >
          {/* Top 3 */}
          {top3.map((trader: CommunityTraderProfile, idx: number) => (
            <TraderCard key={trader.trader_id} trader={trader} rank={idx + 1} />
          ))}

          {/* Separator */}
          {rest.length > 0 && (
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-neutral-800" />
              <span className="text-neutral-600 text-[10px] uppercase tracking-widest font-medium">
                More Traders
              </span>
              <div className="flex-1 h-px bg-neutral-800" />
            </div>
          )}

          {/* Rest */}
          {rest.map((trader: CommunityTraderProfile, idx: number) => (
            <TraderCard key={trader.trader_id} trader={trader} rank={idx + 4} />
          ))}
        </motion.div>
      )}
    </div>
  )
}

// Export wrapped with ErrorBoundary
export function CommunityPage() {
  return (
    <ErrorBoundary>
      <CommunityPageContent />
    </ErrorBoundary>
  )
}
