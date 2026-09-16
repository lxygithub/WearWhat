// WearWhat 共享类型定义

export type CategoryKey = 'top' | 'pants' | 'skirt' | 'outer' | 'shoes' | 'bag' | 'accessory'
export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter' | 'all'
export type OccasionKey = 'commute' | 'casual' | 'sport' | 'date' | 'formal' | 'home'
export type StorageStatus = 'wearing' | 'stored' | 'laundry' | 'repair' | 'discarded'

export interface WWUser {
  id: string
  email: string
  name: string | null
}

export interface ClothingItem {
  id: string
  name: string | null
  category: string
  color: string | null
  pattern: string | null
  material: string | null
  seasons: string // JSON 数组字符串
  occasions: string // JSON 数组字符串
  brand: string | null
  size: string | null
  price: number | null
  purchaseDate: string | null
  storageStatus: string
  storageLocation: string | null
  wearCount: number
  lastWornAt: string | null
  imageData: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface OutfitRecord {
  id: string
  date: string // YYYY-MM-DD
  occasion: string | null
  weather: string | null
  notes: string | null
  source: string
  createdAt: string
  items: ClothingItem[]
}

export interface WeatherData {
  city: string
  temp: number
  apparent: number
  condition: string
  icon: string
  windSpeed: number
  humidity: number
  precipProb: number
  tempMax: number
  tempMin: number
}

export interface RecOutfit {
  key: string
  items: ClothingItem[]
  score: number
  reason: string
  styleTags: string[]
}

export interface RecommendResponse {
  outfits: RecOutfit[]
  weather: WeatherData | null
  season: string
  message?: string
}

export interface StatsData {
  totalItems: number
  activeItems: number
  totalValue: number
  wornIn30d: number
  utilization: number
  topWorn: ClothingItem[]
  mostIdle: ClothingItem[]
  colorDist: { name: string; count: number }[]
  categoryDist: { category: string; count: number }[]
  wearLast30: { date: string; count: number }[]
}

export interface WishlistEntry {
  id: string
  name: string
  category: string | null
  expectedPrice: number | null
  priority: number
  notes: string | null
  createdAt: string
}

export function parseList(s: string | null | undefined): string[] {
  if (!s) return []
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function currentSeason(): Exclude<SeasonKey, 'all'> {
  const m = new Date().getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}
