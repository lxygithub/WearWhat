// WearWhat API 客户端（前端用，仅相对路径）

import type {
  ClothingItem,
  OutfitRecord,
  RecommendResponse,
  StatsData,
  WeatherData,
  WishlistEntry,
} from './types'

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = {}
  }
  if (!res.ok) {
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
    }),

  recommend: (occasion: string, location?: { lat: number; lon: number; city: string }) =>
    j<RecommendResponse>('/api/outfits/recommend', {
      method: 'POST',
      body: JSON.stringify({
        occasion,
        lat: location?.lat,
        lon: location?.lon,
        city: location?.city,
      }),
    }),

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

  search: (q: string) => j<{ items: ClothingItem[]; hint: string }>(`/api/search?q=${encodeURIComponent(q)}`),

  weather: (lat: number, lon: number, city: string) =>
    j<{ weather: WeatherData }>(`/api/weather?lat=${lat}&lon=${lon}&city=${encodeURIComponent(city)}`),

  getWishlist: () => j<{ entries: WishlistEntry[] }>('/api/wishlist'),

  createWishlist: (body: { name: string; category?: string; expectedPrice?: number; notes?: string }) =>
    j<{ entry: WishlistEntry }>('/api/wishlist', { method: 'POST', body: JSON.stringify(body) }),

  deleteWishlist: (id: string) => j<{ ok: boolean }>(`/api/wishlist/${id}`, { method: 'DELETE' }),
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
