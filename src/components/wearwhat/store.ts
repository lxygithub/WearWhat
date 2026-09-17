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

// 本地快照：数据在内网 PostgreSQL（经 SQL Gateway，单程约 2.5s），而首屏要等
// items/outfits/stats/wishlist 全部 settle 才解除加载态。这里把上次的结果缓存到
// localStorage，冷启动先渲染快照（立刻可交互），随后后台刷新覆盖。
// 快照只在已登录时使用；登出/会话过期（401）会清空。
const SNAPSHOT_KEY = 'wearwhat.snapshot.v1'

type Snapshot = {
  items: ClothingItem[]
  outfits: OutfitRecord[]
  stats: StatsData | null
  wishlist: WishlistEntry[]
  cachedAt: number
}

function readSnapshot(): Snapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Snapshot
    return s && typeof s.cachedAt === 'number' ? s : null
  } catch {
    return null
  }
}

function writeSnapshot(s: {
  items: ClothingItem[]
  outfits: OutfitRecord[]
  stats: StatsData | null
  wishlist: WishlistEntry[]
}) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ ...s, cachedAt: Date.now() }))
  } catch {
    /* 隐私模式/配额满：忽略，不影响功能 */
  }
}

function clearSnapshot() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(SNAPSHOT_KEY)
  } catch {}
}

// 登录态缓存：/api/auth/me 也要走一次网关往返（≈2.5s），此前每次冷启动都要先看
// 「正在打开你的衣橱…」。这里记住上次的登录结果，挂载时直接进主界面，后台再校验；
// 校验失败（401/异常）由 AuthGate 与 401 处理器清空并回到登录页。
const AUTH_KEY = 'wearwhat.auth.v1'

export function readAuthCache(): WWUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as WWUser) : null
  } catch {
    return null
  }
}

export function writeAuthCache(u: WWUser | null) {
  if (typeof window === 'undefined') return
  try {
    if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u))
    else localStorage.removeItem(AUTH_KEY)
  } catch {}
}

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
  resetData: () => {
    clearSnapshot()
    writeAuthCache(null)
    set({
      ready: false,
      tab: 'home',
      items: [],
      outfits: [],
      stats: null,
      wishlist: [],
      weather: null,
      sheet: null,
    })
  },

  init: async () => {
    const city = currentCity()
    set({ city })
    // 先用本地快照出内容：有快照就不必等网关往返（无快照时下面的 ready 仍在全部
    // settle 后置真，行为与之前一致）
    const snap = readSnapshot()
    if (snap) {
      set({
        items: snap.items ?? [],
        outfits: snap.outfits ?? [],
        stats: snap.stats ?? null,
        wishlist: snap.wishlist ?? [],
        ready: true,
      })
    }
    await Promise.allSettled([
      get().loadItems(),
      get().loadOutfits(),
      get().loadStats(),
      get().loadWishlist(),
      get().loadWeather(city),
    ])
    set({ ready: true })
    const { items, outfits, stats, wishlist } = get()
    writeSnapshot({ items, outfits, stats, wishlist })
  },

  loadItems: async () => {
    set({ itemsLoading: true })
    try {
      const { items } = await api.getItems()
      set({ items })
      const s = get()
      writeSnapshot({ items, outfits: s.outfits, stats: s.stats, wishlist: s.wishlist })
    } finally {
      set({ itemsLoading: false })
    }
  },

  loadOutfits: async () => {
    set({ outfitsLoading: true })
    try {
      const { outfits } = await api.getOutfits()
      set({ outfits })
      const s = get()
      writeSnapshot({ items: s.items, outfits, stats: s.stats, wishlist: s.wishlist })
    } finally {
      set({ outfitsLoading: false })
    }
  },

  loadStats: async () => {
    try {
      const { stats } = await api.stats()
      set({ stats })
      const s = get()
      writeSnapshot({ items: s.items, outfits: s.outfits, stats, wishlist: s.wishlist })
    } catch {
      /* 静默 */
    }
  },

  loadWishlist: async () => {
    try {
      const { entries } = await api.getWishlist()
      set({ wishlist: entries })
      const s = get()
      writeSnapshot({ items: s.items, outfits: s.outfits, stats: s.stats, wishlist: entries })
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
