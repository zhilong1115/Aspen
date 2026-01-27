interface IconProps {
  width?: number
  height?: number
  className?: string
}

// 获取AI模型图标的函数
export const getModelIcon = (modelType: string, props: IconProps = {}) => {
  // 支持完整ID或类型名
  const type = modelType.includes('_') ? modelType.split('_').pop() : modelType
  const lower = (type || '').toLowerCase()

  let iconPath: string | null = null

  // Exact match first
  switch (lower) {
    case 'deepseek':
      iconPath = '/icons/deepseek.svg'
      break
    case 'qwen':
      iconPath = '/icons/qwen.svg'
      break
    case 'openrouter':
      iconPath = '/icons/openrouter.svg'
      break
    case 'gpt':
    case 'openai':
      iconPath = '/icons/gpt.svg'
      break
    case 'gemini':
    case 'google':
      iconPath = '/icons/gemini.svg'
      break
    case 'grok':
    case 'x-ai':
    case 'xai':
      iconPath = '/icons/grok.svg'
      break
    default:
      // Partial match fallback
      if (lower.includes('grok')) {
        iconPath = '/icons/grok.svg'
      } else if (lower.includes('gemini')) {
        iconPath = '/icons/gemini.svg'
      } else if (lower.includes('gpt') || lower.includes('openai')) {
        iconPath = '/icons/gpt.svg'
      } else if (lower.includes('openrouter')) {
        iconPath = '/icons/openrouter.svg'
      } else if (lower.includes('deepseek')) {
        iconPath = '/icons/deepseek.svg'
      } else if (lower.includes('qwen')) {
        iconPath = '/icons/qwen.svg'
      } else {
        return null
      }
  }

  return (
    <img
      src={iconPath}
      alt={`${type} icon`}
      width={props.width || 24}
      height={props.height || 24}
      className={props.className}
      style={{ borderRadius: '50%' }}
    />
  )
}
