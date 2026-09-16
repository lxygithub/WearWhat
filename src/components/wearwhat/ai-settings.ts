// 用户自带模型（BYOK）配置：只保存在当前浏览器，不进入数据库。

export interface AISettings {
  baseUrl: string
  apiKey: string
  model: string
}

const STORAGE_KEY = 'wearwhat.ai-settings.v1'

const emptySettings = (): AISettings => ({ baseUrl: '', apiKey: '', model: '' })

export function getAISettings(): AISettings {
  if (typeof window === 'undefined') return emptySettings()
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<AISettings>
    return {
      baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl : '',
      apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
      model: typeof value.model === 'string' ? value.model : '',
    }
  } catch {
    return emptySettings()
  }
}

export function saveAISettings(settings: AISettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function clearAISettings(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/** 只有完整配置才会覆盖服务端默认 AI 凭证。 */
export function configuredAIHeaders(): HeadersInit | undefined {
  const { baseUrl, apiKey, model } = getAISettings()
  if (!baseUrl.trim() || !apiKey.trim()) return undefined
  return {
    'X-WearWhat-AI-Base-URL': baseUrl.trim(),
    'X-WearWhat-AI-Key': apiKey.trim(),
    ...(model.trim() ? { 'X-WearWhat-AI-Model': model.trim() } : {}),
  }
}
