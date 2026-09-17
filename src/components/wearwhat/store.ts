// WearWhat 全局状态（zustand）

import { create } from 'zustand'
import { api } from './api'
import { CITIES } from './constants'
import type {
  ClothingItem,
  OccasionKey,
  OutfitRecord,
  SeasonKey,
  StatsData,
  WeatherData,
  WishlistEntry,
  WWUser,
} from './types'

export type Tab = 'home' | 'closet' | 'calendar' | 'profile'

export type Sheet =
  | { type: 'form'; item: ClothingItem | null } // null = 新增
  | { type: 'detail'; item: ClothingItem }
  | { type: 'recommend'; occasion?: OccasionKey }
  | { type: 'day'; date: string }
  | { type: 'ask' } // 衣橱问答
  | null

const CITY_KEY = 'wearwhat.city'

interface WWStore {
  ready: boolean
  tab: Tab
  user: WWUser | null
  authChecked: boolean
  items: ClothingItem[]
  itemsLoading: boolean
  outfits: OutfitRecord[]
  outfitsLoading: boolean
  stats: StatsData | null
  wishlist: WishlistEntry[]
  weather: WeatherData | null
  weatherLoading: boolean
  season: SeasonKey
  city: string

  sheet: Sheet
  toastHint: string | null

  setTab: (t: Tab) => void
  openSheet: (s: Sheet) => void
  closeSheet: () => void

  setUser: (u: WWUser | null) => void
  resetData: () => void

  init: () => Promise<void>
  loadItems: () => Promise<void>
  loadOutfits: () => Promise<void>
  loadStats: () => Promise<void>
  loadWishlist: () => Promise<void>
  loadWeather: (city?: string) => Promise<void>
  setCity: (city: string) => Promise<void>
}

function detectSeason(): SeasonKey {
  const m = new Date().getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}

export function currentCity(): string {
  if (typeof window === 'undefined') return CITIES[0].name
  return localStorage.getItem(CITY_KEY) || CITIES[0].name
}

export const useWW = create<WWStore>((set, get) => ({
  ready: false,
  tab: 'home',
  user: null,
  authChecked: false,
  items: [],
  itemsLoading: false,
  outfits: [],
  outfitsLoading: false,
  stats: null,
  wishlist: [],
  weather: null,
  weatherLoading: false,
  season: detectSeason(),
  city: CITIES[0].name,

  sheet: null,
  toastHint: null,

  setTab: (t) => set({ tab: t }),
  openSheet: (s) => set({ sheet: s }),
  closeSheet: () => set({ sheet: null }),

  setUser: (u) => set({ user: u }),

  // 登出 / 会话过期时清空本地数据，回到登录前状态
  resetData: () =>
    set({
      ready: false,
      tab: 'home',
      items: [],
      outfits: [],
      stats: null,
      wishlist: [],
      weather: null,
      sheet: null,
    }),

  init: async () => {
    const city = currentCity()
    set({ city })
    await Promise.allSettled([
      get().loadItems(),
      get().loadOutfits(),
      get().loadStats(),
      get().loadWishlist(),
      get().loadWeather(city),
    ])
    set({ ready: true })
  },

  loadItems: async () => {
    set({ itemsLoading: true })
    try {
      const { items } = await api.getItems()
      set({ items })
    } finally {
      set({ itemsLoading: false })
    }
  },

  loadOutfits: async () => {
    set({ outfitsLoading: true })
    try {
      const { outfits } = await api.getOutfits()
      set({ outfits })
    } finally {
      set({ outfitsLoading: false })
    }
  },

  loadStats: async () => {
    try {
      const { stats } = await api.stats()
      set({ stats })
    } catch {
      /* 静默 */
    }
  },

  loadWishlist: async () => {
    try {
      const { entries } = await api.getWishlist()
      set({ wishlist: entries })
    } catch {
      /* 静默 */
    }
  },

  loadWeather: async (city?: string) => {
    const c = city || get().city
    const meta = CITIES.find((x) => x.name === c)
    if (!meta) return
    set({ weatherLoading: true })
    try {
      const { weather } = await api.weather(meta.lat, meta.lon, meta.name)
      set({ weather, city: meta.name })
    } catch {
      set({ weather: null })
    } finally {
      set({ weatherLoading: false })
    }
  },

  setCity: async (city) => {
    localStorage.setItem(CITY_KEY, city)
    set({ city })
    await get().loadWeather(city)
  },
}))
