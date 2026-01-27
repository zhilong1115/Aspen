import { motion } from 'framer-motion'
import { Crown, TrendingUp, TrendingDown, Users, Loader2, AlertCircle } from 'lucide-react'
import useSWR from 'swr'
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

const RANK_BADGES = ['🥇', '🥈', '🥉']

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

// ── Component ──────────────────────────────────────────────
export function CommunityPage() {
  const { data, error, isLoading } = useSWR<CommunityData>(
    'community',
    () => api.getCommunity(),
    { refreshInterval: 30000 }
  )

  const traders = data?.traders ?? []

  return (
    <div className="min-h-screen bg-black pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <Users size={28} style={{ color: GREEN }} />
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Community
          </h1>
          <span className="ml-2 px-3 py-0.5 rounded-full bg-neutral-800 text-neutral-400 text-xs font-semibold uppercase tracking-wider border border-neutral-700">
            Beta
          </span>
        </div>
        <p className="text-neutral-500 text-sm sm:text-base">
          See how AI strategies perform across the platform
        </p>
      </motion.div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/30 px-5 py-4 flex items-center gap-3"
      >
        <Crown size={20} className="text-yellow-500 shrink-0" />
        <p className="text-neutral-400 text-sm">
          Leaderboard ranked by total return. Win rate and Sharpe ratio from trading history.
        </p>
      </motion.div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-neutral-500" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle size={32} className="text-red-500" />
          <p className="text-neutral-400 text-sm">Failed to load community data</p>
        </div>
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
          {traders.map((trader: CommunityTraderProfile, idx: number) => {
            const isPositive = trader.total_return_pct >= 0
            const accentColor = isPositive ? GREEN : RED
            const badge = RANK_BADGES[idx] ?? null
            const ReturnIcon = isPositive ? TrendingUp : TrendingDown

            return (
              <motion.div
                key={trader.trader_id}
                variants={cardVariants}
                className="rounded-xl border border-neutral-900 bg-neutral-900/50 p-4 sm:p-5 flex items-center gap-4 hover:border-neutral-700 transition-colors"
              >
                {/* Rank */}
                <div className="w-10 text-center shrink-0">
                  {badge ? (
                    <span className="text-2xl">{badge}</span>
                  ) : (
                    <span className="text-neutral-500 font-bold text-lg">
                      {idx + 1}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-semibold text-sm sm:text-base truncate">
                      {trader.trader_name}
                    </span>
                    {trader.is_running && (
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Running" />
                    )}
                    <span className="text-neutral-500 text-xs bg-neutral-800 rounded-full px-2 py-0.5 shrink-0">
                      {getModelDisplayName(trader.ai_model)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-neutral-400">
                    <span>{trader.total_trades} trades</span>
                    {trader.sharpe_ratio !== 0 && (
                      <span>Sharpe {trader.sharpe_ratio.toFixed(2)}</span>
                    )}
                  </div>
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
          })}
        </motion.div>
      )}
    </div>
  )
}
