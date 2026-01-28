import { Trash2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { t, type Language } from '../../i18n/translations'
import { api } from '../../lib/api'
import type { AIModel } from '../../types'
import { getModelIcon } from '../ModelIcons'
import { getShortName } from './utils'

interface ModelConfigModalProps {
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
}

export function ModelConfigModal({
  configuredModels,
  editingModelId,
  onSave,
  onDelete,
  onClose,
  language,
  supportedModels,
}: ModelConfigModalProps) {
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
        const existingCount =
          configuredModels?.filter((m) => m.provider === selectedProvider)
            .length || 0

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
        <div className="flex items-center justify-between p-6 pb-4 sticky top-0 z-10 bg-[#1E2329] rounded-t-xl">
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
                    const existingCount =
                      configuredModels?.filter(
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
                        {(
                          selectedModel.name ||
                          selectedModel.provider ||
                          '?'
                        )[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-white">
                      {getShortName(
                        selectedModel.name || selectedModel.provider || ''
                      )}
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
                      常用模型示例：openai/gpt-4o, anthropic/claude-3.5-sonnet,
                      google/gemini-pro, meta-llama/llama-3.1-405b-instruct
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
