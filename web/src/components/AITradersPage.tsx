import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  HelpCircle,
  Landmark,
  Pencil,
  Plus,
  Radio,
  Trash2
} from 'lucide-react'
import { motion } from 'framer-motion'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import useSWR from 'swr'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { t, type Language } from '../i18n/translations'
import { api } from '../lib/api'
import { confirmToast } from '../lib/notify'
import type {
  AIModel,
  CreateTraderRequest,
  Exchange,
  TraderInfo,
} from '../types'
import { getModelIcon } from './ModelIcons'
import { TraderConfigModal } from './TraderConfigModal'
import {
  TwoStageKeyModal,
  type TwoStageKeyModalResult,
} from './TwoStageKeyModal'

// Animation variants for staggered children
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

// 获取友好的AI模型名称
function getModelDisplayName(modelId: string): string {
  switch (modelId.toLowerCase()) {
    case 'deepseek':
      return 'DeepSeek'
    case 'qwen':
      return 'Qwen'
    case 'openrouter':
      return 'OpenRouter'
    case 'claude':
      return 'Claude'
    default:
      return modelId.toUpperCase()
  }
}

// 提取下划线后面的名称部分
function getShortName(fullName: string): string {
  const parts = fullName.split('_')
  return parts.length > 1 ? parts[parts.length - 1] : fullName
}

interface AITradersPageProps {
  onTraderSelect?: (traderId: string) => void
}

