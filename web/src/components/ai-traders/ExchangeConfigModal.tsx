import { AlertTriangle, BookOpen, HelpCircle, Trash2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { t, type Language } from '../../i18n/translations'
import { api } from '../../lib/api'
import type { Exchange } from '../../types'
import {
  TwoStageKeyModal,
  type TwoStageKeyModalResult,
} from '../TwoStageKeyModal'
import { Tooltip } from './Tooltip'
import { getShortName } from './utils'

interface ExchangeConfigModalProps {
  allExchanges: Exchange[]
  editingExchangeId: string | null
  onSave: (
    exchangeId: string,
    apiKey: string,
    secretKey?: string,
    testnet?: boolean,
    hyperliquidWalletAddr?: string,
    asterUser?: string,
    asterSigner?: string,
    asterPrivateKey?: string,
    paperTradingInitialUSDC?: number
  ) => Promise<void>
  onDelete: (exchangeId: string) => void
  onClose: () => void
  language: Language
}

export function ExchangeConfigModal({
  allExchanges,
  editingExchangeId,
  onSave,
  onDelete,
  onClose,
  language,
}: ExchangeConfigModalProps) {
  const [selectedExchangeId, setSelectedExchangeId] = useState(
    editingExchangeId || ''
  )
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [testnet, setTestnet] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [serverIP, setServerIP] = useState<{
    public_ip: string
    message: string
  } | null>(null)
  const [loadingIP, setLoadingIP] = useState(false)
  const [copiedIP, setCopiedIP] = useState(false)

  // 币安配置指南展开状态
  const [showBinanceGuide, setShowBinanceGuide] = useState(false)

  // Aster 特定字段
  const [asterUser, setAsterUser] = useState('')
  const [asterSigner, setAsterSigner] = useState('')
  const [asterPrivateKey, setAsterPrivateKey] = useState('')

  // Hyperliquid 特定字段
  const [hyperliquidWalletAddr, setHyperliquidWalletAddr] = useState('')

  // Paper Trading 特定字段
  const [paperTradingInitialUSDC, setPaperTradingInitialUSDC] = useState(10000)

  // 安全输入状态
  const [secureInputTarget, setSecureInputTarget] = useState<
    null | 'hyperliquid' | 'aster'
  >(null)

  // 获取当前编辑的交易所信息
  const selectedExchange = allExchanges?.find(
    (e) => e.id === selectedExchangeId
  )

  // 如果是编辑现有交易所，初始化表单数据
  useEffect(() => {
    if (editingExchangeId && selectedExchange) {
      setApiKey(selectedExchange.apiKey || '')
      setSecretKey(selectedExchange.secretKey || '')
      setPassphrase('') // Don't load existing passphrase for security
      setTestnet(selectedExchange.testnet || false)

      // Aster 字段
      setAsterUser(selectedExchange.asterUser || '')
      setAsterSigner(selectedExchange.asterSigner || '')
      setAsterPrivateKey('') // Don't load existing private key for security

      // Hyperliquid 字段
      setHyperliquidWalletAddr(selectedExchange.hyperliquidWalletAddr || '')

      // Paper Trading 字段
      setPaperTradingInitialUSDC(
        selectedExchange.paperTradingInitialUSDC || 10000
      )
    }
  }, [editingExchangeId, selectedExchange])

  // 加载服务器IP（当选择binance时）
  useEffect(() => {
    if (selectedExchangeId === 'binance' && !serverIP) {
      setLoadingIP(true)
      api
        .getServerIP()
        .then((data) => {
          setServerIP(data)
        })
        .catch((err) => {
          console.error('Failed to load server IP:', err)
        })
        .finally(() => {
          setLoadingIP(false)
        })
    }
  }, [selectedExchangeId])

  const handleCopyIP = async (ip: string) => {
    try {
      // 优先使用现代 Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(ip)
        setCopiedIP(true)
        setTimeout(() => setCopiedIP(false), 2000)
        toast.success(t('ipCopied', language))
      } else {
        // 降级方案: 使用传统的 execCommand 方法
        const textArea = document.createElement('textarea')
        textArea.value = ip
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()

        try {
          const successful = document.execCommand('copy')
          if (successful) {
            setCopiedIP(true)
            setTimeout(() => setCopiedIP(false), 2000)
            toast.success(t('ipCopied', language))
          } else {
            throw new Error('复制命令执行失败')
          }
        } finally {
          document.body.removeChild(textArea)
        }
      }
    } catch (err) {
      console.error('复制失败:', err)
      // 显示错误提示
      toast.error(
        t('copyIPFailed', language) || `复制失败: ${ip}\n请手动复制此IP地址`
      )
    }
  }

  // 安全输入处理函数
  const secureInputContextLabel =
    secureInputTarget === 'aster'
      ? t('asterExchangeName', language)
      : secureInputTarget === 'hyperliquid'
        ? t('hyperliquidExchangeName', language)
        : undefined

  const handleSecureInputCancel = () => {
    setSecureInputTarget(null)
  }

  const handleSecureInputComplete = ({
    value,
    obfuscationLog,
  }: TwoStageKeyModalResult) => {
    const trimmed = value.trim()
    if (secureInputTarget === 'hyperliquid') {
      setApiKey(trimmed)
    }
    if (secureInputTarget === 'aster') {
      setAsterPrivateKey(trimmed)
    }
    console.log('Secure input obfuscation log:', obfuscationLog)
    setSecureInputTarget(null)
  }

  // 掩盖敏感数据显示
  const maskSecret = (secret: string) => {
    if (!secret || secret.length === 0) return ''
    if (secret.length <= 8) return '*'.repeat(secret.length)
    return (
      secret.slice(0, 4) +
      '*'.repeat(Math.max(secret.length - 8, 4)) +
      secret.slice(-4)
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedExchangeId) return

    // 根据交易所类型验证不同字段
    if (selectedExchange?.id === 'binance') {
      if (!apiKey.trim() || !secretKey.trim()) return
      await onSave(selectedExchangeId, apiKey.trim(), secretKey.trim(), testnet)
    } else if (selectedExchange?.id === 'hyperliquid') {
      if (!apiKey.trim() || !hyperliquidWalletAddr.trim()) return // 验证私钥和钱包地址
      await onSave(
        selectedExchangeId,
        apiKey.trim(),
        '',
        testnet,
        hyperliquidWalletAddr.trim()
      )
    } else if (selectedExchange?.id === 'aster') {
      if (!asterUser.trim() || !asterSigner.trim() || !asterPrivateKey.trim())
        return
      await onSave(
        selectedExchangeId,
        '',
        '',
        testnet,
        undefined,
        asterUser.trim(),
        asterSigner.trim(),
        asterPrivateKey.trim()
      )
    } else if (selectedExchange?.id === 'paper') {
      // Paper Trading 只需要初始USDC金额
      if (paperTradingInitialUSDC <= 0) {
        toast.error('初始USDC金额必须大于0')
        return
      }
      await onSave(
        selectedExchangeId,
        '',
        '',
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        paperTradingInitialUSDC
      )
    } else if (selectedExchange?.id === 'okx') {
      if (!apiKey.trim() || !secretKey.trim() || !passphrase.trim()) return
      await onSave(selectedExchangeId, apiKey.trim(), secretKey.trim(), testnet)
    } else {
      // 默认情况（其他CEX交易所）
      if (!apiKey.trim() || !secretKey.trim()) return
      await onSave(selectedExchangeId, apiKey.trim(), secretKey.trim(), testnet)
    }
  }

  // 可选择的交易所列表（所有支持的交易所）
  const availableExchanges = allExchanges || []

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        className="bg-[#1E2329] rounded-xl w-full max-w-lg relative my-8 border border-neutral-800"
        style={{
          maxHeight: 'calc(100vh - 4rem)',
        }}
      >
        <div className="flex items-center justify-between p-6 pb-4 sticky top-0 z-10 bg-[#1E2329] rounded-t-xl">
          <h3 className="text-xl font-bold text-white">
            {editingExchangeId
              ? t('editExchange', language)
              : t('addExchange', language)}
          </h3>
          <div className="flex items-center gap-2">
            {selectedExchange?.id === 'binance' && (
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="px-3 py-2 rounded text-sm font-semibold transition-all hover:scale-105 flex items-center gap-2 bg-[#00C805]/10 text-[#00C805]"
              >
                <BookOpen className="w-4 h-4" />
                {t('viewGuide', language)}
              </button>
            )}
            {editingExchangeId && (
              <button
                type="button"
                onClick={() => onDelete(editingExchangeId)}
                className="p-2 rounded bg-[#FF5000]/10 text-[#FF5000] hover:bg-[#FF5000]/20 transition-colors"
                title={t('delete', language)}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6">
          <div
            className="space-y-4 overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 16rem)' }}
          >
            {!editingExchangeId && (
              <div>
                <label className="block text-sm font-semibold mb-2 text-white">
                  {t('selectExchange', language)}
                </label>
                <select
                  value={selectedExchangeId}
                  onChange={(e) => setSelectedExchangeId(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                  required
                >
                  <option value="">
                    {t('pleaseSelectExchange', language)}
                  </option>
                  {availableExchanges.map((exchange) => (
                    <option key={exchange.id} value={exchange.id}>
                      {getShortName(exchange.name)} (
                      {exchange.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedExchange && (
              <div className="p-4 rounded bg-[#0B0E11] border border-neutral-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-neutral-800 text-[#00C805]">
                    {getShortName(selectedExchange.name)[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-white">
                      {getShortName(selectedExchange.name)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {selectedExchange.type.toUpperCase()} •{' '}
                      {selectedExchange.id}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedExchange && (
              <>
                {/* Binance 和其他 CEX 交易所的字段 */}
                {(selectedExchange.id === 'binance' ||
                  selectedExchange.type === 'cex') &&
                  selectedExchange.id !== 'hyperliquid' &&
                  selectedExchange.id !== 'aster' && (
                    <>
                      {/* 币安用户配置提示 (D1 方案) */}
                      {selectedExchange.id === 'binance' && (
                        <div
                          className="mb-4 p-3 rounded cursor-pointer transition-colors bg-blue-900/30 border border-blue-800/50"
                          onClick={() => setShowBinanceGuide(!showBinanceGuide)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-blue-400">ℹ️</span>
                              <span className="text-sm font-medium text-white">
                                <strong>币安用户必读：</strong>
                                使用「现货与合约交易」API，不要用「统一账户
                                API」
                              </span>
                            </div>
                            <span className="text-neutral-500">
                              {showBinanceGuide ? '▲' : '▼'}
                            </span>
                          </div>

                          {/* 展开的详细说明 */}
                          {showBinanceGuide && (
                            <div
                              className="mt-3 pt-3 border-t border-blue-800/50 text-sm text-neutral-300"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="mb-2 text-neutral-500">
                                <strong>原因：</strong>统一账户 API
                                权限结构不同，会导致订单提交失败
                              </p>

                              <p className="font-semibold mb-1 text-white">
                                正确配置步骤：
                              </p>
                              <ol
                                className="list-decimal list-inside space-y-1 mb-3"
                                style={{ paddingLeft: '0.5rem' }}
                              >
                                <li>
                                  登录币安 → 个人中心 →{' '}
                                  <strong>API 管理</strong>
                                </li>
                                <li>
                                  创建 API → 选择「
                                  <strong>系统生成的 API 密钥</strong>」
                                </li>
                                <li>
                                  勾选「<strong>现货与合约交易</strong>」（
                                  <span className="text-[#FF5000]">
                                    不选统一账户
                                  </span>
                                  ）
                                </li>
                                <li>
                                  IP 限制选「<strong>无限制</strong>
                                  」或添加服务器 IP
                                </li>
                              </ol>

                              <p className="mb-2 p-2 rounded bg-[#FF5000]/10 border border-[#FF5000]/30">
                                💡 <strong>多资产模式用户注意：</strong>
                                如果您开启了多资产模式，将强制使用全仓模式。建议关闭多资产模式以支持逐仓交易。
                              </p>

                              <a
                                href="https://www.binance.com/zh-CN/support/faq/how-to-create-api-keys-on-binance-360002502072"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-sm hover:underline text-blue-400"
                              >
                                📖 查看币安官方教程 ↗
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-white">
                          {t('apiKey', language)}
                        </label>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={t('enterAPIKey', language)}
                          className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-white">
                          {t('secretKey', language)}
                        </label>
                        <input
                          type="password"
                          value={secretKey}
                          onChange={(e) => setSecretKey(e.target.value)}
                          placeholder={t('enterSecretKey', language)}
                          className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                          required
                        />
                      </div>

                      {selectedExchange.id === 'okx' && (
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-white">
                            {t('passphrase', language)}
                          </label>
                          <input
                            type="password"
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            placeholder={t('enterPassphrase', language)}
                            className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                            required
                          />
                        </div>
                      )}

                      {/* Binance 白名单IP提示 */}
                      {selectedExchange.id === 'binance' && (
                        <div className="p-4 rounded bg-[#00C805]/10 border border-[#00C805]/20">
                          <div className="text-sm font-semibold mb-2 text-[#00C805]">
                            {t('whitelistIP', language)}
                          </div>
                          <div className="text-xs mb-3 text-neutral-500">
                            {t('whitelistIPDesc', language)}
                          </div>

                          {loadingIP ? (
                            <div className="text-xs text-neutral-500">
                              {t('loadingServerIP', language)}
                            </div>
                          ) : serverIP && serverIP.public_ip ? (
                            <div className="flex items-center gap-2 p-2 rounded bg-[#0B0E11]">
                              <code className="flex-1 text-sm font-mono text-[#00C805]">
                                {serverIP.public_ip}
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopyIP(serverIP.public_ip)}
                                className="px-3 py-1 rounded text-xs font-semibold transition-all hover:scale-105 bg-[#00C805]/20 text-[#00C805]"
                              >
                                {copiedIP
                                  ? t('ipCopied', language)
                                  : t('copyIP', language)}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </>
                  )}

                {/* Hyperliquid 交易所的字段 */}
                {selectedExchange.id === 'hyperliquid' && (
                  <>
                    {/* 安全提示 banner */}
                    <div className="p-3 rounded mb-4 bg-[#00C805]/10 border border-[#00C805]/30">
                      <div className="flex items-start gap-2">
                        <span className="text-[#00C805] text-base">🔐</span>
                        <div className="flex-1">
                          <div className="text-sm font-semibold mb-1 text-[#00C805]">
                            {t('hyperliquidAgentWalletTitle', language)}
                          </div>
                          <div
                            className="text-xs text-neutral-500"
                            style={{ lineHeight: '1.5' }}
                          >
                            {t('hyperliquidAgentWalletDesc', language)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Agent Private Key 字段 */}
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-white">
                        {t('hyperliquidAgentPrivateKey', language)}
                      </label>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={maskSecret(apiKey)}
                            readOnly
                            placeholder={t(
                              'enterHyperliquidAgentPrivateKey',
                              language
                            )}
                            className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                          />
                          <button
                            type="button"
                            onClick={() => setSecureInputTarget('hyperliquid')}
                            className="px-3 py-2 rounded text-xs font-semibold transition-all hover:scale-105 bg-[#00C805] text-black whitespace-nowrap"
                          >
                            {apiKey
                              ? t('secureInputReenter', language)
                              : t('secureInputButton', language)}
                          </button>
                          {apiKey && (
                            <button
                              type="button"
                              onClick={() => setApiKey('')}
                              className="px-3 py-2 rounded text-xs font-semibold transition-all hover:scale-105 bg-neutral-900 text-neutral-500 whitespace-nowrap"
                            >
                              {t('secureInputClear', language)}
                            </button>
                          )}
                        </div>
                        {apiKey && (
                          <div className="text-xs text-neutral-500">
                            {t('secureInputHint', language)}
                          </div>
                        )}
                      </div>
                      <div className="text-xs mt-1 text-neutral-500">
                        {t('hyperliquidAgentPrivateKeyDesc', language)}
                      </div>
                    </div>

                    {/* Main Wallet Address 字段 */}
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-white">
                        {t('hyperliquidMainWalletAddress', language)}
                      </label>
                      <input
                        type="text"
                        value={hyperliquidWalletAddr}
                        onChange={(e) =>
                          setHyperliquidWalletAddr(e.target.value)
                        }
                        placeholder={t(
                          'enterHyperliquidMainWalletAddress',
                          language
                        )}
                        className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                        required
                      />
                      <div className="text-xs mt-1 text-neutral-500">
                        {t('hyperliquidMainWalletAddressDesc', language)}
                      </div>
                    </div>
                  </>
                )}

                {/* Aster 交易所的字段 */}
                {selectedExchange.id === 'aster' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold mb-2 flex items-center gap-2 text-white">
                        {t('user', language)}
                        <Tooltip content={t('asterUserDesc', language)}>
                          <HelpCircle className="w-4 h-4 cursor-help text-[#00C805]" />
                        </Tooltip>
                      </label>
                      <input
                        type="text"
                        value={asterUser}
                        onChange={(e) => setAsterUser(e.target.value)}
                        placeholder={t('enterUser', language)}
                        className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2 flex items-center gap-2 text-white">
                        {t('signer', language)}
                        <Tooltip content={t('asterSignerDesc', language)}>
                          <HelpCircle className="w-4 h-4 cursor-help text-[#00C805]" />
                        </Tooltip>
                      </label>
                      <input
                        type="text"
                        value={asterSigner}
                        onChange={(e) => setAsterSigner(e.target.value)}
                        placeholder={t('enterSigner', language)}
                        className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2 flex items-center gap-2 text-white">
                        {t('privateKey', language)}
                        <Tooltip content={t('asterPrivateKeyDesc', language)}>
                          <HelpCircle className="w-4 h-4 cursor-help text-[#00C805]" />
                        </Tooltip>
                      </label>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={maskSecret(asterPrivateKey)}
                            readOnly
                            placeholder={t('enterPrivateKey', language)}
                            className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                          />
                          <button
                            type="button"
                            onClick={() => setSecureInputTarget('aster')}
                            className="px-3 py-2 rounded text-xs font-semibold transition-all hover:scale-105 bg-[#00C805] text-black whitespace-nowrap"
                          >
                            {asterPrivateKey
                              ? t('secureInputReenter', language)
                              : t('secureInputButton', language)}
                          </button>
                          {asterPrivateKey && (
                            <button
                              type="button"
                              onClick={() => setAsterPrivateKey('')}
                              className="px-3 py-2 rounded text-xs font-semibold transition-all hover:scale-105 bg-neutral-900 text-neutral-500 whitespace-nowrap"
                            >
                              {t('secureInputClear', language)}
                            </button>
                          )}
                        </div>
                        {asterPrivateKey && (
                          <div className="text-xs text-neutral-500">
                            {t('secureInputHint', language)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded bg-[#00C805]/10 border border-[#00C805]/20">
                      <div className="text-sm font-semibold mb-2 text-[#00C805]">
                        <span className="inline-flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />{' '}
                          {t('securityWarning', language)}
                        </span>
                      </div>
                      <div className="text-xs space-y-1 text-neutral-500">
                        {selectedExchange.id === 'aster' && (
                          <div>{t('asterUsdtWarning', language)}</div>
                        )}
                        <div>{t('exchangeConfigWarning1', language)}</div>
                        <div>{t('exchangeConfigWarning2', language)}</div>
                        <div>{t('exchangeConfigWarning3', language)}</div>
                      </div>
                    </div>
                  </>
                )}

                {/* Paper Trading 交易所的字段 */}
                {selectedExchange.id === 'paper' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-white">
                        初始 USDC 金额
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={paperTradingInitialUSDC}
                        onChange={(e) =>
                          setPaperTradingInitialUSDC(
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="10000"
                        className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                        required
                      />
                      <div className="text-xs mt-1 text-neutral-500">
                        模拟仓的初始USDC余额，用于模拟交易
                      </div>
                    </div>

                    <div className="p-4 rounded bg-blue-500/10 border border-blue-500/20">
                      <div className="text-sm font-semibold mb-2 text-blue-500">
                        ℹ️ 关于模拟仓
                      </div>
                      <div className="text-xs space-y-1 text-neutral-500">
                        <div>• 模拟仓使用真实市场价格进行模拟交易</div>
                        <div>• 所有交易都是虚拟的，不会产生实际资金流动</div>
                        <div>• 适合测试交易策略和熟悉系统功能</div>
                        <div>• 持仓和盈亏会实时计算并显示</div>
                      </div>
                    </div>
                  </>
                )}

                {/* Testnet 开关 - 所有交易所通用（Paper Trading 除外） */}
                {selectedExchange && selectedExchange.id !== 'paper' && (
                  <div className="flex items-center gap-3 p-4 rounded bg-[#0B0E11] border border-neutral-800">
                    <input
                      type="checkbox"
                      id="testnet-checkbox"
                      checked={testnet}
                      onChange={(e) => setTestnet(e.target.checked)}
                      className="w-4 h-4 rounded"
                      style={{
                        accentColor: '#00C805',
                        cursor: 'pointer',
                      }}
                    />
                    <label
                      htmlFor="testnet-checkbox"
                      className="flex-1 cursor-pointer text-white"
                    >
                      <div className="text-sm font-semibold">
                        {t('useTestnet', language)}
                      </div>
                      <div className="text-xs mt-1 text-neutral-500">
                        {t('testnetDescription', language)}
                      </div>
                    </label>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex gap-3 mt-6 pt-4 sticky bottom-0 bg-[#1E2329]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded text-sm font-semibold bg-neutral-800 text-neutral-400"
            >
              {t('cancel', language)}
            </button>
            <button
              type="submit"
              disabled={
                !selectedExchange ||
                (selectedExchange.id === 'binance' &&
                  (!apiKey.trim() || !secretKey.trim())) ||
                (selectedExchange.id === 'okx' &&
                  (!apiKey.trim() ||
                    !secretKey.trim() ||
                    !passphrase.trim())) ||
                (selectedExchange.id === 'hyperliquid' &&
                  (!apiKey.trim() || !hyperliquidWalletAddr.trim())) ||
                (selectedExchange.id === 'aster' &&
                  (!asterUser.trim() ||
                    !asterSigner.trim() ||
                    !asterPrivateKey.trim())) ||
                (selectedExchange.id === 'paper' &&
                  paperTradingInitialUSDC <= 0) ||
                (selectedExchange.type === 'cex' &&
                  selectedExchange.id !== 'hyperliquid' &&
                  selectedExchange.id !== 'aster' &&
                  selectedExchange.id !== 'binance' &&
                  selectedExchange.id !== 'okx' &&
                  selectedExchange.id !== 'paper' &&
                  (!apiKey.trim() || !secretKey.trim()))
              }
              className="flex-1 px-4 py-2 rounded text-sm font-semibold disabled:opacity-50 bg-[#00C805] text-black"
            >
              {t('saveConfig', language)}
            </button>
          </div>
        </form>
      </div>

      {/* Binance Setup Guide Modal */}
      {showGuide && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="bg-[#1E2329] rounded-xl p-6 w-full max-w-4xl relative border border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                <BookOpen className="w-6 h-6 text-[#00C805]" />
                {t('binanceSetupGuide', language)}
              </h3>
              <button
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 rounded text-sm font-semibold transition-all hover:scale-105 bg-neutral-800 text-neutral-400"
              >
                {t('closeGuide', language)}
              </button>
            </div>
            <div className="overflow-y-auto max-h-[80vh]">
              <img
                src="/images/guide.png"
                alt={t('binanceSetupGuide', language)}
                className="w-full h-auto rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* Two Stage Key Modal */}
      <TwoStageKeyModal
        isOpen={secureInputTarget !== null}
        language={language}
        contextLabel={secureInputContextLabel}
        expectedLength={64}
        onCancel={handleSecureInputCancel}
        onComplete={handleSecureInputComplete}
      />
    </div>
  )
}
