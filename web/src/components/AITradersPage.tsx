import {
  AlertTriangle,
  BarChart3,
  Bot,
  Brain,
  Landmark,
  Pencil,
  Plus,
  Radio,
  Trash2,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import useSWR from 'swr'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { ErrorState } from './ui/ErrorState'
import { TradersSkeleton } from './ui/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { t } from '../i18n/translations'
import { api } from '../lib/api'
import { confirmToast } from '../lib/notify'
import type {
  AIModel,
  CreateTraderRequest,
  Exchange,
  TraderInfo,
} from '../types'
import {
  containerVariants,
  ExchangeConfigModal,
  getModelDisplayName,
  getShortName,
  itemVariants,
  ModelConfigModal,
  SignalSourceModal,
} from './ai-traders'
import { TraderConfigModal } from './TraderConfigModal'

interface AITradersPageProps {
  onTraderSelect?: (traderId: string) => void
}

function AITradersPageContent({ onTraderSelect }: AITradersPageProps) {
  const { language } = useLanguage()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showModelModal, setShowModelModal] = useState(false)
  const [showExchangeModal, setShowExchangeModal] = useState(false)
  const [showSignalSourceModal, setShowSignalSourceModal] = useState(false)
  const [editingModel, setEditingModel] = useState<string | null>(null)
  const [editingExchange, setEditingExchange] = useState<string | null>(null)
  const [editingTrader, setEditingTrader] = useState<any>(null)
  const [allModels, setAllModels] = useState<AIModel[]>([])
  const [allExchanges, setAllExchanges] = useState<Exchange[]>([])
  const [supportedModels, setSupportedModels] = useState<AIModel[]>([])
  const [supportedExchanges, setSupportedExchanges] = useState<Exchange[]>([])
  const [userSignalSource, setUserSignalSource] = useState<{
    coinPoolUrl: string
    oiTopUrl: string
  }>({
    coinPoolUrl: '',
    oiTopUrl: '',
  })

  const {
    data: traders,
    error: tradersError,
    isLoading: tradersLoading,
    mutate: mutateTraders,
  } = useSWR<TraderInfo[]>(user && token ? 'traders' : null, api.getTraders, {
    refreshInterval: 5000,
  })

  // 加载AI模型和交易所配置
  useEffect(() => {
    const loadConfigs = async () => {
      if (!user || !token) {
        // 未登录时只加载公开的支持模型和交易所
        try {
          const [supportedModels, supportedExchanges] = await Promise.all([
            api.getSupportedModels(),
            api.getSupportedExchanges(),
          ])
          setSupportedModels(supportedModels)
          setSupportedExchanges(supportedExchanges)
        } catch (err) {
          console.error('Failed to load supported configs:', err)
        }
        return
      }

      try {
        const [
          modelConfigs,
          exchangeConfigs,
          supportedModels,
          supportedExchanges,
        ] = await Promise.all([
          api.getModelConfigs(),
          api.getExchangeConfigs(),
          api.getSupportedModels(),
          api.getSupportedExchanges(),
        ])
        setAllModels(modelConfigs)
        setAllExchanges(exchangeConfigs)
        setSupportedModels(supportedModels)
        setSupportedExchanges(supportedExchanges)

        // 加载用户信号源配置
        try {
          const signalSource = await api.getUserSignalSource()
          setUserSignalSource({
            coinPoolUrl: signalSource.coin_pool_url || '',
            oiTopUrl: signalSource.oi_top_url || '',
          })
        } catch (error) {
          console.log('📡 用户信号源配置暂未设置')
        }
      } catch (error) {
        console.error('Failed to load configs:', error)
      }
    }
    loadConfigs()
  }, [user, token])

  // ── Loading/Error States ─────────────────────────────────
  // Show loading skeleton (only on initial load, not during refresh)
  if (tradersLoading && !traders) {
    return <TradersSkeleton />
  }

  // Show error state
  if (tradersError) {
    return (
      <ErrorState
        error={tradersError}
        title="Failed to load traders"
        description="We couldn't load your AI traders. Please try again."
        onRetry={() => mutateTraders()}
      />
    )
  }

  // 只显示已配置的模型和交易所
  // 注意：后端返回的数据不包含敏感信息（apiKey等），所以通过其他字段判断是否已配置
  const configuredModels =
    allModels?.filter((m) => {
      // 如果模型已启用，说明已配置
      // 或者有自定义API URL，也说明已配置
      return m.enabled || (m.customApiUrl && m.customApiUrl.trim() !== '')
    }) || []
  const configuredExchanges =
    allExchanges?.filter((e) => {
      // Aster 交易所检查特殊字段
      if (e.id === 'aster') {
        return e.asterUser && e.asterUser.trim() !== ''
      }
      // Hyperliquid 需要检查钱包地址（后端会返回这个字段）
      if (e.id === 'hyperliquid') {
        return e.hyperliquidWalletAddr && e.hyperliquidWalletAddr.trim() !== ''
      }
      // 其他交易所：如果已启用，说明已配置（后端返回的已配置交易所会有 enabled: true）
      return e.enabled
    }) || []

  // 只在创建交易员时使用已启用且配置完整的
  // 注意：后端返回的数据不包含敏感信息，所以只检查 enabled 状态和必要的非敏感字段
  const enabledModels = allModels?.filter((m) => m.enabled) || []
  const enabledExchanges =
    allExchanges?.filter((e) => {
      if (!e.enabled) return false

      // Aster 交易所需要特殊字段（后端会返回这些非敏感字段）
      if (e.id === 'aster') {
        return (
          e.asterUser &&
          e.asterUser.trim() !== '' &&
          e.asterSigner &&
          e.asterSigner.trim() !== ''
        )
      }

      // Hyperliquid 需要钱包地址（后端会返回这个字段）
      if (e.id === 'hyperliquid') {
        return e.hyperliquidWalletAddr && e.hyperliquidWalletAddr.trim() !== ''
      }

      // 其他交易所：如果已启用，说明已配置完整（后端只返回已配置的交易所）
      return true
    }) || []

  // 检查模型是否正在被运行中的交易员使用（用于UI禁用）
  const isModelInUse = (modelId: string) => {
    return traders?.some((t) => t.ai_model === modelId && t.is_running)
  }

  // 检查交易所是否正在被运行中的交易员使用（用于UI禁用）
  const isExchangeInUse = (exchangeId: string) => {
    return traders?.some((t) => t.exchange_id === exchangeId && t.is_running)
  }

  // 检查模型是否被任何交易员使用（包括停止状态的）
  const isModelUsedByAnyTrader = (modelId: string) => {
    return traders?.some((t) => t.ai_model === modelId) || false
  }

  // 检查交易所是否被任何交易员使用（包括停止状态的）
  const isExchangeUsedByAnyTrader = (exchangeId: string) => {
    return traders?.some((t) => t.exchange_id === exchangeId) || false
  }

  // 获取使用特定模型的交易员列表
  const getTradersUsingModel = (modelId: string) => {
    return traders?.filter((t) => t.ai_model === modelId) || []
  }

  // 获取使用特定交易所的交易员列表
  const getTradersUsingExchange = (exchangeId: string) => {
    return traders?.filter((t) => t.exchange_id === exchangeId) || []
  }

  const handleCreateTrader = async (data: CreateTraderRequest) => {
    try {
      const model = allModels?.find((m) => m.id === data.ai_model_id)
      const exchange = allExchanges?.find((e) => e.id === data.exchange_id)

      if (!model?.enabled) {
        toast.error(t('modelNotConfigured', language))
        return
      }

      if (!exchange?.enabled) {
        toast.error(t('exchangeNotConfigured', language))
        return
      }

      await toast.promise(api.createTrader(data), {
        loading: '正在创建…',
        success: '创建成功',
        error: '创建失败',
      })
      setShowCreateModal(false)
      mutateTraders()
    } catch (error) {
      console.error('Failed to create trader:', error)
      toast.error(t('createTraderFailed', language))
    }
  }

  const handleEditTrader = async (traderId: string) => {
    try {
      const traderConfig = await api.getTraderConfig(traderId)
      setEditingTrader(traderConfig)
      setShowEditModal(true)
    } catch (error) {
      console.error('Failed to fetch trader config:', error)
      toast.error(t('getTraderConfigFailed', language))
    }
  }

  const handleSaveEditTrader = async (data: CreateTraderRequest) => {
    if (!editingTrader) return

    try {
      const model = enabledModels?.find((m) => m.id === data.ai_model_id)
      const exchange = enabledExchanges?.find((e) => e.id === data.exchange_id)

      if (!model) {
        toast.error(t('modelConfigNotExist', language))
        return
      }

      if (!exchange) {
        toast.error(t('exchangeConfigNotExist', language))
        return
      }

      const request = {
        name: data.name,
        ai_model_id: data.ai_model_id,
        exchange_id: data.exchange_id,
        initial_balance: data.initial_balance,
        scan_interval_minutes: data.scan_interval_minutes,
        btc_eth_leverage: data.btc_eth_leverage,
        altcoin_leverage: data.altcoin_leverage,
        trading_symbols: data.trading_symbols,
        custom_prompt: data.custom_prompt,
        override_base_prompt: data.override_base_prompt,
        is_cross_margin: data.is_cross_margin,
        use_coin_pool: data.use_coin_pool,
        use_oi_top: data.use_oi_top,
      }

      await toast.promise(api.updateTrader(editingTrader.trader_id, request), {
        loading: '正在保存…',
        success: '保存成功',
        error: '保存失败',
      })
      setShowEditModal(false)
      setEditingTrader(null)
      mutateTraders()
    } catch (error) {
      console.error('Failed to update trader:', error)
      toast.error(t('updateTraderFailed', language))
    }
  }

  const handleDeleteTrader = async (traderId: string) => {
    {
      const ok = await confirmToast(t('confirmDeleteTrader', language))
      if (!ok) return
    }

    try {
      await toast.promise(api.deleteTrader(traderId), {
        loading: '正在删除…',
        success: '删除成功',
        error: '删除失败',
      })
      mutateTraders()
    } catch (error) {
      console.error('Failed to delete trader:', error)
      toast.error(t('deleteTraderFailed', language))
    }
  }

  const handleToggleTrader = async (traderId: string, running: boolean) => {
    try {
      if (running) {
        await toast.promise(api.stopTrader(traderId), {
          loading: '正在停止…',
          success: '已停止',
          error: '停止失败',
        })
      } else {
        await toast.promise(api.startTrader(traderId), {
          loading: '正在启动…',
          success: '已启动',
          error: '启动失败',
        })
      }
      mutateTraders()
    } catch (error) {
      console.error('Failed to toggle trader:', error)
      toast.error(t('operationFailed', language))
    }
  }

  const handleModelClick = (modelId: string) => {
    if (!isModelInUse(modelId)) {
      setEditingModel(modelId)
      setShowModelModal(true)
    }
  }

  const handleExchangeClick = (exchangeId: string) => {
    if (!isExchangeInUse(exchangeId)) {
      setEditingExchange(exchangeId)
      setShowExchangeModal(true)
    }
  }

  // 通用删除配置处理函数
  const handleDeleteConfig = async <T extends { id: string }>(config: {
    id: string
    type: 'model' | 'exchange'
    checkInUse: (id: string) => boolean
    getUsingTraders: (id: string) => any[]
    cannotDeleteKey: string
    confirmDeleteKey: string
    allItems: T[] | undefined
    clearFields: (item: T) => T
    buildRequest: (items: T[]) => any
    updateApi: (request: any) => Promise<void>
    refreshApi: () => Promise<T[]>
    setItems: (items: T[]) => void
    closeModal: () => void
    errorKey: string
  }) => {
    // 检查是否有交易员正在使用
    if (config.checkInUse(config.id)) {
      const usingTraders = config.getUsingTraders(config.id)
      const traderNames = usingTraders.map((t) => t.trader_name).join(', ')
      toast.error(
        `${t(config.cannotDeleteKey, language)} · ${t('tradersUsing', language)}: ${traderNames} · ${t('pleaseDeleteTradersFirst', language)}`
      )
      return
    }

    {
      const ok = await confirmToast(t(config.confirmDeleteKey, language))
      if (!ok) return
    }

    try {
      const updatedItems =
        config.allItems?.map((item) =>
          item.id === config.id ? config.clearFields(item) : item
        ) || []

      const request = config.buildRequest(updatedItems)
      await toast.promise(config.updateApi(request), {
        loading: '正在更新配置…',
        success: '配置已更新',
        error: '更新配置失败',
      })

      // 重新获取用户配置以确保数据同步
      const refreshedItems = await config.refreshApi()
      config.setItems(refreshedItems)

      config.closeModal()
    } catch (error) {
      console.error(`Failed to delete ${config.type} config:`, error)
      toast.error(t(config.errorKey, language))
    }
  }

  const handleDeleteModelConfig = async (modelId: string) => {
    await handleDeleteConfig({
      id: modelId,
      type: 'model',
      checkInUse: isModelUsedByAnyTrader,
      getUsingTraders: getTradersUsingModel,
      cannotDeleteKey: 'cannotDeleteModelInUse',
      confirmDeleteKey: 'confirmDeleteModel',
      allItems: allModels,
      clearFields: (m) => ({
        ...m,
        apiKey: '',
        customApiUrl: '',
        customModelName: '',
        enabled: false,
      }),
      buildRequest: (models) => ({
        models: Object.fromEntries(
          models.map((model) => [
            model.provider,
            {
              enabled: model.enabled,
              api_key: model.apiKey || '',
              custom_api_url: model.customApiUrl || '',
              custom_model_name: model.customModelName || '',
            },
          ])
        ),
      }),
      updateApi: api.updateModelConfigs,
      refreshApi: api.getModelConfigs,
      setItems: (items) => {
        // 使用函数式更新确保状态正确更新
        setAllModels([...items])
      },
      closeModal: () => {
        setShowModelModal(false)
        setEditingModel(null)
      },
      errorKey: 'deleteConfigFailed',
    })
  }

  const handleSaveModelConfig = async (
    modelId: string,
    apiKey: string,
    customApiUrl?: string,
    customModelName?: string
  ) => {
    try {
      // 创建或更新用户的模型配置
      const existingModel = allModels?.find((m) => m.id === modelId)
      let updatedModels = [...(allModels || [])]

      if (existingModel) {
        // 更新现有配置
        updatedModels = updatedModels.map((m) =>
          m.id === modelId
            ? {
                ...m,
                apiKey,
                customApiUrl: customApiUrl || '',
                customModelName: customModelName || '',
                enabled: true,
              }
            : m
        )
      } else {
        // 添加新配置：从 modelId 中提取 provider
        // OpenRouter 模型 ID 格式：openrouter-model-name (如 openrouter-openai-gpt-4o)
        let provider: string
        if (modelId.startsWith('openrouter-')) {
          provider = 'openrouter'
        } else if (modelId.includes('_')) {
          provider = modelId.split('_')[0]
        } else {
          provider = modelId
        }

        // 从支持列表中查找对应的模型信息
        const modelTemplate = supportedModels?.find(
          (m) => m.provider === provider
        )
        if (!modelTemplate) {
          toast.error(t('modelNotExist', language))
          return
        }

        // 创建新模型配置
        const newModel = {
          ...modelTemplate,
          id: modelId,
          apiKey,
          customApiUrl: customApiUrl || '',
          customModelName: customModelName || '',
          enabled: true,
        }
        updatedModels.push(newModel)
      }

      const request = {
        models: Object.fromEntries(
          updatedModels.map((model) => [
            model.id,
            {
              enabled: model.enabled,
              api_key: model.apiKey || '',
              custom_api_url: model.customApiUrl || '',
              custom_model_name: model.customModelName || '',
            },
          ])
        ),
      }

      await toast.promise(api.updateModelConfigs(request), {
        loading: '正在更新模型配置…',
        success: '模型配置已更新',
        error: '更新模型配置失败',
      })

      // 重新获取用户配置以确保数据同步
      const refreshedModels = await api.getModelConfigs()
      setAllModels(refreshedModels)

      // 如果是批量创建（OpenRouter 多选），不立即关闭弹窗
      // 只有在编辑或单个创建时才关闭
      if (existingModel || !modelId.startsWith('openrouter-')) {
        setShowModelModal(false)
        setEditingModel(null)
      }
    } catch (error) {
      console.error('Failed to save model config:', error)
      toast.error(t('saveConfigFailed', language))
    }
  }

  const handleDeleteExchangeConfig = async (exchangeId: string) => {
    await handleDeleteConfig({
      id: exchangeId,
      type: 'exchange',
      checkInUse: isExchangeUsedByAnyTrader,
      getUsingTraders: getTradersUsingExchange,
      cannotDeleteKey: 'cannotDeleteExchangeInUse',
      confirmDeleteKey: 'confirmDeleteExchange',
      allItems: allExchanges,
      clearFields: (e) => ({
        ...e,
        apiKey: '',
        secretKey: '',
        hyperliquidWalletAddr: '',
        asterUser: '',
        asterSigner: '',
        asterPrivateKey: '',
        enabled: false,
      }),
      buildRequest: (exchanges) => ({
        exchanges: Object.fromEntries(
          exchanges.map((exchange) => [
            exchange.id,
            {
              enabled: exchange.enabled,
              api_key: exchange.apiKey || '',
              secret_key: exchange.secretKey || '',
              testnet: exchange.testnet || false,
              hyperliquid_wallet_addr: exchange.hyperliquidWalletAddr || '',
              aster_user: exchange.asterUser || '',
              aster_signer: exchange.asterSigner || '',
              aster_private_key: exchange.asterPrivateKey || '',
              paper_trading_initial_usdc:
                exchange.paperTradingInitialUSDC || 10000.0,
            },
          ])
        ),
      }),
      updateApi: api.updateExchangeConfigsEncrypted,
      refreshApi: api.getExchangeConfigs,
      setItems: (items) => {
        // 使用函数式更新确保状态正确更新
        setAllExchanges([...items])
      },
      closeModal: () => {
        setShowExchangeModal(false)
        setEditingExchange(null)
      },
      errorKey: 'deleteExchangeConfigFailed',
    })
  }

  const handleSaveExchangeConfig = async (
    exchangeId: string,
    apiKey: string,
    secretKey?: string,
    testnet?: boolean,
    hyperliquidWalletAddr?: string,
    asterUser?: string,
    asterSigner?: string,
    asterPrivateKey?: string,
    paperTradingInitialUSDC?: number
  ) => {
    try {
      // 找到要配置的交易所（从supportedExchanges中）
      const exchangeToUpdate = supportedExchanges?.find(
        (e) => e.id === exchangeId
      )
      if (!exchangeToUpdate) {
        toast.error(t('exchangeNotExist', language))
        return
      }

      // 创建或更新用户的交易所配置
      const existingExchange = allExchanges?.find((e) => e.id === exchangeId)
      let updatedExchanges

      if (existingExchange) {
        // 更新现有配置
        updatedExchanges =
          allExchanges?.map((e) =>
            e.id === exchangeId
              ? {
                  ...e,
                  apiKey,
                  secretKey,
                  testnet,
                  hyperliquidWalletAddr,
                  asterUser,
                  asterSigner,
                  asterPrivateKey,
                  paperTradingInitialUSDC,
                  enabled: true,
                }
              : e
          ) || []
      } else {
        // 添加新配置
        const newExchange = {
          ...exchangeToUpdate,
          apiKey,
          secretKey,
          testnet,
          hyperliquidWalletAddr,
          asterUser,
          asterSigner,
          asterPrivateKey,
          paperTradingInitialUSDC,
          enabled: true,
        }
        updatedExchanges = [...(allExchanges || []), newExchange]
      }

      const request = {
        exchanges: Object.fromEntries(
          updatedExchanges.map((exchange) => [
            exchange.id,
            {
              enabled: exchange.enabled,
              api_key: exchange.apiKey || '',
              secret_key: exchange.secretKey || '',
              testnet: exchange.testnet || false,
              hyperliquid_wallet_addr: exchange.hyperliquidWalletAddr || '',
              aster_user: exchange.asterUser || '',
              aster_signer: exchange.asterSigner || '',
              aster_private_key: exchange.asterPrivateKey || '',
              paper_trading_initial_usdc:
                exchange.paperTradingInitialUSDC || 10000.0,
            },
          ])
        ),
      }

      await toast.promise(api.updateExchangeConfigsEncrypted(request), {
        loading: '正在更新交易所配置…',
        success: '交易所配置已更新',
        error: '更新交易所配置失败',
      })

      // 重新获取用户配置以确保数据同步
      const refreshedExchanges = await api.getExchangeConfigs()
      setAllExchanges(refreshedExchanges)

      setShowExchangeModal(false)
      setEditingExchange(null)
    } catch (error) {
      console.error('Failed to save exchange config:', error)
      toast.error(t('saveConfigFailed', language))
    }
  }

  const handleAddModel = () => {
    setEditingModel(null)
    setShowModelModal(true)
  }

  const handleAddExchange = () => {
    setEditingExchange(null)
    setShowExchangeModal(true)
  }

  const handleSaveSignalSource = async (
    coinPoolUrl: string,
    oiTopUrl: string
  ) => {
    try {
      await toast.promise(api.saveUserSignalSource(coinPoolUrl, oiTopUrl), {
        loading: '正在保存…',
        success: '保存成功',
        error: '保存失败',
      })
      setUserSignalSource({ coinPoolUrl, oiTopUrl })
      setShowSignalSourceModal(false)
    } catch (error) {
      console.error('Failed to save signal source:', error)
      toast.error(t('saveSignalSourceFailed', language))
    }
  }

  return (
    <motion.div
      className="space-y-4 md:space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-white">
            {t('aiTraders', language)}
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#00C805]/20 text-[#00C805]">
              {traders?.length || 0} {t('active', language)}
            </span>
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {t('manageAITraders', language)}
          </p>
        </div>

        <div className="flex gap-2 md:gap-3 w-full md:w-auto overflow-hidden flex-wrap md:flex-nowrap">
          <button
            onClick={handleAddModel}
            className="px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition-all hover:scale-105 flex items-center gap-1 md:gap-2 whitespace-nowrap bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800"
          >
            <Plus className="w-3 h-3 md:w-4 md:h-4" />
            {t('aiModels', language)}
          </button>

          <button
            onClick={handleAddExchange}
            className="px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition-all hover:scale-105 flex items-center gap-1 md:gap-2 whitespace-nowrap bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800"
          >
            <Plus className="w-3 h-3 md:w-4 md:h-4" />
            {t('exchanges', language)}
          </button>

          <button
            onClick={() => setShowSignalSourceModal(true)}
            className="px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition-all hover:scale-105 flex items-center gap-1 md:gap-2 whitespace-nowrap bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800"
          >
            <Radio className="w-3 h-3 md:w-4 md:h-4" />
            {t('signalSource', language)}
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            disabled={
              configuredModels.length === 0 || configuredExchanges.length === 0
            }
            className={`px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 md:gap-2 whitespace-nowrap ${
              configuredModels.length > 0 && configuredExchanges.length > 0
                ? 'bg-[#00C805] text-black'
                : 'bg-neutral-800 text-neutral-600'
            }`}
          >
            <Plus className="w-4 h-4" />
            {t('createTrader', language)}
          </button>
        </div>
      </motion.div>

      {/* 信号源配置警告 */}
      {traders &&
        traders.some((t) => t.use_coin_pool || t.use_oi_top) &&
        !userSignalSource.coinPoolUrl &&
        !userSignalSource.oiTopUrl && (
          <motion.div
            variants={itemVariants}
            className="rounded-xl px-4 py-3 flex items-start gap-3 bg-[#FF5000]/10 border border-[#FF5000]/30"
          >
            <AlertTriangle
              size={20}
              className="flex-shrink-0 mt-0.5 text-[#FF5000]"
            />
            <div className="flex-1">
              <div className="font-semibold mb-1 text-[#FF5000]">
                ⚠️ {t('signalSourceNotConfigured', language)}
              </div>
              <div className="text-sm text-neutral-400">
                <p className="mb-2">
                  {t('signalSourceWarningMessage', language)}
                </p>
                <p>
                  <strong className="text-neutral-300">
                    {t('solutions', language)}
                  </strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2 mt-1">
                  <li>点击"{t('signalSource', language)}"按钮配置API地址</li>
                  <li>或在交易员配置中禁用"使用币种池"和"使用OI Top"</li>
                  <li>或在交易员配置中设置自定义币种列表</li>
                </ul>
              </div>
              <button
                onClick={() => setShowSignalSourceModal(true)}
                className="mt-3 px-3 py-1.5 rounded-full text-sm font-bold transition-all hover:scale-105 bg-[#00C805] text-black"
              >
                {t('configureSignalSourceNow', language)}
              </button>
            </div>
          </motion.div>
        )}

      {/* Configuration Status */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6"
      >
        {/* AI Models */}
        <div className="rounded-xl border border-neutral-900 p-4 md:p-5">
          <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-3 text-white">
            <img
              src="/icons/ai-models.svg"
              alt="AI Models"
              className="w-8 h-8"
            />
            {t('aiModels', language)}
          </h3>
          <div className="space-y-2 md:space-y-3">
            {configuredModels.map((model) => {
              const inUse = isModelInUse(model.id)
              // 生成显示名称
              let displayName: string
              if (model.id.startsWith('openrouter-')) {
                // OpenRouter 模型：显示为 "OpenRouter-ModelName"
                const modelName =
                  model.customModelName ||
                  model.id.replace('openrouter-', '').replace(/-/g, '/')
                displayName = `OpenRouter-${modelName.split('/').pop() || modelName}`
              } else if (model.customModelName) {
                // 其他模型：如果有自定义模型名称，显示它
                displayName = `${getModelDisplayName(model.provider || model.id)} (${model.customModelName})`
              } else {
                // 默认：显示 provider 名称
                displayName = getModelDisplayName(model.provider || model.id)
              }
              // 如果 ID 包含时间戳（多个实例），在名称后添加标识
              const modelIdSuffix =
                model.id.includes('_') &&
                model.id !== model.provider &&
                !model.id.startsWith('openrouter-')
                  ? ` #${model.id.split('_').slice(1).join('_')}`
                  : ''
              return (
                <div
                  key={model.id}
                  className={`flex items-center justify-between p-2 md:p-3 rounded-lg transition-colors border border-neutral-900 ${
                    inUse
                      ? 'cursor-not-allowed bg-neutral-900/30'
                      : 'cursor-pointer hover:bg-neutral-800/50 bg-transparent'
                  }`}
                  onClick={() => handleModelClick(model.id)}
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-bold bg-neutral-800 text-[#00C805] flex-shrink-0">
                      {getShortName(model.name)[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm md:text-base truncate text-white">
                        {displayName}
                        {modelIdSuffix}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {inUse
                          ? t('inUse', language)
                          : model.enabled
                            ? t('enabled', language)
                            : t('configured', language)}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full flex-shrink-0 ${model.enabled ? 'bg-[#00C805]' : 'bg-neutral-700'}`}
                  />
                </div>
              )
            })}
            {configuredModels.length === 0 && (
              <div className="text-center py-6 md:py-8 text-neutral-500">
                <Brain className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 opacity-50" />
                <div className="text-xs md:text-sm">
                  {t('noModelsConfigured', language)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Exchanges */}
        <div className="rounded-xl border border-neutral-900 p-4 md:p-5">
          <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-3 text-white">
            <div className="p-1.5 rounded-md bg-[#00C805]/10 text-[#00C805]">
              <Landmark size={20} />
            </div>
            {t('exchanges', language)}
          </h3>
          <div className="space-y-2 md:space-y-3">
            {configuredExchanges.map((exchange) => {
              const inUse = isExchangeInUse(exchange.id)
              return (
                <div
                  key={exchange.id}
                  className={`flex items-center justify-between p-2 md:p-3 rounded-lg transition-colors border border-neutral-900 ${
                    inUse
                      ? 'cursor-not-allowed bg-neutral-900/30'
                      : 'cursor-pointer hover:bg-neutral-800/50 bg-transparent'
                  }`}
                  onClick={() => handleExchangeClick(exchange.id)}
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-bold bg-neutral-800 text-[#00C805] flex-shrink-0">
                      {getShortName(exchange.name)[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm md:text-base truncate text-white">
                        {getShortName(exchange.name)}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {exchange.type.toUpperCase()} •{' '}
                        {inUse
                          ? t('inUse', language)
                          : exchange.enabled
                            ? t('enabled', language)
                            : t('configured', language)}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full flex-shrink-0 ${exchange.enabled ? 'bg-[#00C805]' : 'bg-neutral-700'}`}
                  />
                </div>
              )
            })}
            {configuredExchanges.length === 0 && (
              <div className="text-center py-6 md:py-8 text-neutral-500">
                <Landmark className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 opacity-50" />
                <div className="text-xs md:text-sm">
                  {t('noExchangesConfigured', language)}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Traders List */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-neutral-900 p-4 md:p-6"
      >
        <div className="flex items-center justify-between mb-5 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-3 text-white">
            <img
              src="/icons/my-traders.svg"
              alt="My Traders"
              className="w-8 h-8"
            />
            {t('currentTraders', language)}
          </h2>
        </div>

        {traders && traders.length > 0 ? (
          <div className="space-y-3 md:space-y-4">
            {traders.map((trader) => (
              <div
                key={trader.trader_id}
                className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 rounded-xl transition-colors gap-3 md:gap-4 bg-transparent border border-neutral-900 hover:bg-neutral-900/50"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-neutral-800 text-[#00C805] text-sm md:text-base font-bold">
                    {trader.trader_name?.[0] || 'T'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-base md:text-lg truncate text-white">
                      {trader.trader_name}
                    </div>
                    <div className="text-xs md:text-sm truncate text-neutral-500">
                      {getModelDisplayName(
                        trader.ai_model.split('_').pop() || trader.ai_model
                      )}{' '}
                      Model • {trader.exchange_id?.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 md:gap-4 flex-wrap md:flex-nowrap">
                  {/* Status */}
                  <div className="text-center">
                    <div
                      className={`px-2 md:px-3 py-1 rounded text-xs font-bold ${
                        trader.is_running
                          ? 'bg-[#00C805]/20 text-[#00C805]'
                          : 'bg-neutral-800 text-neutral-500'
                      }`}
                    >
                      {trader.is_running
                        ? t('running', language)
                        : t('stopped', language)}
                    </div>
                  </div>

                  {/* Actions: 禁止换行，超出横向滚动 */}
                  <div className="flex gap-1.5 md:gap-2 flex-nowrap overflow-x-auto items-center">
                    <button
                      onClick={() => {
                        if (onTraderSelect) {
                          onTraderSelect(trader.trader_id)
                        } else {
                          navigate(`/dashboard?trader=${trader.trader_id}`)
                        }
                      }}
                      className="px-2 md:px-3 py-1.5 md:py-2 rounded text-xs md:text-sm font-semibold transition-all hover:scale-105 flex items-center gap-1 whitespace-nowrap bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800"
                    >
                      <BarChart3 className="w-3 h-3 md:w-4 md:h-4" />
                      {t('view', language)}
                    </button>

                    <button
                      onClick={() => handleEditTrader(trader.trader_id)}
                      disabled={trader.is_running}
                      className={`px-2 md:px-3 py-1.5 md:py-2 rounded text-xs md:text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1 ${
                        trader.is_running
                          ? 'bg-neutral-900 text-neutral-600'
                          : 'bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800'
                      }`}
                    >
                      <Pencil className="w-3 h-3 md:w-4 md:h-4" />
                      {t('edit', language)}
                    </button>

                    <button
                      onClick={() =>
                        handleToggleTrader(
                          trader.trader_id,
                          trader.is_running || false
                        )
                      }
                      className={`px-2 md:px-3 py-1.5 md:py-2 rounded text-xs md:text-sm font-semibold transition-all hover:scale-105 whitespace-nowrap ${
                        trader.is_running
                          ? 'bg-[#FF5000]/20 text-[#FF5000]'
                          : 'bg-[#00C805]/20 text-[#00C805]'
                      }`}
                    >
                      {trader.is_running
                        ? t('stop', language)
                        : t('start', language)}
                    </button>

                    <button
                      onClick={() => handleDeleteTrader(trader.trader_id)}
                      className="px-2 md:px-3 py-1.5 md:py-2 rounded text-xs md:text-sm font-semibold transition-all hover:scale-105 bg-[#FF5000]/20 text-[#FF5000]"
                    >
                      <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 md:py-16 text-neutral-500">
            <Bot className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-3 md:mb-4 opacity-50" />
            <div className="text-base md:text-lg font-semibold mb-2 text-neutral-400">
              {t('noTraders', language)}
            </div>
            <div className="text-xs md:text-sm mb-3 md:mb-4">
              {t('createFirstTrader', language)}
            </div>
            {(configuredModels.length === 0 ||
              configuredExchanges.length === 0) && (
              <div className="text-xs md:text-sm text-[#FF5000]">
                {configuredModels.length === 0 &&
                configuredExchanges.length === 0
                  ? t('configureModelsAndExchangesFirst', language)
                  : configuredModels.length === 0
                    ? t('configureModelsFirst', language)
                    : t('configureExchangesFirst', language)}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Create Trader Modal */}
      {showCreateModal && (
        <TraderConfigModal
          isOpen={showCreateModal}
          isEditMode={false}
          availableModels={enabledModels}
          availableExchanges={enabledExchanges}
          onSave={handleCreateTrader}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit Trader Modal */}
      {showEditModal && editingTrader && (
        <TraderConfigModal
          isOpen={showEditModal}
          isEditMode={true}
          traderData={editingTrader}
          availableModels={enabledModels}
          availableExchanges={enabledExchanges}
          onSave={handleSaveEditTrader}
          onClose={() => {
            setShowEditModal(false)
            setEditingTrader(null)
          }}
        />
      )}

      {/* Model Configuration Modal */}
      {showModelModal && (
        <ModelConfigModal
          configuredModels={allModels}
          editingModelId={editingModel}
          onSave={async (modelId, apiKey, baseUrl, modelName) => {
            await handleSaveModelConfig(modelId, apiKey, baseUrl, modelName)
            // 重新获取模型列表
            const refreshedModels = await api.getModelConfigs()
            setAllModels(refreshedModels)
          }}
          onDelete={handleDeleteModelConfig}
          onClose={() => {
            setShowModelModal(false)
            setEditingModel(null)
          }}
          language={language}
          supportedModels={supportedModels}
        />
      )}

      {/* Exchange Configuration Modal */}
      {showExchangeModal && (
        <ExchangeConfigModal
          allExchanges={supportedExchanges}
          editingExchangeId={editingExchange}
          onSave={handleSaveExchangeConfig}
          onDelete={handleDeleteExchangeConfig}
          onClose={() => {
            setShowExchangeModal(false)
            setEditingExchange(null)
          }}
          language={language}
        />
      )}

      {/* Signal Source Configuration Modal */}
      {showSignalSourceModal && (
        <SignalSourceModal
          coinPoolUrl={userSignalSource.coinPoolUrl}
          oiTopUrl={userSignalSource.oiTopUrl}
          onSave={handleSaveSignalSource}
          onClose={() => setShowSignalSourceModal(false)}
          language={language}
        />
      )}
    </motion.div>
  )
}

// Export wrapped with ErrorBoundary
export function AITradersPage({ onTraderSelect }: AITradersPageProps) {
  return (
    <ErrorBoundary>
      <AITradersPageContent onTraderSelect={onTraderSelect} />
    </ErrorBoundary>
  )
}
