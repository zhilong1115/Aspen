import { Medal, Trophy } from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'
import { useLanguage } from '../contexts/LanguageContext'
import { t } from '../i18n/translations'
import { api } from '../lib/api'
import type { CompetitionData } from '../types'
import { getTraderColor } from '../utils/traderColors'
import { ComparisonChart } from './ComparisonChart'
import { TraderConfigViewModal } from './TraderConfigViewModal'

export function CompetitionPage() {
  const { language } = useLanguage()
  const [selectedTrader, setSelectedTrader] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data: competition } = useSWR<CompetitionData>(
    'competition',
    api.getCompetition,
    {
      refreshInterval: 15000, // 15秒刷新（竞赛数据不需要太频繁更新）
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  const handleTraderClick = async (traderId: string) => {
    try {
      const traderConfig = await api.getTraderConfig(traderId)
      setSelectedTrader(traderConfig)
      setIsModalOpen(true)
    } catch (error) {
      console.error('Failed to fetch trader config:', error)
      // 对于未登录用户，不显示详细配置，这是正常行为
      // 竞赛页面主要用于查看排行榜和基本信息
    }
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedTrader(null)
  }

  if (!competition) {
    return (
      <div className="space-y-6">
        <div className="glass-card p-8 animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-3 flex-1">
              <div className="skeleton h-8 w-64 bg-gray-200"></div>
              <div className="skeleton h-4 w-48 bg-gray-200"></div>
            </div>
            <div className="skeleton h-12 w-32 bg-gray-200"></div>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="skeleton h-6 w-40 mb-4 bg-gray-200"></div>
          <div className="space-y-3">
            <div className="skeleton h-20 w-full rounded bg-gray-200"></div>
            <div className="skeleton h-20 w-full rounded bg-gray-200"></div>
          </div>
        </div>
      </div>
    )
  }

  // 如果有数据返回但没有交易员，显示空状态
  if (!competition.traders || competition.traders.length === 0) {
    return (
      <div className="space-y-5 animate-fade-in">
        {/* Competition Header - 精简版 */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
          <div className="flex items-center gap-3 md:gap-4">
            <div
              className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center bg-[var(--surface-soft-yellow)] shadow-sm"
            >
              <Trophy
                className="w-6 h-6 md:w-7 md:h-7 text-[var(--google-yellow)]"
              />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
                {t('aiCompetition', language)}
                <span className="text-xs font-normal px-2 py-1 rounded bg-[var(--surface-soft-yellow)] text-[var(--google-yellow)] border border-[var(--google-yellow)]/20">
                  0 {t('traders', language)}
                </span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('liveBattle', language)}
              </p>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="glass-card p-8 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-40 text-[var(--text-tertiary)]" />
          <h3 className="text-lg font-bold mb-2 text-[var(--text-primary)]">
            {t('noTraders', language)}
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('createFirstTrader', language)}
          </p>
        </div>
      </div>
    )
  }

  // 按收益率排序
  const sortedTraders = [...competition.traders].sort(
    (a, b) => b.total_pnl_pct - a.total_pnl_pct
  )

  // 找出领先者
  const leader = sortedTraders[0]

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Competition Header - 精简版 */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
        <div className="flex items-center gap-3 md:gap-4">
          <div
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center bg-[var(--surface-soft-yellow)] shadow-sm"
          >
            <Trophy
              className="w-6 h-6 md:w-7 md:h-7 text-[var(--google-yellow)]"
            />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
              {t('aiCompetition', language)}
              <span className="text-xs font-normal px-2 py-1 rounded bg-[var(--surface-soft-yellow)] text-[var(--google-yellow)] border border-[var(--google-yellow)]/20">
                {competition.count} {t('traders', language)}
              </span>
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              {t('liveBattle', language)}
            </p>
          </div>
        </div>
        <div className="text-left md:text-right w-full md:w-auto">
          <div className="text-xs mb-1 text-[var(--text-secondary)]">
            {t('leader', language)}
          </div>
          <div className="text-base md:text-lg font-bold text-[var(--google-yellow)]">
            {leader?.trader_name}
          </div>
          <div
            className="text-sm font-semibold"
            style={{
              color: (leader?.total_pnl ?? 0) >= 0 ? '#0ECB81' : '#F6465D',
            }}
          >
            {(leader?.total_pnl ?? 0) >= 0 ? '+' : ''}
            {leader?.total_pnl_pct?.toFixed(2) || '0.00'}%
          </div>
        </div>
      </div>

      {/* Left/Right Split: Performance Chart + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Performance Comparison Chart */}
        <div
          className="glass-card p-5 animate-slide-in"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--text-primary)]">
              {t('performanceComparison', language)}
            </h2>
            <div className="text-xs text-[var(--text-secondary)]">
              {t('realTimePnL', language)}
            </div>
          </div>
          <ComparisonChart traders={sortedTraders.slice(0, 5)} />
        </div>

        {/* Right: Leaderboard */}
        <div
          className="glass-card p-5 animate-slide-in"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--text-primary)]">
              {t('leaderboard', language)}
            </h2>
            <div className="text-xs px-2 py-1 rounded bg-[var(--surface-soft-yellow)] text-[var(--google-yellow)] border border-[var(--google-yellow)]/20">
              {t('live', language)}
            </div>
          </div>
          <div className="space-y-2">
            {sortedTraders.map((trader, index) => {
              const isLeader = index === 0
              const traderColor = getTraderColor(
                sortedTraders,
                trader.trader_id
              )

              return (
                <div
                  key={trader.trader_id}
                  onClick={() => handleTraderClick(trader.trader_id)}
                  className={`rounded-xl p-3 transition-all duration-300 hover:translate-y-[-1px] cursor-pointer hover:shadow-md border ${isLeader
                      ? 'bg-[var(--surface-soft-yellow)] border-[var(--google-yellow)]/30'
                      : 'bg-[var(--surface)] border-[var(--border-light)]'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    {/* Rank & Name */}
                    <div className="flex items-center gap-3">
                      <div className="w-6 flex items-center justify-center">
                        <Medal
                          className="w-5 h-5"
                          style={{
                            color:
                              index === 0
                                ? '#F0B90B'
                                : index === 1
                                  ? '#C0C0C0'
                                  : '#CD7F32',
                          }}
                        />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[var(--text-primary)]">
                          {trader.trader_name}
                        </div>
                        <div
                          className="text-xs mono font-semibold"
                          style={{ color: traderColor }}
                        >
                          {trader.ai_model.toUpperCase()} +{' '}
                          {trader.exchange.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap md:flex-nowrap">
                      {/* Total Equity */}
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-secondary)]">
                          {t('equity', language)}
                        </div>
                        <div className="text-xs md:text-sm font-bold mono text-[var(--text-primary)]">
                          {trader.total_equity?.toFixed(2) || '0.00'}
                        </div>
                      </div>

                      {/* P&L */}
                      <div className="text-right min-w-[70px] md:min-w-[90px]">
                        <div className="text-xs text-[var(--text-secondary)]">
                          {t('pnl', language)}
                        </div>
                        <div
                          className="text-base md:text-lg font-bold mono"
                          style={{
                            color:
                              (trader.total_pnl ?? 0) >= 0
                                ? '#0ECB81'
                                : '#F6465D',
                          }}
                        >
                          {(trader.total_pnl ?? 0) >= 0 ? '+' : ''}
                          {trader.total_pnl_pct?.toFixed(2) || '0.00'}%
                        </div>
                        <div className="text-xs mono text-[var(--text-secondary)]">
                          {(trader.total_pnl ?? 0) >= 0 ? '+' : ''}
                          {trader.total_pnl?.toFixed(2) || '0.00'}
                        </div>
                      </div>

                      {/* Positions */}
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-secondary)]">
                          {t('pos', language)}
                        </div>
                        <div className="text-xs md:text-sm font-bold mono text-[var(--text-primary)]">
                          {trader.position_count}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          {trader.margin_used_pct.toFixed(1)}%
                        </div>
                      </div>

                      {/* Status */}
                      <div>
                        <div
                          className="px-2 py-1 rounded text-xs font-bold"
                          style={
                            trader.is_running
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
                          {trader.is_running ? '●' : '○'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Head-to-Head Stats */}
      {competition.traders.length === 2 && (
        <div
          className="glass-card p-5 animate-slide-in"
          style={{ animationDelay: '0.3s' }}
        >
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-[var(--text-primary)]">
            {t('headToHead', language)}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {sortedTraders.map((trader, index) => {
              const isWinning = index === 0
              const opponent = sortedTraders[1 - index]

              // Check if both values are valid numbers
              const hasValidData =
                trader.total_pnl_pct != null &&
                opponent.total_pnl_pct != null &&
                !isNaN(trader.total_pnl_pct) &&
                !isNaN(opponent.total_pnl_pct)

              const gap = hasValidData
                ? trader.total_pnl_pct - opponent.total_pnl_pct
                : NaN

              return (
                <div
                  key={trader.trader_id}
                  className={`p-4 rounded-xl transition-all duration-300 hover:scale-[1.02] border ${isWinning
                      ? 'bg-[var(--surface-soft-green)] border-[var(--google-green)]/30 shadow-sm'
                      : 'bg-[var(--surface)] border-[var(--border-light)] shadow-sm'
                    }`}
                >
                  <div className="text-center">
                    <div
                      className="text-sm md:text-base font-bold mb-2"
                      style={{
                        color: getTraderColor(sortedTraders, trader.trader_id),
                      }}
                    >
                      {trader.trader_name}
                    </div>
                    <div
                      className="text-lg md:text-2xl font-bold mono mb-1"
                      style={{
                        color:
                          (trader.total_pnl ?? 0) >= 0 ? '#0ECB81' : '#F6465D',
                      }}
                    >
                      {trader.total_pnl_pct != null &&
                        !isNaN(trader.total_pnl_pct)
                        ? `${trader.total_pnl_pct >= 0 ? '+' : ''}${trader.total_pnl_pct.toFixed(2)}%`
                        : '—'}
                    </div>
                    {hasValidData && isWinning && gap > 0 && (
                      <div
                        className="text-xs font-semibold"
                        style={{ color: '#0ECB81' }}
                      >
                        {t('leadingBy', language, { gap: gap.toFixed(2) })}
                      </div>
                    )}
                    {hasValidData && !isWinning && gap < 0 && (
                      <div
                        className="text-xs font-semibold"
                        style={{ color: '#F6465D' }}
                      >
                        {t('behindBy', language, {
                          gap: Math.abs(gap).toFixed(2),
                        })}
                      </div>
                    )}
                    {!hasValidData && (
                      <div
                        className="text-xs font-semibold"
                        style={{ color: '#848E9C' }}
                      >
                        —
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Trader Config View Modal */}
      <TraderConfigViewModal
        isOpen={isModalOpen}
        onClose={closeModal}
        traderData={selectedTrader}
      />
    </div>
  )
}
