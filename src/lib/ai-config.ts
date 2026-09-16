// 单次请求的用户自带模型（BYOK）配置。只从请求头读取，绝不持久化或写入日志。

import type { NextRequest } from 'next/server'

export interface AIConfig {
  baseUrl: string
  apiKey: string
  model?: string
}

const MAX_BASE_URL_LENGTH = 512
const MAX_API_KEY_LENGTH = 1024
const MAX_MODEL_LENGTH = 160

function invalidConfig(message: string): never {
  throw new Error(`AI 配置无效：${message}`)
}

function normaliseBaseUrl(value: string): string {
  if (value.length > MAX_BASE_URL_LENGTH) invalidConfig('服务地址过长')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return invalidConfig('服务地址不是有效 URL')
  }
  if (url.protocol !== 'https:') invalidConfig('服务地址必须使用 HTTPS')
  if (url.username || url.password || url.search || url.hash) invalidConfig('服务地址不能包含账号、参数或片段')
  // 避免把应用服务器当作内网代理使用；域名解析出的私网地址由部署网络继续拦截。
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host === '[::1]' ||
    /^\[(?:f[cd]|fe[89ab])/i.test(host) ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    invalidConfig('不支持本机或内网地址')
  }
  return url.toString().replace(/\/+$/, '')
}

/**
 * 完整的用户配置会覆盖部署环境中的默认配置；缺失任一必填项则保持默认配置。
 */
export function aiConfigFromRequest(req: NextRequest): AIConfig | undefined {
  const baseUrl = req.headers.get('x-wearwhat-ai-base-url')?.trim()
  const apiKey = req.headers.get('x-wearwhat-ai-key')?.trim()
  const model = req.headers.get('x-wearwhat-ai-model')?.trim()
  if (!baseUrl && !apiKey && !model) return undefined
  if (!baseUrl || !apiKey) invalidConfig('请同时填写服务地址与 API Key')
  if (apiKey.length > MAX_API_KEY_LENGTH) invalidConfig('API Key 过长')
  if (model && model.length > MAX_MODEL_LENGTH) invalidConfig('模型名过长')
  return { baseUrl: normaliseBaseUrl(baseUrl), apiKey, model: model || undefined }
}
