// WearWhat API 客户端（前端用，仅相对路径）

import type {
  ClothingItem,
  OutfitRecord,
  RecommendResponse,
  StatsData,
  WeatherData,
  WishlistEntry,
  WWUser,
} from './types'
import { configuredAIHeaders } from './ai-settings'

// 401 全局处理：会话过期时回调（由 AuthGate 注册），排除 auth 接口自身
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn
}

async function j<T>(url: string, init?: RequestInit, useUserAI = false): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  if (useUserAI) {
    for (const [name, value] of new Headers(configuredAIHeaders())) headers.set(name, value)
  }
  const res = await fetch(url, {
    ...init,
    headers,
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = {}
  }
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/')) onUnauthorized?.()
    const msg = (data as { error?: string })?.error || `请求失败 (${res.status})`
    throw new Error(msg)
  }
  return data as T
}

export interface ItemQuery {
  category?: string
  season?: string
  status?: string
  q?: string
}

export const api = {
  // ---- 账号 ----
  authSendCode: (email: string, type: 'register' | 'reset') =>
    j<{ ok: boolean; devCode?: string }>('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email, type }),
    }),

  authRegister: (body: { email: string; password: string; code: string; name?: string }) =>
    j<{ user: WWUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  authLogin: (email: string, password: string) =>
    j<{ user: WWUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  authLogout: () => j<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  authMe: () => j<{ user: WWUser }>('/api/auth/me'),

  authResetPassword: (body: { email: string; code: string; newPassword: string }) =>
    j<{ ok: boolean }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),

  // ---- 衣物 ----
  getItems: (query?: ItemQuery) => {
    const p = new URLSearchParams()
    if (query?.category) p.set('category', query.category)
    if (query?.season) p.set('season', query.season)
    if (query?.status) p.set('status', query.status)
    if (query?.q) p.set('q', query.q)
    const qs = p.toString()
    return j<{ items: ClothingItem[] }>(`/api/clothing${qs ? `?${qs}` : ''}`)
  },

  createItem: (body: Partial<ClothingItem>) =>
    j<{ item: ClothingItem }>('/api/clothing', { method: 'POST', body: JSON.stringify(body) }),

  updateItem: (id: string, body: Partial<ClothingItem>) =>
    j<{ item: ClothingItem }>(`/api/clothing/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  deleteItem: (id: string) => j<{ ok: boolean }>(`/api/clothing/${id}`, { method: 'DELETE' }),

  recognize: (imageData: string) =>
    j<{ result: RecognizeResult }>('/api/clothing/recognize', {
      method: 'POST',
      body: JSON.stringify({ imageData }),
    }, true),

  recommend: (occasion: string, location?: { lat: number; lon: number; city: string }) =>
    j<RecommendResponse>('/api/outfits/recommend', {
      method: 'POST',
      body: JSON.stringify({
        occasion,
        lat: location?.lat,
        lon: location?.lon,
        city: location?.city,
      }),
    }, true),

  getOutfits: (month?: string) =>
    j<{ outfits: OutfitRecord[] }>(`/api/outfits${month ? `?month=${month}` : ''}`),

  createOutfit: (body: {
    date: string
    occasion?: string
    itemIds: string[]
    notes?: string
    source?: string
    weather?: unknown
  }) => j<{ outfit: OutfitRecord }>('/api/outfits', { method: 'POST', body: JSON.stringify(body) }),

  deleteOutfit: (id: string) => j<{ ok: boolean }>(`/api/outfits/${id}`, { method: 'DELETE' }),

  stats: () => j<{ stats: StatsData }>('/api/stats'),

  search: (q: string) => j<{ items: ClothingItem[]; hint: string }>(`/api/search?q=${encodeURIComponent(q)}`, undefined, true),

  weather: (lat: number, lon: number, city: string) =>
    j<{ weather: WeatherData }>(`/api/weather?lat=${lat}&lon=${lon}&city=${encodeURIComponent(city)}`),

  // 衣橱问答：LLM 实时答，离线时服务端自动降级本地统计
  ask: (
    question: string,
    context?: {
      weather?: WeatherData | null
      season?: string
      history?: { role: 'user' | 'assistant'; content: string }[]
    },
  ) =>
    j<AskResponse>('/api/ask', {
      method: 'POST',
      body: JSON.stringify({
        question,
        weather: context?.weather ?? undefined,
        season: context?.season,
        history: context?.history,
      }),
    }, true),

  getWishlist: () => j<{ entries: WishlistEntry[] }>('/api/wishlist'),

  createWishlist: (body: { name: string; category?: string; expectedPrice?: number; notes?: string }) =>
    j<{ entry: WishlistEntry }>('/api/wishlist', { method: 'POST', body: JSON.stringify(body) }),

  deleteWishlist: (id: string) => j<{ ok: boolean }>(`/api/wishlist/${id}`, { method: 'DELETE' }),
}

export interface AskResponse {
  answer: string
  followUps: string[]
  source: 'ai' | 'local'
  items: Pick<ClothingItem, 'id' | 'name' | 'imageData' | 'category' | 'color'>[]
}

export interface RecognizeResult {
  name: string | null
  category: string | null
  color: string | null
  pattern: string | null
  material: string | null
  seasons: string[]
  occasions: string[]
}

/** 客户端图片压缩：最长边 720px，JPEG 0.72，输出 dataURL */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const MAX = 720
        let { width, height } = img
        if (width > height && width > MAX) {
          height = Math.round((height * MAX) / width)
          width = MAX
        } else if (height > MAX) {
          width = Math.round((width * MAX) / height)
          height = MAX
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas 不可用'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      }
      img.onerror = () => reject(new Error('图片读取失败'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}