export function AITradersPage({ onTraderSelect }: AITradersPageProps) {
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

  const { data: traders, mutate: mutateTraders } = useSWR<TraderInfo[]>(
    user && token ? 'traders' : null,
    api.getTraders,
    { refreshInterval: 5000 }
  )

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
        const modelTemplate = supportedModels?.find((m) => m.provider === provider)
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
              paper_trading_initial_usdc: exchange.paperTradingInitialUSDC || 10000.0,
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
              paper_trading_initial_usdc: exchange.paperTradingInitialUSDC || 10000.0,
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
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
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
            className={`px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 md:gap-2 whitespace-nowrap ${configuredModels.length > 0 && configuredExchanges.length > 0
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
                  <strong className="text-neutral-300">{t('solutions', language)}</strong>
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
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* AI Models */}
        <div className="rounded-xl border border-neutral-900 p-4 md:p-5">
          <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-3 text-white">
            <img src="/icons/ai-models.svg" alt="AI Models" className="w-8 h-8" />
            {t('aiModels', language)}
          </h3>
          <div className="space-y-2 md:space-y-3">
            {configuredModels.map((model) => {
              const inUse = isModelInUse(model.id)
              // 生成显示名称
              let displayName: string
              if (model.id.startsWith('openrouter-')) {
                // OpenRouter 模型：显示为 "OpenRouter-ModelName"
                const modelName = model.customModelName || model.id.replace('openrouter-', '').replace(/-/g, '/')
                displayName = `OpenRouter-${modelName.split('/').pop() || modelName}`
              } else if (model.customModelName) {
                // 其他模型：如果有自定义模型名称，显示它
                displayName = `${getModelDisplayName(model.provider || model.id)} (${model.customModelName})`
              } else {
                // 默认：显示 provider 名称
                displayName = getModelDisplayName(model.provider || model.id)
              }
              // 如果 ID 包含时间戳（多个实例），在名称后添加标识
              const modelIdSuffix = model.id.includes('_') && model.id !== model.provider && !model.id.startsWith('openrouter-')
                ? ` #${model.id.split('_').slice(1).join('_')}`
                : ''
              return (
                <div
                  key={model.id}
                  className={`flex items-center justify-between p-2 md:p-3 rounded-lg transition-colors border border-neutral-900 ${inUse
                    ? 'cursor-not-allowed bg-neutral-900/30'
                    : 'cursor-pointer hover:bg-neutral-800/50 bg-transparent'
                    }`}
                  onClick={() => handleModelClick(model.id)}
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <div
                      className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-bold bg-neutral-800 text-[#00C805] flex-shrink-0"
                    >
                      {getShortName(model.name)[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm md:text-base truncate text-white">
                        {displayName}{modelIdSuffix}
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
                  className={`flex items-center justify-between p-2 md:p-3 rounded-lg transition-colors border border-neutral-900 ${inUse
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
      <motion.div variants={itemVariants} className="rounded-xl border border-neutral-900 p-4 md:p-6">
        <div className="flex items-center justify-between mb-5 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-3 text-white">
            <img src="/icons/my-traders.svg" alt="My Traders" className="w-8 h-8" />
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
                      className={`px-2 md:px-3 py-1 rounded text-xs font-bold ${trader.is_running
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

// Tooltip Helper Component
function Tooltip({
  content,
  children,
}: {
  content: string
  children: React.ReactNode
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
      >
        {children}
      </div>
      {show && (
        <div
          className="absolute z-10 px-3 py-2 text-sm rounded-lg w-64 left-1/2 transform -translate-x-1/2 bottom-full mb-2 bg-neutral-800 text-white border border-neutral-700"
        >
          {content}
          <div
            className="absolute left-1/2 transform -translate-x-1/2 top-full"
            style={{
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #262626',
            }}
          />
        </div>
      )}
    </div>
  )
}

// Signal Source Configuration Modal Component
function SignalSourceModal({
  coinPoolUrl,
  oiTopUrl,
  onSave,
  onClose,
  language,
}: {
  coinPoolUrl: string
  oiTopUrl: string
  onSave: (coinPoolUrl: string, oiTopUrl: string) => void
  onClose: () => void
  language: Language
}) {
  const [coinPool, setCoinPool] = useState(coinPoolUrl || '')
  const [oiTop, setOiTop] = useState(oiTopUrl || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(coinPool.trim(), oiTop.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        className="bg-[#1E2329] rounded-xl w-full max-w-lg relative my-8 border border-neutral-800"
        style={{
          maxHeight: 'calc(100vh - 4rem)',
        }}
      >
        <div className="p-6 pb-0">
          <h3 className="text-xl font-bold mb-4 text-white">
            {t('signalSourceConfig', language)}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6">
          <div
            className="space-y-4 overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 16rem)' }}
          >
            <div>
              <label className="block text-sm font-semibold mb-2 text-white">
                COIN POOL URL
              </label>
              <input
                type="url"
                value={coinPool}
                onChange={(e) => setCoinPool(e.target.value)}
                placeholder="https://api.example.com/coinpool"
                className="w-full px-3 py-2 rounded border border-neutral-800 bg-[#0B0E11] text-white focus:border-[#00C805] outline-none transition-all"
              />
              <div className="text-xs mt-1 text-neutral-500">
                {t('coinPoolDescription', language)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-white">
                OI TOP URL
              </label>
              <input
                type="url"
                value={oiTop}
                onChange={(e) => setOiTop(e.target.value)}
                placeholder="https://api.example.com/oitop"
                className="w-full px-3 py-2 rounded border border-neutral-800 bg-[#0B0E11] text-white focus:border-[#00C805] outline-none transition-all"
              />
              <div className="text-xs mt-1 text-neutral-500">
                {t('oiTopDescription', language)}
              </div>
            </div>

            <div className="p-4 rounded bg-[#00C805]/10 border border-[#00C805]/20">
              <div className="text-sm font-semibold mb-2 text-[#00C805]">
                ℹ️ {t('information', language)}
              </div>
              <div className="text-xs space-y-1 text-neutral-400">
                <div>{t('signalSourceInfo1', language)}</div>
                <div>{t('signalSourceInfo2', language)}</div>
                <div>{t('signalSourceInfo3', language)}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 sticky bottom-0 bg-[#1E2329] border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded text-sm font-semibold bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-colors"
            >
              {t('cancel', language)}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded text-sm font-bold bg-[#00C805] text-black hover:opacity-90 transition-opacity"
            >
              {t('save', language)}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Model Configuration Modal Component
function ModelConfigModal({
  configuredModels,
  editingModelId,
  onSave,
  onDelete,
  onClose,
  language,
  supportedModels,
}: {
  configuredModels: AIModel[]
  editingModelId: string | null
  onSave: (
    modelId: string,
    apiKey: string,
    baseUrl?: string,
    modelName?: string
  ) => Promise<void>
  onDelete: (modelId: string) => void
  onClose: () => void
  language: Language
  supportedModels?: AIModel[]
}) {
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [modelName, setModelName] = useState('')
  const [modelNamesInput, setModelNamesInput] = useState<string>('') // OpenRouter 模型名称输入（支持换行或逗号分隔）

  // 获取当前编辑的模型信息 - 编辑时从已配置的模型中查找
  const selectedModel = editingModelId
    ? configuredModels?.find((m) => m.id === editingModelId)
    : selectedProvider
      ? supportedModels?.find((m) => m.provider === selectedProvider)
      : null

  // 如果是编辑现有模型，初始化所有字段
  useEffect(() => {
    if (editingModelId) {
      const model = configuredModels?.find((m) => m.id === editingModelId)
      if (model) {
        setSelectedProvider(model.provider || '')
        setApiKey(model.apiKey || '')
        setBaseUrl(model.customApiUrl || '')
        setModelName(model.customModelName || '')
      }
    } else {
      // 新建时重置所有字段
      setSelectedProvider('')
      setApiKey('')
      setBaseUrl('')
      setModelName('')
      setModelNamesInput('')
    }
  }, [editingModelId, configuredModels])

  // 当选择 OpenRouter 时，重置模型输入
  useEffect(() => {
    if (selectedProvider !== 'openrouter') {
      setModelNamesInput('')
    }
  }, [selectedProvider])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) return

    if (editingModelId) {
      // 编辑现有模型：使用现有的 ID
      await onSave(
        editingModelId,
        apiKey.trim(),
        baseUrl.trim() || undefined,
        modelName.trim() || undefined
      )
    } else {
      // 创建新模型
      if (!selectedProvider) {
        return
      }

      // OpenRouter 特殊处理：支持多选模型
      if (selectedProvider === 'openrouter') {
        if (!modelNamesInput.trim()) {
          toast.error('请输入至少一个模型名称')
          return
        }

        // 解析模型名称：支持换行或逗号分隔
        const modelNames = modelNamesInput
          .split(/[\n,，]/) // 支持换行、英文逗号、中文逗号
          .map((name) => name.trim())
          .filter((name) => name.length > 0)

        if (modelNames.length === 0) {
          toast.error('请输入至少一个模型名称')
          return
        }

        // 批量创建所有模型实例
        try {
          let updatedModels = [...(configuredModels || [])]
          for (const model of modelNames) {
            const modelId = `openrouter-${model.replace(/\//g, '-')}`
            // 检查是否已存在
            if (!updatedModels.find((m) => m.id === modelId)) {
              const modelTemplate = supportedModels?.find(
                (m) => m.provider === 'openrouter'
              )
              if (modelTemplate) {
                updatedModels.push({
                  ...modelTemplate,
                  id: modelId,
                  apiKey: apiKey.trim(),
                  customApiUrl: '',
                  customModelName: model,
                  enabled: true,
                })
              }
            }
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
            loading: `正在创建 ${modelNames.length} 个模型配置…`,
            success: `成功创建 ${modelNames.length} 个模型实例`,
            error: '创建模型配置失败',
          })

          // 关闭弹窗，父组件会重新获取模型列表
          onClose()
        } catch (error) {
          console.error('批量创建模型失败:', error)
          toast.error('批量创建模型失败')
        }
        return
      } else {
        // 其他 provider：单个模型
        const existingCount = configuredModels?.filter(
          (m) => m.provider === selectedProvider
        ).length || 0

        let newModelId: string
        if (existingCount === 0) {
          // 第一个实例，使用 provider 作为 ID
          newModelId = selectedProvider
        } else {
          // 后续实例，使用 provider_timestamp 格式
          const timestamp = Date.now()
          newModelId = `${selectedProvider}_${timestamp}`
        }

        await onSave(
          newModelId,
          apiKey.trim(),
          baseUrl.trim() || undefined,
          modelName.trim() || undefined
        )
      }
    }
  }

  // 可选择的模型列表（支持的模型类型）
  const availableProviders = supportedModels || []

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        className="bg-[#1E2329] rounded-xl w-full max-w-lg relative my-8 border border-neutral-800"
        style={{
          maxHeight: 'calc(100vh - 4rem)',
        }}
      >
        <div
          className="flex items-center justify-between p-6 pb-4 sticky top-0 z-10 bg-[#1E2329] rounded-t-xl"
        >
          <h3 className="text-xl font-bold text-white">
            {editingModelId
              ? t('editAIModel', language)
              : t('addAIModel', language)}
          </h3>
          {editingModelId && (
            <button
              type="button"
              onClick={() => onDelete(editingModelId)}
              className="p-2 rounded bg-[#FF5000]/10 text-[#FF5000] hover:bg-[#FF5000]/20 transition-colors"
              title={t('delete', language)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6">
          <div
            className="space-y-4 overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 16rem)' }}
          >
            {!editingModelId && (
              <div>
                <label className="block text-sm font-semibold mb-2 text-white">
                  {t('selectModel', language)}
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                  required
                >
                  <option value="">{t('pleaseSelectModel', language)}</option>
                  {availableProviders.map((model) => {
                    const existingCount = configuredModels?.filter(
                      (m) => m.provider === model.provider
                    ).length || 0
                    return (
                      <option key={model.provider} value={model.provider}>
                        {getShortName(model.name)} ({model.provider})
                        {existingCount > 0 && ` - 已有 ${existingCount} 个实例`}
                      </option>
                    )
                  })}
                </select>
                <div className="text-xs mt-1 text-neutral-500">
                  可以为同一个 provider 创建多个实例（使用不同的 API Key 或模型）
                </div>
              </div>
            )}

            {selectedModel && (
              <div className="p-4 rounded bg-[#0B0E11] border border-neutral-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 flex items-center justify-center">
                    {getModelIcon(selectedModel.provider || selectedModel.id, {
                      width: 32,
                      height: 32,
                    }) || (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-neutral-800 text-white">
                          {(selectedModel.name || selectedModel.provider || '?')[0]}
                        </div>
                      )}
                  </div>
                  <div>
                    <div className="font-semibold text-white">
                      {getShortName(selectedModel.name || selectedModel.provider || '')}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {selectedModel.provider || selectedModel.id}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedProvider && (
              <>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white">
                    API Key
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

                {selectedProvider !== 'openrouter' && (
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-white">
                      {t('customBaseURL', language)}
                    </label>
                    <input
                      type="url"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder={t('customBaseURLPlaceholder', language)}
                      className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                    />
                    <div className="text-xs mt-1 text-neutral-500">
                      {t('leaveBlankForDefault', language)}
                    </div>
                  </div>
                )}

                {selectedProvider === 'openrouter' && !editingModelId ? (
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-white">
                      模型名称（每行一个或用逗号分隔）
                    </label>
                    <textarea
                      value={modelNamesInput}
                      onChange={(e) => setModelNamesInput(e.target.value)}
                      placeholder={`例如：
openai/gpt-4o
anthropic/claude-3.5-sonnet
google/gemini-pro

或者用逗号分隔：
openai/gpt-4o, anthropic/claude-3.5-sonnet, google/gemini-pro`}
                      rows={6}
                      className="w-full px-3 py-2 rounded font-mono text-sm bg-[#0B0E11] border border-neutral-800 text-white"
                      style={{ resize: 'vertical' }}
                    />
                    <div className="text-xs mt-1 text-neutral-500">
                      {(() => {
                        const modelCount = modelNamesInput
                          .split(/[\n,，]/)
                          .map((name) => name.trim())
                          .filter((name) => name.length > 0).length
                        return modelCount > 0
                          ? `将创建 ${modelCount} 个模型实例（共享同一个 API Key）`
                          : '支持换行或逗号分隔，系统将为每个模型创建一个实例'
                      })()}
                    </div>
                    <div className="text-xs mt-1 text-neutral-500">
                      常用模型示例：openai/gpt-4o, anthropic/claude-3.5-sonnet, google/gemini-pro, meta-llama/llama-3.1-405b-instruct
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-white">
                      Model Name (可选)
                    </label>
                    <input
                      type="text"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder={
                        selectedProvider === 'openrouter'
                          ? '例如: openai/gpt-4o, anthropic/claude-3.5-sonnet'
                          : '例如: deepseek-chat, qwen3-max, gpt-5'
                      }
                      className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                    />
                    <div className="text-xs mt-1 text-neutral-500">
                      {selectedProvider === 'openrouter'
                        ? '留空使用默认模型 openai/gpt-4o'
                        : '留空使用默认模型名称'}
                    </div>
                  </div>
                )}

                <div className="p-4 rounded bg-[#00C805]/10 border border-[#00C805]/20">
                  <div className="text-sm font-semibold mb-2 text-[#00C805]">
                    ℹ️ {t('information', language)}
                  </div>
                  <div className="text-xs space-y-1 text-neutral-500">
                    <div>{t('modelConfigInfo1', language)}</div>
                    <div>{t('modelConfigInfo2', language)}</div>
                    <div>{t('modelConfigInfo3', language)}</div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 mt-6 pt-4 sticky bottom-0 bg-[#1E2329]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded text-sm font-semibold bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-colors"
            >
              {t('cancel', language)}
            </button>
            <button
              type="submit"
              disabled={
                !selectedProvider ||
                !apiKey.trim() ||
                (selectedProvider === 'openrouter' &&
                  !editingModelId &&
                  !modelNamesInput.trim())
              }
              className="flex-1 px-4 py-2 rounded text-sm font-bold disabled:opacity-50 bg-[#00C805] text-black"
            >
              {t('saveConfig', language)}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Exchange Configuration Modal Component
function ExchangeConfigModal({
  allExchanges,
  editingExchangeId,
  onSave,
  onDelete,
  onClose,
  language,
}: {
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
}) {
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
      setPaperTradingInitialUSDC(selectedExchange.paperTradingInitialUSDC || 10000)
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
                              <span
                                className="text-sm font-medium text-white"
                              >
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

                              <p
                                className="font-semibold mb-1 text-white"
                              >
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
                        <label
                          className="block text-sm font-semibold mb-2 text-white"
                        >
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
                        <label
                          className="block text-sm font-semibold mb-2 text-white"
                        >
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
                          <label
                            className="block text-sm font-semibold mb-2 text-white"
                          >
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
                        <div
                          className="p-4 rounded bg-[#00C805]/10 border border-[#00C805]/20"
                        >
                          <div
                            className="text-sm font-semibold mb-2 text-[#00C805]"
                          >
                            {t('whitelistIP', language)}
                          </div>
                          <div
                            className="text-xs mb-3 text-neutral-500"
                          >
                            {t('whitelistIPDesc', language)}
                          </div>

                          {loadingIP ? (
                            <div
                              className="text-xs text-neutral-500"
                            >
                              {t('loadingServerIP', language)}
                            </div>
                          ) : serverIP && serverIP.public_ip ? (
                            <div
                              className="flex items-center gap-2 p-2 rounded bg-[#0B0E11]"
                            >
                              <code
                                className="flex-1 text-sm font-mono text-[#00C805]"
                              >
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
                    <div>
                      <label
                        className="block text-sm font-semibold mb-2 text-white"
                      >
                        {t('privateKey', language)}
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={t('enterPrivateKey', language)}
                        className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                        required
                      />
                      <div
                        className="text-xs mt-1 text-neutral-500"
                      >
                        {t('hyperliquidPrivateKeyDesc', language)}
                      </div>
                    </div>
                  </>
                )}

                {/* Aster 交易所的字段 */}
                {selectedExchange.id === 'aster' && (
                  <>
                    <div>
                      <label
                        className="block text-sm font-semibold mb-2 flex items-center gap-2 text-white"
                      >
                        {t('user', language)}
                        <Tooltip content={t('asterUserDesc', language)}>
                          <HelpCircle
                            className="w-4 h-4 cursor-help text-[#00C805]"
                          />
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
                      <label
                        className="block text-sm font-semibold mb-2 flex items-center gap-2 text-white"
                      >
                        {t('signer', language)}
                        <Tooltip content={t('asterSignerDesc', language)}>
                          <HelpCircle
                            className="w-4 h-4 cursor-help text-[#00C805]"
                          />
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
                      <label
                        className="block text-sm font-semibold mb-2 flex items-center gap-2 text-white"
                      >
                        {t('privateKey', language)}
                        <Tooltip content={t('asterPrivateKeyDesc', language)}>
                          <HelpCircle
                            className="w-4 h-4 cursor-help text-[#00C805]"
                          />
                        </Tooltip>
                      </label>
                      <input
                        type="password"
                        value={asterPrivateKey}
                        onChange={(e) => setAsterPrivateKey(e.target.value)}
                        placeholder={t('enterPrivateKey', language)}
                        className="w-full px-3 py-2 rounded bg-[#0B0E11] border border-neutral-800 text-white"
                        required
                      />
                    </div>
                  </>
                )}

                {/* Paper Trading 交易所的字段 */}
                {selectedExchange.id === 'paper' && (
                  <>
                    <div>
                      <label
                        className="block text-sm font-semibold mb-2 text-white"
                      >
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
                      <div
                        className="text-xs mt-1 text-neutral-500"
                      >
                        模拟仓的初始USDC余额，用于模拟交易
                      </div>
                    </div>

                    <div
                      className="p-4 rounded bg-blue-500/10 border border-blue-500/20"
                    >
                      <div
                        className="text-sm font-semibold mb-2 text-blue-500"
                      >
                        ℹ️ 关于模拟仓
                      </div>
                      <div
                        className="text-xs space-y-1 text-neutral-500"
                      >
                        <div>
                          • 模拟仓使用真实市场价格进行模拟交易
                        </div>
                        <div>• 所有交易都是虚拟的，不会产生实际资金流动</div>
                        <div>• 适合测试交易策略和熟悉系统功能</div>
                        <div>• 持仓和盈亏会实时计算并显示</div>
                      </div>
                    </div>
                  </>
                )}

                {/* Hyperliquid 交易所的字段 */}
                {selectedExchange.id === 'hyperliquid' && (
                  <>
                    {/* 安全提示 banner */}
                    <div
                      className="p-3 rounded mb-4 bg-[#00C805]/10 border border-[#00C805]/30"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[#00C805] text-base">
                          🔐
                        </span>
                        <div className="flex-1">
                          <div
                            className="text-sm font-semibold mb-1 text-[#00C805]"
                          >
                            {t('hyperliquidAgentWalletTitle', language)}
                          </div>
                          <div
                            className="text-xs text-neutral-500" style={{ lineHeight: '1.5' }}
                          >
                            {t('hyperliquidAgentWalletDesc', language)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Agent Private Key 字段 */}
                    <div>
                      <label
                        className="block text-sm font-semibold mb-2 text-white"
                      >
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
                      <div
                        className="text-xs mt-1 text-neutral-500"
                      >
                        {t('hyperliquidAgentPrivateKeyDesc', language)}
                      </div>
                    </div>

                    {/* Main Wallet Address 字段 */}
                    <div>
                      <label
                        className="block text-sm font-semibold mb-2 text-white"
                      >
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
                      <div
                        className="text-xs mt-1 text-neutral-500"
                      >
                        {t('hyperliquidMainWalletAddressDesc', language)}
                      </div>
                    </div>
                  </>
                )}

                {/* Aster 交易所的字段 */}
                {selectedExchange.id === 'aster' && (
                  <>
                    <div>
                      <label
                        className="block text-sm font-semibold mb-2 flex items-center gap-2 text-white"
                      >
                        {t('user', language)}
                        <Tooltip content={t('asterUserDesc', language)}>
                          <HelpCircle
                            className="w-4 h-4 cursor-help text-[#00C805]"
                          />
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
                      <label
                        className="block text-sm font-semibold mb-2 flex items-center gap-2 text-white"
                      >
                        {t('signer', language)}
                        <Tooltip content={t('asterSignerDesc', language)}>
                          <HelpCircle
                            className="w-4 h-4 cursor-help text-[#00C805]"
                          />
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
                      <label
                        className="block text-sm font-semibold mb-2 flex items-center gap-2 text-white"
                      >
                        {t('privateKey', language)}
                        <Tooltip content={t('asterPrivateKeyDesc', language)}>
                          <HelpCircle
                            className="w-4 h-4 cursor-help text-[#00C805]"
                          />
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

                    <div
                      className="p-4 rounded bg-[#00C805]/10 border border-[#00C805]/20"
                    >
                      <div
                        className="text-sm font-semibold mb-2 text-[#00C805]"
                      >
                        <span className="inline-flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />{' '}
                          {t('securityWarning', language)}
                        </span>
                      </div>
                      <div
                        className="text-xs space-y-1 text-neutral-500"
                      >
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

          <div
            className="flex gap-3 mt-6 pt-4 sticky bottom-0 bg-[#1E2329]"
          >
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
                  (!apiKey.trim() || !hyperliquidWalletAddr.trim())) || // 验证私钥和钱包地址
                (selectedExchange.id === 'aster' &&
                  (!asterUser.trim() ||
                    !asterSigner.trim() ||
                    !asterPrivateKey.trim())) ||
                (selectedExchange.id === 'paper' &&
                  paperTradingInitialUSDC <= 0) || // 验证初始USDC金额
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
              <h3
                className="text-xl font-bold flex items-center gap-2 text-white"
              >
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
